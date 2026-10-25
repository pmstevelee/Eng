export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma/client'
import { getGrammarCodeDepth } from '@/lib/grammar/code'
import { getOpenGaps, getScriptAndGapCounts, getScriptsForCategory } from '@/lib/grammar/source-scripts'
import { ScriptPanel } from '../../_components/script-panel'
import { WorkflowGuide } from '../../_components/workflow-guide'
import { CategoryAiTools, type CategoryPointRow } from './_components/category-ai-tools'

export default async function AdminGrammarCategoryPage({ params }: { params: { code: string } }) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'SUPER_ADMIN') redirect('/login')

  const code = decodeURIComponent(params.code)
  const depth = getGrammarCodeDepth(code)
  if (depth !== 1 && depth !== 2) notFound()

  const category = await prisma.grammarCategory.findUnique({
    where: { code },
    select: {
      id: true,
      code: true,
      name: true,
      depth: true,
      parent: { select: { code: true, name: true } },
      children: {
        orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
        select: { id: true, code: true, name: true, points: { where: { academyId: null }, select: { id: true } } },
      },
      points: {
        where: { academyId: null },
        orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
        select: { id: true, code: true, title: true, status: true, summary: true },
      },
    },
  })
  if (!category) notFound()

  // 대분류면 하위 중분류 포인트까지 보완 요청 대상
  const pointIds = [...category.points.map((p) => p.id), ...category.children.flatMap((c) => c.points.map((p) => p.id))]
  const [scripts, allGaps, counts] = await Promise.all([
    getScriptsForCategory(category.id),
    getOpenGaps({ categoryIds: [category.id, ...category.children.map((c) => c.id)], pointIds }),
    getScriptAndGapCounts(),
  ])

  const pointRows: CategoryPointRow[] = category.points.map((p) => ({
    id: p.id,
    code: p.code,
    title: p.title,
    status: p.status,
    hasContent: !!p.summary,
    scriptCount: counts.scriptsByPoint.get(p.id) ?? 0,
    gapCount: counts.gapsByPoint.get(p.id) ?? 0,
  }))

  const gapsByChild = new Map(
    category.children.map((c) => [c.id, c.points.reduce((n, p) => n + (counts.gapsByPoint.get(p.id) ?? 0), 0)]),
  )

  const label = `${category.depth === 1 ? '대분류' : '중분류'} ${category.code} ${category.name}`

  return (
    <div className="space-y-5">
      <div>
        <Link href="/admin/grammar" className="inline-flex min-h-[44px] items-center gap-1 text-sm text-gray-500 hover:text-gray-900">
          <ChevronLeft className="h-4 w-4" />
          문법 커리큘럼
        </Link>
        {category.parent && (
          <p className="text-xs text-gray-400">
            <Link href={`/admin/grammar/categories/${category.parent.code}`} className="hover:text-gray-700">
              {category.parent.code} {category.parent.name}
            </Link>
          </p>
        )}
        <h1 className="mt-1 text-2xl font-bold text-gray-900">
          <span className="mr-2 font-mono text-base text-gray-400">{category.code}</span>
          {category.name}
        </h1>
      </div>

      <WorkflowGuide />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <ScriptPanel target={{ categoryId: category.id }} targetLabel={label} scripts={scripts.rows} gaps={allGaps} />

        {category.depth === 2 ? (
          <CategoryAiTools categoryId={category.id} points={pointRows} scriptCount={scripts.prompt.length} />
        ) : (
          <section className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
            <h2 className="text-sm font-semibold text-gray-900">중분류</h2>
            <p className="mt-0.5 text-xs text-gray-500">
              대분류 원고는 모든 하위 중분류에 함께 쓰입니다. AI 분석·초안 생성은 중분류에서 실행합니다.
            </p>
            <ul className="mt-3 divide-y divide-gray-100 rounded-lg border border-gray-200">
              {category.children.map((c) => {
                const gapCount = gapsByChild.get(c.id) ?? 0
                const scriptCount = counts.scriptsByCategory.get(c.id) ?? 0
                return (
                  <li key={c.id}>
                    <Link
                      href={`/admin/grammar/categories/${c.code}`}
                      className="flex min-h-[48px] items-center gap-3 px-4 py-2 hover:bg-[#F5F8FF]"
                    >
                      <span className="w-16 shrink-0 font-mono text-xs text-gray-400">{c.code}</span>
                      <span className="min-w-0 flex-1 truncate text-sm text-gray-900">{c.name}</span>
                      <span className="shrink-0 text-xs text-gray-500">원고 {scriptCount}</span>
                      {gapCount > 0 && (
                        <span className="shrink-0 rounded-full bg-[#FFF4D6] px-2 py-0.5 text-xs font-semibold text-[#8A5A00]">
                          보완 {gapCount}
                        </span>
                      )}
                      <ChevronRight className="h-4 w-4 shrink-0 text-gray-300" />
                    </Link>
                  </li>
                )
              })}
            </ul>
          </section>
        )}
      </div>
    </div>
  )
}
