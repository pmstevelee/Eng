import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { subscriptionId } = await req.json() as { subscriptionId?: string }

  if (!subscriptionId) {
    return NextResponse.json({ error: 'subscriptionId가 필요합니다' }, { status: 400 })
  }

  const { prisma } = await import('@/lib/prisma/client')
  const { Plan } = await import('@/generated/prisma')
  const { processRecurringPayment } = await import('@/lib/billing/recurring')

  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    include: {
      billingKey: true,
      academy: { select: { id: true, businessName: true, name: true } },
    },
  })

  if (!subscription) {
    return NextResponse.json({ error: '구독을 찾을 수 없습니다' }, { status: 404 })
  }

  if (subscription.plan === Plan.FREE) {
    return NextResponse.json({ error: 'FREE 플랜은 정기결제 대상이 아닙니다' }, { status: 400 })
  }

  if (!subscription.billingKey) {
    return NextResponse.json({ error: '빌링키가 없습니다' }, { status: 400 })
  }

  const result = await processRecurringPayment(subscription)

  return NextResponse.json({ ok: true, result })
}
