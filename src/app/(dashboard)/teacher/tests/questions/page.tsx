import { redirect } from 'next/navigation'
import { unstable_cache } from 'next/cache'
import { Library } from 'lucide-react'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma/client'
import QuestionBankClient from '@/components/shared/question-bank-client'
import PublicQuestionList from '@/components/shared/public-question-list'
import { createQuestion, updateQuestion, deleteQuestion, getQuestionDetail, getQuestionBankPage } from './actions'
import { getPublicQuestionsPage } from '@/lib/questions/public-question-actions'

const PAGE_SIZE = 20

// ── 캐시 쿼리 (통계 전용, 목록은 서버 페이지네이션으로 조회) ─────────────────────

const getCachedQuestionBankSummary = (academyId: string) =>
  unstable_cache(
    async () => {
      const [domainGroups, academyTotal, publicTotal] = await Promise.all([
        prisma.question.groupBy({
          by: ['domain'],
          where: { academyId },
          _count: { _all: true },
        }),
        prisma.question.count({ where: { academyId } }),
        prisma.question.count({ where: { academyId: null, isActive: true } }),
      ])
      const domainCounts = {
        GRAMMAR: 0,
        VOCABULARY: 0,
        READING: 0,
        LISTENING: 0,
        WRITING: 0,
      }
      for (const g of domainGroups) domainCounts[g.domain] = g._count._all
      return { domainCounts, academyTotal, publicTotal }
    },
    ['teacher-question-bank-summary', academyId],
    { revalidate: 60, tags: [`academy-${academyId}-questions`, 'question-bank'] },
  )()

// ── 페이지 컴포넌트 ────────────────────────────────────────────────────────────

type SearchParams = Promise<{ tab?: string }>

export default async function TeacherQuestionsPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'TEACHER' || !user.academyId) redirect('/login')

  const { tab = 'academy' } = await searchParams

  const [summary, firstPage, firstPublicPage] = await Promise.all([
    getCachedQuestionBankSummary(user.academyId),
    tab === 'public'
      ? Promise.resolve({ rows: [], total: 0 })
      : getQuestionBankPage({ scope: 'academy', page: 1, pageSize: PAGE_SIZE }),
    tab === 'public' ? getPublicQuestionsPage({ page: 1, pageSize: PAGE_SIZE }) : Promise.resolve({ rows: [], total: 0 }),
  ])

  const statCards = [
    { label: '문법', count: summary.domainCounts.GRAMMAR, color: '#1865F2' },
    { label: '어휘', count: summary.domainCounts.VOCABULARY, color: '#7854F7' },
    { label: '읽기', count: summary.domainCounts.READING, color: '#0FBFAD' },
    { label: '듣기', count: summary.domainCounts.LISTENING, color: '#E91E8A' },
    { label: '쓰기', count: summary.domainCounts.WRITING, color: '#E35C20' },
  ]

  const tabs = [
    { key: 'academy', label: '우리 학원 문제', count: summary.academyTotal },
    { key: 'public', label: '공용 문제', count: summary.publicTotal || null },
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
          <p className="text-sm text-gray-500 mt-0.5">
            학원 문제를 조회하고 새 문제를 출제하세요.
            <span className="ml-2 text-xs text-gray-400">(수정/삭제는 본인이 만든 문제만 가능)</span>
          </p>
        </div>
      </div>

      {/* 영역별 통계 (학원 문제 기준) */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
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
            href={`/teacher/tests/questions?tab=${t.key}`}
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
        <PublicQuestionList
          initialRows={firstPublicPage.rows}
          initialTotal={firstPublicPage.total}
          pageSize={PAGE_SIZE}
          actFetchPage={getPublicQuestionsPage}
        />
      ) : (
        <QuestionBankClient
          scope="academy"
          initialRows={firstPage.rows}
          initialTotal={firstPage.total}
          pageSize={PAGE_SIZE}
          actFetchPage={getQuestionBankPage}
          actCreate={createQuestion}
          actUpdate={updateQuestion}
          actDelete={deleteQuestion}
          actGetDetail={getQuestionDetail}
        />
      )}
    </div>
  )
}
