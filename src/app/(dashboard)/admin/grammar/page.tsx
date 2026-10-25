export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronRight, Clapperboard, SpellCheck, Tags } from 'lucide-react'
import type { GrammarPointStatus } from '@/generated/prisma'
import { getCurrentUser } from '@/lib/auth'
import { getAdminGrammarTree, type GrammarTreePoint } from '@/lib/grammar/curriculum'
import { getVerifiedQuestionCounts } from '@/lib/grammar/admin'
import { getScriptAndGapCounts } from '@/lib/grammar/source-scripts'
import { getLectureProductionByPoint } from '@/lib/grammar/lecture-scripts'
import { LectureProductionBadge } from '@/components/grammar/lecture-script-badge'
import { MIN_PUBLISH_QUESTIONS } from '@/lib/grammar/constants'
import { GrammarStatusBadge } from '@/components/grammar/grammar-status-badge'
import { cn } from '@/lib/utils'
import { WorkflowGuide } from './_components/workflow-guide'

type Filter = 'ALL' | GrammarPointStatus | 'SHORT' | 'GAPS'

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'ALL', label: '전체' },
  { value: 'DRAFT', label: '초안' },
  { value: 'REVIEW', label: '검수 대기' },
  { value: 'PUBLISHED', label: '공개' },
  { value: 'SHORT', label: '문항 부족' },
  { value: 'GAPS', label: '보완 요청' },
]

function parseFilter(value: string | undefined): Filter {
  return FILTERS.find((f) => f.value === value)?.value ?? 'ALL'
}

