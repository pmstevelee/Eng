import 'server-only'

import { prisma } from '@/lib/prisma/client'
import type { SubscriptionStatus, Plan } from '@/generated/prisma'

const ACTIVE_STATUSES: SubscriptionStatus[] = ['TRIAL', 'ACTIVE']
const FREE_PLAN: Plan = 'FREE'

const DEFAULT_DAILY_NEW_WORDS = 10
const FREE_DAILY_NEW_WORDS = 5

interface WordLearningLimits {
  dailyNewWords: number
  maxSets: number
}

interface AcademySettings {
  wordLearning?: {
    dailyNewWords?: number
  }
}

async function fetchAcademySubscription(academyId: string) {
  return prisma.academy.findUnique({
    where: { id: academyId },
    select: {
      settingsJson: true,
      subscription: {
        select: { plan: true, status: true },
      },
    },
  })
}

function isSubscriptionActive(
  subscription: { plan: Plan; status: SubscriptionStatus } | null,
): boolean {
  if (!subscription) return false
  return subscription.plan !== FREE_PLAN && ACTIVE_STATUSES.includes(subscription.status)
}

function parseAcademyDailyNewWords(settingsJson: unknown): number {
  try {
    const settings = settingsJson as AcademySettings
    const value = settings?.wordLearning?.dailyNewWords
    if (typeof value === 'number' && value > 0) return value
  } catch {
    // settingsJson 파싱 실패 시 기본값 반환
  }
  return DEFAULT_DAILY_NEW_WORDS
}

export function getAcademyDailyNewWords(settingsJson: unknown): number {
  return parseAcademyDailyNewWords(settingsJson)
}

export async function canUseWordLearning(academyId: string): Promise<boolean> {
  const academy = await fetchAcademySubscription(academyId)
  if (!academy) return false
  return isSubscriptionActive(academy.subscription)
}

export async function assertCanUseWordLearning(academyId: string): Promise<void> {
  const allowed = await canUseWordLearning(academyId)
  if (!allowed) {
    throw new Error('단어학습은 스타터 이상 구독(TRIAL/ACTIVE)에서만 사용할 수 있습니다.')
  }
}

export async function getWordLearningLimits(academyId: string): Promise<WordLearningLimits> {
  const academy = await fetchAcademySubscription(academyId)
  if (!academy || !isSubscriptionActive(academy.subscription)) {
    return { dailyNewWords: FREE_DAILY_NEW_WORDS, maxSets: 0 }
  }
  return {
    dailyNewWords: parseAcademyDailyNewWords(academy.settingsJson),
    maxSets: Number.POSITIVE_INFINITY,
  }
}
