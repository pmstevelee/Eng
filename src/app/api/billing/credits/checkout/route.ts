import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma/client'
import { CREDIT_PACKAGES } from '@/lib/pricing'
import type { CreditPackageKey } from '@/lib/pricing'

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
      return NextResponse.json({ error: '학원장만 크레딧을 구매할 수 있습니다' }, { status: 403 })
    }

    if (!dbUser.academyId) {
      return NextResponse.json({ error: '학원 정보가 없습니다' }, { status: 400 })
    }

    const body = await req.json()
    const { packageId } = body as { packageId: string }

    if (!packageId || !(packageId in CREDIT_PACKAGES)) {
      return NextResponse.json({ error: '유효하지 않은 패키지입니다' }, { status: 400 })
    }

    const pkg = CREDIT_PACKAGES[packageId as CreditPackageKey]

    const subscription = await prisma.subscription.findUnique({
      where: { academyId: dbUser.academyId },
      select: { id: true },
    })

    if (!subscription) {
      return NextResponse.json({ error: '구독 정보가 없습니다' }, { status: 404 })
    }

    const paymentId = crypto.randomUUID()
    const packageNames: Record<string, string> = {
      SMALL: '소형',
      MEDIUM: '중형',
      LARGE: '대형',
    }
    const orderName = `위고업잉글리시 AI 크레딧 ${packageNames[packageId] ?? packageId} 패키지`

    await prisma.payment.create({
      data: {
        subscriptionId: subscription.id,
        academyId: dbUser.academyId,
        paymentId,
        type: 'CREDIT_PACKAGE',
        amount: pkg.price,
        status: 'PENDING',
      },
    })

    return NextResponse.json({
      paymentId,
      amount: pkg.price,
      orderName,
      packageId,
      customerInfo: {
        customerId: dbUser.academyId,
        fullName: dbUser.name,
        email: dbUser.email,
        phoneNumber: dbUser.phone ?? undefined,
      },
    })
  } catch (err) {
    console.error('[billing/credits/checkout]', err)
    return NextResponse.json({ error: '서버 오류가 발생했습니다' }, { status: 500 })
  }
}
