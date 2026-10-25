import Link from 'next/link'
import { BookOpen, ChevronDown, ChevronRight, Info } from 'lucide-react'
import { requireStudent } from '@/lib/auth-student'
import { getGrammarMapData, type GrammarMapCategory, type GrammarMapPoint } from '@/lib/grammar/student-queries'
import { GrammarStateBadge } from '@/components/grammar/grammar-state-badge'
import { GRAMMAR_STATE_STYLE } from '@/lib/grammar/constants'
import { cn } from '@/lib/utils'
import { formatDueKey } from '../_components/format'

type MapFilter = 'all' | 'assigned' | 'weak'

const FILTERS: { value: MapFilter; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'assigned', label: '배정된 것' },
  { value: 'weak', label: '취약' },
]

function parseFilter(value: string | string[] | undefined): MapFilter {
  return value === 'assigned' || value === 'weak' ? value : 'all'
}

function matches(point: GrammarMapPoint, filter: MapFilter): boolean {
  if (filter === 'assigned') return point.assigned
  if (filter === 'weak') return point.state === 'WEAK'
  return true
}

/** 필터에 맞는 포인트만 남기고, 비는 중분류·대분류는 뺀다 */
function applyFilter(categories: GrammarMapCategory[], filter: MapFilter): GrammarMapCategory[] {
  if (filter === 'all') return categories
  return categories.flatMap((c) => {
    const children = c.children.flatMap((s) => {
      const points = s.points.filter((p) => matches(p, filter))
      return points.length > 0 ? [{ ...s, points }] : []
    })
    return children.length > 0 ? [{ ...c, children }] : []
  })
}

export default async function StudentGrammarMapPage({
  searchParams,
}: {
  searchParams: { filter?: string | string[] }
}) {
  const filter = parseFilter(searchParams.filter)
  const { user, studentId } = await requireStudent()
  const data = user.academyId ? await getGrammarMapData(studentId, user.academyId) : null

  if (!data || data.counts.all === 0) {
    return (
      <div className="flex flex-col items-center rounded-xl border border-gray-200 bg-white px-6 py-14 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#EEF4FF]">
          <BookOpen className="h-7 w-7 text-[#1865F2]" />
        </div>
        <h2 className="mt-4 text-lg font-bold text-gray-900">아직 열린 문법 단원이 없어요</h2>
        <p className="mt-1 text-sm text-gray-500">단원이 준비되면 이 지도에 나타나요.</p>
        <Link
          href="/student/learn/domain/grammar"
          className="mt-6 inline-flex min-h-[44px] items-center rounded-lg bg-[#1865F2] px-5 text-sm font-semibold text-white hover:bg-[#1453c9]"
        >
          자유 연습 하기
        </Link>
      </div>
    )
  }

  const categories = applyFilter(data.categories, filter)
  // 필터를 걸었거나 대분류가 하나뿐이면 펼쳐서 보여 준다
  const openAll = filter !== 'all' || categories.length === 1

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2" role="group" aria-label="단원 필터">
        {FILTERS.map((f) => {
          const count = f.value === 'all' ? data.counts.all : f.value === 'assigned' ? data.counts.assigned : data.counts.weak
          const active = f.value === filter
          return (
            <Link
              key={f.value}
              href={f.value === 'all' ? '/student/grammar/map' : `/student/grammar/map?filter=${f.value}`}
              aria-current={active ? 'true' : undefined}
              className={cn(
                'inline-flex min-h-[44px] items-center gap-1.5 rounded-full border px-4 text-sm font-semibold',
                active
                  ? 'border-[#1865F2] bg-[#EEF4FF] text-[#1865F2]'
                  : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50',
              )}
            >
              {f.label}
              <span className="text-xs font-medium opacity-80">{count}</span>
            </Link>
          )
        })}
      </div>

      {categories.length === 0 ? (
        <p className="rounded-xl border border-gray-200 bg-white px-6 py-10 text-center text-sm text-gray-500">
          {filter === 'assigned' ? '배정된 단원이 없어요.' : '취약 단원이 없어요.'}
        </p>
      ) : (
        <div className="space-y-3">
          {categories.map((c) => (
            <CategorySection key={c.id} category={c} defaultOpen={openAll} />
          ))}
        </div>
      )}
    </div>
  )
}

function CategorySection({ category, defaultOpen }: { category: GrammarMapCategory; defaultOpen: boolean }) {
  const percent = category.total > 0 ? Math.round((category.passed / category.total) * 100) : 0
  return (
    <details open={defaultOpen} className="group rounded-xl border border-gray-200 bg-white">
      <summary className="flex min-h-[44px] cursor-pointer list-none items-center gap-3 p-4 [&::-webkit-details-marker]:hidden">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="truncate text-base font-bold text-gray-900">{category.name}</p>
            <p className="shrink-0 text-xs text-gray-500">
              {category.passed} / {category.total} 통과
            </p>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-100" aria-hidden>
            <div
              className="h-full rounded-full"
              style={{ width: `${percent}%`, backgroundColor: GRAMMAR_STATE_STYLE.MASTERED.color }}
            />
          </div>
        </div>
        <ChevronDown className="h-5 w-5 shrink-0 text-gray-400 transition-transform group-open:rotate-180" />
      </summary>

      <div className="space-y-4 border-t border-gray-100 px-4 pb-4 pt-3">
        {category.children.map((sub) => (
          <div key={sub.id}>
            <h3 className="text-sm font-semibold text-gray-500">{sub.name}</h3>
            <ul className="mt-1 divide-y divide-gray-100">
              {sub.points.map((p) => (
                <li key={p.id}>
                  <PointRow point={p} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </details>
  )
}

function PointRow({ point }: { point: GrammarMapPoint }) {
  return (
    <Link href={`/student/grammar/${point.code}`} className="flex min-h-[44px] items-center gap-3 py-2.5 hover:bg-gray-50">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-gray-900">{point.title}</p>
        {(point.assigned || point.pendingPrerequisites.length > 0) && (
          <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
            {point.assigned && (
              <span className="font-semibold text-[#1865F2]">
                배정됨{point.dueKey ? ` · ${formatDueKey(point.dueKey)}까지` : ''}
              </span>
            )}
            {point.pendingPrerequisites.length > 0 && (
              <span className="inline-flex items-center gap-1 text-gray-500">
                <Info className="h-3 w-3" />
                먼저 학습 권장: {point.pendingPrerequisites.join(', ')}
              </span>
            )}
          </div>
        )}
      </div>
      <GrammarStateBadge state={point.state} />
      <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" />
    </Link>
  )
}
