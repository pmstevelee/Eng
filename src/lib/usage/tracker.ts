import 'server-only'
import { prisma } from '@/lib/prisma/client'
import { PLANS } from '@/lib/pricing'
import { Plan, CreditType } from '@/generated/prisma'

export type AiUsageType = 'WRITING' | 'QUESTION'

export interface UsageCheckResult {
  canUse: boolean
  source: 'FREE' | 'CREDIT' | 'OVERAGE' | 'BLOCKED'
  message: string
  usedThisMonth: number
  limit: number
  remainingFree: number
  creditBalance: number
}

export interface TrackResult {
  usedThisMonth: number
  limit: number
  remainingFree: number
  isOverLimit: boolean
}

// 이번 달 UsageRecord 조회 또는 생성
async function getOrCreateUsageRecord(academyId: string, subscriptionId: string) {
  const now = new Date()
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)

  const existing = await prisma.usageRecord.findUnique({
    where: { subscriptionId_periodStart: { subscriptionId, periodStart } },
  })

  if (existing) return existing

  return prisma.usageRecord.create({
    data: {
      subscriptionId,
      academyId,
      periodStart,
      periodEnd,
    },
  })
}

// 학원의 현재 구독 + 플랜 조회
async function getSubscriptionInfo(academyId: string) {
  const sub = await prisma.subscription.findUnique({
    where: { academyId },
    select: {
      id: true,
      plan: true,
      status: true,
      overageBlocked: true,
      overageMode: true,
    },
  })
  if (!sub) throw new Error(`구독 정보를 찾을 수 없습니다. academyId=${academyId}`)
  return sub
}

