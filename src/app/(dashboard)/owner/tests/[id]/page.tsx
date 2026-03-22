import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma/client'
import TestDetailClient from './_components/test-detail-client'
import type { QuestionContentJson } from '@/components/shared/question-bank-client'

export default async function OwnerTestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const owner = await getCurrentUser()
  if (!owner || owner.role !== 'ACADEMY_OWNER' || !owner.academyId) redirect('/login')

  const { id: testId } = await params

  const test = await prisma.test.findFirst({
    where: { id: testId, academyId: owner.academyId },
    select: {
      id: true,
      title: true,
      type: true,
      status: true,
      totalScore: true,
      timeLimitMin: true,
      questionOrder: true,
      classId: true,
      createdAt: true,
      creator: { select: { name: true } },
      class: { select: { id: true, name: true } },
      testSessions: {
        select: {
          id: true,
          status: true,
          score: true,
          grammarScore: true,
          vocabularyScore: true,
          readingScore: true,
          writingScore: true,
          startedAt: true,
          completedAt: true,
          student: {
            select: { user: { select: { name: true } } },
          },
        },
        orderBy: { startedAt: 'desc' },
      },
    },
  })

  if (!test) notFound()

  const questionIds = Array.isArray(test.questionOrder) ? (test.questionOrder as string[]) : []

  const [questions, allResponses] = await Promise.all([
    questionIds.length > 0
      ? prisma.question.findMany({
          where: { id: { in: questionIds } },
          select: { id: true, domain: true, contentJson: true },
        })
      : Promise.resolve([]),
    prisma.questionResponse.findMany({
      where: { session: { testId } },
      select: { questionId: true, isCorrect: true, timeSpentSec: true },
    }),
  ])

  // Per-question correct rate
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
      correctRate: stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0,
    }
  })

  // Session data
  const sessions = test.testSessions.map((s) => {
    const durationMin =
      s.completedAt
        ? Math.round((s.completedAt.getTime() - s.startedAt.getTime()) / 60000)
        : null
    return {
      id: s.id,
      studentName: s.student.user.name,
      status: s.status,
      score: s.score,
      grammarScore: s.grammarScore,
      vocabularyScore: s.vocabularyScore,
      readingScore: s.readingScore,
      writingScore: s.writingScore,
      durationMin,
    }
  })

  // Class comparison: fetch other classes that took this same test
  // (tests deployed to multiple classes - find sessions from students in different classes)
  const classComparison: Array<{ className: string; avgScore: number; count: number }> = []
  if (test.testSessions.length > 0) {
    const sessionStudentIds = await prisma.testSession.findMany({
      where: { testId },
      select: { studentId: true, score: true, student: { select: { classId: true, class: { select: { name: true } } } } },
    })

    const classSessions = new Map<string, { name: string; scores: number[] }>()
    for (const s of sessionStudentIds) {
      if (!s.student.classId || !s.student.class) continue
      const existing = classSessions.get(s.student.classId) ?? { name: s.student.class.name, scores: [] }
      if (s.score !== null) existing.scores.push(s.score)
      classSessions.set(s.student.classId, existing)
    }

    for (const val of Array.from(classSessions.values())) {
      if (val.scores.length > 0) {
        classComparison.push({
          className: val.name,
          avgScore: Math.round(val.scores.reduce((a: number, b: number) => a + b, 0) / val.scores.length),
          count: val.scores.length,
        })
      }
    }
  }

  const testData = {
    id: test.id,
    title: test.title,
    type: test.type,
    status: test.status,
    questionCount: questionIds.length,
    totalScore: test.totalScore,
    timeLimitMin: test.timeLimitMin,
    creatorName: test.creator.name,
    className: test.class?.name ?? null,
    createdAt: test.createdAt.toISOString(),
    sessions,
    questionStats,
    classComparison,
  }

  return (
    <div className="space-y-6">
      {/* 뒤로 가기 */}
      <Link
        href="/owner/tests"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
      >
        <ChevronLeft size={16} />
        테스트 목록
      </Link>

      <TestDetailClient test={testData} />
    </div>
  )
}
