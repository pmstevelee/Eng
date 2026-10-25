export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { getCurrentUser } from '@/lib/auth'
import { getAdminGrammarTree, getGrammarPointByCode } from '@/lib/grammar/curriculum'
import { getVerifiedQuestionCounts } from '@/lib/grammar/admin'
import { isValidGrammarCode } from '@/lib/grammar/code'
import { parseGrammarCommonErrors, parseGrammarExamples, parseGrammarRules } from '@/types/grammar'
import { getOpenGaps, getScriptsForPoint } from '@/lib/grammar/source-scripts'
import { ScriptPanel } from '../../_components/script-panel'
import { PointEditor, type PrerequisiteOption } from './_components/point-editor'

export default async function AdminGrammarPointPage({ params }: { params: { code: string } }) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'SUPER_ADMIN') redirect('/login')

  const code = decodeURIComponent(params.code)
  if (!isValidGrammarCode(code, 3)) notFound()

  const [point, tree, counts] = await Promise.all([
    getGrammarPointByCode(code),
    getAdminGrammarTree(),
    getVerifiedQuestionCounts(),
  ])
  if (!point || point.academyId !== null) notFound()

  const [scripts, gaps] = await Promise.all([
    getScriptsForPoint(point.id, { categoryId: point.category.id, parentCategoryId: point.parentCategory?.id ?? null }),
    getOpenGaps({ pointIds: [point.id] }),
  ])

  const options: PrerequisiteOption[] = tree.flatMap((c) =>
    c.children.flatMap((s) =>
      s.points
        .filter((p) => p.id !== point.id)
        .map((p) => ({ id: p.id, code: p.code, title: p.title, group: `${c.name} › ${s.name}` })),
    ),
  )

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/admin/grammar"
          className="inline-flex min-h-[44px] items-center gap-1 text-sm text-gray-500 hover:text-gray-900"
        >
          <ChevronLeft className="h-4 w-4" />
          문법 커리큘럼
        </Link>
        <p className="text-xs text-gray-400">
          {point.parentCategory ? `${point.parentCategory.name} › ` : ''}
          <Link href={`/admin/grammar/categories/${point.category.code}`} className="hover:text-gray-700">
            {point.category.name}
          </Link>{' '}
          · <span className="font-mono">{point.code}</span>
        </p>
      </div>

      <PointEditor
        pointId={point.id}
        code={point.code}
        status={point.status}
        verifiedCount={counts.get(point.id) ?? 0}
        scriptCount={scripts.prompt.length}
        options={options}
        initial={{
          title: point.title,
          levelMin: point.levelMin,
          levelMax: point.levelMax,
          summary: point.summary ?? '',
          rules: parseGrammarRules(point.rulesJson),
          examples: parseGrammarExamples(point.examplesJson),
          commonErrors: parseGrammarCommonErrors(point.commonErrorsJson),
          prerequisiteIds: point.prerequisiteIds,
        }}
      />

      <ScriptPanel
        target={{ grammarPointId: point.id }}
        targetLabel={`포인트 ${point.code} ${point.title}`}
        scripts={scripts.rows}
        gaps={gaps}
      />
    </div>
  )
}
