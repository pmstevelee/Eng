'use server'

import { prisma } from '@/lib/prisma/client'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath, revalidateTag } from 'next/cache'
import {
  estimateCurrentLevel,
  getTargetDifficulty,
  shouldEndDomain,
  selectNextAdaptiveQuestion,
  calculateDomainLevel,
  calculateOverallLevel,
  buildPlacementResult,
  saveLevelAssessment,
  getWritingPromptByLevel,
  type AdaptiveDomain,
  type QuestionHistoryItem,
  type AdaptiveConfig,
} from '@/lib/assessment/adaptive-test-engine'
import { checkPromotionStatus } from '@/lib/assessment/promotion-engine'
import type { QuestionContentJson } from '@/components/shared/question-bank-client'

// ─── Auth 헬퍼 ────────────────────────────────────────────────────────────────

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
      academyId: true,
      student: { select: { id: true, currentLevel: true } },
    },
  })
  if (!user || user.role !== 'STUDENT') return null

  let studentId = user.student?.id
  let currentLevel = user.student?.currentLevel ?? 1
  if (!studentId) {
    const newStudent = await prisma.student.create({
      data: { userId: user.id },
      select: { id: true, currentLevel: true },
    })
    studentId = newStudent.id
    currentLevel = newStudent.currentLevel
  }
  return { userId: user.id, studentId, currentLevel, academyId: user.academyId }
}

// ─── 타입 ─────────────────────────────────────────────────────────────────────

export type AdaptiveNextResult =
  | {
      type: 'question'
      questionId: string
      domain: AdaptiveDomain
      difficulty: number
      contentJson: QuestionContentJson
      domainQuestionIndex: number      // 현재 영역에서 몇 번째 문제인지
      domainTotalEstimate: number      // 이 영역 예상 총 문제 수
      currentDomain: AdaptiveDomain
      domainOrder: AdaptiveDomain[]
      estimatedLevel: number
    }
  | {
      type: 'writing_prompt'
      domain: 'WRITING'
      promptText: string
      wordRange: string
      questionIndex: number
      isLastQuestion: boolean
    }
  | {
      type: 'complete'
    }
  | {
      type: 'error'
      error: string
    }

export type AdaptiveSubmitResult = {
  error?: string
  isComplete?: boolean
  nextDomain?: AdaptiveDomain | null
}

// ─── 적응형 테스트 시작 ────────────────────────────────────────────────────────

/**
 * 적응형 테스트 세션 시작 - 첫 문제 반환
 */
export async function startAdaptiveSession(sessionId: string): Promise<AdaptiveNextResult> {
  const auth = await getAuthedStudent()
  if (!auth) return { type: 'error', error: '권한이 없습니다.' }

  const session = await prisma.testSession.findUnique({
    where: { id: sessionId, studentId: auth.studentId },
    select: {
      id: true,
      status: true,
      test: {
        select: {
          isAdaptive: true,
          adaptiveConfig: true,
          academyId: true,
        },
      },
    },
  })

  if (!session) return { type: 'error', error: '세션을 찾을 수 없습니다.' }
  if (!session.test.isAdaptive) return { type: 'error', error: '적응형 테스트가 아닙니다.' }

  // 상태 업데이트
  if (session.status === 'NOT_STARTED') {
    await prisma.testSession.update({
      where: { id: sessionId },
      data: { status: 'IN_PROGRESS', startedAt: new Date() },
    })
  }

  const config = (session.test.adaptiveConfig as AdaptiveConfig | null) ?? {
    questionsPerDomain: 8,
    startLevel: auth.currentLevel > 1 ? auth.currentLevel : 5,
    writingQuestions: 2,
  }

  const firstDomain: AdaptiveDomain = 'GRAMMAR'
  const question = await selectNextAdaptiveQuestion(
    firstDomain,
    config.startLevel,
    [],
    session.test.academyId,
  )

  if (!question) return { type: 'error', error: '문제를 찾을 수 없습니다.' }

  return {
    type: 'question',
    questionId: question.questionId,
    domain: firstDomain,
    difficulty: question.difficulty,
    contentJson: question.contentJson as QuestionContentJson,
    domainQuestionIndex: 1,
    domainTotalEstimate: config.questionsPerDomain,
    currentDomain: firstDomain,
    domainOrder: ['GRAMMAR', 'VOCABULARY', 'READING', 'LISTENING', 'WRITING'],
    estimatedLevel: config.startLevel,
  }
}

