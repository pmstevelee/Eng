import { redirect } from 'next/navigation'
import { Library } from 'lucide-react'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma/client'
import QuestionBankClient from '@/components/shared/question-bank-client'
import type { QuestionRow } from '@/components/shared/question-bank-client'
import { createQuestion, updateQuestion, deleteQuestion } from './actions'

export default async function TeacherQuestionsPage() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'TEACHER' || !user.academyId) redirect('/login')

  // 교사는 학원 전체 문제 열람, 수정/삭제는 본인 것만 (actions에서 처리)
  const rawQuestions = await prisma.question.findMany({
    where: { academyId: user.academyId },
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

  const questions: QuestionRow[] = rawQuestions.map((q) => ({
    id: q.id,
    domain: q.domain,
    subCategory: q.subCategory,
    difficulty: q.difficulty,
    cefrLevel: q.cefrLevel,
    contentJson: q.contentJson as QuestionRow['contentJson'],
    statsJson: q.statsJson as QuestionRow['statsJson'],
    createdAt: q.createdAt.toISOString(),
    creator: q.creator,
  }))

  const domainCounts = {
    GRAMMAR: questions.filter((q) => q.domain === 'GRAMMAR').length,
    VOCABULARY: questions.filter((q) => q.domain === 'VOCABULARY').length,
    READING: questions.filter((q) => q.domain === 'READING').length,
    WRITING: questions.filter((q) => q.domain === 'WRITING').length,
  }

  const statCards = [
    { label: '문법', count: domainCounts.GRAMMAR, color: '#1865F2', bg: '#EEF4FF' },
    { label: '어휘', count: domainCounts.VOCABULARY, color: '#7854F7', bg: '#F3EFFF' },
    { label: '읽기', count: domainCounts.READING, color: '#0FBFAD', bg: '#E6FAF8' },
    { label: '쓰기', count: domainCounts.WRITING, color: '#E35C20', bg: '#FEF0E8' },
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

      {/* 영역별 통계 */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {statCards.map((item) => (
          <div key={item.label} className="rounded-xl border border-gray-200 p-4 bg-white">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{item.label}</span>
            </div>
            <p className="text-2xl font-bold" style={{ color: item.color }}>{item.count}</p>
            <p className="text-xs text-gray-400 mt-0.5">문제</p>
          </div>
        ))}
      </div>

      {/* 문제 목록 */}
      <QuestionBankClient
        questions={questions}
        actCreate={createQuestion}
        actUpdate={updateQuestion}
        actDelete={deleteQuestion}
      />
    </div>
  )
}
