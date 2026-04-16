'use server'

import { prisma } from '@/lib/prisma/client'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath, revalidateTag } from 'next/cache'
import type { QuestionContentJson } from '@/components/shared/question-bank-client'
import { recordActivityAndCheckBadges } from '@/app/(dashboard)/student/_actions/gamification'
import { recordLevelTestUsage } from '@/lib/questions/usage-tracker'
import { updateQuestionQuality } from '@/lib/questions/quality-updater'
import { checkPromotionStatus } from '@/lib/assessment/promotion-engine'

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
    // 기존 응답 일괄 조회 (N번 findFirst → 1번 findMany)
    const existingResponses = await prisma.questionResponse.findMany({
      where: { sessionId, questionId: { in: responses.map((r) => r.questionId) } },
      select: { id: true, questionId: true },
    })
    const existingMap = new Map(existingResponses.map((r) => [r.questionId, r.id]))

    // 병렬 저장 + 세션 업데이트 동시 실행
    await Promise.all([
      ...responses.map((r) => {
        const existingId = existingMap.get(r.questionId)
        if (existingId) {
          return prisma.questionResponse.update({
            where: { id: existingId },
            data: { answer: r.answer },
          })
        }
        return prisma.questionResponse.create({
          data: { sessionId, questionId: r.questionId, answer: r.answer },
        })
      }),
      prisma.testSession.update({
        where: { id: sessionId },
        data: { lastSavedAt: new Date(), currentQuestionIdx },
      }),
    ])
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
      testId: true,
      status: true,
      studentId: true,
      test: {
        select: {
          questionOrder: true,
          title: true,
          type: true,
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
  type DomainKey = 'GRAMMAR' | 'VOCABULARY' | 'READING' | 'WRITING' | 'LISTENING'
  const domainStats: Record<DomainKey, { correct: number; total: number }> = {
    GRAMMAR: { correct: 0, total: 0 },
    VOCABULARY: { correct: 0, total: 0 },
    READING: { correct: 0, total: 0 },
    WRITING: { correct: 0, total: 0 },
    LISTENING: { correct: 0, total: 0 },
  }

  let hasEssay = false

  try {
    // 1단계: 채점 계산 (동기, DB 없음)
    const questionGrades = questions.map((q) => {
      const content = q.contentJson as QuestionContentJson
      const studentAnswer = answerMap.get(q.id) ?? ''
      const domain = q.domain as DomainKey
      let isCorrect: boolean | null = null

      if (content.type === 'essay') {
        hasEssay = true
      } else if (content.type === 'word_bank' && content.sentences) {
        domainStats[domain].total++
        if (studentAnswer) {
          try {
            const studentAnswers: Record<string, string> = JSON.parse(studentAnswer)
            const allCorrect = content.sentences.every(
              (s) =>
                (studentAnswers[s.label] ?? '').toLowerCase().trim() ===
                s.correct_answer.toLowerCase().trim(),
            )
            isCorrect = allCorrect
            if (isCorrect) domainStats[domain].correct++
          } catch {
            isCorrect = false
          }
        }
      } else if (content.type === 'sentence_order' && content.order_sentences) {
        domainStats[domain].total++
        if (studentAnswer) {
          try {
            const studentAnswers: Record<string, string> = JSON.parse(studentAnswer)
            const allCorrect = content.order_sentences.every(
              (item) =>
                (studentAnswers[item.label] ?? '').trim() === item.correct_answer.trim(),
            )
            isCorrect = allCorrect
            if (isCorrect) domainStats[domain].correct++
          } catch {
            isCorrect = false
          }
        }
      } else if (content.type === 'question_set' && content.sub_questions) {
        domainStats[domain].total++
        if (studentAnswer) {
          try {
            const studentAnswers: Record<string, string> = JSON.parse(studentAnswer)
            const allCorrect = content.sub_questions.every(
              (sq) =>
                (studentAnswers[sq.label] ?? '').toUpperCase().trim() ===
                sq.correct_answer.toUpperCase().trim(),
            )
            isCorrect = allCorrect
            if (isCorrect) domainStats[domain].correct++
          } catch {
            isCorrect = false
          }
        }
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

      return { q, studentAnswer, isCorrect }
    })

    // 2단계: 기존 응답 일괄 조회 (N번 findFirst → 1번 findMany)
    const existingResponses = await prisma.questionResponse.findMany({
      where: { sessionId },
      select: { id: true, questionId: true },
    })
    const existingMap = new Map(existingResponses.map((r) => [r.questionId, r.id]))

    // 3단계: 도메인별 점수 계산
    const calcDomainScore = (key: DomainKey): number | null => {
      const { correct, total } = domainStats[key]
      if (total === 0) return null
      return Math.round((correct / total) * 100)
    }

    const grammarScore = calcDomainScore('GRAMMAR')
    const vocabularyScore = calcDomainScore('VOCABULARY')
    const readingScore = calcDomainScore('READING')

    const totalObjective = (['GRAMMAR', 'VOCABULARY', 'READING', 'LISTENING'] as DomainKey[]).reduce(
      (sum, k) => sum + domainStats[k].total,
      0,
    )
    const totalCorrect = (['GRAMMAR', 'VOCABULARY', 'READING', 'LISTENING'] as DomainKey[]).reduce(
      (sum, k) => sum + domainStats[k].correct,
      0,
    )
    const score = totalObjective > 0 ? Math.round((totalCorrect / totalObjective) * 100) : null

    const now = new Date()

    // 4단계: 응답 저장 + 세션 업데이트 + SkillAssessment + 알림 병렬 실행
    await Promise.all([
      // 응답 저장 (병렬)
      ...questionGrades.map(({ q, studentAnswer, isCorrect }) => {
        const existingId = existingMap.get(q.id)
        if (existingId) {
          return prisma.questionResponse.update({
            where: { id: existingId },
            data: { answer: studentAnswer || null, isCorrect },
          })
        } else if (studentAnswer) {
          return prisma.questionResponse.create({
            data: { sessionId, questionId: q.id, answer: studentAnswer, isCorrect },
          })
        }
        return Promise.resolve()
      }),
      // 세션 상태 업데이트
      prisma.testSession.update({
        where: { id: sessionId },
        data: {
          status: hasEssay ? 'COMPLETED' : 'GRADED',
          completedAt: now,
          lastSavedAt: now,
          score,
          grammarScore,
          vocabularyScore,
          readingScore,
        },
      }),
      // SkillAssessment 병렬 생성
      ...Object.entries(domainStats)
        .filter(([, stats]) => stats.total > 0)
        .map(([domain, stats]) =>
          prisma.skillAssessment.create({
            data: {
              studentId: auth.studentId,
              domain: domain as DomainKey,
              level: 1,
              score: Math.round((stats.correct / stats.total) * 100),
              notes: `자동 채점 - ${session.test.title}`,
            },
          }),
        ),
      // 교사 알림 (쓰기 문제가 있는 경우)
      hasEssay
        ? prisma.notification.create({
            data: {
              userId: session.test.createdBy,
              academyId: session.test.academyId,
              type: 'WARNING',
              title: '쓰기 채점 대기 중',
              message: `"${session.test.title}" 테스트에서 학생의 쓰기 답안이 채점을 기다리고 있습니다.`,
            },
          })
        : Promise.resolve(),
    ])

    // 5단계: 게이미피케이션 (세션 업데이트 완료 후 실행)
    const gamification = await recordActivityAndCheckBadges(auth.studentId, sessionId)

    // 6단계: 레벨 테스트 사용 이력 기록 (비동기, 다음 레벨 테스트 중복 방지용)
    if (session.test.type === 'LEVEL_TEST' && session.test.academyId) {
      recordLevelTestUsage(session.test.academyId, session.testId, questionIds).catch(
        console.error,
      )
    }

    // 7-1단계: 단원 테스트 완료 시 승급 조건 2 업데이트 (비동기)
    // 단원 테스트 이수율과 평균점수가 변경될 수 있으므로 승급 조건을 재계산
    if (session.test.type === 'UNIT_TEST') {
      checkPromotionStatus(auth.studentId).catch(console.error)
    }

    // 7단계: 문제 품질 점수 비동기 갱신 (학생 응답 속도에 영향 없음)
    for (const qId of questionIds) {
      updateQuestionQuality(qId).catch(console.error)
    }

    revalidateTag(`student-${auth.studentId}-tests`)
    revalidateTag(`student-${auth.studentId}-grades`)
    revalidateTag(`student-${auth.studentId}-learning`)
    revalidateTag(`student-${auth.studentId}-badges`)
    revalidateTag(`owner-${session.test.academyId}-dashboard`)
    revalidatePath(`/student/tests/${sessionId}`)
    revalidatePath('/student')
    return { newBadges: gamification.newBadges }
  } catch (err) {
    console.error('submitTest error:', err)
    return { error: '제출에 실패했습니다.' }
  }
}