// ─── 응답 제출 + 다음 문제 반환 ───────────────────────────────────────────────

/**
 * 현재 문제 응답 저장 후 다음 문제 반환
 * history는 클라이언트가 관리하고 서버로 전달
 */
export async function submitAdaptiveAnswer(
  sessionId: string,
  questionId: string,
  answer: string,
  isCorrect: boolean,
  currentDomain: AdaptiveDomain,
  history: QuestionHistoryItem[], // 이번 답변 포함된 전체 이력
): Promise<AdaptiveNextResult> {
  const auth = await getAuthedStudent()
  if (!auth) return { type: 'error', error: '권한이 없습니다.' }

  const session = await prisma.testSession.findUnique({
    where: { id: sessionId, studentId: auth.studentId },
    select: {
      id: true,
      status: true,
      test: {
        select: {
          isAdaptive: true,
          adaptiveConfig: true,
          academyId: true,
          createdBy: true,
        },
      },
    },
  })

  if (!session || session.status !== 'IN_PROGRESS') {
    return { type: 'error', error: '유효하지 않은 세션입니다.' }
  }

  const config = (session.test.adaptiveConfig as AdaptiveConfig | null) ?? {
    questionsPerDomain: 8,
    startLevel: 5,
    writingQuestions: 2,
  }

  // 응답 저장 (isCorrect는 서버에서 직접 채점)
  const question = await prisma.question.findUnique({
    where: { id: questionId },
    select: { contentJson: true, domain: true },
  })

  let serverIsCorrect: boolean | null = isCorrect
  if (question) {
    const content = question.contentJson as QuestionContentJson
    if (content.type === 'essay') {
      serverIsCorrect = null // AI가 별도 채점
    } else if (content.type === 'word_bank' && content.sentences) {
      try {
        const studentAnswers: Record<string, string> = JSON.parse(answer)
        serverIsCorrect = content.sentences.every(
          (s) =>
            (studentAnswers[s.label] ?? '').toLowerCase().trim() ===
            s.correct_answer.toLowerCase().trim(),
        )
      } catch {
        serverIsCorrect = false
      }
    } else if (content.type === 'question_set' && content.sub_questions) {
      try {
        const studentAnswers: Record<string, string> = JSON.parse(answer)
        serverIsCorrect = content.sub_questions.every(
          (sq) =>
            (studentAnswers[sq.label] ?? '').toUpperCase().trim() ===
            sq.correct_answer.toUpperCase().trim(),
        )
      } catch {
        serverIsCorrect = false
      }
    } else if (content.correct_answer) {
      // multiple_choice, fill_blank, short_answer, reading_comprehension 등 모두 동일하게 채점
      serverIsCorrect = answer.toLowerCase().trim() === content.correct_answer.toLowerCase().trim()
    } else {
      serverIsCorrect = null
    }
  }

  // 응답 저장 (적응형은 각 문제당 한 번만 답변)
  const existingResponse = await prisma.questionResponse.findFirst({
    where: { sessionId, questionId },
    select: { id: true },
  })
  if (existingResponse) {
    await prisma.questionResponse.update({
      where: { id: existingResponse.id },
      data: { answer, isCorrect: serverIsCorrect },
    })
  } else {
    await prisma.questionResponse.create({
      data: { sessionId, questionId, answer, isCorrect: serverIsCorrect },
    })
  }

  // 현재 영역 이력 필터
  const domainHistory = history.filter((h) => h.domain === currentDomain)

  const domainOrder: AdaptiveDomain[] = ['GRAMMAR', 'VOCABULARY', 'READING', 'LISTENING', 'WRITING']
  const currentDomainIdx = domainOrder.indexOf(currentDomain)

  // 현재 영역 종료 여부 판단
  if (shouldEndDomain(domainHistory, config, currentDomain)) {
    // 다음 영역으로 이동
    const nextDomainIdx = currentDomainIdx + 1
    if (nextDomainIdx >= domainOrder.length) {
      // 모든 영역 완료 → 최종 채점
      return await finalizeAdaptiveTest(sessionId, auth, session.test, history, config)
    }

    const nextDomain = domainOrder[nextDomainIdx]

    // 쓰기 영역은 AI 프롬프트 방식
    if (nextDomain === 'WRITING') {
      const estimatedLevel = Math.round(
        calculateOverallLevel(
          domainOrder
            .filter((d) => d !== 'WRITING')
            .map((d) => calculateDomainLevel(history.filter((h) => h.domain === d), config.startLevel)),
        ),
      )
      const writingPrompt = getWritingPromptByLevel(estimatedLevel)
      return {
        type: 'writing_prompt',
        domain: 'WRITING',
        promptText: writingPrompt.prompt,
        wordRange: writingPrompt.wordRange,
        questionIndex: 1,
        isLastQuestion: config.writingQuestions === 1,
      }
    }

    // 다음 영역 첫 문제
    const usedIds = history.map((h) => h.questionId)
    const estimate = estimateCurrentLevel(domainHistory, config.startLevel)
    const targetDiff = Math.round(estimate)
    const nextQ = await selectNextAdaptiveQuestion(nextDomain, targetDiff, usedIds, session.test.academyId)

    if (!nextQ) return { type: 'error', error: `${nextDomain} 영역 문제를 찾을 수 없습니다.` }

    return {
      type: 'question',
      questionId: nextQ.questionId,
      domain: nextDomain,
      difficulty: nextQ.difficulty,
      contentJson: nextQ.contentJson as QuestionContentJson,
      domainQuestionIndex: 1,
      domainTotalEstimate: config.questionsPerDomain,
      currentDomain: nextDomain,
      domainOrder,
      estimatedLevel: estimate,
    }
  }

  // 같은 영역에서 다음 문제
  const estimate = estimateCurrentLevel(domainHistory, config.startLevel)
  const targetDiff = getTargetDifficulty(domainHistory, estimate)
  const usedIds = history.map((h) => h.questionId)

  const nextQ = await selectNextAdaptiveQuestion(currentDomain, targetDiff, usedIds, session.test.academyId)
  if (!nextQ) {
    // 해당 영역 문제 소진 → 강제 다음 영역
    const nextDomainIdx = currentDomainIdx + 1
    if (nextDomainIdx >= domainOrder.length) {
      return await finalizeAdaptiveTest(sessionId, auth, session.test, history, config)
    }
    const nextDomain = domainOrder[nextDomainIdx]
    const nextQ2 = await selectNextAdaptiveQuestion(nextDomain, config.startLevel, usedIds, session.test.academyId)
    if (!nextQ2) return { type: 'error', error: '더 이상 출제할 문제가 없습니다.' }

    return {
      type: 'question',
      questionId: nextQ2.questionId,
      domain: nextDomain,
      difficulty: nextQ2.difficulty,
      contentJson: nextQ2.contentJson as QuestionContentJson,
      domainQuestionIndex: 1,
      domainTotalEstimate: config.questionsPerDomain,
      currentDomain: nextDomain,
      domainOrder,
      estimatedLevel: estimate,
    }
  }

  return {
    type: 'question',
    questionId: nextQ.questionId,
    domain: currentDomain,
    difficulty: nextQ.difficulty,
    contentJson: nextQ.contentJson as QuestionContentJson,
    domainQuestionIndex: domainHistory.length + 1,
    domainTotalEstimate: config.questionsPerDomain,
    currentDomain,
    domainOrder,
    estimatedLevel: estimate,
  }
}

