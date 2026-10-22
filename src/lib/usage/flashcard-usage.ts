import 'server-only'
import { prisma } from '@/lib/prisma/client'
import { PLANS } from '@/lib/pricing'
import { chargeAiCredits, getCreditPricing, getWallet, walletAcademyIdOf } from '@/lib/credits/wallet'
import { kstMonthStart, todayKst } from '@/lib/attendance/time'
import { getAcademyUsagePlan } from './tracker'

/**
 * AI 플래시카드 사용량·과금 — 단어 1개 단위.
 * 플랜 월 무료 한도(단어 수) → 통합 크레딧(단어당 AI_FLASHCARD 단가) 순서로 쓰고, 둘 다 없으면 만들 수 없다.
 * 월 사용량은 ai_flashcard_usages(학원별, KST 월 기준)로 집계해 구독 행이 없는 학원도 한도가 적용된다.
 */

export interface FlashcardQuota {
  /** 이번 달 AI로 만든 단어 수 */
  usedThisMonth: number
  /** 월 무료 한도 (-1: 무제한) */
  freeLimit: number
  /** 남은 무료 단어 수 (무제한이면 Infinity) */
  remainingFree: number
  /** 통합 크레딧 잔액 (지점은 본원 지갑) */
  creditBalance: number
  /** 단어 1개당 크레딧 */
  creditPerWord: number
  /** 지금 AI로 만들 수 있는 최대 단어 수 (무제한이면 Infinity) */
  maxWords: number
  /** 결제 실패로 AI 사용이 막힘 */
  blocked: boolean
}

async function getMonthlyUsedWords(academyId: string): Promise<number> {
  const agg = await prisma.aiFlashcardUsage.aggregate({
    where: { academyId, createdAt: { gte: kstMonthStart(todayKst()) } },
    _sum: { wordCount: true },
  })
  return agg._sum.wordCount ?? 0
}

export async function getFlashcardQuota(academyId: string): Promise<FlashcardQuota> {
  const [{ plan, overageBlocked }, usedThisMonth, wallet, pricing] = await Promise.all([
    getAcademyUsagePlan(academyId),
    getMonthlyUsedWords(academyId),
    walletAcademyIdOf(academyId).then(getWallet),
    getCreditPricing(),
  ])
  const freeLimit = PLANS[plan].aiFlashcardLimit
  const remainingFree = freeLimit === -1 ? Number.POSITIVE_INFINITY : Math.max(0, freeLimit - usedThisMonth)
  const creditPerWord = pricing.AI_FLASHCARD
  const byCredit = creditPerWord > 0 ? Math.floor(wallet.balance / creditPerWord) : 0
  return {
    usedThisMonth,
    freeLimit,
    remainingFree,
    creditBalance: wallet.balance,
    creditPerWord,
    maxWords: overageBlocked ? 0 : remainingFree + byCredit,
    blocked: overageBlocked,
  }
}

/** 무료 한도로 처리할 단어 수 / 크레딧으로 처리할 단어 수 */
export function splitFlashcardCharge(count: number, remainingFree: number): { free: number; paid: number } {
  const free = Math.min(count, remainingFree)
  return { free, paid: count - free }
}

/**
 * AI로 만든 단어 수를 기록하고, 무료 한도를 넘은 만큼 크레딧을 차감한다 (AI 응답을 받은 뒤 호출).
 * 동시에 다른 사용으로 잔액이 먼저 소진됐다면 차감 없이 기록만 남긴다.
 */
export async function recordFlashcardUsage(params: {
  academyId: string
  userId: string
  wordCount: number
}): Promise<{ freeCount: number; creditsUsed: number }> {
  const { academyId, userId, wordCount } = params
  if (wordCount <= 0) return { freeCount: 0, creditsUsed: 0 }

  const quota = await getFlashcardQuota(academyId)
  const { free, paid } = splitFlashcardCharge(wordCount, quota.remainingFree)

  let creditsUsed = 0
  if (paid > 0) {
    const charged = await chargeAiCredits({ academyId, item: 'AI_FLASHCARD', count: paid })
    if (charged.ok) creditsUsed = charged.credits
    else console.error('[flashcard-usage] 크레딧 차감 실패 (잔액 부족 경합)', { academyId, paid })
  }

  await prisma.aiFlashcardUsage.create({
    data: { academyId, userId, wordCount, freeCount: free, creditsUsed },
  })
  return { freeCount: free, creditsUsed }
}

/** 이번 달(KST) AI 플래시카드 사용 요약 — 크레딧 화면용 */
export async function getMonthlyFlashcardUsage(academyId: string) {
  const [{ plan }, agg] = await Promise.all([
    getAcademyUsagePlan(academyId),
    prisma.aiFlashcardUsage.aggregate({
      where: { academyId, createdAt: { gte: kstMonthStart(todayKst()) } },
      _sum: { wordCount: true, freeCount: true, creditsUsed: true },
    }),
  ])
  const words = agg._sum.wordCount ?? 0
  const free = agg._sum.freeCount ?? 0
  return {
    freeLimit: PLANS[plan].aiFlashcardLimit,
    freeUsed: free,
    paidWords: words - free,
    credits: agg._sum.creditsUsed ?? 0,
  }
}