// 만료되지 않은 크레딧 잔액 조회
async function getCreditBalance(academyId: string, type: AiUsageType): Promise<number> {
  const creditType: CreditType = type === 'WRITING' ? CreditType.WRITING : CreditType.QUESTION
  const now = new Date()
  const result = await prisma.aiCredit.aggregate({
    where: {
      academyId,
      type: creditType,
      amount: { gt: 0 },
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    _sum: { amount: true },
  })
  return result._sum.amount ?? 0
}

/**
 * AI 사용 전 한도 체크 (사용량 증가 없음)
 */
export async function checkAiUsageLimit(
  academyId: string,
  type: AiUsageType,
): Promise<UsageCheckResult> {
  const sub = await getSubscriptionInfo(academyId)
  const plan = sub.plan as Plan
  const planConfig = PLANS[plan]

  const freeLimit = type === 'WRITING' ? planConfig.aiWritingLimit : planConfig.aiQuestionLimit
  const overagePrice =
    type === 'WRITING' ? planConfig.aiWritingOveragePrice : planConfig.aiQuestionOveragePrice

  const now = new Date()
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const usageRecord = await prisma.usageRecord.findUnique({
    where: { subscriptionId_periodStart: { subscriptionId: sub.id, periodStart } },
    select: { aiWritingCount: true, aiQuestionCount: true },
  })

  const usedThisMonth =
    type === 'WRITING'
      ? (usageRecord?.aiWritingCount ?? 0)
      : (usageRecord?.aiQuestionCount ?? 0)

  const remainingFree = Math.max(0, freeLimit - usedThisMonth)
  const creditBalance = await getCreditBalance(academyId, type)

  if (sub.overageBlocked) {
    return {
      canUse: false,
      source: 'BLOCKED',
      message: '결제 실패로 AI 사용이 차단되었습니다. 결제 수단을 갱신해주세요.',
      usedThisMonth,
      limit: freeLimit,
      remainingFree: 0,
      creditBalance,
    }
  }

  if (remainingFree > 0) {
    return {
      canUse: true,
      source: 'FREE',
      message: `무료 한도 내 사용 (${usedThisMonth + 1}/${freeLimit})`,
      usedThisMonth,
      limit: freeLimit,
      remainingFree,
      creditBalance,
    }
  }

  if (creditBalance > 0) {
    return {
      canUse: true,
      source: 'CREDIT',
      message: `충전 크레딧 사용 (잔액: ${creditBalance}회)`,
      usedThisMonth,
      limit: freeLimit,
      remainingFree: 0,
      creditBalance,
    }
  }

  // 무료/크레딧 모두 소진 — 초과 결제 여부 확인
  if (sub.overageMode === 'BLOCK') {
    return {
      canUse: false,
      source: 'BLOCKED',
      message:
        '이번 달 AI 사용 한도를 초과했습니다. 크레딧을 충전하거나 요금제를 업그레이드해주세요.',
      usedThisMonth,
      limit: freeLimit,
      remainingFree: 0,
      creditBalance: 0,
    }
  }

  // FREE 플랜은 초과 결제 없음
  if (plan === 'FREE' || overagePrice === 0) {
    return {
      canUse: false,
      source: 'BLOCKED',
      message: '무료 플랜의 AI 사용 한도를 초과했습니다. 요금제를 업그레이드해주세요.',
      usedThisMonth,
      limit: freeLimit,
      remainingFree: 0,
      creditBalance: 0,
    }
  }

  return {
    canUse: true,
    source: 'OVERAGE',
    message: `초과 사용 (${overagePrice.toLocaleString()}원/회 청구 예정)`,
    usedThisMonth,
    limit: freeLimit,
    remainingFree: 0,
    creditBalance: 0,
  }
}

/**
 * AI 사용량 기록 + 결과 반환 (Prisma increment으로 동시성 안전)
 */
export async function trackAiUsage(
  academyId: string,
  type: AiUsageType,
): Promise<TrackResult> {
  const sub = await getSubscriptionInfo(academyId)
  const plan = sub.plan as Plan
  const planConfig = PLANS[plan]
  const freeLimit = type === 'WRITING' ? planConfig.aiWritingLimit : planConfig.aiQuestionLimit

  // 트랜잭션으로 record 조회/생성 + increment 원자적 처리
  const updated = await prisma.$transaction(async (tx) => {
    const now = new Date()
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)

    // upsert로 없으면 생성, 있으면 increment
    if (type === 'WRITING') {
      return tx.usageRecord.upsert({
        where: { subscriptionId_periodStart: { subscriptionId: sub.id, periodStart } },
        create: {
          subscriptionId: sub.id,
          academyId,
          periodStart,
          periodEnd,
          aiWritingCount: 1,
        },
        update: { aiWritingCount: { increment: 1 } },
        select: { aiWritingCount: true, aiQuestionCount: true },
      })
    } else {
      return tx.usageRecord.upsert({
        where: { subscriptionId_periodStart: { subscriptionId: sub.id, periodStart } },
        create: {
          subscriptionId: sub.id,
          academyId,
          periodStart,
          periodEnd,
          aiQuestionCount: 1,
        },
        update: { aiQuestionCount: { increment: 1 } },
        select: { aiWritingCount: true, aiQuestionCount: true },
      })
    }
  })

  const usedThisMonth = type === 'WRITING' ? updated.aiWritingCount : updated.aiQuestionCount
  const limit = type === 'WRITING' ? planConfig.aiWritingLimit : planConfig.aiQuestionLimit

  return {
    usedThisMonth,
    limit,
    remainingFree: Math.max(0, limit - usedThisMonth),
    isOverLimit: limit !== -1 && usedThisMonth > limit,
  }
}

/**
 * 스토리지 사용량 업데이트 (delta MB, 양수=추가 음수=차감)
 */
export async function trackStorageUsage(academyId: string, mbDelta: number): Promise<void> {
  const sub = await getSubscriptionInfo(academyId)
  const now = new Date()
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)

  await prisma.usageRecord.upsert({
    where: { subscriptionId_periodStart: { subscriptionId: sub.id, periodStart } },
    create: {
      subscriptionId: sub.id,
      academyId,
      periodStart,
      periodEnd,
      storageUsedMb: Math.max(0, mbDelta),
    },
    update: {
      storageUsedMb: { increment: mbDelta },
    },
  })
}

/**
 * 현재 활성 학생 수를 UsageRecord에 동기화
 */
export async function trackStudentCount(academyId: string): Promise<void> {
  const [sub, count] = await Promise.all([
    getSubscriptionInfo(academyId),
    prisma.student.count({
      where: {
        status: 'ACTIVE',
        user: { academyId, isDeleted: false },
      },
    }),
  ])

  const now = new Date()
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)

  await prisma.usageRecord.upsert({
    where: { subscriptionId_periodStart: { subscriptionId: sub.id, periodStart } },
    create: {
      subscriptionId: sub.id,
      academyId,
      periodStart,
      periodEnd,
      studentCount: count,
    },
    update: { studentCount: count },
  })
}
