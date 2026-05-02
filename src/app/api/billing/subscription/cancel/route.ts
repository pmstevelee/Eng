import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma/client'
import { cancelPayment, deleteBillingKey, PortOneServerError } from '@/lib/portone/server'
import { PLANS } from '@/lib/pricing'
import type { Plan } from '@/generated/prisma'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id, isDeleted: false },
      select: { id: true, role: true, academyId: true },
    })

    if (!dbUser || dbUser.role !== 'ACADEMY_OWNER') {
      return NextResponse.json({ error: '학원장만 구독을 해지할 수 있습니다' }, { status: 403 })
    }

    if (!dbUser.academyId) {
      return NextResponse.json({ error: '학원 정보가 없습니다' }, { status: 400 })
    }

    const body = await req.json()
    const { reason, immediate = false } = body as { reason: string; immediate?: boolean }

    if (!reason || reason.trim().length === 0) {
      return NextResponse.json({ error: '해지 사유를 입력해 주세요' }, { status: 400 })
    }

    const subscription = await prisma.subscription.findUnique({
      where: { academyId: dbUser.academyId },
      include: { billingKey: true },
    })

    if (!subscription) {
      return NextResponse.json({ error: '구독 정보가 없습니다' }, { status: 404 })
    }

    if (subscription.status === 'CANCELLED' || subscription.status === 'CANCELED') {
      return NextResponse.json({ error: '이미 해지된 구독입니다' }, { status: 409 })
    }

    if (!immediate) {
      // 현재 주기 끝까지 사용 가능하도록 예약 해지
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: { cancelAtPeriodEnd: true },
      })

      return NextResponse.json({
        success: true,
        cancelAtPeriodEnd: true,
        currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
        message: `${subscription.currentPeriodEnd.toLocaleDateString('ko-KR')}까지 이용하실 수 있습니다.`,
      })
    }

    // 즉시 해지: 일할 환불 계산
    const now = new Date()
    const nowMidnight = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    )
    const periodEndMidnight = new Date(
      Date.UTC(
        subscription.currentPeriodEnd.getUTCFullYear(),
        subscription.currentPeriodEnd.getUTCMonth(),
        subscription.currentPeriodEnd.getUTCDate(),
      ),
    )

    const remainingDays = Math.max(
      0,
      Math.floor(
        (periodEndMidnight.getTime() - nowMidnight.getTime()) / (1000 * 60 * 60 * 24),
      ),
    )

    const planConfig = PLANS[subscription.plan as Plan]
    const monthlyPrice = planConfig.monthlyPrice
    const refundAmount =
      monthlyPrice > 0 ? Math.floor(monthlyPrice * (remainingDays / 30)) : 0

    // 환불 처리: 가장 최근 PAID SUBSCRIPTION 결제 취소
    let refundPaymentId: string | null = null
    if (refundAmount > 0) {
      const lastPayment = await prisma.payment.findFirst({
        where: {
          subscriptionId: subscription.id,
          type: 'SUBSCRIPTION',
          status: 'PAID',
        },
        orderBy: { paidAt: 'desc' },
      })

      if (lastPayment?.pgTxId) {
        try {
          await cancelPayment(lastPayment.pgTxId, `구독 해지 환불: ${reason}`, refundAmount)
          refundPaymentId = lastPayment.paymentId

          await prisma.payment.update({
            where: { id: lastPayment.id },
            data: {
              status: 'PARTIAL_CANCELED',
              canceledAt: now,
            },
          })
        } catch (err) {
          if (err instanceof PortOneServerError) {
            console.error('[cancel] 환불 실패:', err.message)
            // 환불 실패해도 해지는 진행 (환불은 수동 처리)
          } else {
            throw err
          }
        }
      }
    }

    // 빌링키 삭제
    if (subscription.billingKey) {
      try {
        await deleteBillingKey(subscription.billingKey.portoneBillingKey)
      } catch (err) {
        console.error('[cancel] 빌링키 삭제 실패:', err)
      }
    }

    // 구독 즉시 해지
    await prisma.$transaction(async (tx) => {
      await tx.subscription.update({
        where: { id: subscription.id },
        data: {
          status: 'CANCELED',
          cancelAtPeriodEnd: false,
          currentPeriodEnd: now,
        },
      })

      if (subscription.billingKey) {
        await tx.billingKey.delete({ where: { id: subscription.billingKey.id } })
      }
    })

    return NextResponse.json({
      success: true,
      immediate: true,
      refundAmount,
      refundPaymentId,
      message:
        refundAmount > 0
          ? `구독이 즉시 해지되었습니다. ${refundAmount.toLocaleString('ko-KR')}원이 환불됩니다 (잔여 ${remainingDays}일).`
          : '구독이 즉시 해지되었습니다.',
    })
  } catch (err) {
    console.error('[billing/subscription/cancel]', err)
    return NextResponse.json({ error: '서버 오류가 발생했습니다' }, { status: 500 })
  }
}
