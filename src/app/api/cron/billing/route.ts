import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma/client'
import { SubscriptionStatus, ScheduleStatus, PaymentType, Plan } from '@/generated/prisma'
import { processRecurringPayment } from '@/lib/billing/recurring'
import { processRetry, downgradeExpiredSubscriptions } from '@/lib/billing/retry'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5분

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 })
  }

  const authHeader = req.headers.get('x-vercel-cron-secret')
  if (authHeader !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const windowEnd = new Date(now.getTime() + 60 * 60 * 1000) // +1시간

  // ── 1. 오늘 결제일인 활성 구독 조회 ──
  const dueSubscriptions = await prisma.subscription.findMany({
    where: {
      status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL] },
      currentPeriodEnd: { lte: windowEnd },
      plan: { not: Plan.FREE },
      billingKey: { isNot: null },
    },
    include: {
      billingKey: true,
      academy: { select: { id: true, businessName: true, name: true } },
    },
  })

  // ── 2. 재시도 대기 중인 결제 예약 조회 ──
  const pendingRetries = await prisma.paymentSchedule.findMany({
    where: {
      status: ScheduleStatus.PENDING,
      scheduledAt: { lte: now },
      type: PaymentType.SUBSCRIPTION,
    },
    include: {
      subscription: {
        include: {
          billingKey: true,
          academy: { select: { id: true, businessName: true, name: true } },
        },
      },
    },
  })

  // ── 3. 정기결제 실행 ──
  const recurringResults = await Promise.allSettled(
    dueSubscriptions.map((sub) => processRecurringPayment(sub)),
  )

  let recurringSuccess = 0
  let recurringFailed = 0
  for (const result of recurringResults) {
    if (result.status === 'fulfilled' && result.value.success) {
      recurringSuccess++
    } else {
      recurringFailed++
    }
  }

  // ── 4. 재시도 실행 ──
  const retryResults = await Promise.allSettled(
    pendingRetries.map((schedule) =>
      processRetry({
        id: schedule.id,
        subscriptionId: schedule.subscriptionId,
        amount: schedule.amount,
        type: schedule.type,
        retryCount: schedule.retryCount,
        metadata: schedule.metadata as Record<string, unknown> | null,
        subscription: schedule.subscription,
      }),
    ),
  )

  const retryFailed = retryResults.filter((r) => r.status === 'rejected').length

  // ── 5. PAST_DUE 구독 자동 다운그레이드 ──
  const { downgraded, academyIds } = await downgradeExpiredSubscriptions()

  console.log('[cron:billing] 실행 완료', {
    at: now.toISOString(),
    recurring: { total: dueSubscriptions.length, success: recurringSuccess, failed: recurringFailed },
    retries: { total: pendingRetries.length, failed: retryFailed },
    downgraded: { count: downgraded, academyIds },
  })

  return NextResponse.json({
    ok: true,
    at: now.toISOString(),
    recurring: {
      total: dueSubscriptions.length,
      success: recurringSuccess,
      failed: recurringFailed,
    },
    retries: {
      total: pendingRetries.length,
      failed: retryFailed,
    },
    downgraded,
  })
}
