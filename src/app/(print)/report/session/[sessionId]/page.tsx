import { redirect, notFound } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma/client'
import { SessionReportPrint } from './_components/session-report-print'
import type { QuestionContentJson } from '@/components/shared/question-bank-client'
import type { TestSessionAnalysis } from '@/app/api/ai/analyze-test-session/route'
import type { WritingCategoryScores } from '@/lib/ai/writing-grading'

type WritingAnswerJson = {
  teacherScore?: number
  teacherComment?: string
  categoryScores?: WritingCategoryScores
}

export default async function SessionReportPage({
  params,
}: {
  params: Promise<{ sessionId: string }>
}) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  if (user.role !== 'ACADEMY_OWNER' && user.role !== 'TEACHER') redirect('/login')

  const { sessionId } = await params

  const session = await prisma.testSession.findUnique({
    where: { id: sessionId },
    include: {
      test: {
        select: {
          id: true,
          title: true,
          type: true,
          totalScore: true,
          questionOrder: true,
          isAdaptive: true,
        },
      },
      student: {
        select: {
          id: true,
          currentLevel: true,
          user: {
            select: {
              name: true,
              academyId: true,
            },
          },
          class: { select: { name: true } },
        },
      },
      questionResponses: {
        select: {
          questionId: true,
          answer: true,
          answerJson: true,
          isCorrect: true,
        },
      },
    },
  })

  if (!session) notFound()

  // 권한 확인: 같은 학원의 교사/학원장만 접근 가능
  const studentAcademyId = session.student.user.academyId
  if (user.academyId !== studentAcademyId) notFound()

  // 학원 정보
  const academy = studentAcademyId
    ? await prisma.academy.findUnique({
        where: { id: studentAcademyId },
        select: { name: true, businessName: true, address: true, phone: true },
      })
    : null

  // 문제 로드
  const questionIds = (session.test.questionOrder as string[]) ?? []
  const questionsRaw = await prisma.question.findMany({
    where: { id: { in: questionIds } },
    select: { id: true, domain: true, contentJson: true },
  })
  const questionMap = new Map(questionsRaw.map((q) => [q.id, q]))
  const questions = questionIds
    .map((id) => questionMap.get(id))
    .filter((q): q is NonNullable<typeof q> => q !== undefined)

  const responseMap = new Map(session.questionResponses.map((r) => [r.questionId, r]))

  // 저장된 AI 분석 불러오기 (없으면 null — 클라이언트에서 생성)
  const savedReport = await prisma.report.findFirst({
    where: {
      type: 'AI_TEST_RESULT',
      dataJson: { path: ['metadata', 'sessionId'], equals: sessionId },
    },
    orderBy: { createdAt: 'desc' },
  })

  const savedAnalysis = savedReport
    ? (savedReport.dataJson as unknown as TestSessionAnalysis & {
        metadata: Record<string, string>
      })
    : null

  // 이전 세션 비교
  const prevSession = await prisma.testSession.findFirst({
    where: {
      studentId: session.studentId,
      id: { not: sessionId },
      status: { in: ['COMPLETED', 'GRADED'] },
      test: { type: session.test.type },
      completedAt: { lt: session.completedAt ?? new Date() },
    },
    orderBy: { completedAt: 'desc' },
    select: { score: true },
  })

  // 문제별 결과 데이터 가공
  const questionResults = questions.map((q, idx) => {
    const content = q.contentJson as QuestionContentJson
    const response = responseMap.get(q.id)
    const isEssay = content.type === 'essay'
    const writingData = isEssay && response?.answerJson
      ? (response.answerJson as WritingAnswerJson)
      : null

    return {
      index: idx + 1,
      id: q.id,
      domain: q.domain,
      questionText: content.question_text ?? '',
      type: content.type,
      answer: response?.answer ?? null,
      isCorrect: response?.isCorrect ?? null,
      correctAnswer: content.correct_answer ?? null,
      explanation: content.explanation ?? null,
      writingData,
    }
  })

  return (
    <SessionReportPrint
      sessionId={sessionId}
      academy={academy}
      student={{
        name: session.student.user.name,
        currentLevel: session.student.currentLevel,
        className: session.student.class?.name ?? null,
      }}
      test={{
        title: session.test.title,
        type: session.test.type,
      }}
      scores={{
        total: session.score,
        grammar: session.grammarScore,
        vocabulary: session.vocabularyScore,
        reading: session.readingScore,
        writing: session.writingScore,
        listening: session.listeningScore,
        prevTotal: prevSession?.score ?? null,
      }}
      completedAt={session.completedAt?.toISOString() ?? null}
      status={session.status}
      questionResults={questionResults}
      savedAnalysis={savedAnalysis}
      canViewerDownload
    />
  )
}
