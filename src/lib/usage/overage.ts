import 'server-only'
import { prisma } from '@/lib/prisma/client'
import { payWithBillingKey, PortOneServerError } from '@/lib/portone/server'
import { PLANS } from '@/lib/pricing'
import { Plan, CreditType, PaymentType } from '@/generated/prisma'
import type { AiUsageType } from './tracker'

// 크레딧을 만료 임박 순으로 차감하고, 실제 차감된 수량 반환
async function deductCredits(
  academyId: string,
  type: AiUsageType,
  count: number,
): Promise<number> {
  const creditType: CreditType = type === 'WRITING' ? CreditType.WRITING : CreditType.QUESTION
  const now = new Date()

  const credits = await prisma.aiCredit.findMany({
    where: {
      academyId,
      type: creditType,
      amount: { gt: 0 },
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    orderBy: [
      { expiresAt: 'asc' }, // 만료 임박 먼저 (null은 마지막)
      { createdAt: 'asc' },
    ],
  })

  let remaining = count
  let totalDeducted = 0

  for (const credit of credits) {
    if (remaining <= 0) break
    const deduct = Math.min(credit.amount, remaining)
    await prisma.aiCredit.update({
      where: { id: credit.id },
      data: { amount: { decrement: deduct } },
    })
    remaining -= deduct
    totalDeducted += deduct
  }

  return totalDeducted
}

/**
 * 초과 사용에 대한 결제 실행
 * 1. 크레딧 우선 차감
 * 2. 부족분 빌링키 결제
 * 3. 결제 실패 시 차단 플래그 설정
 */
export async function chargeOverage(
  academyId: string,
  type: AiUsageType,
  count: number,
): Promise<void> {
  const sub = await prisma.subscription.findUnique({
    where: { academyId },
    include: { billingKey: true },
  })

  if (!sub) {
    console.error(`[chargeOverage] 구독 없음: academyId=${academyId}`)
    return
  }

  const plan = sub.plan as Plan
  const planConfig = PLANS[plan]
  const overagePrice =
    type === 'WRITING' ? planConfig.aiWritingOveragePrice : planConfig.aiQuestionOveragePrice

  if (overagePrice === 0) return // 초과 요금 없는 플랜

  // 1. 크레딧 차감 시도
  const deducted = await deductCredits(academyId, type, count)
  const billableCount = count - deducted

  if (billableCount <= 0) return // 크레딧으로 전부 충당

  // 2. 빌링키 없으면 차단
  if (!sub.billingKey) {
    await prisma.subscription.update({
      where: { id: sub.id },
      data: { overageBlocked: true },
    })
    console.warn(`[chargeOverage] 빌링키 없음, 사용 차단: academyId=${academyId}`)
    return
  }

  const amount = billableCount * overagePrice
  const paymentId = crypto.randomUUID()
  const paymentType: PaymentType =
    type === 'WRITING' ? PaymentType.OVERAGE_AI_WRITING : PaymentType.OVERAGE_AI_QUESTION

  // 3. Payment 레코드 생성
  const payment = await prisma.payment.create({
    data: {
      subscriptionId: sub.id,
      academyId,
      paymentId,
      type: paymentType,
      amount,
      status: 'PENDING',
    },
  })

  try {
    const result = await payWithBillingKey({
      billingKey: sub.billingKey.portoneBillingKey,
      paymentId,
      amount,
      orderName: `AI ${type === 'WRITING' ? '쓰기평가' : '문제생성'} 초과 ${billableCount}회`,
      customer: { customerId: academyId },
    })

    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'PAID',
        pgProvider: result.channel?.pgProvider ?? null,
        pgTxId: result.transactionId ?? null,
        receiptUrl: result.receiptUrl ?? null,
        paidAt: new Date(),
      },
    })

    // 결제 성공 시 차단 해제
    if (sub.overageBlocked) {
      await prisma.subscription.update({
        where: { id: sub.id },
        data: { overageBlocked: false },
      })
    }
  } catch (err) {
    const reason = err instanceof PortOneServerError ? err.message : String(err)
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'FAILED', failureReason: reason },
    })
    // 결제 실패 → 차단
    await prisma.subscription.update({
      where: { id: sub.id },
      data: { overageBlocked: true },
    })
    console.error(`[chargeOverage] 결제 실패, 사용 차단: academyId=${academyId}`, reason)
  }
}

/**
 * 초과 결제를 백그라운드에서 실행 (AI 응답 반환을 블록하지 않음)
 * overageMode에 따라 즉시 결제 or 예약 처리
 */
export function queueOverageCharge(
  academyId: string,
  type: AiUsageType,
  count: number,
): void {
  // REALTIME 모드는 즉시 실행, 나머지는 배치 cron이 처리하므로 큐만 기록
  prisma.subscription
    .findUnique({ where: { academyId }, select: { overageMode: true } })
    .then((sub) => {
      if (!sub) return
      if (sub.overageMode === 'REALTIME') {
        // 즉시 결제 (비동기, await 안 함)
        chargeOverage(academyId, type, count).catch((err) =>
          console.error('[queueOverageCharge] REALTIME 결제 오류:', err),
        )
      } else if (sub.overageMode !== 'BLOCK') {
        // WEEKLY / MONTHLY: PaymentSchedule에 초과 사용량 누적 기록
        recordPendingOverage(academyId, type, count).catch((err) =>
          console.error('[queueOverageCharge] 기록 오류:', err),
        )
      }
    })
    .catch((err) => console.error('[queueOverageCharge] 구독 조회 오류:', err))
}

// 배치 결제를 위한 초과 사용 누적 기록
async function recordPendingOverage(
  academyId: string,
  type: AiUsageType,
  count: number,
): Promise<void> {
  const sub = await prisma.subscription.findUnique({
    where: { academyId },
    select: { id: true, plan: true, overageMode: true },
  })
  if (!sub) return

  const plan = sub.plan as Plan
  const planConfig = PLANS[plan]
  const overagePrice =
    type === 'WRITING' ? planConfig.aiWritingOveragePrice : planConfig.aiQuestionOveragePrice
  if (overagePrice === 0) return

  const now = new Date()
  let scheduledAt: Date

  if (sub.overageMode === 'WEEKLY') {
    // 다음 일요일 자정
    const daysUntilSunday = (7 - now.getDay()) % 7 || 7
    scheduledAt = new Date(now)
    scheduledAt.setDate(now.getDate() + daysUntilSunday)
    scheduledAt.setHours(0, 0, 0, 0)
  } else {
    // MONTHLY: 이번 달 말일 23:59
    scheduledAt = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
  }

  const paymentType: PaymentType =
    type === 'WRITING' ? PaymentType.OVERAGE_AI_WRITING : PaymentType.OVERAGE_AI_QUESTION
  const amount = count * overagePrice

  // 같은 날 같은 타입 예약이 있으면 금액 누적, 없으면 생성
  const existing = await prisma.paymentSchedule.findFirst({
    where: {
      subscriptionId: sub.id,
      type: paymentType,
      status: 'PENDING',
      scheduledAt,
    },
  })

  if (existing) {
    await prisma.paymentSchedule.update({
      where: { id: existing.id },
      data: { amount: { increment: amount } },
    })
  } else {
    await prisma.paymentSchedule.create({
      data: {
        subscriptionId: sub.id,
        scheduledAt,
        type: paymentType,
        amount,
        metadata: { overageCount: count, unitPrice: overagePrice, academyId },
      },
    })
  }
}
