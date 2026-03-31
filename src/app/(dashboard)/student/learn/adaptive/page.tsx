import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { getCurrentUser } from '@/lib/auth'
import { getSmartAdaptiveData } from '../actions'
import { SmartAdaptiveClient } from './_components/adaptive-client'

export default async function AdaptivePage() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'STUDENT') redirect('/login')

  const { questions, summary } = await getSmartAdaptiveData(7)

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex items-center gap-3">
        <Link
          href="/student/learn"
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50"
        >
          <ChevronLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">AI 맞춤형 학습</h1>
          <p className="text-xs text-gray-500">약점 분석 기반 · 최적 문제 선별</p>
        </div>
      </div>

      {questions.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 py-16 text-center">
          <div className="mb-3 text-4xl">📚</div>
          <p className="text-sm font-medium text-gray-600">추천 문제가 없습니다</p>
          <p className="mt-1 text-xs text-gray-400">문제가 아직 준비 중이에요. 다시 시도해주세요.</p>
          <Link
            href="/student/learn"
            className="mt-4 inline-flex h-10 items-center rounded-xl bg-[#1865F2] px-5 text-sm font-semibold text-white"
          >
            돌아가기
          </Link>
        </div>
      ) : (
        <SmartAdaptiveClient questions={questions} summary={summary} />
      )}
    </div>
  )
}
