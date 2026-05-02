import { redirect, notFound } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma/client'
import { TestReportPrint } from '@/components/shared/test-report-print'
import type { QuestionContentJson } from '@/components/shared/question-bank-client'

export default async function TestReportPage({
  params,
}: {
  params: Promise<{ testId: string }>
}) {
  const user = await getCurrentUser()
  if (!user || !user.academyId) redirect('/login')
  if (user.role !== 'ACADEMY_OWNER' && user.role !== 'TEACHER') redirect('/login')

  const { testId } = await params

  const [test, academy] = await Promise.all([
    prisma.test.findUnique({
      where: { id: testId },
      select: {
        id: true,
        title: true,
        type: true,
        status: true,
        totalScore: true,
        timeLimitMin: true,
        questionOrder: true,
        createdAt: true,
        academyId: true,
        creator: { select: { name: true } },
        class: { select: { name: true } },
        testSessions: {
          select: {
            id: true,
            status: true,
            score: true,
            grammarScore: true,
            vocabularyScore: true,
            readingScore: true,
            writingScore: true,
            listeningScore: true,
            startedAt: true,
            completedAt: true,
            student: {
              select: {
                user: { select: { name: true } },
                class: { select: { name: true } },
              },
            },
          },
          orderBy: { student: { user: { name: 'asc' } } },
        },
      },
    }),
    prisma.academy.findUnique({
      where: { id: user.academyId },
      select: {
        name: true,
        businessName: true,
        address: true,
        phone: true,
      },
    }),
  ])

  if (!test || test.academyId !== user.academyId) notFound()

  const questionIds = Array.isArray(test.questionOrder)
    ? (test.questionOrder as string[])
    : []

  const [questions, allResponses] = await Promise.all([
    questionIds.length > 0
      ? prisma.question.findMany({
          where: { id: { in: questionIds } },
          select: { id: true, domain: true, contentJson: true },
        })
      : Promise.resolve([]),
    prisma.questionResponse.findMany({
      where: { session: { testId } },
      select: { questionId: true, isCorrect: true },
    }),
  ])

  // 문제별 정답률 계산
  const responsesByQuestion = new Map<string, { total: number; correct: number }>()
  for (const resp of allResponses) {
    const existing = responsesByQuestion.get(resp.questionId) ?? { total: 0, correct: 0 }
    existing.total++
    if (resp.isCorrect) existing.correct++
    responsesByQuestion.set(resp.questionId, existing)
  }

  const questionMap = new Map(questions.map((q) => [q.id, q]))
  const questionStats = questionIds.map((qId, idx) => {
    const q = questionMap.get(qId)
    const stats = responsesByQuestion.get(qId) ?? { total: 0, correct: 0 }
    const content = q?.contentJson as QuestionContentJson | undefined
    return {
      id: qId,
      index: idx + 1,
      domain: (q?.domain ?? 'GRAMMAR') as string,
      questionText: content?.question_text ?? '(문제 없음)',
      totalAttempts: stats.total,
      correctCount: stats.correct,
      correctRate:
        stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0,
    }
  })

  const sessions = test.testSessions.map((s) => {
    const durationMin =
      s.completedAt
        ? Math.round(
            (new Date(s.completedAt).getTime() - new Date(s.startedAt).getTime()) /
              60000,
          )
        : null
    return {
      id: s.id,
      studentName: s.student.user.name,
      className: s.student.class?.name ?? null,
      status: s.status,
      score: s.score,
      grammarScore: s.grammarScore,
      vocabularyScore: s.vocabularyScore,
      readingScore: s.readingScore,
      writingScore: s.writingScore,
      listeningScore: s.listeningScore,
      durationMin,
    }
  })

  return (
    <TestReportPrint
      academy={{
        name: academy?.name ?? '',
        businessName: academy?.businessName ?? null,
        address: academy?.address ?? null,
        phone: academy?.phone ?? null,
      }}
      test={{
        id: test.id,
        title: test.title,
        type: test.type,
        status: test.status,
        totalScore: test.totalScore,
        timeLimitMin: test.timeLimitMin,
        questionCount: questionIds.length,
        creatorName: test.creator.name,
        className: test.class?.name ?? null,
        createdAt: test.createdAt.toISOString(),
      }}
      sessions={sessions}
      questionStats={questionStats}
    />
  )
}
