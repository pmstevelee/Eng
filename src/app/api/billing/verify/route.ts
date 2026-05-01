import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma/client'
import { payWithBillingKey, getBillingKeyInfo, cancelPayment, PortOneServerError } from '@/lib/portone/server'
import { PLAN_DISPLAY_NAMES, BILLING_CYCLE_DISPLAY_NAMES } from '@/lib/pricing'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id, isDeleted: false },
      select: { id: true, role: true, academyId: true, name: true, email: true, phone: true },
    })

    if (!dbUser || dbUser.role !== 'ACADEMY_OWNER') {
      return NextResponse.json({ error: '학원장만 결제를 검증할 수 있습니다' }, { status: 403 })
    }

    const body = await req.json()
    const { paymentId, billingKey } = body as { paymentId: string; billingKey: string }

    if (!paymentId || !billingKey) {
      return NextResponse.json({ error: 'paymentId와 billingKey가 필요합니다' }, { status: 400 })
    }

    // DB에서 Payment 조회 (멱등성 보장)
    const pendingPayment = await prisma.payment.findUnique({
      where: { paymentId },
      include: { subscription: true },
    })

    if (!pendingPayment) {
      return NextResponse.json({ error: '결제 정보를 찾을 수 없습니다' }, { status: 404 })
    }

    // 소유권 검증
    if (pendingPayment.academyId !== dbUser.academyId) {
      return NextResponse.json({ error: '권한이 없습니다' }, { status: 403 })
    }

    // 이미 처리된 결제 (멱등성)
    if (pendingPayment.status === 'PAID') {
      return NextResponse.json({ success: true, alreadyPaid: true })
    }

    if (pendingPayment.status !== 'PENDING') {
      return NextResponse.json(
        { error: `결제를 진행할 수 없는 상태입니다: ${pendingPayment.status}` },
        { status: 409 },
      )
    }

    // 빌링키 정보 조회 (유효성 확인)
    try {
      const billingKeyInfo = await getBillingKeyInfo(billingKey)
      if (billingKeyInfo.status !== 'ISSUED') {
        return NextResponse.json({ error: '유효하지 않은 빌링키입니다' }, { status: 400 })
      }
    } catch (err) {
      if (err instanceof PortOneServerError) {
        return NextResponse.json({ error: `빌링키 확인 실패: ${err.message}` }, { status: 400 })
      }
      throw err
    }

    const subscription = pendingPayment.subscription
    const orderName = `위고업잉글리시 ${PLAN_DISPLAY_NAMES[subscription.plan]} ${BILLING_CYCLE_DISPLAY_NAMES[subscription.billingCycle]} 구독`

    // 실제 결제 실행 (paymentId를 portone charge ID로 재사용)
    let portonePayment
    const chargePaymentId = crypto.randomUUID()

    try {
      portonePayment = await payWithBillingKey({
        paymentId: chargePaymentId,
        billingKey,
        orderName,
        amount: pendingPayment.amount,
        customer: {
          customerId: dbUser.academyId ?? undefined,
          fullName: dbUser.name,
          email: dbUser.email,
          phoneNumber: dbUser.phone ?? undefined,
        },
        customData: {
          academyId: dbUser.academyId,
          plan: subscription.plan,
          billingCycle: subscription.billingCycle,
        },
      })
    } catch (err) {
      // 결제 실패 시 Payment 상태 업데이트
      await prisma.payment.update({
        where: { paymentId },
        data: {
          status: 'FAILED',
          failureReason: err instanceof Error ? err.message : '결제 실패',
        },
      })

      return NextResponse.json(
        { error: err instanceof PortOneServerError ? err.message : '결제 처리 중 오류가 발생했습니다' },
        { status: 422 },
      )
    }

    // 결제 금액 검증 (조작 방지)
    if (portonePayment.amount.total !== pendingPayment.amount) {
      // 금액 불일치 → 즉시 취소
      await cancelPayment(chargePaymentId, '결제 금액 불일치 - 시스템 자동 취소').catch(console.error)

      await prisma.payment.update({
        where: { paymentId },
        data: { status: 'FAILED', failureReason: '결제 금액 불일치' },
      })

      return NextResponse.json({ error: '결제 금액이 일치하지 않습니다' }, { status: 422 })
    }

    // 구독 기간 계산
    const now = new Date()
    const periodEnd = new Date(now)
    if (subscription.billingCycle === 'YEARLY') {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1)
    } else {
      periodEnd.setMonth(periodEnd.getMonth() + 1)
    }

    // 트랜잭션: Payment 업데이트 + BillingKey 저장 + Subscription 활성화
    await prisma.$transaction(async (tx) => {
      // Payment 업데이트 (chargePaymentId로 portone TX 추적)
      await tx.payment.update({
        where: { paymentId },
        data: {
          status: 'PAID',
          pgProvider: portonePayment.channel?.pgProvider ?? 'INICIS',
          pgTxId: portonePayment.transactionId ?? chargePaymentId,
          receiptUrl: portonePayment.receiptUrl ?? null,
          paidAt: portonePayment.paidAt ? new Date(portonePayment.paidAt) : now,
        },
      })

      // BillingKey 저장 (upsert: 기존 있으면 교체)
      const cardInfo = portonePayment.method?.card
      await tx.billingKey.upsert({
        where: { subscriptionId: subscription.id },
        create: {
          subscriptionId: subscription.id,
          portoneBillingKey: billingKey,
          cardCompany: cardInfo?.brand ?? cardInfo?.publisher ?? null,
          cardNumberMasked: cardInfo?.number ?? null,
          issuedAt: now,
        },
        update: {
          portoneBillingKey: billingKey,
          cardCompany: cardInfo?.brand ?? cardInfo?.publisher ?? null,
          cardNumberMasked: cardInfo?.number ?? null,
          issuedAt: now,
        },
      })

      // Subscription ACTIVE 전환
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

    return NextResponse.json({
      success: true,
      plan: subscription.plan,
      billingCycle: subscription.billingCycle,
      currentPeriodEnd: periodEnd.toISOString(),
    })
  } catch (err) {
    console.error('[billing/verify]', err)
    return NextResponse.json({ error: '서버 오류가 발생했습니다' }, { status: 500 })
  }
}
