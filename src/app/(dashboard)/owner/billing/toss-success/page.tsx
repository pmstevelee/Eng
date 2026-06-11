import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma/client'
import { issueBillingKey, payWithBillingKey, cancelPayment, TossServerError } from '@/lib/tosspayments/server'
import { PLAN_DISPLAY_NAMES, BILLING_CYCLE_DISPLAY_NAMES } from '@/lib/pricing'

interface PageProps {
  searchParams: Promise<{ customerKey?: string; authKey?: string }>
}

export default async function TossSuccessPage({ searchParams }: PageProps) {
  const params = await searchParams
  const { customerKey, authKey } = params

  if (!customerKey || !authKey) {
    redirect('/owner/billing/plans?error=missing_params')
  }

  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) redirect('/login')

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id, isDeleted: false },
    select: { id: true, role: true, academyId: true, name: true, email: true },
  })

  if (!dbUser || dbUser.role !== 'ACADEMY_OWNER' || !dbUser.academyId) {
    redirect('/owner/billing/plans?error=unauthorized')
  }

  // customerKey는 academyId와 일치해야 함
  if (customerKey !== dbUser.academyId) {
    redirect('/owner/billing/toss-fail?code=INVALID_CUSTOMER&message=잘못된+고객+키입니다')
  }

  // 진행 중인 TRIAL 구독 조회
  const subscription = await prisma.subscription.findUnique({
    where: { academyId: dbUser.academyId },
  })

  if (!subscription || subscription.status !== 'TRIAL') {
    redirect('/owner/billing/plans?error=no_pending_subscription')
  }

  // 진행 중인 PENDING 결제 조회
  const pendingPayment = await prisma.payment.findFirst({
    where: {
      subscriptionId: subscription.id,
      status: 'PENDING',
    },
    orderBy: { createdAt: 'desc' },
  })

  if (!pendingPayment) {
    redirect('/owner/billing/plans?error=no_pending_payment')
  }

  try {
    // 1. 빌링키 발급
    const billingInfo = await issueBillingKey(authKey, customerKey)
    const tossBillingKey = billingInfo.billingKey

    // 2. 즉시 결제 승인
    const orderId = pendingPayment.paymentId
    const orderName = `위고업잉글리시 ${PLAN_DISPLAY_NAMES[subscription.plan]} ${BILLING_CYCLE_DISPLAY_NAMES[subscription.billingCycle]} 구독`

    const paymentResult = await payWithBillingKey({
      billingKey: tossBillingKey,
      customerKey,
      orderId,
      orderName,
      amount: pendingPayment.amount,
      customerEmail: dbUser.email,
      customerName: dbUser.name,
    })

    // 3. 결제 금액 검증
    if (paymentResult.totalAmount !== pendingPayment.amount) {
      await cancelPaymentSafe(paymentResult.paymentKey, '결제 금액 불일치 - 시스템 자동 취소')
      await prisma.payment.update({
        where: { id: pendingPayment.id },
        data: { status: 'FAILED', failureReason: '결제 금액 불일치' },
      })
      redirect('/owner/billing/toss-fail?code=AMOUNT_MISMATCH&message=결제+금액이+일치하지+않습니다')
    }

    // 4. 구독 기간 계산
    const now = new Date()
    const periodEnd = new Date(now)
    if (subscription.billingCycle === 'YEARLY') {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1)
    } else {
      periodEnd.setMonth(periodEnd.getMonth() + 1)
    }

    // 5. DB 트랜잭션: 결제 완료 + 빌링키 저장 + 구독 활성화
    await prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: pendingPayment.id },
        data: {
          status: 'PAID',
          pgProvider: 'TOSSPAYMENTS',
          pgTxId: paymentResult.paymentKey,
          receiptUrl: paymentResult.receipt?.url ?? null,
          paidAt: paymentResult.approvedAt ? new Date(paymentResult.approvedAt) : now,
        },
      })

      const cardInfo = paymentResult.card
      await tx.billingKey.upsert({
        where: { subscriptionId: subscription.id },
        create: {
          subscriptionId: subscription.id,
          portoneBillingKey: tossBillingKey,
          cardCompany: billingInfo.cardCompany ?? null,
          cardNumberMasked: billingInfo.cardNumber ?? cardInfo?.number ?? null,
          issuedAt: now,
        },
        update: {
          portoneBillingKey: tossBillingKey,
          cardCompany: billingInfo.cardCompany ?? null,
          cardNumberMasked: billingInfo.cardNumber ?? cardInfo?.number ?? null,
          issuedAt: now,
        },
      })

      await tx.subscription.update({
        where: { id: subscription.id },
        data: {
          status: 'ACTIVE',
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          cancelAtPeriodEnd: false,
        },
      })
    })

    redirect(`/owner/billing/success?plan=${subscription.plan}&cycle=${subscription.billingCycle}`)
  } catch (err) {
    if (err instanceof TossServerError) {
      await prisma.payment.update({
        where: { id: pendingPayment.id },
        data: { status: 'FAILED', failureReason: err.message },
      }).catch(() => {})

      const code = encodeURIComponent(err.code ?? 'UNKNOWN')
      const message = encodeURIComponent(err.message)
      redirect(`/owner/billing/toss-fail?code=${code}&message=${message}`)
    }

    // Next.js redirect는 내부적으로 throw이므로 그대로 전파
    throw err
  }
}

async function cancelPaymentSafe(paymentKey: string, reason: string) {
  try {
    await cancelPayment(paymentKey, reason)
  } catch {
    console.error('[toss-success] 결제 취소 실패:', paymentKey)
  }
}
