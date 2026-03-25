'use server'

import { prisma } from '@/lib/prisma/client'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath, revalidateTag } from 'next/cache'
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
  if (!user || user.role !== 'STUDENT') return null

  // Student 레코드가 없으면 자동 생성
  let studentId = user.student?.id
  if (!studentId) {
    const newStudent = await prisma.student.create({
      data: { userId: user.id },
      select: { id: true },
    })
    studentId = newStudent.id
  }
  return { userId: user.id, studentId }
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

  revalidateTag(`student-${auth.studentId}-tests`)
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
    // PgBouncer 호환: 인터랙티브 트랜잭션 대신 순차 쿼리
    for (const r of responses) {
      const existing = await prisma.questionResponse.findFirst({
        where: { sessionId, questionId: r.questionId },
        select: { id: true },
      })
      if (existing) {
        await prisma.questionResponse.update({
          where: { id: existing.id },
          data: { answer: r.answer },
        })
      } else {
        await prisma.questionResponse.create({
          data: { sessionId, questionId: r.questionId, answer: r.answer },
        })
      }
    }
    await prisma.testSession.update({
      where: { id: sessionId },
      data: { lastSavedAt: new Date(), currentQuestionIdx },
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
): Promise<{ error?: string; newBadges?: string[] }> {
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
    // PgBouncer 호환: 인터랙티브 트랜잭션 대신 순차 쿼리
    // 1단계: 응답 저장 + 채점 계산
    for (const q of questions) {
      const content = q.contentJson as QuestionContentJson
      const studentAnswer = answerMap.get(q.id) ?? ''
      const domain = q.domain as DomainKey

      let isCorrect: boolean | null = null

      if (content.type === 'essay') {
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

      const existing = await prisma.questionResponse.findFirst({
        where: { sessionId, questionId: q.id },
        select: { id: true },
      })
      if (existing) {
        await prisma.questionResponse.update({
          where: { id: existing.id },
          data: { answer: studentAnswer || null, isCorrect },
        })
      } else if (studentAnswer) {
        await prisma.questionResponse.create({
          data: { sessionId, questionId: q.id, answer: studentAnswer, isCorrect },
        })
      }
    }

    // 2단계: 도메인별 점수 계산
    const calcDomainScore = (key: DomainKey): number | null => {
      const { correct, total } = domainStats[key]
      if (total === 0) return null
      return Math.round((correct / total) * 100)
    }

    const grammarScore = calcDomainScore('GRAMMAR')
    const vocabularyScore = calcDomainScore('VOCABULARY')
    const readingScore = calcDomainScore('READING')

    const totalObjective = (['GRAMMAR', 'VOCABULARY', 'READING'] as DomainKey[]).reduce(
      (sum, k) => sum + domainStats[k].total,
      0,
    )
    const totalCorrect = (['GRAMMAR', 'VOCABULARY', 'READING'] as DomainKey[]).reduce(
      (sum, k) => sum + domainStats[k].correct,
      0,
    )
    const score = totalObjective > 0 ? Math.round((totalCorrect / totalObjective) * 100) : null

    // 3단계: 세션 상태 업데이트 (COMPLETED)
    await prisma.testSession.update({
      where: { id: sessionId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        lastSavedAt: new Date(),
        score,
        grammarScore,
        vocabularyScore,
        readingScore,
      },
    })

    // 4단계: 영역별 SkillAssessment 기록
    for (const [domain, stats] of Object.entries(domainStats)) {
      if (stats.total > 0) {
        const domScore = Math.round((stats.correct / stats.total) * 100)
        await prisma.skillAssessment.create({
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

    // 5단계: 교사 알림 (쓰기 문제가 있는 경우)
    if (hasEssay) {
      await prisma.notification.create({
        data: {
          userId: session.test.createdBy,
          academyId: session.test.academyId,
          type: 'WARNING',
          title: '쓰기 채점 대기 중',
          message: `"${session.test.title}" 테스트에서 학생의 쓰기 답안이 채점을 기다리고 있습니다.`,
        },
      })
    }

    // 6단계: 게이미피케이션 (스트릭, 배지, 레벨업)
    const { recordActivityAndCheckBadges } = await import(
      '@/app/(dashboard)/student/_actions/gamification'
    )
    const gamification = await recordActivityAndCheckBadges(auth.studentId, sessionId)

    revalidateTag(`student-${auth.studentId}-tests`)
    revalidateTag(`student-${auth.studentId}-grades`)
    revalidateTag(`student-${auth.studentId}-learning`)
    revalidateTag(`student-${auth.studentId}-badges`)
    revalidatePath(`/student/tests/${sessionId}`)
    revalidatePath('/student')
    return { newBadges: gamification.newBadges }
  } catch (err) {
    console.error('submitTest error:', err)
    return { error: '제출에 실패했습니다.' }
  }
}
