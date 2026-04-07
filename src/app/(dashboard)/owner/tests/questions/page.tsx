import { redirect } from 'next/navigation'
import { unstable_cache } from 'next/cache'
import { Library } from 'lucide-react'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma/client'
import QuestionBankClient from '@/components/shared/question-bank-client'
import type { QuestionRow } from '@/components/shared/question-bank-client'
import PublicQuestionList from '@/components/shared/public-question-list'
import type { PublicQuestionRow } from '@/components/shared/public-question-list'
import { createQuestion, updateQuestion, deleteQuestion, getQuestionDetail } from './actions'

// ── 캐시 쿼리 ──────────────────────────────────────────────────────────────────

const getCachedAcademyQuestions = (academyId: string) =>
  unstable_cache(
    async () => {
      const rows = await prisma.question.findMany({
        where: { academyId },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          domain: true,
          subCategory: true,
          difficulty: true,
          cefrLevel: true,
          contentJson: true,
          statsJson: true,
          createdAt: true,
          creator: { select: { name: true } },
        },
      })
      return rows.map((q) => ({ ...q, createdAt: q.createdAt.toISOString() }))
    },
    ['owner-questions', academyId],
    { revalidate: 60, tags: [`academy-${academyId}-questions`] },
  )()

const getCachedPublicQuestions = unstable_cache(
  async () => {
    const rows = await prisma.question.findMany({
      where: { academyId: null, isActive: true },
      orderBy: [{ qualityScore: 'desc' }, { createdAt: 'desc' }],
      take: 500,
      select: {
        id: true,
        domain: true,
        subCategory: true,
        difficulty: true,
        cefrLevel: true,
        contentJson: true,
        source: true,
        qualityScore: true,
        usageCount: true,
        createdAt: true,
      },
    })
    return rows.map((q) => ({ ...q, createdAt: q.createdAt.toISOString() }))
  },
  ['public-questions-list'],
  { revalidate: 600, tags: ['question-bank'] },
)()

// ── 페이지 컴포넌트 ────────────────────────────────────────────────────────────

type SearchParams = Promise<{ tab?: string }>

export default async function OwnerQuestionsPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ACADEMY_OWNER' || !user.academyId) redirect('/login')

  const { tab = 'academy' } = await searchParams

  const [rawAcademy, rawPublic] = await Promise.all([
    getCachedAcademyQuestions(user.academyId),
    tab === 'academy' ? Promise.resolve([]) : getCachedPublicQuestions,
  ])

  // 학원 문제 → QuestionRow
  const academyQuestions: QuestionRow[] = rawAcademy.map((q) => {
    const content = q.contentJson as { type: string; question_text?: string }
    return {
      id: q.id,
      domain: q.domain,
      subCategory: q.subCategory,
      difficulty: q.difficulty,
      cefrLevel: q.cefrLevel,
      questionType: (content.type ?? 'multiple_choice') as QuestionRow['questionType'],
      questionText: content.question_text ?? '',
      statsJson: q.statsJson as QuestionRow['statsJson'],
      createdAt: q.createdAt,
      creator: q.creator,
    }
  })

  // 공용 문제 → PublicQuestionRow
  const publicQuestions: PublicQuestionRow[] = rawPublic.map((q) => {
    const content = q.contentJson as { type?: string; question_text?: string }
    return {
      id: q.id,
      domain: q.domain,
      subCategory: q.subCategory,
      difficulty: q.difficulty,
      cefrLevel: q.cefrLevel,
      questionType: content.type ?? 'multiple_choice',
      questionText: content.question_text ?? '',
      source: q.source,
      qualityScore: q.qualityScore,
      usageCount: q.usageCount,
      createdAt: q.createdAt,
    }
  })

  const allQuestions: QuestionRow[] =
    tab === 'all'
      ? [
          ...academyQuestions,
          ...publicQuestions.map((q) => ({
            id: q.id,
            domain: q.domain as QuestionRow['domain'],
            subCategory: q.subCategory,
            difficulty: q.difficulty,
            cefrLevel: q.cefrLevel,
            questionType: q.questionType as QuestionRow['questionType'],
            questionText: q.questionText,
            statsJson: null,
            createdAt: q.createdAt,
            creator: null,
          })),
        ]
      : academyQuestions

  const domainCounts = {
    GRAMMAR: academyQuestions.filter((q) => q.domain === 'GRAMMAR').length,
    VOCABULARY: academyQuestions.filter((q) => q.domain === 'VOCABULARY').length,
    READING: academyQuestions.filter((q) => q.domain === 'READING').length,
    WRITING: academyQuestions.filter((q) => q.domain === 'WRITING').length,
  }

  const statCards = [
    { label: '문법', count: domainCounts.GRAMMAR, color: '#1865F2' },
    { label: '어휘', count: domainCounts.VOCABULARY, color: '#7854F7' },
    { label: '읽기', count: domainCounts.READING, color: '#0FBFAD' },
    { label: '쓰기', count: domainCounts.WRITING, color: '#E35C20' },
  ]

  const tabs = [
    { key: 'academy', label: '우리 학원 문제', count: academyQuestions.length },
    { key: 'public', label: '공용 문제', count: publicQuestions.length || null },
    { key: 'all', label: '전체', count: null },
  ]

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center">
          <Library size={20} className="text-primary-700" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">문제 뱅크</h1>
          <p className="text-sm text-gray-500 mt-0.5">학원 문제를 관리하고 테스트에 활용하세요.</p>
        </div>
      </div>

      {/* 영역별 통계 (학원 문제 기준) */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {statCards.map((item) => (
          <div key={item.label} className="rounded-xl border border-gray-200 p-4 bg-white">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{item.label}</span>
            </div>
            <p className="text-2xl font-bold" style={{ color: item.color }}>{item.count}</p>
            <p className="text-xs text-gray-400 mt-0.5">학원 문제</p>
          </div>
        ))}
      </div>

      {/* 탭 */}
      <div className="flex gap-1 border-b border-gray-200">
        {tabs.map((t) => (
          <a
            key={t.key}
            href={`/owner/tests/questions?tab=${t.key}`}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === t.key
                ? 'border-primary-700 text-primary-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
            {t.count !== null && (
              <span className="ml-1.5 text-xs text-gray-400">({t.count})</span>
            )}
          </a>
        ))}
      </div>

      {/* 탭 콘텐츠 */}
      {tab === 'public' ? (
        <PublicQuestionList questions={publicQuestions} />
      ) : tab === 'all' ? (
        <QuestionBankClient
          questions={allQuestions}
          actCreate={createQuestion}
          actUpdate={updateQuestion}
          actDelete={deleteQuestion}
          actGetDetail={getQuestionDetail}
        />
      ) : (
        <QuestionBankClient
          questions={academyQuestions}
          actCreate={createQuestion}
          actUpdate={updateQuestion}
          actDelete={deleteQuestion}
          actGetDetail={getQuestionDetail}
        />
      )}
    </div>
  )
}
