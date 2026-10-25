export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronLeft, ChevronRight, Tags } from 'lucide-react'
import { getCurrentUser } from '@/lib/auth'
import { getAdminGrammarTree } from '@/lib/grammar/curriculum'
import {
  TAG_PAGE_SIZE,
  getPendingSuggestions,
  getTaggingSummary,
  parseTagView,
  type TagView,
} from '@/lib/grammar/questions'
import { AUTO_ACCEPT_CONFIDENCE } from '@/lib/grammar/question-tagging'
import { cn } from '@/lib/utils'
import type { PointOption } from '../_components/point-picker'
import { TaggingRunner } from './_components/tagging-runner'
import { SuggestionList } from './_components/suggestion-list'

const HIGH = Math.round(AUTO_ACCEPT_CONFIDENCE * 100)

export default async function AdminGrammarTaggingPage({
  searchParams,
}: {
  searchParams: { view?: string; page?: string }
}) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'SUPER_ADMIN') redirect('/login')

  const view = parseTagView(searchParams.view)
  const page = Math.max(1, Number.parseInt(searchParams.page ?? '1', 10) || 1)

  const [summary, list, tree] = await Promise.all([
    getTaggingSummary(),
    getPendingSuggestions(view, page),
    getAdminGrammarTree(),
  ])

  const options: PointOption[] = tree.flatMap((c) =>
    c.children.flatMap((s) => s.points.map((p) => ({ id: p.id, code: p.code, title: p.title, group: `${c.name} › ${s.name}` }))),
  )

  const views: { value: TagView; label: string; count: number }[] = [
    { value: 'high', label: `확신도 ${HIGH}% 이상`, count: summary.pendingHigh },
    { value: 'low', label: `${HIGH}% 미만`, count: summary.pendingLow },
    { value: 'none', label: '포인트 못 찾음', count: summary.pendingNone },
    { value: 'all', label: '검수 대기 전체', count: summary.pendingHigh + summary.pendingLow + summary.pendingNone },
  ]

  const stats = [
    { label: '태깅 전 문항', value: summary.remaining, color: 'text-gray-900' },
    { label: '검수 대기', value: summary.pendingHigh + summary.pendingLow + summary.pendingNone, color: 'text-[#8A5A00]' },
    { label: '확정', value: summary.accepted, color: 'text-[#15803D]' },
    { label: '해당 없음', value: summary.rejected, color: 'text-gray-500' },
  ]

  const totalPages = Math.max(1, Math.ceil(list.total / TAG_PAGE_SIZE))
  const href = (v: TagView, p = 1) => `/admin/grammar/tagging?view=${v}${p > 1 ? `&page=${p}` : ''}`

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/grammar"
          className="inline-flex min-h-[44px] items-center gap-1 text-sm text-gray-500 hover:text-gray-900"
        >
          <ChevronLeft className="h-4 w-4" />
          문법 커리큘럼
        </Link>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EEF4FF]">
            <Tags className="h-5 w-5 text-[#1865F2]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">문법 문항 태깅</h1>
            <p className="text-sm text-gray-500">
              기존 문법 문항을 AI가 문법 포인트에 연결해 제안합니다. 확정해야 포인트에 연결되고, 본사 공용·검수 완료 문항은
              포인트의 문항 수에 들어갑니다.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-gray-200 bg-white px-4 py-3">
            <p className="text-xs text-gray-500">{s.label}</p>
            <p className={cn('mt-1 text-2xl font-bold', s.color)}>{s.value.toLocaleString()}</p>
          </div>
        ))}
      </div>

      <TaggingRunner remaining={summary.remaining} highCount={summary.pendingHigh} highPercent={HIGH} />

      <div className="flex flex-wrap gap-2">
        {views.map((v) => (
          <Link
            key={v.value}
            href={href(v.value)}
            className={cn(
              'inline-flex min-h-[44px] items-center rounded-full border px-4 text-sm font-medium transition-colors',
              view === v.value
                ? 'border-[#1865F2] bg-[#1865F2] text-white'
                : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50',
            )}
          >
            {v.label}
            <span className={cn('ml-1.5 rounded-full px-1.5 text-xs', view === v.value ? 'bg-white/20' : 'bg-gray-100 text-gray-600')}>
              {v.count.toLocaleString()}
            </span>
          </Link>
        ))}
      </div>

      {list.rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white py-16 text-center">
          <Tags className="h-10 w-10 text-gray-300" />
          <p className="mt-3 text-sm text-gray-500">
            {summary.remaining > 0
              ? '검수할 제안이 없습니다. 위에서 AI 태깅을 시작해 주세요.'
              : '이 조건에 맞는 검수 대기 제안이 없습니다.'}
          </p>
          {view !== 'all' && (
            <Link
              href={href('all')}
              className="mt-4 inline-flex min-h-[44px] items-center rounded-lg border border-gray-200 px-4 text-sm text-gray-700 hover:bg-gray-50"
            >
              검수 대기 전체 보기
            </Link>
          )}
        </div>
      ) : (
        <>
          <SuggestionList key={`${view}-${page}`} rows={list.rows} options={options} />
          {totalPages > 1 && (
            <nav className="flex items-center justify-center gap-2" aria-label="페이지">
              {page > 1 && (
                <Link
                  href={href(view, page - 1)}
                  className="inline-flex min-h-[44px] items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <ChevronLeft className="h-4 w-4" />
                  이전
                </Link>
              )}
              <span className="px-2 text-sm text-gray-500">
                {page} / {totalPages}
              </span>
              {page < totalPages && (
                <Link
                  href={href(view, page + 1)}
                  className="inline-flex min-h-[44px] items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 hover:bg-gray-50"
                >
                  다음
                  <ChevronRight className="h-4 w-4" />
                </Link>
              )}
            </nav>
          )}
        </>
      )}
    </div>
  )
}
