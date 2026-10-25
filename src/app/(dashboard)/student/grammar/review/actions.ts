'use server'

// 학생 문법 복습 Server Actions — 포인트 복습 · 문항 복습 · 오답노트 다시 풀기
//
// - 채점은 서버에서 answer-checker로 한다 (클라이언트가 보낸 정답 여부는 쓰지 않음)
// - 포인트 복습: mastery-engine REVIEW_DONE → 진도·시도 기록 한 트랜잭션, 숙달 시 XP
// - 문항 복습: 기존 recordQuestionAnswers() 규칙 그대로 (복습 간격 규칙을 새로 만들지 않음)

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma/client'
import { requireStudent } from '@/lib/auth-student'
import { recordQuestionAnswers } from '@/lib/missions/question-review'
import type { QuestionDomain } from '@/generated/prisma'
import { REVIEW_SIZE, XP_MASTER } from '@/lib/grammar/constants'
import { applyGrammarEvent, toScore } from '@/lib/grammar/mastery-engine'
import { isPointReviewDue } from '@/lib/grammar/review-logic'
import {
  QUESTION_REVIEW_BATCH,
  gradeWrongNoteAnswer,
  loadDueReviewPool,
  reviewQuestionIds,
  type GrammarReviewResult,
} from '@/lib/grammar/review-queries'
import {
  buildResultItems,
  findStudentPoint,
  gradePoolAnswer,
  lastAttemptIds,
  loadGrammarSettings,
  loadQuestionPool,
  toMasteryProgress,
} from '@/lib/grammar/unit-queries'
import {
  normalizeSubmitted,
  runGrammarSideEffects,
  saveGrammarProgress,
  type SubmittedAnswer,
} from '@/lib/grammar/unit-save'
import { endOfTodayKst } from '@/lib/attendance/time'

export type ReviewActionResult<T> = ({ ok: true } & T) | { ok: false; error: string }

const SAVE_FAILED = '저장하지 못했어요. 잠시 후 다시 시도해 주세요.'
const CHANGED = '복습 문제가 바뀌었어요. 새로고침한 뒤 다시 풀어 주세요.'

function revalidateGrammar() {
  revalidatePath('/student/grammar', 'layout')
  revalidatePath('/student/daily-mission')
}

/** 포인트 복습 제출 — 5문항 일괄 채점 → REVIEW_DONE */
export async function submitGrammarReview(
  code: string,
  answers: SubmittedAnswer[],
): Promise<ReviewActionResult<{ result: GrammarReviewResult }>> {
  const { user, studentId } = await requireStudent()
  const academyId = user.academyId ?? ''
  const point = academyId && typeof code === 'string' ? await findStudentPoint(code, academyId) : null
  if (!point) return { ok: false, error: '단원을 찾을 수 없어요. 복습 목록에서 다시 들어와 주세요.' }

  const [pool, progressRow, settings, lastReview] = await Promise.all([
    loadQuestionPool(point.id, academyId),
    prisma.grammarPointProgress.findUnique({
      where: { studentId_grammarPointId: { studentId, grammarPointId: point.id } },
    }),
    loadGrammarSettings(academyId),
    prisma.grammarAttempt.findFirst({
      where: { studentId, grammarPointId: point.id, kind: 'REVIEW' },
      orderBy: { createdAt: 'desc' },
      select: { answersJson: true },
    }),
  ])
  const progress = toMasteryProgress(progressRow)
  if (!progress || !isPointReviewDue(progress, endOfTodayKst())) {
    return { ok: false, error: '지금은 이 단원을 복습할 때가 아니에요. 복습 목록을 새로고침해 주세요.' }
  }

  const byId = new Map(pool.map((q) => [q.id, q]))
  const expected = reviewQuestionIds(studentId, point.id, progress, Array.from(byId.keys()), lastAttemptIds(lastReview))
  if (expected.length === 0) return { ok: false, error: '이 단원의 복습 문제가 아직 준비되지 않았어요.' }

  const submitted = normalizeSubmitted(answers).slice(0, REVIEW_SIZE)
  const expectedSet = new Set(expected)
  if (submitted.length !== expected.length || submitted.some((a) => !expectedSet.has(a.questionId))) {
    return { ok: false, error: CHANGED }
  }

  const graded = submitted.map((a) => gradePoolAnswer(byId.get(a.questionId)!, a.answer))
  const correct = graded.filter((g) => g.isCorrect).length
  const score = toScore(correct, graded.length)
  const result = applyGrammarEvent(progress, { type: 'REVIEW_DONE', score }, settings, new Date())

  try {
    await saveGrammarProgress(studentId, point.id, result, { kind: 'REVIEW', graded })
  } catch (error) {
    console.error('[grammar-review] 포인트 복습 저장 실패:', error)
    return { ok: false, error: SAVE_FAILED }
  }
  await runGrammarSideEffects(studentId, point.id, byId, graded, result)
  revalidateGrammar()

  return {
    ok: true,
    result: {
      score,
      correctCount: correct,
      totalCount: graded.length,
      items: buildResultItems(byId, graded),
      point: {
        passed: result.passedNow,
        passScore: settings.passScore,
        state: result.progress.state,
        reviewStreak: result.progress.reviewStreak,
        masteryReviewStreak: settings.masteryReviewStreak,
        nextReviewAt: result.progress.nextReviewAt ? result.progress.nextReviewAt.toISOString() : null,
        xpEarned: result.firstMastery ? XP_MASTER : 0,
      },
    },
  }
}

