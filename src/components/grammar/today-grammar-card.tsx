import Link from 'next/link'
import { BookOpen, ChevronRight, RotateCcw } from 'lucide-react'
import { GrammarStateBadge } from '@/components/grammar/grammar-state-badge'
import { NEXT_UNIT_REASON_LABEL } from '@/lib/grammar/constants'
import type { GrammarHomeData } from '@/lib/grammar/student-queries'

// 오늘의 학습(/student/daily-mission) "오늘의 문법" 카드 — 다음 단원 + 오늘 복습 수
// 공개된 문법 단원이 없으면 그리지 않는다.

export function TodayGrammarCard({ data }: { data: Pick<GrammarHomeData, 'hasPoints' | 'next' | 'review'> }) {
  if (!data.hasPoints) return null
  const reviewTotal = data.review.points + data.review.questions
  const next = data.next

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#EEF4FF]">
          <BookOpen className="h-4 w-4 text-[#1865F2]" aria-hidden />
        </div>
        <h2 className="text-sm font-bold text-gray-900">오늘의 문법</h2>
      </div>

      <div className="mt-3 space-y-2">
        <Link
          href={next ? `/student/grammar/${encodeURIComponent(next.code)}` : '/student/grammar'}
          className="flex min-h-[64px] items-center gap-3 rounded-lg border border-gray-200 px-4 py-3 hover:border-[#1865F2]"
        >
          <div className="min-w-0 flex-1">
            {next ? (
              <>
                <p className="text-xs font-semibold text-[#1865F2]">
                  {NEXT_UNIT_REASON_LABEL[next.reason]}
                  {next.stepLabel ? ` · ${next.stepLabel} 단계` : ''}
                </p>
                <p className="truncate text-sm font-semibold text-gray-900">{next.title}</p>
                <p className="truncate text-xs text-gray-500">{next.categoryName}</p>
              </>
            ) : (
              <>
                <p className="text-sm font-semibold text-gray-900">지금 학습할 단원을 모두 마쳤어요</p>
                <p className="text-xs text-gray-500">커리큘럼 지도에서 다른 단원을 골라 보세요</p>
              </>
            )}
          </div>
          {next && <GrammarStateBadge state={next.state} />}
          <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" aria-hidden />
        </Link>

        <Link
          href="/student/grammar/review"
          className="flex min-h-[48px] items-center gap-3 rounded-lg border border-gray-200 px-4 py-2 hover:border-[#1865F2]"
        >
          <RotateCcw className="h-4 w-4 shrink-0 text-[#1FAF54]" aria-hidden />
          <p className="flex-1 text-sm text-gray-700">
            {reviewTotal > 0 ? (
              <>
                오늘 복습 <span className="font-bold text-gray-900">{reviewTotal}개</span>
                <span className="text-xs text-gray-500">
                  {' '}
                  (단원 {data.review.points} · 틀린 문제 {data.review.questions})
                </span>
              </>
            ) : (
              '오늘 복습할 문법이 없어요'
            )}
          </p>
          <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" aria-hidden />
        </Link>
      </div>
    </section>
  )
}
