import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma/client'
import { PLANS, PLAN_DISPLAY_NAMES, BILLING_CYCLE_DISPLAY_NAMES } from '@/lib/pricing'
import { Plan, BillingCycle } from '@/generated/prisma'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id, isDeleted: false },
      include: { academy: true },
    })

    if (!dbUser || dbUser.role !== 'ACADEMY_OWNER') {
      return NextResponse.json({ error: '학원장만 결제할 수 있습니다' }, { status: 403 })
    }

    if (!dbUser.academyId || !dbUser.academy) {
      return NextResponse.json({ error: '학원 정보가 없습니다' }, { status: 400 })
    }

    const body = await req.json()
    const { plan, billingCycle } = body as { plan: string; billingCycle: string }

    if (!Object.values(Plan).includes(plan as Plan)) {
      return NextResponse.json({ error: '유효하지 않은 플랜입니다' }, { status: 400 })
    }
    if (!Object.values(BillingCycle).includes(billingCycle as BillingCycle)) {
      return NextResponse.json({ error: '유효하지 않은 결제 주기입니다' }, { status: 400 })
    }

    const validPlan = plan as Plan
    const validCycle = billingCycle as BillingCycle

    // FREE 플랜: 결제 없이 바로 활성화
    if (validPlan === 'FREE') {
      const now = new Date()
      const periodEnd = new Date(now)
      periodEnd.setFullYear(periodEnd.getFullYear() + 100) // 영구 무료

      await prisma.subscription.upsert({
        where: { academyId: dbUser.academyId },
        create: {
          academyId: dbUser.academyId,
          plan: 'FREE',
          billingCycle: 'MONTHLY',
          status: 'ACTIVE',
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
        },
        update: {
          plan: 'FREE',
          status: 'ACTIVE',
          currentPeriodEnd: periodEnd,
          cancelAtPeriodEnd: false,
        },
      })

      return NextResponse.json({ free: true, plan: 'FREE' })
    }

    // 유료 플랜: 이미 활성 구독이 있으면 거부
    const existingSub = await prisma.subscription.findUnique({
      where: { academyId: dbUser.academyId },
    })

    if (existingSub && existingSub.status === 'ACTIVE' && existingSub.plan !== 'FREE') {
      return NextResponse.json(
        { error: '이미 활성 구독이 있습니다. 플랜 변경은 구독 관리 페이지를 이용해 주세요.' },
        { status: 409 },
      )
    }

    const planConfig = PLANS[validPlan]
    const amount = validCycle === 'YEARLY' ? planConfig.yearlyPrice : planConfig.monthlyPrice
    const paymentId = crypto.randomUUID()

    const now = new Date()
    const tempPeriodEnd = new Date(now)
    tempPeriodEnd.setDate(tempPeriodEnd.getDate() + 1)

    // Subscription upsert (TRIAL 상태 - 결제 후 ACTIVE로 전환)
    const subscription = await prisma.subscription.upsert({
      where: { academyId: dbUser.academyId },
      create: {
        academyId: dbUser.academyId,
        plan: validPlan,
        billingCycle: validCycle,
        status: 'TRIAL',
        currentPeriodStart: now,
        currentPeriodEnd: tempPeriodEnd,
        trialEndsAt: now,
      },
      update: {
        plan: validPlan,
        billingCycle: validCycle,
        status: 'TRIAL',
        trialEndsAt: now,
      },
    })

    // Payment 레코드 생성 (PENDING)
    await prisma.payment.create({
      data: {
        subscriptionId: subscription.id,
        academyId: dbUser.academyId,
        paymentId,
        type: 'SUBSCRIPTION',
        amount,
        status: 'PENDING',
      },
    })

    const orderName = `위고업잉글리시 ${PLAN_DISPLAY_NAMES[validPlan]} ${BILLING_CYCLE_DISPLAY_NAMES[validCycle]} 구독`

    return NextResponse.json({
      paymentId,
      amount,
      plan: validPlan,
      billingCycle: validCycle,
      orderName,
      customerInfo: {
        customerId: dbUser.academyId,
        fullName: dbUser.name,
        email: dbUser.email,
        phoneNumber: dbUser.phone ?? undefined,
      },
    })
  } catch (err) {
    console.error('[billing/checkout]', err)
    return NextResponse.json({ error: '서버 오류가 발생했습니다' }, { status: 500 })
  }
}