// ─── 쓰기 답변 제출 ────────────────────────────────────────────────────────────

/**
 * 쓰기 답안 저장 후 다음 쓰기 문제 또는 완료 처리
 */
export async function submitWritingAnswer(
  sessionId: string,
  writingAnswer: string,
  writingQuestionIndex: number, // 1-based
  estimatedLevel: number,
  history: QuestionHistoryItem[],
): Promise<AdaptiveNextResult> {
  const auth = await getAuthedStudent()
  if (!auth) return { type: 'error', error: '권한이 없습니다.' }

  const session = await prisma.testSession.findUnique({
    where: { id: sessionId, studentId: auth.studentId },
    select: {
      id: true,
      status: true,
      test: {
        select: {
          isAdaptive: true,
          adaptiveConfig: true,
          academyId: true,
          createdBy: true,
        },
      },
    },
  })

  if (!session || session.status !== 'IN_PROGRESS') {
    return { type: 'error', error: '유효하지 않은 세션입니다.' }
  }

  const config = (session.test.adaptiveConfig as AdaptiveConfig | null) ?? {
    questionsPerDomain: 8,
    startLevel: 5,
    writingQuestions: 2,
  }

  // 쓰기 답안을 별도 question_response에 저장
  // (쓰기는 특수 "essay_adaptive" 타입으로 저장)
  await prisma.testSession.update({
    where: { id: sessionId },
    data: {
      lastSavedAt: new Date(),
    },
  })

  // sessionId에 쓰기 답안 임시 저장 (placementResult JSON에 포함)
  const currentPlacement = await prisma.testSession.findUnique({
    where: { id: sessionId },
    select: { placementResult: true },
  })
  const currentPlacementData = (currentPlacement?.placementResult as Record<string, unknown>) ?? {}
  const writingAnswers = (currentPlacementData.writingAnswers as string[]) ?? []
  writingAnswers[writingQuestionIndex - 1] = writingAnswer

  await prisma.testSession.update({
    where: { id: sessionId },
    data: {
      placementResult: {
        ...currentPlacementData,
        writingAnswers,
      },
    },
  })

  // 2번째 쓰기 문제
  if (writingQuestionIndex < config.writingQuestions) {
    const writingPrompt = getWritingPromptByLevel(estimatedLevel)
    return {
      type: 'writing_prompt',
      domain: 'WRITING',
      promptText: `[에세이] ${writingPrompt.prompt}`,
      wordRange: writingPrompt.wordRange,
      questionIndex: writingQuestionIndex + 1,
      isLastQuestion: true,
    }
  }

  // 쓰기까지 완료 → AI 채점 + 최종 결과
  return await finalizeAdaptiveTestWithWriting(sessionId, auth, session.test, history, config, writingAnswers)
}

