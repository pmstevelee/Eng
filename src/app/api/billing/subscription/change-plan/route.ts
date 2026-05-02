import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma/client'
import { payWithBillingKey, PortOneServerError } from '@/lib/portone/server'
import { PLANS, PLAN_DISPLAY_NAMES } from '@/lib/pricing'
import { Plan, BillingCycle } from '@/generated/prisma'

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
      select: { id: true, role: true, academyId: true, name: true, email: true, phone: true },
    })

    if (!dbUser || dbUser.role !== 'ACADEMY_OWNER') {
      return NextResponse.json({ error: '학원장만 플랜을 변경할 수 있습니다' }, { status: 403 })
    }

    if (!dbUser.academyId) {
      return NextResponse.json({ error: '학원 정보가 없습니다' }, { status: 400 })
    }

    const body = await req.json()
    const { newPlan, newBillingCycle } = body as {
      newPlan: string
      newBillingCycle: string
    }

    if (!Object.values(Plan).includes(newPlan as Plan)) {
      return NextResponse.json({ error: '유효하지 않은 플랜입니다' }, { status: 400 })
    }
    if (!Object.values(BillingCycle).includes(newBillingCycle as BillingCycle)) {
      return NextResponse.json({ error: '유효하지 않은 결제 주기입니다' }, { status: 400 })
    }

    const validNewPlan = newPlan as Plan
    const validNewCycle = newBillingCycle as BillingCycle

    const subscription = await prisma.subscription.findUnique({
      where: { academyId: dbUser.academyId },
      include: { billingKey: true },
    })

    if (!subscription) {
      return NextResponse.json({ error: '구독 정보가 없습니다' }, { status: 404 })
    }

    if (subscription.status !== 'ACTIVE') {
      return NextResponse.json({ error: '활성 구독만 변경할 수 있습니다' }, { status: 409 })
    }

    if (subscription.plan === validNewPlan && subscription.billingCycle === validNewCycle) {
      return NextResponse.json({ error: '현재와 동일한 플랜입니다' }, { status: 400 })
    }

    const currentConfig = PLANS[subscription.plan as Plan]
    const newConfig = PLANS[validNewPlan]

    const currentMonthlyPrice = currentConfig.monthlyPrice
    const newMonthlyPrice = newConfig.monthlyPrice

    const isUpgrade = newMonthlyPrice > currentMonthlyPrice

    if (isUpgrade) {
      // 업그레이드: 차액 일할 계산 후 즉시 결제
      if (!subscription.billingKey) {
        return NextResponse.json({ error: '결제 수단이 없습니다. 카드를 먼저 등록해 주세요.' }, { status: 400 })
      }

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

      const currentDailyRate = currentMonthlyPrice / 30
      const newDailyRate = newMonthlyPrice / 30
      const diffAmount = Math.max(0, Math.floor((newDailyRate - currentDailyRate) * remainingDays))

      const paymentId = crypto.randomUUID()
      const orderName = `위고업잉글리시 ${PLAN_DISPLAY_NAMES[validNewPlan]} 업그레이드 차액`

      const payment = await prisma.payment.create({
        data: {
          subscriptionId: subscription.id,
          academyId: dbUser.academyId,
          paymentId,
          type: 'SUBSCRIPTION',
          amount: diffAmount,
          status: 'PENDING',
        },
      })

      if (diffAmount > 0) {
        try {
          const result = await payWithBillingKey({
            paymentId,
            billingKey: subscription.billingKey.portoneBillingKey,
            orderName,
            amount: diffAmount,
            customer: {
              customerId: dbUser.academyId,
              fullName: dbUser.name,
              email: dbUser.email,
              phoneNumber: dbUser.phone ?? undefined,
            },
            customData: {
              academyId: dbUser.academyId,
              planChange: true,
              fromPlan: subscription.plan,
              toPlan: validNewPlan,
            },
          })

          await prisma.payment.update({
            where: { id: payment.id },
            data: {
              status: 'PAID',
              pgProvider: result.channel?.pgProvider ?? 'INICIS',
              pgTxId: result.transactionId ?? paymentId,
              receiptUrl: result.receiptUrl ?? null,
              paidAt: new Date(),
            },
          })
        } catch (err) {
          await prisma.payment.update({
            where: { id: payment.id },
            data: {
              status: 'FAILED',
              failureReason: err instanceof PortOneServerError ? err.message : '결제 실패',
            },
          })

          return NextResponse.json(
            { error: err instanceof PortOneServerError ? err.message : '업그레이드 결제에 실패했습니다' },
            { status: 422 },
          )
        }
      } else {
        // 차액이 0이면 결제 없이 바로 처리
        await prisma.payment.update({
          where: { id: payment.id },
          data: { status: 'PAID', paidAt: new Date() },
        })
      }

      // 플랜 즉시 업데이트
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          plan: validNewPlan,
          billingCycle: validNewCycle,
          cancelAtPeriodEnd: false,
        },
      })

      return NextResponse.json({
        success: true,
        type: 'UPGRADE',
        newPlan: validNewPlan,
        diffAmount,
        message: diffAmount > 0
          ? `${PLAN_DISPLAY_NAMES[validNewPlan]} 플랜으로 업그레이드되었습니다. 차액 ${diffAmount.toLocaleString('ko-KR')}원이 결제되었습니다.`
          : `${PLAN_DISPLAY_NAMES[validNewPlan]} 플랜으로 업그레이드되었습니다.`,
      })
    } else {
      // 다운그레이드: 다음 결제 주기부터 적용
      // PaymentSchedule에 새 플랜 정보로 다음 주기 청구 예약
      const newCyclePrice =
        validNewCycle === 'YEARLY' ? newConfig.yearlyPrice : newConfig.monthlyPrice

      await prisma.paymentSchedule.create({
        data: {
          subscriptionId: subscription.id,
          scheduledAt: subscription.currentPeriodEnd,
          type: 'SUBSCRIPTION',
          amount: newCyclePrice,
          metadata: {
            planChange: true,
            newPlan: validNewPlan,
            newBillingCycle: validNewCycle,
            academyId: dbUser.academyId,
          },
        },
      })

      return NextResponse.json({
        success: true,
        type: 'DOWNGRADE',
        newPlan: validNewPlan,
        effectiveDate: subscription.currentPeriodEnd.toISOString(),
        message: `${subscription.currentPeriodEnd.toLocaleDateString('ko-KR')}부터 ${PLAN_DISPLAY_NAMES[validNewPlan]} 플랜이 적용됩니다. 환불은 제공되지 않습니다.`,
      })
    }
  } catch (err) {
    console.error('[billing/subscription/change-plan]', err)
    return NextResponse.json({ error: '서버 오류가 발생했습니다' }, { status: 500 })
  }
}
