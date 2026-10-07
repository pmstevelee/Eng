import { Target } from 'lucide-react'
import { requireStudent } from '@/lib/auth-student'
import { getOrCreateTodayMission } from '@/lib/missions/mission-engine'
import { canUseWordLearning } from '@/lib/words/access-guard'
import {
  DAILY_PLAN_BONUS_XP,
  getOrCreateTodayWordPlan,
  getTodayLearningSummary,
  refreshTodayPlanCompletion,
} from '@/lib/words/daily-plan'
import { TodayLearningHub } from '@/components/student/today-learning'

// 오늘의 단어학습 — 레벨 맞춤 신규 단어 자동 생성 + 복습 + 문법 미션
// (기존 '오늘의 미션' 경로를 그대로 사용해 북마크·알림 링크가 깨지지 않게 한다)

export default async function DailyLearningPage() {
  const { user, studentId, userId } = await requireStudent()
  const academyId = user.academyId

  const canUseWords = academyId ? await canUseWordLearning(academyId) : false

  // 오늘의 단어 계획과 문법 미션은 서로 독립적이므로 함께 생성/조회한다.
  await Promise.all([
    academyId && canUseWords
      ? getOrCreateTodayWordPlan({ studentId, userId, academyId }).catch((e) => {
          console.error('[daily-learning] 오늘의 단어 생성 실패:', e)
          return null
        })
      : null,
    getOrCreateTodayMission(studentId).catch((e) => {
      console.error('[daily-learning] 문법 미션 생성 실패:', e)
      return null
    }),
  ])

  let summary = await getTodayLearningSummary(studentId)
  // 마지막 복습 응답이 완료 처리보다 늦게 저장된 경우 등, 모두 끝났는데 보너스가 없으면 여기서 마무리한다.
  if (summary.isAllComplete && summary.plan && !summary.plan.bonusAwarded) {
    const res = await refreshTodayPlanCompletion(studentId).catch(() => null)
    if (res?.completedNow) summary = await getTodayLearningSummary(studentId)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#7854F7]">
          <Target size={22} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">오늘의 단어학습</h1>
          <p className="mt-1 text-sm text-gray-500">
            내 레벨에 맞춘 단어와 문법을 매일 자동으로 준비해요 · 복습 → 새 단어 → 문법 순서로 학습하세요
          </p>
        </div>
      </div>

      <TodayLearningHub summary={summary} canUseWords={canUseWords} bonusXp={DAILY_PLAN_BONUS_XP} />
    </div>
  )
}