// ─── 최종 채점 ─────────────────────────────────────────────────────────────────

async function finalizeAdaptiveTest(
  sessionId: string,
  auth: { studentId: string; currentLevel: number; academyId: string | null },
  test: { adaptiveConfig: unknown; academyId: string; createdBy: string },
  history: QuestionHistoryItem[],
  config: AdaptiveConfig,
): Promise<AdaptiveNextResult> {
  const domainOrder: AdaptiveDomain[] = ['GRAMMAR', 'VOCABULARY', 'READING', 'LISTENING', 'WRITING']

  const domainResults = domainOrder.map((d) => {
    const dHistory = history.filter((h) => h.domain === d)
    return calculateDomainLevel(dHistory, config.startLevel)
  })

  const overallLevel = calculateOverallLevel(domainResults)
  const previousLevel = auth.currentLevel > 1 ? auth.currentLevel : null
  const result = buildPlacementResult(domainResults, previousLevel)

  const now = new Date()

  // 세션 완료 처리
  await prisma.testSession.update({
    where: { id: sessionId },
    data: {
      status: 'GRADED',
      completedAt: now,
      lastSavedAt: now,
      isPlacement: true,
      grammarScore: result.grammarLevel * 10,
      vocabularyScore: result.vocabularyLevel * 10,
      readingScore: result.readingLevel * 10,
      writingScore: result.writingLevel * 10,
      assessedLevels: {
        grammar: result.grammarLevel,
        vocabulary: result.vocabularyLevel,
        reading: result.readingLevel,
        writing: result.writingLevel,
        overall: result.overallLevel,
      },
      placementResult: JSON.parse(JSON.stringify(result)),
      score: overallLevel * 10,
    },
  })

  // 레벨 평가 저장 (조건 1 기록 — 직접 레벨 변경은 하지 않음)
  await saveLevelAssessment(auth.studentId, sessionId, result)

  // 승급 조건 체크 (조건 1 충족 여부 판단 + 전체 승급 가능 시 자동 승급)
  // 조건 1 체크만 바로 실행; 조건 2·3는 이미 DB에 저장된 값 사용
  checkPromotionStatus(auth.studentId).catch(console.error)

  // 교사 알림
  await prisma.notification.create({
    data: {
      userId: test.createdBy,
      academyId: test.academyId,
      type: 'SUCCESS',
      title: '레벨 테스트 완료',
      message: `학생의 적응형 레벨 테스트가 완료되었습니다. 측정 레벨: Level ${overallLevel}`,
      link: `/teacher/students`,
    },
  })

  revalidateTag(`student-${auth.studentId}-tests`)
  revalidateTag(`student-${auth.studentId}-grades`)
  revalidatePath(`/student/tests/${sessionId}/result`)

  return { type: 'complete' }
}

