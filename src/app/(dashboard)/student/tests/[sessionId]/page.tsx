import { redirect, notFound } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma/client'
import type { QuestionContentJson } from '@/components/shared/question-bank-client'
import { TestStartScreen } from './_components/test-start-screen'
import { TestTakingClient } from './_components/test-taking-client'
import { startTestSession, saveResponses, submitTest } from './actions'

export type QuestionForTest = {
  id: string
  domain: 'GRAMMAR' | 'VOCABULARY' | 'READING' | 'WRITING' | 'LISTENING'
  contentJson: QuestionContentJson
}

export type SessionForTest = {
  id: string
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'GRADED'
  startedAt: string
  timeLimitMin: number | null
  currentQuestionIdx: number
  lastSavedAt: string | null
}

export type TestForTest = {
  id: string
  title: string
  type: string
  instructions: string | null
  timeLimitMin: number | null
  totalScore: number
}

export type InitialAnswers = Record<string, string>

export default async function TestSessionPage({
  params,
}: {
  params: { sessionId: string }
}) {
  const { sessionId } = params

  const user = await getCurrentUser()
  if (!user || user.role !== 'STUDENT') redirect('/login')

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { student: { select: { id: true } } },
  })

  // Student 레코드가 없으면 자동 생성
  let studentId = dbUser?.student?.id
  if (!studentId) {
    const newStudent = await prisma.student.create({
      data: { userId: user.id },
      select: { id: true },
    })
    studentId = newStudent.id
  }

  const session = await prisma.testSession.findUnique({
    where: { id: sessionId, studentId },
    include: {
      test: {
        select: {
          id: true,
          title: true,
          type: true,
          instructions: true,
          timeLimitMin: true,
          totalScore: true,
          questionOrder: true,
        },
      },
      questionResponses: {
        select: { questionId: true, answer: true },
      },
    },
  })

  if (!session) notFound()

  // 이미 완료된 테스트 - 결과 페이지로 리다이렉트
  if (session.status === 'COMPLETED' || session.status === 'GRADED') {
    redirect(`/student/tests/${sessionId}/result`)
  }

  // 문제 ID 목록
  const questionIds = (session.test.questionOrder as string[]) || []

  // 문제 데이터 fetch
  const questionsRaw = await prisma.question.findMany({
    where: { id: { in: questionIds } },
    select: { id: true, domain: true, contentJson: true },
  })

  // questionOrder 순서 보장
  const questionMap = new Map(questionsRaw.map((q) => [q.id, q]))
  const questions: QuestionForTest[] = questionIds
    .map((id) => questionMap.get(id))
    .filter((q): q is NonNullable<typeof q> => q !== undefined)
    .map((q) => ({
      id: q.id,
      domain: q.domain,
      contentJson: q.contentJson as QuestionContentJson,
    }))

  // 기존 응답 복원
  const initialAnswers: InitialAnswers = {}
  for (const r of session.questionResponses) {
    if (r.answer) initialAnswers[r.questionId] = r.answer
  }

  const sessionData: SessionForTest = {
    id: session.id,
    status: session.status,
    startedAt: session.startedAt.toISOString(),
    timeLimitMin: session.timeLimitMin,
    currentQuestionIdx: session.currentQuestionIdx,
    lastSavedAt: session.lastSavedAt?.toISOString() ?? null,
  }

  const testData: TestForTest = {
    id: session.test.id,
    title: session.test.title,
    type: session.test.type,
    instructions: session.test.instructions,
    timeLimitMin: session.test.timeLimitMin,
    totalScore: session.test.totalScore,
  }

  if (session.status === 'NOT_STARTED') {
    return (
      <TestStartScreen
        session={sessionData}
        test={testData}
        questionCount={questions.length}
        onStart={startTestSession}
      />
    )
  }

  return (
    <TestTakingClient
      session={sessionData}
      test={testData}
      questions={questions}
      initialAnswers={initialAnswers}
      onSaveResponses={saveResponses}
      onSubmit={submitTest}
    />
  )
}
