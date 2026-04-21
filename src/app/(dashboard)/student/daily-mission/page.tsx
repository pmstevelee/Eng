import { redirect } from 'next/navigation'
import { Target, Sparkles } from 'lucide-react'
import { requireStudent } from '@/lib/auth-student'
import { getDailyMissionWithQuestions } from '@/app/(dashboard)/student/_actions/gamification'
import { MissionClient } from './_components/mission-client'

const DOMAIN_LABELS: Record<string, string> = {
  GRAMMAR: 'Grammar',
  VOCABULARY: 'Vocabulary',
  READING: 'Reading',
  WRITING: 'Writing',
}

export default async function DailyMissionPage() {
  await requireStudent()
  const data = await getDailyMissionWithQuestions()

  if (!data) redirect('/student')

  if (data.mission.isCompleted) {
    return (
      <div className="max-w-md mx-auto text-center py-16 space-y-4">
        <div className="text-5xl">✅</div>
        <h2 className="text-xl font-bold text-gray-900">오늘 미션 완료!</h2>
        <p className="text-gray-500">내일 또 새로운 미션이 기다리고 있어요.</p>
      </div>
    )
  }

  if (data.questions.length === 0) {
    return (
      <div className="max-w-md mx-auto text-center py-16 space-y-4">
        <div className="text-5xl">📚</div>
        <h2 className="text-xl font-bold text-gray-900">문제가 준비 중이에요</h2>
        <p className="text-gray-500">선생님이 문제를 추가하면 바로 미션이 시작돼요!</p>
      </div>
    )
  }

  const domainLabel = DOMAIN_LABELS[data.mission.domainFocus ?? ''] ?? '영어'

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-2xl bg-[#1865F2] flex items-center justify-center flex-shrink-0">
          <Target size={22} className="text-white" />
        </div>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">오늘의 미션</h1>
            <span className="inline-flex items-center gap-1 text-xs font-medium text-[#7854F7] bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-full">
              <Sparkles size={11} />
              AI 추천
            </span>
          </div>
          <p className="text-sm text-gray-500">
            취약 영역인 <strong className="text-gray-700">{domainLabel}</strong>을 집중 연습해요 ·{' '}
            {data.questions.length}문제
          </p>
        </div>
      </div>

      <MissionClient mission={data.mission} questions={data.questions} />
    </div>
  )
}
