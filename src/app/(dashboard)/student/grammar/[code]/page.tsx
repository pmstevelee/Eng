import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { requireStudent } from '@/lib/auth-student'
import { getGrammarUnitData } from '@/lib/grammar/unit-queries'
import { GrammarStateBadge } from '@/components/grammar/grammar-state-badge'
import { GrammarUnitClient } from './_components/unit-client'

// 문법 단원 학습 — 개념 → (강의) → 연습 → 확인 테스트 → 결과
export default async function StudentGrammarUnitPage({ params }: { params: { code: string } }) {
  const { user, studentId } = await requireStudent()
  const data = user.academyId ? await getGrammarUnitData(studentId, user.academyId, decodeURIComponent(params.code)) : null
  if (!data) notFound()

  const { point, progress } = data

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/student/grammar/map"
          className="-ml-2 inline-flex min-h-[44px] items-center gap-1 rounded-lg px-2 text-sm text-gray-500 hover:text-gray-900"
        >
          <ChevronLeft className="h-4 w-4" />
          커리큘럼 지도
        </Link>
        <p className="text-sm text-gray-500">
          {point.parentCategoryName ? `${point.parentCategoryName} · ` : ''}
          {point.categoryName}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h2 className="text-xl font-bold text-gray-900">{point.title}</h2>
          <GrammarStateBadge state={progress.state} />
        </div>
        {progress.bestCheckScore !== null && (
          <p className="mt-1 text-sm text-gray-500">
            확인 테스트 최고 {progress.bestCheckScore}점 · {progress.checkAttempts}회 응시
          </p>
        )}
      </div>

      <GrammarUnitClient data={data} studentId={studentId} />
    </div>
  )
}
