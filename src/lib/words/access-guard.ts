import 'server-only'

import { unstable_cache } from 'next/cache'
import { prisma } from '@/lib/prisma/client'
import type { SubscriptionStatus, Plan, PlanType } from '@/generated/prisma'
import { parseWordLearningSettings, type WordLearningSettings } from './settings'

const ACTIVE_STATUSES: SubscriptionStatus[] = ['TRIAL', 'ACTIVE']
const FREE_PLAN: Plan = 'FREE'
const FREE_PLAN_TYPE: PlanType = 'FREE'

const FREE_DAILY_NEW_WORDS = 5

interface WordLearningLimits {
  dailyNewWords: number
  maxSets: number
}

// 구독 상태는 자주 바뀌지 않으므로 60초 캐시로 학습 액션마다 발생하는 원격 DB 왕복을 줄인다.
// 태그: 관리자 플랜 변경(`academy-{id}-subscription`)과 일반 학원 변경(`academy-{id}`) 모두에서 무효화된다.
function fetchAcademySubscription(academyId: string) {
  return unstable_cache(
    () =>
      prisma.academy.findUnique({
        where: { id: academyId },
        select: {
          settingsJson: true,
          // 관리자 수동 플랜 변경 / 입금 확인은 Academy 컬럼에 직접 기록된다.
          subscriptionPlan: true,
          subscriptionStatus: true,
          subscriptionExpiresAt: true,
          trialEndsAt: true,
          // 카드 결제(토스) 구독은 별도 Subscription 테이블에 기록된다.
          subscription: {
            select: { plan: true, status: true },
          },
        },
      }),
    ['academy-subscription', academyId],
    { revalidate: 60, tags: [`academy-${academyId}`, `academy-${academyId}-subscription`] },
  )()
}

// unstable_cache는 결과를 JSON으로 직렬화하므로 캐시 적중 시 Date 컬럼이 ISO 문자열로 돌아온다.
type AcademySubscriptionRow = {
  subscriptionPlan: PlanType
  subscriptionStatus: SubscriptionStatus
  subscriptionExpiresAt: Date | string | null
  trialEndsAt: Date | string | null
  subscription: { plan: Plan; status: SubscriptionStatus } | null
}

/** 카드 결제 구독(Subscription 테이블) 기준 활성 여부 */
function isSubscriptionActive(
  subscription: { plan: Plan; status: SubscriptionStatus } | null,
): boolean {
  if (!subscription) return false
  return subscription.plan !== FREE_PLAN && ACTIVE_STATUSES.includes(subscription.status)
}

/**
 * Academy 컬럼(관리자 플랜 변경·구독 연장·수동 입금 확인) 기준 활성 여부.
 * - TRIAL: 체험 종료일이 지나지 않았을 때
 * - ACTIVE: 만료일이 없거나 지나지 않았을 때
 */
function isAcademyPlanActive(academy: AcademySubscriptionRow, now = new Date()): boolean {
  if (academy.subscriptionPlan === FREE_PLAN_TYPE) return false
  if (academy.subscriptionStatus === 'TRIAL') {
    return isNotExpired(academy.trialEndsAt, now)
  }
  if (academy.subscriptionStatus === 'ACTIVE') {
    return isNotExpired(academy.subscriptionExpiresAt, now)
  }
  return false
}

/** 종료일이 없거나 아직 지나지 않았으면 true (문자열/Date 모두 처리) */
function isNotExpired(endsAt: Date | string | null, now: Date): boolean {
  if (!endsAt) return true
  return new Date(endsAt).getTime() > now.getTime()
}

/** 두 구독 소스 중 하나라도 활성이면 단어학습 사용 가능 */
function hasActiveWordLearningPlan(academy: AcademySubscriptionRow): boolean {
  return isSubscriptionActive(academy.subscription) || isAcademyPlanActive(academy)
}

function parseAcademyDailyNewWords(settingsJson: unknown): number {
  return parseWordLearningSettings(settingsJson).dailyNewWords
}

export function getAcademyDailyNewWords(settingsJson: unknown): number {
  return parseAcademyDailyNewWords(settingsJson)
}

/** 학원 단어학습 설정 (60초 캐시 재사용 — 신규 단어 수는 구독 상태에 따라 무료 한도 적용) */
export async function getAcademyWordLearningSettings(
  academyId: string,
): Promise<WordLearningSettings & { canUseWords: boolean }> {
  const academy = await fetchAcademySubscription(academyId)
  const settings = parseWordLearningSettings(academy?.settingsJson)
  const canUseWords = !!academy && hasActiveWordLearningPlan(academy)
  return {
    ...settings,
    dailyNewWords: canUseWords ? settings.dailyNewWords : FREE_DAILY_NEW_WORDS,
    canUseWords,
  }
}

export async function canUseWordLearning(academyId: string): Promise<boolean> {
  const academy = await fetchAcademySubscription(academyId)
  if (!academy) return false
  return hasActiveWordLearningPlan(academy)
}

export async function assertCanUseWordLearning(academyId: string): Promise<void> {
  const allowed = await canUseWordLearning(academyId)
  if (!allowed) {
    throw new Error('단어학습은 스타터 이상 구독(TRIAL/ACTIVE)에서만 사용할 수 있습니다.')
  }
}

export async function getWordLearningLimits(academyId: string): Promise<WordLearningLimits> {
  const academy = await fetchAcademySubscription(academyId)
  if (!academy || !hasActiveWordLearningPlan(academy)) {
    return { dailyNewWords: FREE_DAILY_NEW_WORDS, maxSets: 0 }
  }
  return {
    dailyNewWords: parseAcademyDailyNewWords(academy.settingsJson),
    maxSets: Number.POSITIVE_INFINITY,
  }
}