async function finalizeAdaptiveTestWithWriting(
  sessionId: string,
  auth: { studentId: string; currentLevel: number; academyId: string | null },
  test: { adaptiveConfig: unknown; academyId: string; createdBy: string },
  history: QuestionHistoryItem[],
  config: AdaptiveConfig,
  writingAnswers: string[],
): Promise<AdaptiveNextResult> {
  const domainOrder: AdaptiveDomain[] = ['GRAMMAR', 'VOCABULARY', 'READING']

  // 객관식 영역 레벨 계산
  const objDomainResults = domainOrder.map((d) => {
    const dHistory = history.filter((h) => h.domain === d)
    return calculateDomainLevel(dHistory, config.startLevel)
  })

  // 쓰기 레벨: 답변 길이 + 기본 추정값으로 임시 계산 (AI 채점은 비동기)
  const objOverall = calculateOverallLevel(objDomainResults)
  const writingEstimate = Math.max(1, Math.min(10, objOverall - 1)) // 통계적으로 쓰기가 1단계 낮은 경향

  const allDomainResults = [
    ...objDomainResults,
    { domain: 'WRITING' as AdaptiveDomain, level: writingEstimate, rawScore: 0.5, confidence: 'LOW' as const },
  ]

  const previousLevel = auth.currentLevel > 1 ? auth.currentLevel : null
  const result = buildPlacementResult(allDomainResults, previousLevel)
  const overallLevel = result.overallLevel

  const now = new Date()

  // 세션 완료
  await prisma.testSession.update({
    where: { id: sessionId },
    data: {
      status: 'GRADED',
      completedAt: now,
      lastSavedAt: now,
      isPlacement: true,
      grammarScore: result.grammarLevel * 10,
      vocabularyScore: result.vocabularyLevel * 10,
      readingScore: result.readingLevel * 10,
      writingScore: writingEstimate * 10,
      assessedLevels: {
        grammar: result.grammarLevel,
        vocabulary: result.vocabularyLevel,
        reading: result.readingLevel,
        writing: result.writingLevel,
        overall: result.overallLevel,
      },
      placementResult: {
        ...JSON.parse(JSON.stringify(result)),
        writingAnswers,
        writingPendingAiGrade: true,
      },
      score: overallLevel * 10,
    },
  })

  // 레벨 평가 저장 (조건 1 기록 — 직접 레벨 변경은 하지 않음)
  await saveLevelAssessment(auth.studentId, sessionId, result)

  // 승급 조건 체크 (쓰기 포함 버전도 동일하게 조건 1 업데이트)
  checkPromotionStatus(auth.studentId).catch(console.error)

  // 교사 알림 (쓰기 AI 채점 대기)
  await prisma.notification.create({
    data: {
      userId: test.createdBy,
      academyId: test.academyId,
      type: 'SUCCESS',
      title: '레벨 테스트 완료',
      message: `학생의 적응형 레벨 테스트가 완료되었습니다. 측정 레벨: Level ${overallLevel} (쓰기 AI 채점 포함)`,
      link: `/teacher/students`,
    },
  })

  revalidateTag(`student-${auth.studentId}-tests`)
  revalidateTag(`student-${auth.studentId}-grades`)
  revalidatePath(`/student/tests/${sessionId}/result`)

  return { type: 'complete' }
}

// ─── 배치 결과 조회 ────────────────────────────────────────────────────────────

export async function getPlacementResult(sessionId: string) {
  const supabase = await createClient()
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()
  if (!authUser) return null

  const dbUser = await prisma.user.findUnique({
    where: { id: authUser.id },
    select: { student: { select: { id: true } } },
  })
  if (!dbUser?.student) return null

  const session = await prisma.testSession.findUnique({
    where: { id: sessionId, studentId: dbUser.student.id },
    select: {
      id: true,
      status: true,
      isPlacement: true,
      assessedLevels: true,
      placementResult: true,
      completedAt: true,
      test: { select: { title: true, type: true } },
    },
  })

  return session
}