/** 문항 복습 제출 — 만기된 내 문법 오답노트 문항만 채점, 결과는 기존 오답노트 규칙으로 */
export async function submitQuestionReview(
  answers: SubmittedAnswer[],
): Promise<ReviewActionResult<{ result: GrammarReviewResult }>> {
  const { studentId } = await requireStudent()
  const submitted = normalizeSubmitted(answers).slice(0, QUESTION_REVIEW_BATCH)
  if (submitted.length === 0) return { ok: false, error: '푼 문제가 없어요.' }

  const pool = await loadDueReviewPool(
    studentId,
    submitted.map((a) => a.questionId),
  )
  if (submitted.some((a) => !pool.has(a.questionId))) return { ok: false, error: CHANGED }

  const graded = submitted.map((a) => gradePoolAnswer(pool.get(a.questionId)!, a.answer))
  try {
    // 오답노트 간격(1→3→7일, 2회 연속 정답이면 해제)과 문법 일자 통계를 함께 갱신한다
    await recordQuestionAnswers(
      studentId,
      graded.map((g) => ({
        questionId: g.questionId,
        domain: pool.get(g.questionId)!.domain as QuestionDomain,
        isCorrect: g.isCorrect,
        gradable: true,
      })),
    )
  } catch (error) {
    console.error('[grammar-review] 문항 복습 저장 실패:', error)
    return { ok: false, error: SAVE_FAILED }
  }
  revalidateGrammar()

  const correct = graded.filter((g) => g.isCorrect).length
  return {
    ok: true,
    result: {
      score: toScore(correct, graded.length),
      correctCount: correct,
      totalCount: graded.length,
      items: buildResultItems(pool, graded),
      point: null,
    },
  }
}

/** 오답노트 다시 풀기 — 채점만 하고 기록·복습 일정은 바꾸지 않는다 */
export async function checkWrongNoteAnswer(
  questionId: string,
  answer: string,
): Promise<ReviewActionResult<{ isCorrect: boolean; correctAnswer: string; explanation: string | null }>> {
  const { studentId } = await requireStudent()
  if (typeof questionId !== 'string') return { ok: false, error: '문제를 찾을 수 없어요.' }
  const graded = await gradeWrongNoteAnswer(studentId, questionId, typeof answer === 'string' ? answer.slice(0, 300) : '')
  if (!graded) return { ok: false, error: '오답노트에서 이 문제를 찾을 수 없어요. 새로고침해 주세요.' }
  return { ok: true, ...graded }
}