export default async function AdminGrammarPage({ searchParams }: { searchParams: { status?: string } }) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'SUPER_ADMIN') redirect('/login')

  const filter = parseFilter(searchParams.status)
  const [tree, counts, sg, production] = await Promise.all([
    getAdminGrammarTree(),
    getVerifiedQuestionCounts(),
    getScriptAndGapCounts(),
    getLectureProductionByPoint(),
  ])

  const countOf = (p: GrammarTreePoint) => counts.get(p.id) ?? 0
  const gapsOf = (p: GrammarTreePoint) => sg.gapsByPoint.get(p.id) ?? 0
  const matches = (p: GrammarTreePoint) =>
    filter === 'ALL'
      ? true
      : filter === 'SHORT'
        ? countOf(p) < MIN_PUBLISH_QUESTIONS
        : filter === 'GAPS'
          ? gapsOf(p) > 0
          : p.status === filter

  const allPoints = tree.flatMap((c) => c.children.flatMap((s) => s.points))
  const summary = {
    total: allPoints.length,
    DRAFT: allPoints.filter((p) => p.status === 'DRAFT').length,
    REVIEW: allPoints.filter((p) => p.status === 'REVIEW').length,
    PUBLISHED: allPoints.filter((p) => p.status === 'PUBLISHED').length,
    short: allPoints.filter((p) => countOf(p) < MIN_PUBLISH_QUESTIONS).length,
    gaps: allPoints.reduce((n, p) => n + gapsOf(p), 0),
    scripts: Array.from(sg.scriptsByCategory.values()).reduce((a, b) => a + b, 0) +
      Array.from(sg.scriptsByPoint.values()).reduce((a, b) => a + b, 0),
  }

  const filtered = tree
    .map((c) => ({
      ...c,
      children: c.children.map((s) => ({ ...s, points: s.points.filter(matches) })).filter((s) => s.points.length > 0),
    }))
    .filter((c) => c.children.length > 0)

  const statCards = [
    { label: '전체 포인트', value: summary.total, color: 'text-gray-900' },
    { label: '초안', value: summary.DRAFT, color: 'text-gray-600' },
    { label: '검수 대기', value: summary.REVIEW, color: 'text-[#8A5A00]' },
    { label: '공개', value: summary.PUBLISHED, color: 'text-[#15803D]' },
    { label: `문항 ${MIN_PUBLISH_QUESTIONS}개 미만`, value: summary.short, color: 'text-[#D92916]' },
    { label: '관리자 원고', value: summary.scripts, color: 'text-[#1865F2]' },
    { label: '보완 요청', value: summary.gaps, color: 'text-[#8A5A00]' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EEF4FF]">
          <SpellCheck className="h-5 w-5 text-[#1865F2]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">문법 커리큘럼</h1>
          <p className="text-sm text-gray-500">
            관리자 원고를 바탕으로 AI가 개념 정리·강의를 만들고, 부족한 곳은 보완을 요청합니다. 공개하려면 검수 완료
            문항이 {MIN_PUBLISH_QUESTIONS}개 이상 필요합니다.
          </p>
        </div>
        <div className="ml-auto flex shrink-0 flex-wrap justify-end gap-2">
          <Link
            href="/admin/grammar/video-lab"
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <Clapperboard className="h-4 w-4 text-[#1865F2]" />
            영상 렌더러
          </Link>
          <Link
            href="/admin/grammar/tagging"
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <Tags className="h-4 w-4 text-[#1865F2]" />
            문항 태깅
          </Link>
        </div>
      </div>

      <WorkflowGuide />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {statCards.map((s) => (
          <div key={s.label} className="rounded-xl border border-gray-200 bg-white px-4 py-3">
            <p className="text-xs text-gray-500">{s.label}</p>
            <p className={cn('mt-1 text-2xl font-bold', s.color)}>{s.value.toLocaleString()}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.value}
            href={f.value === 'ALL' ? '/admin/grammar' : `/admin/grammar?status=${f.value}`}
            className={cn(
              'inline-flex min-h-[44px] items-center rounded-full border px-4 text-sm font-medium transition-colors',
              filter === f.value
                ? 'border-[#1865F2] bg-[#1865F2] text-white'
                : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50',
            )}
          >
            {f.label}
            {((f.value === 'REVIEW' && summary.REVIEW > 0) || (f.value === 'GAPS' && summary.gaps > 0)) && (
              <span
                className={cn(
                  'ml-1.5 rounded-full px-1.5 text-xs',
                  filter === f.value ? 'bg-white/20' : 'bg-[#FFF4D6] text-[#8A5A00]',
                )}
              >
                {f.value === 'GAPS' ? summary.gaps : summary.REVIEW}
              </span>
            )}
          </Link>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white py-16 text-center">
          <SpellCheck className="h-10 w-10 text-gray-300" />
          <p className="mt-3 text-sm text-gray-500">
            {allPoints.length === 0 ? '등록된 문법 포인트가 없습니다. 커리큘럼 시드를 먼저 실행해 주세요.' : '조건에 맞는 포인트가 없습니다.'}
          </p>
          {filter !== 'ALL' && (
            <Link
              href="/admin/grammar"
              className="mt-4 inline-flex min-h-[44px] items-center rounded-lg border border-gray-200 px-4 text-sm text-gray-700 hover:bg-gray-50"
            >
              전체 보기
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((cat) => {
            const catPoints = cat.children.reduce((n, s) => n + s.points.length, 0)
            return (
              <details key={cat.id} open={filter !== 'ALL'} className="group rounded-xl border border-gray-200 bg-white">
                <summary className="flex min-h-[52px] cursor-pointer list-none items-center gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
                  <ChevronRight className="h-4 w-4 shrink-0 text-gray-400 transition-transform group-open:rotate-90" />
                  <span className="font-mono text-xs text-gray-400">{cat.code}</span>
                  <span className="font-semibold text-gray-900">{cat.name}</span>
                  <span className="ml-auto text-xs text-gray-500">{catPoints}개</span>
                  <Link
                    href={`/admin/grammar/categories/${cat.code}`}
                    className="inline-flex min-h-[36px] items-center rounded-lg border border-gray-200 px-3 text-xs text-gray-700 hover:bg-gray-50"
                  >
                    원고 {sg.scriptsByCategory.get(cat.id) ?? 0}
                  </Link>
                </summary>
                <div className="space-y-2 border-t border-gray-100 px-3 py-3">
                  {cat.children.map((sub) => (
                    <details key={sub.id} open className="group/sub rounded-lg bg-gray-50">
                      <summary className="flex min-h-[44px] cursor-pointer list-none items-center gap-2 px-3 py-2 [&::-webkit-details-marker]:hidden">
                        <ChevronRight className="h-4 w-4 shrink-0 text-gray-400 transition-transform group-open/sub:rotate-90" />
                        <span className="font-mono text-xs text-gray-400">{sub.code}</span>
                        <span className="text-sm font-medium text-gray-800">{sub.name}</span>
                        <span className="ml-auto text-xs text-gray-500">{sub.points.length}개</span>
                        <Link
                          href={`/admin/grammar/categories/${sub.code}`}
                          className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 text-xs text-gray-700 hover:bg-gray-50"
                        >
                          원고 {sg.scriptsByCategory.get(sub.id) ?? 0}
                          {sub.points.some((p) => gapsOf(p) > 0) && (
                            <span className="rounded-full bg-[#FFF4D6] px-1.5 font-semibold text-[#8A5A00]">
                              보완 {sub.points.reduce((n, p) => n + gapsOf(p), 0)}
                            </span>
                          )}
                        </Link>
                      </summary>
                      <ul className="divide-y divide-gray-100 rounded-b-lg bg-white">
                        {sub.points.map((p) => {
                          const n = countOf(p)
                          return (
                            <li key={p.id}>
                              <Link
                                href={`/admin/grammar/points/${p.code}`}
                                className="flex min-h-[48px] items-center gap-3 px-4 py-2 hover:bg-[#F5F8FF]"
                              >
                                <span className="w-24 shrink-0 font-mono text-xs text-gray-400">{p.code}</span>
                                <span className="min-w-0 flex-1 truncate text-sm text-gray-900">{p.title}</span>
                                {gapsOf(p) > 0 && (
                                  <span className="shrink-0 rounded-full bg-[#FFF4D6] px-2 py-0.5 text-xs font-semibold text-[#8A5A00]">
                                    보완 {gapsOf(p)}
                                  </span>
                                )}
                                <LectureProductionBadge stage={production.get(p.id)} />
                                <span className="hidden shrink-0 text-xs text-gray-400 sm:inline">
                                  Lv {p.levelMin}~{p.levelMax}
                                </span>
                                <span
                                  className={cn(
                                    'w-14 shrink-0 text-right text-xs font-semibold tabular-nums',
                                    n < MIN_PUBLISH_QUESTIONS ? 'text-[#D92916]' : 'text-gray-600',
                                  )}
                                  title="검수 완료 문항 수"
                                >
                                  {n}문항
                                </span>
                                <GrammarStatusBadge status={p.status} />
                              </Link>
                            </li>
                          )
                        })}
                      </ul>
                    </details>
                  ))}
                </div>
              </details>
            )
          })}
        </div>
      )}
    </div>
  )
}
