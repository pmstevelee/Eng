import 'server-only'
import { prisma } from '@/lib/prisma/client'
import {
  PaymentStatus,
  PaymentType,
  ScheduleStatus,
  SubscriptionStatus,
  Plan,
} from '@/generated/prisma'
import { payWithBillingKey, PortOneServerError } from '@/lib/portone/server'
import {
  sendPaymentFailed,
  sendDowngradeWarning,
  sendDowngradeExecuted,
} from '@/lib/notifications/billing'

const MAX_RETRY_COUNT = 3
const PAST_DUE_GRACE_DAYS = 7
const DOWNGRADE_WARNING_DAYS = 3

type PendingSchedule = {
  id: string
  subscriptionId: string
  amount: number
  type: PaymentType
  retryCount: number
  metadata: Record<string, unknown> | null
  subscription: {
    id: string
    academyId: string
    plan: Plan
    billingKey: {
      portoneBillingKey: string
    } | null
    academy: {
      id: string
      businessName: string | null
      name: string
    }
  }
}

export async function processRetry(schedule: PendingSchedule): Promise<void> {
  const { subscription } = schedule

  if (!subscription.billingKey) {
    await prisma.paymentSchedule.update({
      where: { id: schedule.id },
      data: { status: ScheduleStatus.FAILED },
    })
    return
  }

  if (schedule.retryCount >= MAX_RETRY_COUNT) {
    // 최대 재시도 초과 → PAST_DUE 전환 + 경고 알림
    await prisma.$transaction([
      prisma.paymentSchedule.update({
        where: { id: schedule.id },
        data: { status: ScheduleStatus.FAILED },
      }),
      prisma.subscription.update({
        where: { id: subscription.id },
        data: { status: SubscriptionStatus.PAST_DUE },
      }),
    ])

    await sendDowngradeWarning(subscription.academyId, DOWNGRADE_WARNING_DAYS)
    return
  }

  const portonePaymentId = crypto.randomUUID()
  const academyName = subscription.academy.businessName ?? subscription.academy.name

  const payment = await prisma.payment.create({
    data: {
      subscriptionId: subscription.id,
      academyId: subscription.academyId,
      paymentId: portonePaymentId,
      type: schedule.type,
      amount: schedule.amount,
      status: PaymentStatus.PENDING,
    },
  })

  try {
    await payWithBillingKey({
      paymentId: portonePaymentId,
      billingKey: subscription.billingKey.portoneBillingKey,
      orderName: `위고업잉글리시 ${subscription.plan} 정기결제 (재시도 ${schedule.retryCount + 1}회)`,
      amount: schedule.amount,
      customer: {
        fullName: academyName,
        customerId: subscription.academyId,
      },
      customData: {
        subscriptionId: subscription.id,
        retryCount: schedule.retryCount + 1,
        originalScheduleId: schedule.id,
      },
    })

    await prisma.$transaction([
      prisma.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.PAID, paidAt: new Date() },
      }),
      prisma.paymentSchedule.update({
        where: { id: schedule.id },
        data: { status: ScheduleStatus.EXECUTED },
      }),
      prisma.subscription.update({
        where: { id: subscription.id },
        data: { status: SubscriptionStatus.ACTIVE },
      }),
    ])
  } catch (err) {
    const failureReason =
      err instanceof PortOneServerError ? err.message : '알 수 없는 오류'

    const nextRetryAt = new Date(Date.now() + 24 * 60 * 60 * 1000)

    await prisma.$transaction([
      prisma.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.FAILED, failureReason },
      }),
      prisma.paymentSchedule.update({
        where: { id: schedule.id },
        data: {
          status: ScheduleStatus.FAILED,
          retryCount: { increment: 1 },
        },
      }),
    ])

    // 다음 재시도 예약
    await prisma.paymentSchedule.create({
      data: {
        subscriptionId: subscription.id,
        scheduledAt: nextRetryAt,
        type: schedule.type,
        amount: schedule.amount,
        retryCount: schedule.retryCount + 1,
        metadata: { previousScheduleId: schedule.id },
      },
    })

    const failedPayment = await prisma.payment.findUnique({ where: { id: payment.id } })
    if (failedPayment) {
      await sendPaymentFailed(subscription.academyId, failedPayment, nextRetryAt)
    }
  }
}

/** PAST_DUE 상태가 7일 경과한 구독을 FREE로 다운그레이드 */
export async function downgradeExpiredSubscriptions(): Promise<{
  downgraded: number
  academyIds: string[]
}> {
  const cutoff = new Date(Date.now() - PAST_DUE_GRACE_DAYS * 24 * 60 * 60 * 1000)

  const expiredSubscriptions = await prisma.subscription.findMany({
    where: {
      status: SubscriptionStatus.PAST_DUE,
      updatedAt: { lte: cutoff },
    },
    select: { id: true, academyId: true },
  })

  if (expiredSubscriptions.length === 0) {
    return { downgraded: 0, academyIds: [] }
  }

  const ids = expiredSubscriptions.map((s) => s.id)
  const academyIds = expiredSubscriptions.map((s) => s.academyId)

  await prisma.subscription.updateMany({
    where: { id: { in: ids } },
    data: { status: SubscriptionStatus.EXPIRED, plan: Plan.FREE },
  })

  for (const academyId of academyIds) {
    await sendDowngradeExecuted(academyId)
  }

  return { downgraded: expiredSubscriptions.length, academyIds }
}
