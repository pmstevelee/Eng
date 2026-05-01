import 'server-only'
import { prisma } from '@/lib/prisma/client'
import { Plan, BillingCycle, PaymentStatus, PaymentType, SubscriptionStatus } from '@/generated/prisma'
import { payWithBillingKey, PortOneServerError } from '@/lib/portone/server'
import { PLANS, STUDENT_OVERAGE, getOverageAmount } from '@/lib/pricing'
import {
  sendPaymentSuccess,
  sendPaymentFailed,
} from '@/lib/notifications/billing'

type SubscriptionWithRelations = {
  id: string
  academyId: string
  plan: Plan
  billingCycle: BillingCycle
  currentPeriodStart: Date
  currentPeriodEnd: Date
  billingKey: {
    portoneBillingKey: string
    cardCompany: string | null
    cardNumberMasked: string | null
  } | null
  academy: {
    id: string
    businessName: string | null
    name: string
  }
}

interface AmountBreakdown {
  base: number
  studentOverage: number
  storageOverage: number
  total: number
}

function calculateAmount(
  plan: Plan,
  billingCycle: BillingCycle,
  studentCount: number,
  storageUsedMb: number,
): AmountBreakdown {
  const planConfig = PLANS[plan]

  const base =
    billingCycle === BillingCycle.YEARLY ? planConfig.yearlyPrice : planConfig.monthlyPrice

  // 학생 수 초과분 (STANDARD만 유료)
  const studentOverageCount =
    planConfig.studentLimit !== -1
      ? getOverageAmount(studentCount, planConfig.studentLimit)
      : 0
  const studentOverage = studentOverageCount * STUDENT_OVERAGE[plan].perStudent

  // 스토리지 초과분 (10GB 단위)
  const storageOverageMb =
    planConfig.storageLimitMb !== -1
      ? getOverageAmount(storageUsedMb, planConfig.storageLimitMb)
      : 0
  const storageOverageUnits = Math.floor(storageOverageMb / 10240)
  const storageOverage = storageOverageUnits * planConfig.storageOveragePrice

  return {
    base,
    studentOverage,
    storageOverage,
    total: base + studentOverage + storageOverage,
  }
}

export async function processRecurringPayment(
  subscription: SubscriptionWithRelations,
): Promise<{ success: boolean; paymentId?: string; error?: string }> {
  if (!subscription.billingKey) {
    return { success: false, error: '빌링키가 없습니다' }
  }

  const { currentPeriodStart, currentPeriodEnd } = subscription

  // ── 멱등성: 같은 기간에 이미 PAID 또는 PENDING 결제가 존재하면 스킵 ──
  const existing = await prisma.payment.findFirst({
    where: {
      subscriptionId: subscription.id,
      type: PaymentType.SUBSCRIPTION,
      status: { in: [PaymentStatus.PAID, PaymentStatus.PENDING] },
      createdAt: { gte: currentPeriodStart },
    },
  })

  if (existing) {
    return { success: true, paymentId: existing.paymentId }
  }

  // ── 현재 기간 사용량 조회 (없으면 0으로 처리) ──
  const usageRecord = await prisma.usageRecord.findFirst({
    where: {
      subscriptionId: subscription.id,
      periodStart: { lte: currentPeriodStart },
      periodEnd: { gte: currentPeriodStart },
    },
    orderBy: { periodStart: 'desc' },
  })

  const studentCount = usageRecord?.studentCount ?? 0
  const storageUsedMb = usageRecord?.storageUsedMb ?? 0

  const breakdown = calculateAmount(
    subscription.plan,
    subscription.billingCycle,
    studentCount,
    storageUsedMb,
  )

  if (breakdown.total === 0) {
    // FREE 플랜은 정기결제 불필요
    return { success: true }
  }

  const portonePaymentId = crypto.randomUUID()
  const academyName = subscription.academy.businessName ?? subscription.academy.name

  const nextPeriodStart = currentPeriodEnd
  const nextPeriodEnd = new Date(currentPeriodEnd)
  if (subscription.billingCycle === BillingCycle.YEARLY) {
    nextPeriodEnd.setFullYear(nextPeriodEnd.getFullYear() + 1)
  } else {
    nextPeriodEnd.setMonth(nextPeriodEnd.getMonth() + 1)
  }

  // ── Payment 레코드 생성 (PENDING) ──
  const payment = await prisma.payment.create({
    data: {
      subscriptionId: subscription.id,
      academyId: subscription.academyId,
      paymentId: portonePaymentId,
      type: PaymentType.SUBSCRIPTION,
      amount: breakdown.total,
      status: PaymentStatus.PENDING,
    },
  })

  try {
    const result = await payWithBillingKey({
      paymentId: portonePaymentId,
      billingKey: subscription.billingKey.portoneBillingKey,
      orderName: `위고업잉글리시 ${subscription.plan} 정기결제`,
      amount: breakdown.total,
      customer: {
        fullName: academyName,
        customerId: subscription.academyId,
      },
      customData: {
        subscriptionId: subscription.id,
        periodStart: currentPeriodStart.toISOString(),
        periodEnd: currentPeriodEnd.toISOString(),
        breakdown,
      },
    })

    // ── 결제 성공 ──
    await prisma.$transaction([
      prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.PAID,
          pgProvider: result.channel?.pgProvider ?? null,
          pgTxId: result.transactionId ?? null,
          receiptUrl: result.receiptUrl ?? null,
          paidAt: new Date(),
        },
      }),
      prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          currentPeriodStart: nextPeriodStart,
          currentPeriodEnd: nextPeriodEnd,
          status: SubscriptionStatus.ACTIVE,
        },
      }),
    ])

    const paidPayment = await prisma.payment.findUnique({ where: { id: payment.id } })
    if (paidPayment) {
      await sendPaymentSuccess(subscription.academyId, paidPayment)
    }

    return { success: true, paymentId: portonePaymentId }
  } catch (err) {
    const failureReason =
      err instanceof PortOneServerError ? err.message : '알 수 없는 오류'

    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: PaymentStatus.FAILED,
        failureReason,
      },
    })

    // ── 24시간 후 재시도 예약 ──
    const retryAt = new Date(Date.now() + 24 * 60 * 60 * 1000)
    await prisma.paymentSchedule.create({
      data: {
        subscriptionId: subscription.id,
        scheduledAt: retryAt,
        type: PaymentType.SUBSCRIPTION,
        amount: breakdown.total,
        retryCount: 0,
        metadata: { originalPaymentId: payment.id },
      },
    })

    const failedPayment = await prisma.payment.findUnique({ where: { id: payment.id } })
    if (failedPayment) {
      await sendPaymentFailed(subscription.academyId, failedPayment, retryAt)
    }

    return { success: false, paymentId: portonePaymentId, error: failureReason }
  }
}
