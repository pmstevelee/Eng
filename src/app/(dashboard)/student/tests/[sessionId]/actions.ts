'use server'

import { prisma } from '@/lib/prisma/client'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { QuestionContentJson } from '@/components/shared/question-bank-client'

async function getAuthedStudent() {
  const supabase = await createClient()
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()
  if (!authUser) return null

  const user = await prisma.user.findUnique({
    where: { id: authUser.id, isDeleted: false },
    select: {
      id: true,
      role: true,
      student: { select: { id: true } },
    },
  })
  if (!user || user.role !== 'STUDENT' || !user.student) return null
  return { userId: user.id, studentId: user.student.id }
}

// 테스트 시작 (NOT_STARTED → IN_PROGRESS)
export async function startTestSession(
  sessionId: string,
): Promise<{ error?: string; startedAt?: string }> {
  const auth = await getAuthedStudent()
  if (!auth) return { error: '권한이 없습니다.' }

  const session = await prisma.testSession.findUnique({
    where: { id: sessionId, studentId: auth.studentId },
    select: { id: true, status: true },
  })
  if (!session) return { error: '세션을 찾을 수 없습니다.' }
  if (session.status !== 'NOT_STARTED') return { error: '이미 시작된 테스트입니다.' }

  const now = new Date()
  await prisma.testSession.update({
    where: { id: sessionId },
    data: { status: 'IN_PROGRESS', startedAt: now },
  })

  revalidatePath(`/student/tests/${sessionId}`)
  return { startedAt: now.toISOString() }
}

// 응답 일괄 저장 (자동 저장)
export async function saveResponses(
  sessionId: string,
  responses: { questionId: string; answer: string }[],
  currentQuestionIdx: number,
): Promise<{ error?: string }> {
  const auth = await getAuthedStudent()
  if (!auth) return { error: '권한이 없습니다.' }

  const session = await prisma.testSession.findUnique({
    where: { id: sessionId, studentId: auth.studentId },
    select: { id: true, status: true },
  })
  if (!session || session.status !== 'IN_PROGRESS') return { error: '유효하지 않은 세션입니다.' }

  try {
    await prisma.$transaction(async (tx) => {
      for (const r of responses) {
        const existing = await tx.questionResponse.findFirst({
          where: { sessionId, questionId: r.questionId },
          select: { id: true },
        })
        if (existing) {
          await tx.questionResponse.update({
            where: { id: existing.id },
            data: { answer: r.answer },
          })
        } else {
          await tx.questionResponse.create({
            data: { sessionId, questionId: r.questionId, answer: r.answer },
          })
        }
      }
      await tx.testSession.update({
        where: { id: sessionId },
        data: { lastSavedAt: new Date(), currentQuestionIdx },
      })
    })
    return {}
  } catch {
    return { error: '저장에 실패했습니다.' }
  }
}

