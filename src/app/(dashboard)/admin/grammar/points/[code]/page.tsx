export const dynamic = 'force-dynamic'
// AI 강의 스크립트 생성(OpenAI)·장면 음성 생성(ElevenLabs) 서버 액션이 이 페이지에서 불린다
export const maxDuration = 300

import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { getCurrentUser } from '@/lib/auth'
import { getAdminGrammarTree, getGrammarPointByCode } from '@/lib/grammar/curriculum'
import { getVerifiedQuestionCounts } from '@/lib/grammar/admin'
import { isValidGrammarCode } from '@/lib/grammar/code'
import { parseGrammarCommonErrors, parseGrammarExamples, parseGrammarRules } from '@/types/grammar'
import { getOpenGaps, getScriptsForPoint } from '@/lib/grammar/source-scripts'
import { getPointQuestions } from '@/lib/grammar/questions'
import { getPointLectures } from '@/lib/grammar/lectures'
import { getPointLectureScripts } from '@/lib/grammar/lecture-scripts'
import { resolveAudioVoices } from '@/lib/grammar/elevenlabs'
import type { AudioVoices } from '@/lib/grammar/video/audio-plan'
import { cn } from '@/lib/utils'
import { ScriptPanel } from '../../_components/script-panel'
import { PointEditor, type PrerequisiteOption } from './_components/point-editor'
import { PointQuestions } from './_components/point-questions'
import { PointLectures } from './_components/point-lectures'
import { LectureStudio } from './_components/lecture-studio/lecture-studio'

export default async function AdminGrammarPointPage({
  params,
  searchParams,
}: {
  params: { code: string }
  searchParams: { tab?: string }
}) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'SUPER_ADMIN') redirect('/login')

  const code = decodeURIComponent(params.code)
  if (!isValidGrammarCode(code, 3)) notFound()
  const tab = searchParams.tab === 'questions' || searchParams.tab === 'lecture' ? searchParams.tab : 'concept'

  const [point, tree, counts] = await Promise.all([
    getGrammarPointByCode(code),
    getAdminGrammarTree(),
    getVerifiedQuestionCounts(),
  ])
  if (!point || point.academyId !== null) notFound()

  const [scripts, gaps, questions, lectures, lectureScripts] = await Promise.all([
    getScriptsForPoint(point.id, {
      categoryId: point.category.id,
      parentCategoryId: point.parentCategory?.id ?? null,
    }),
    getOpenGaps({ pointIds: [point.id] }),
    getPointQuestions(point.id),
    getPointLectures(point.id),
    tab === 'lecture' ? getPointLectureScripts(point.id) : Promise.resolve([]),
  ])
  const voicesByScript: Record<string, AudioVoices | null> = Object.fromEntries(
    lectureScripts.map((s) => [s.id, resolveAudioVoices(s.koVoiceId, s.enVoiceId)]),
  )
  const unverifiedCount = questions.filter((q) => q.isActive && !q.isVerified).length
  const tabs = [
    {
      value: 'concept',
      label: '개념 정리',
      href: `/admin/grammar/points/${point.code}`,
    },
    {
      value: 'questions',
      label: `문항 ${questions.filter((q) => q.isActive).length}`,
      href: `/admin/grammar/points/${point.code}?tab=questions`,
    },
    {
      value: 'lecture',
      label: `강의 ${lectures.length}`,
      href: `/admin/grammar/points/${point.code}?tab=lecture`,
    },
  ] as const

  const options: PrerequisiteOption[] = tree.flatMap((c) =>
    c.children.flatMap((s) =>
      s.points
        .filter((p) => p.id !== point.id)
        .map((p) => ({
          id: p.id,
          code: p.code,
          title: p.title,
          group: `${c.name} › ${s.name}`,
        })),
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

      <nav className="flex gap-1 border-b border-gray-200" aria-label="포인트 탭">
        {tabs.map((t) => (
          <Link
            key={t.value}
            href={t.href}
            aria-current={tab === t.value ? 'page' : undefined}
            className={cn(
              '-mb-px inline-flex min-h-[44px] items-center gap-1.5 border-b-2 px-4 text-sm font-medium',
              tab === t.value
                ? 'border-[#1865F2] text-[#1865F2]'
                : 'border-transparent text-gray-500 hover:text-gray-900',
            )}
          >
            {t.label}
            {t.value === 'questions' && unverifiedCount > 0 && (
              <span className="rounded-full bg-[#FFF4D6] px-1.5 text-xs font-semibold text-[#8A5A00]">
                검수 {unverifiedCount}
              </span>
            )}
          </Link>
        ))}
      </nav>

      {tab === 'lecture' ? (
        <div className="space-y-5">
          <PointLectures pointId={point.id} lectures={lectures} />
          <LectureStudio
            pointId={point.id}
            point={{ code: point.code, title: point.title, summary: point.summary, categoryName: point.category.name }}
            scripts={lectureScripts}
            voicesByScript={voicesByScript}
            hqLecture={lectures.find((l) => l.academyId === null) ?? null}
          />
        </div>
      ) : tab === 'questions' ? (
        <PointQuestions
          pointId={point.id}
          questions={questions}
          hasConcept={Boolean(point.summary) || parseGrammarRules(point.rulesJson).length > 0}
        />
      ) : (
        <>
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
        </>
      )}
    </div>
  )
}
