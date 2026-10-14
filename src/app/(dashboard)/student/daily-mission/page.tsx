import { Target } from 'lucide-react'
import { requireStudent } from '@/lib/auth-student'
import { getOrCreateTodayMission } from '@/lib/missions/mission-engine'
import { getTodayLearningSummary } from '@/lib/words/daily-plan'
import { TodayLearningHub } from '@/components/student/today-learning'

// 오늘의 학습 — 문법 미션 (단어 복습·새 단어는 단어학습 메뉴)
// (기존 '오늘의 미션' 경로를 그대로 사용해 북마크·알림 링크가 깨지지 않게 한다)

export default async function DailyLearningPage() {
  const { studentId } = await requireStudent()

  await getOrCreateTodayMission(studentId).catch((e) => {
    console.error('[daily-learning] 문법 미션 생성 실패:', e)
    return null
  })

  const summary = await getTodayLearningSummary(studentId)

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#1865F2]">
          <Target size={22} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">오늘의 학습</h1>
          <p className="mt-1 text-sm text-gray-500">내 레벨에 맞춘 오늘의 문법 미션을 매일 자동으로 준비해요</p>
        </div>
      </div>

      <TodayLearningHub summary={summary} />
    </div>
  )
}
