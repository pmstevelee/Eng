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
      test: { select: { questionOrder: true } },
    },
  })
  if (!session || session.status !== 'IN_PROGRESS') return { error: '유효하지 않은 세션입니다.' }

  const questionIds = (session.test.questionOrder as string[]) || []
  const questions = await prisma.question.findMany({
    where: { id: { in: questionIds } },
    select: { id: true, contentJson: true, domain: true },
  })

  const answerMap = new Map(allAnswers.map((r) => [r.questionId, r.answer]))

  let totalCorrect = 0

  try {
    await prisma.$transaction(async (tx) => {
      // 응답 저장 + 채점
      for (const q of questions) {
        const content = q.contentJson as QuestionContentJson
        const studentAnswer = answerMap.get(q.id) ?? ''

        let isCorrect: boolean | null = null
        if (
          (content.type === 'multiple_choice' ||
            content.type === 'fill_blank' ||
            content.type === 'short_answer') &&
          studentAnswer &&
          content.correct_answer
        ) {
          isCorrect =
            studentAnswer.toLowerCase().trim() === content.correct_answer.toLowerCase().trim()
          if (isCorrect) totalCorrect++
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

      const gradableCount = questions.filter((q) => {
        const c = q.contentJson as QuestionContentJson
        return c.type !== 'essay'
      }).length

      const score =
        gradableCount > 0 ? Math.round((totalCorrect / gradableCount) * 100) : null

      await tx.testSession.update({
        where: { id: sessionId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          lastSavedAt: new Date(),
          score,
        },
      })
    })

    revalidatePath(`/student/tests/${sessionId}`)
    revalidatePath('/student')
    return {}
  } catch {
    return { error: '제출에 실패했습니다.' }
  }
}
