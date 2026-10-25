import Link from 'next/link'
import { ChevronLeft, ChevronRight, NotebookPen } from 'lucide-react'
import { requireStudent } from '@/lib/auth-student'
import { WRONG_NOTES_PAGE_SIZE, getWrongNotesData, type WrongNotesData } from '@/lib/grammar/review-queries'
import { OTHER_GROUP_KEY } from '@/lib/grammar/review-logic'
import { cn } from '@/lib/utils'
import { WrongNoteCard } from './_components/wrong-note-card'

// 문법 오답노트 — 틀린 문제를 단원별로 모아 보기 (해결된 문제는 "해결됨" 필터로만)

function href(resolved: boolean, page: number): string {
  const params = new URLSearchParams()
  if (resolved) params.set('filter', 'resolved')
  if (page > 1) params.set('page', String(page))
  const q = params.toString()
  return `/student/grammar/wrong-notes${q ? `?${q}` : ''}`
}

export default async function StudentGrammarWrongNotesPage({
  searchParams,
}: {
  searchParams: { filter?: string; page?: string }
}) {
  const { user, studentId } = await requireStudent()
  const resolved = searchParams.filter === 'resolved'
  const data: WrongNotesData = user.academyId
    ? await getWrongNotesData(studentId, user.academyId, { resolved, page: searchParams.page })
    : { resolved, page: 1, totalPages: 1, counts: { open: 0, resolved: 0 }, groups: [] }

  const filters = [
    { label: '틀린 문제', count: data.counts.open, resolved: false },
    { label: '해결됨', count: data.counts.resolved, resolved: true },
  ]
  let number = (data.page - 1) * WRONG_NOTES_PAGE_SIZE

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="오답노트 필터">
        {filters.map((f) => (
          <Link
            key={f.label}
            href={href(f.resolved, 1)}
            role="tab"
            aria-selected={f.resolved === resolved}
            className={cn(
              'inline-flex min-h-[44px] items-center gap-1.5 rounded-full border px-4 text-sm font-semibold',
              f.resolved === resolved
                ? 'border-[#1865F2] bg-[#1865F2] text-white'
                : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50',
            )}
          >
            {f.label}
            <span className={f.resolved === resolved ? 'text-white/80' : 'text-gray-400'}>{f.count}</span>
          </Link>
        ))}
        {!resolved && data.counts.open > 0 && (
          <Link
            href="/student/grammar/review"
            className="ml-auto inline-flex min-h-[44px] items-center text-sm font-semibold text-[#1865F2] hover:underline"
          >
            오늘 복습하기
          </Link>
        )}
      </div>

      {data.groups.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-gray-200 bg-white px-6 py-14 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#EEF4FF]">
            <NotebookPen className="h-7 w-7 text-[#1865F2]" />
          </div>
          <h2 className="mt-4 text-lg font-bold text-gray-900">
            {data.page > 1 ? '이 쪽에는 문제가 없어요' : resolved ? '아직 해결한 문제가 없어요' : '틀린 문제가 없어요'}
          </h2>
          <p className="mt-1 max-w-sm text-sm text-gray-500">
            {resolved
              ? '오답노트 문제를 복습에서 2번 연속 맞히면 여기로 옮겨져요.'
              : '문법 문제를 틀리면 단원별로 모아 두고, 다음 날 복습에서 다시 풀 수 있어요.'}
          </p>
          <Link
            href={data.page > 1 ? href(resolved, 1) : '/student/grammar'}
            className="mt-6 inline-flex min-h-[44px] items-center rounded-lg border border-gray-200 px-5 text-sm font-semibold text-gray-900 hover:bg-gray-50"
          >
            {data.page > 1 ? '첫 쪽으로' : '문법 홈으로'}
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {data.groups.map((g) => (
            <section key={g.key} className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  {g.categoryName && <p className="text-xs text-gray-500">{g.categoryName}</p>}
                  <h2 className="truncate text-base font-bold text-gray-900">
                    {g.title} <span className="text-sm font-medium text-gray-400">{g.items.length}</span>
                  </h2>
                </div>
                {g.key !== OTHER_GROUP_KEY && (
                  <Link
                    href={`/student/grammar/${encodeURIComponent(g.key)}`}
                    className="inline-flex min-h-[44px] shrink-0 items-center text-sm font-semibold text-[#1865F2] hover:underline"
                  >
                    단원 보기
                  </Link>
                )}
              </div>
              <ul className="space-y-2">
                {g.items.map((item) => {
                  number += 1
                  return <WrongNoteCard key={item.questionId} item={item} number={number} />
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      {data.totalPages > 1 && (
        <nav className="flex items-center justify-center gap-2" aria-label="쪽 이동">
          {data.page > 1 ? (
            <Link
              href={href(resolved, data.page - 1)}
              className="flex h-11 items-center gap-1 rounded-lg border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <ChevronLeft className="h-4 w-4" />
              이전
            </Link>
          ) : (
            <span className="flex h-11 items-center gap-1 rounded-lg border border-gray-200 px-4 text-sm text-gray-300">
              <ChevronLeft className="h-4 w-4" />
              이전
            </span>
          )}
          <span className="px-2 text-sm text-gray-600">
            {data.page} / {data.totalPages}
          </span>
          {data.page < data.totalPages ? (
            <Link
              href={href(resolved, data.page + 1)}
              className="flex h-11 items-center gap-1 rounded-lg border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              다음
              <ChevronRight className="h-4 w-4" />
            </Link>
          ) : (
            <span className="flex h-11 items-center gap-1 rounded-lg border border-gray-200 px-4 text-sm text-gray-300">
              다음
              <ChevronRight className="h-4 w-4" />
            </span>
          )}
        </nav>
      )}
    </div>
  )
}
