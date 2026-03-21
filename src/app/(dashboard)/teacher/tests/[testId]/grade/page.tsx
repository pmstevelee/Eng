import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma/client'
import type { QuestionContentJson } from '@/components/shared/question-bank-client'
import { GradeClient } from './_components/grade-client'

export default async function TestGradePage({
  params,
}: {
  params: { testId: string }
}) {
  const { testId } = params

  const supabase = await createClient()
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const user = await prisma.user.findUnique({
    where: { id: authUser.id, isDeleted: false },
    select: { id: true, role: true, academyId: true },
  })
  if (!user || !user.academyId) redirect('/login')
  if (user.role !== 'TEACHER' && user.role !== 'ACADEMY_OWNER') redirect('/login')

  const test = await prisma.test.findUnique({
    where: { id: testId },
    select: {
      id: true,
      title: true,
      type: true,
      academyId: true,
      createdBy: true,
      questionOrder: true,
    },
  })

  if (!test || test.academyId !== user.academyId) notFound()

  // TEACHER는 자기 테스트만
  if (user.role === 'TEACHER' && test.createdBy !== user.id) notFound()

  // 문제 목록 로드
  const questionIds = (test.questionOrder as string[]) || []
  const questions = await prisma.question.findMany({
    where: { id: { in: questionIds } },
    select: { id: true, domain: true, contentJson: true },
  })
  const essayQuestionIds = new Set(
    questions
      .filter((q) => (q.contentJson as QuestionContentJson).type === 'essay')
      .map((q) => q.id)
  )

  // COMPLETED 세션 목록 (쓰기 채점 필요한 것)
  const sessions = await prisma.testSession.findMany({
    where: { testId, status: 'COMPLETED' },
    orderBy: { completedAt: 'asc' },
    include: {
      student: {
        select: { user: { select: { name: true } } },
      },
      questionResponses: {
        where: { questionId: { in: Array.from(essayQuestionIds) } },
        select: {
          id: true,
          questionId: true,
          answer: true,
          answerJson: true,
        },
      },
    },
  })

  // 쓰기 문제가 없으면 채점 페이지 불필요
  const hasEssayQuestions = essayQuestionIds.size > 0

  const questionMap = new Map(questions.map((q) => [q.id, q]))

  type StudentSession = {
    sessionId: string
    studentName: string
    submittedAt: string
    writingQuestions: {
      responseId: string
      questionId: string
      questionText: string
      essayText: string
    }[]
  }

  const studentSessions: StudentSession[] = sessions
    .filter((s) => s.questionResponses.length > 0)
    .map((s) => ({
      sessionId: s.id,
      studentName: s.student.user.name,
      submittedAt: s.completedAt?.toISOString() ?? s.startedAt.toISOString(),
      writingQuestions: s.questionResponses.map((r) => {
        const q = questionMap.get(r.questionId)
        const content = q?.contentJson as QuestionContentJson | undefined
        return {
          responseId: r.id,
          questionId: r.questionId,
          questionText: content?.question_text ?? '',
          essayText: r.answer ?? '',
        }
      }),
    }))

  // 이미 GRADED된 세션 통계
  const gradedCount = await prisma.testSession.count({
    where: { testId, status: 'GRADED' },
  })
  const totalCount = await prisma.testSession.count({
    where: { testId, status: { in: ['COMPLETED', 'GRADED'] } },
  })

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {/* 헤더 */}
      <div className="mb-6">
        <div className="mb-1 flex items-center gap-2">
          <a href="/teacher/tests" className="text-sm text-gray-500 hover:text-gray-700">
            테스트 목록
          </a>
          <span className="text-gray-400">/</span>
          <span className="text-sm text-gray-700">{test.title}</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">쓰기 채점</h1>
        <p className="mt-1 text-sm text-gray-500">{test.title}</p>
      </div>

      {/* 진행 상황 */}
      <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">채점 진행률</span>
          <span className="text-sm font-bold text-[#1865F2]">
            {gradedCount} / {totalCount} 완료
          </span>
        </div>
        <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
          <div
            className="h-full rounded-full bg-[#1865F2] transition-all"
            style={{ width: totalCount > 0 ? `${(gradedCount / totalCount) * 100}%` : '0%' }}
          />
        </div>
      </div>

      {!hasEssayQuestions ? (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
          <p className="text-gray-500">이 테스트에는 쓰기(에세이) 문제가 없습니다.</p>
          <a
            href="/teacher/tests"
            className="mt-4 inline-block text-sm text-[#1865F2] hover:underline"
          >
            테스트 목록으로
          </a>
        </div>
      ) : (
        <GradeClient sessions={studentSessions} />
      )}
    </div>
  )
}