// 테스트 제출 (자동 채점 포함)
export async function submitTest(
  sessionId: string,
  allAnswers: { questionId: string; answer: string }[],
): Promise<{ error?: string }> {
  const auth = await getAuthedStudent()
  if (!auth) return { error: '권한이 없습니다.' }

  const session = await prisma.testSession.findUnique({
    where: { id: sessionId, studentId: auth.studentId },
    select: {
      id: true,
      status: true,
      studentId: true,
      test: {
        select: {
          questionOrder: true,
          title: true,
          createdBy: true,
          academyId: true,
        },
      },
    },
  })
  if (!session || session.status !== 'IN_PROGRESS') return { error: '유효하지 않은 세션입니다.' }

  const questionIds = (session.test.questionOrder as string[]) || []
  const questions = await prisma.question.findMany({
    where: { id: { in: questionIds } },
    select: { id: true, contentJson: true, domain: true },
  })

  const answerMap = new Map(allAnswers.map((r) => [r.questionId, r.answer]))

  // 도메인별 채점 통계
  type DomainKey = 'GRAMMAR' | 'VOCABULARY' | 'READING' | 'WRITING'
  const domainStats: Record<DomainKey, { correct: number; total: number }> = {
    GRAMMAR: { correct: 0, total: 0 },
    VOCABULARY: { correct: 0, total: 0 },
    READING: { correct: 0, total: 0 },
    WRITING: { correct: 0, total: 0 },
  }

  let hasEssay = false

  try {
    await prisma.$transaction(async (tx) => {
      // 응답 저장 + 채점
      for (const q of questions) {
        const content = q.contentJson as QuestionContentJson
        const studentAnswer = answerMap.get(q.id) ?? ''
        const domain = q.domain as DomainKey

        let isCorrect: boolean | null = null

        if (content.type === 'essay') {
          // 에세이: 교사 채점 대기
          hasEssay = true
          isCorrect = null
        } else if (
          (content.type === 'multiple_choice' ||
            content.type === 'fill_blank' ||
            content.type === 'short_answer') &&
          content.correct_answer
        ) {
          domainStats[domain].total++
          if (studentAnswer) {
            isCorrect =
              studentAnswer.toLowerCase().trim() === content.correct_answer.toLowerCase().trim()
            if (isCorrect) domainStats[domain].correct++
          }
        }

        const existing = await tx.questionResponse.findFirst({
          where: { sessionId, questionId: q.id },
          select: { id: true },
        })
        if (existing) {
          await tx.questionResponse.update({
            where: { id: existing.id },
            data: { answer: studentAnswer || null, isCorrect },
          })
        } else if (studentAnswer) {
          await tx.questionResponse.create({
            data: { sessionId, questionId: q.id, answer: studentAnswer, isCorrect },
          })
        }
      }

      // 도메인별 점수 계산 (0-100, 문제 없으면 null)
      const calcDomainScore = (key: DomainKey): number | null => {
        const { correct, total } = domainStats[key]
        if (total === 0) return null
        return Math.round((correct / total) * 100)
      }

      const grammarScore = calcDomainScore('GRAMMAR')
      const vocabularyScore = calcDomainScore('VOCABULARY')
      const readingScore = calcDomainScore('READING')

      // 객관식 전체 점수
      const totalObjective = Object.values(domainStats)
        .filter((_, i) => ['GRAMMAR', 'VOCABULARY', 'READING'].includes(Object.keys(domainStats)[i]))
        .reduce((sum, d) => sum + d.total, 0)
      const totalCorrect = Object.values(domainStats)
        .filter((_, i) => ['GRAMMAR', 'VOCABULARY', 'READING'].includes(Object.keys(domainStats)[i]))
        .reduce((sum, d) => sum + d.correct, 0)

      const score = totalObjective > 0 ? Math.round((totalCorrect / totalObjective) * 100) : null

      await tx.testSession.update({
        where: { id: sessionId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          lastSavedAt: new Date(),
          score,
          grammarScore,
          vocabularyScore,
          readingScore,
          // writingScore는 교사 채점 후 업데이트
        },
      })

      // 영역별 SkillAssessment 기록
      for (const [domain, stats] of Object.entries(domainStats)) {
        if (stats.total > 0) {
          const domScore = Math.round((stats.correct / stats.total) * 100)
          await tx.skillAssessment.create({
            data: {
              studentId: auth.studentId,
              domain: domain as DomainKey,
              level: 1,
              score: domScore,
              notes: `자동 채점 - ${session.test.title}`,
            },
          })
        }
      }

      // 교사에게 채점 대기 알림 (쓰기 문제가 있는 경우)
      if (hasEssay) {
        await tx.notification.create({
          data: {
            userId: session.test.createdBy,
            academyId: session.test.academyId,
            type: 'WARNING',
            title: '쓰기 채점 대기 중',
            message: `"${session.test.title}" 테스트에서 학생의 쓰기 답안이 채점을 기다리고 있습니다.`,
          },
        })
      }
    })

    revalidatePath(`/student/tests/${sessionId}`)
    revalidatePath('/student')
    return {}
  } catch {
    return { error: '제출에 실패했습니다.' }
  }
}
