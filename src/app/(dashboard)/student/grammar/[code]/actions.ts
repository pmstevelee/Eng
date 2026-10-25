'use server'

// 학생 문법 단원 학습 Server Actions — 개념 완료 · 연습 · 확인 테스트
//
// - 채점은 서버에서 answer-checker로 한다 (클라이언트가 보낸 정답 여부는 쓰지 않음)
// - 시도 기록(GrammarAttempt)과 진도(GrammarPointProgress)는 한 트랜잭션으로 저장
// - 오답노트·일자별 통계·XP·연속 학습은 그 뒤 병렬로, 실패해도 학습을 막지 않는다

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma/client'
import { requireStudent } from '@/lib/auth-student'
import { CHECK_SIZE, PRACTICE_SIZE, XP_PASS, isGrammarStep, type GrammarStep } from '@/lib/grammar/constants'
import { applyGrammarEvent, toScore, type GrammarEvent } from '@/lib/grammar/mastery-engine'
import {
  normalizeSubmitted,
  runGrammarSideEffects as runSideEffects,
  saveGrammarProgress as saveProgress,
  type SubmittedAnswer,
} from '@/lib/grammar/unit-save'
import {
  buildResultItems,
  checkQuestionIds,
  findStudentPoint,
  gradePoolAnswer,
  loadGrammarSettings,
  loadLastAttemptIds,
  loadPoolQuestion,
  loadQuestionPool,
  toMasteryProgress,
  type GrammarCheckResult,
} from '@/lib/grammar/unit-queries'

export type ActionResult<T> = ({ ok: true } & T) | { ok: false; error: string }

export type { SubmittedAnswer }

export interface PracticeGrade {
  isCorrect: boolean
  correctAnswer: string
  explanation: string | null
}

const NOT_FOUND = '단원을 찾을 수 없어요. 문법 홈에서 다시 들어와 주세요.'
const SAVE_FAILED = '저장하지 못했어요. 잠시 후 다시 시도해 주세요.'

async function loadContext(code: string) {
  const { user, studentId } = await requireStudent()
  // 학원 소속이 없으면 볼 수 있는 단원이 없다 (point = null → NOT_FOUND)
  const academyId = user.academyId ?? ''
  const point = academyId && typeof code === 'string' ? await findStudentPoint(code, academyId) : null
  return { studentId, academyId, point }
}

function loadProgress(studentId: string, grammarPointId: string) {
  return prisma.grammarPointProgress
    .findUnique({ where: { studentId_grammarPointId: { studentId, grammarPointId } } })
    .then(toMasteryProgress)
}

function revalidateGrammar() {
  revalidatePath('/student/grammar', 'layout')
}

// ─── 단계 이동 ───────────────────────────────────────────────────────────────

/**
 * 단원 진입·단계 이동 기록 — 나갔다 들어오면 이 단계로 복원한다.
 * 연습을 시작하면 미학습 → 학습 중. 통과·숙달·취약 상태는 바꾸지 않는다.
 */
export async function startGrammarUnit(code: string, step: GrammarStep): Promise<ActionResult<object>> {
  if (!isGrammarStep(step)) return { ok: false, error: '잘못된 단계예요.' }
  const { studentId, point } = await loadContext(code)
  if (!point) return { ok: false, error: NOT_FOUND }

  const now = new Date()
  try {
    await prisma.grammarPointProgress.upsert({
      where: { studentId_grammarPointId: { studentId, grammarPointId: point.id } },
      create: {
        studentId,
        grammarPointId: point.id,
        currentStep: step,
        state: step === 'PRACTICE' ? 'IN_PROGRESS' : 'NOT_STARTED',
        lastActivityAt: now,
      },
      update: { currentStep: step, lastActivityAt: now },
    })
    if (step === 'PRACTICE') {
      await prisma.grammarPointProgress.updateMany({
        where: { studentId, grammarPointId: point.id, state: 'NOT_STARTED' },
        data: { state: 'IN_PROGRESS' },
      })
    }
  } catch (error) {
    console.error('[grammar-unit] 단계 저장 실패:', error)
    return { ok: false, error: SAVE_FAILED }
  }
  revalidateGrammar()
  return { ok: true }
}

/** 개념 정리 "다 읽었어요" */
export async function completeConcept(code: string): Promise<ActionResult<{ nextStep: GrammarStep }>> {
  const { studentId, academyId, point } = await loadContext(code)
  if (!point) return { ok: false, error: NOT_FOUND }

  const [progress, settings, lectureCount] = await Promise.all([
    loadProgress(studentId, point.id),
    loadGrammarSettings(academyId),
    prisma.grammarLecture.count({
      where: { grammarPointId: point.id, isActive: true, OR: [{ academyId: null }, { academyId }] },
    }),
  ])
  const event: GrammarEvent = { type: 'CONCEPT_DONE', hasLecture: lectureCount > 0 }
  const result = applyGrammarEvent(progress, event, settings, new Date())
  try {
    await saveProgress(studentId, point.id, result)
  } catch (error) {
    console.error('[grammar-unit] 개념 완료 저장 실패:', error)
    return { ok: false, error: SAVE_FAILED }
  }
  revalidateGrammar()
  return { ok: true, nextStep: result.progress.currentStep }
}

// ─── 연습 ────────────────────────────────────────────────────────────────────

/** 연습 문항 1개 즉시 채점 (기록은 submitGrammarPractice에서 한 번에) */
export async function checkGrammarPracticeAnswer(
  code: string,
  questionId: string,
  answer: string,
): Promise<ActionResult<PracticeGrade>> {
  const { academyId, point } = await loadContext(code)
  if (!point) return { ok: false, error: NOT_FOUND }
  const q = await loadPoolQuestion(point.id, academyId, questionId)
  if (!q) return { ok: false, error: '이 단원의 문제가 아니에요. 새로고침해 주세요.' }
  const g = gradePoolAnswer(q, typeof answer === 'string' ? answer.slice(0, 300) : '')
  return { ok: true, isCorrect: g.isCorrect, correctAnswer: g.correctAnswer, explanation: g.explanation }
}

/** 연습 마치기 — 점수는 상태에 영향 없음(활동량만), 다음 단계는 확인 테스트 */
export async function submitGrammarPractice(
  code: string,
  answers: SubmittedAnswer[],
): Promise<ActionResult<{ correct: number; total: number }>> {
  const { studentId, academyId, point } = await loadContext(code)
  if (!point) return { ok: false, error: NOT_FOUND }

  const submitted = normalizeSubmitted(answers).slice(0, PRACTICE_SIZE)
  const [pool, progress, settings] = await Promise.all([
    loadQuestionPool(point.id, academyId),
    loadProgress(studentId, point.id),
    loadGrammarSettings(academyId),
  ])
  const byId = new Map(pool.map((q) => [q.id, q]))
  const graded = submitted.flatMap((a) => {
    const q = byId.get(a.questionId)
    return q ? [gradePoolAnswer(q, a.answer)] : []
  })
  const correct = graded.filter((g) => g.isCorrect).length

  const result = applyGrammarEvent(progress, { type: 'PRACTICE_DONE', correct, total: graded.length }, settings, new Date())
  try {
    await saveProgress(studentId, point.id, result, graded.length > 0 ? { kind: 'PRACTICE', graded } : undefined)
  } catch (error) {
    console.error('[grammar-unit] 연습 저장 실패:', error)
    return { ok: false, error: SAVE_FAILED }
  }
  if (graded.length > 0) await runSideEffects(studentId, point.id, byId, graded, result)
  revalidateGrammar()
  return { ok: true, correct, total: graded.length }
}

// ─── 확인 테스트 ─────────────────────────────────────────────────────────────

/** 확인 테스트 일괄 채점 → 통과/미달 판정 */
export async function submitGrammarCheck(
  code: string,
  answers: SubmittedAnswer[],
): Promise<ActionResult<{ result: GrammarCheckResult }>> {
  const { studentId, academyId, point } = await loadContext(code)
  if (!point) return { ok: false, error: NOT_FOUND }

  const [pool, progress, settings, last] = await Promise.all([
    loadQuestionPool(point.id, academyId),
    loadProgress(studentId, point.id),
    loadGrammarSettings(academyId),
    loadLastAttemptIds(studentId, point.id),
  ])
  const byId = new Map(pool.map((q) => [q.id, q]))
  const submitted = normalizeSubmitted(answers).slice(0, CHECK_SIZE)

  // 이번 차수에 출제된 문항 수와 같고, 모두 이 단원의 문항이어야 한다
  const expected = checkQuestionIds(studentId, point.id, progress, Array.from(byId.keys()), last.lastCheckIds, last.lastPracticeIds)
  if (expected.length === 0) return { ok: false, error: '이 단원의 확인 테스트 문제가 아직 준비되지 않았어요.' }
  if (submitted.length !== expected.length || submitted.some((a) => !byId.has(a.questionId))) {
    return { ok: false, error: '문제가 바뀌었어요. 새로고침한 뒤 다시 풀어 주세요.' }
  }

  const graded = submitted.map((a) => gradePoolAnswer(byId.get(a.questionId)!, a.answer))
  const correct = graded.filter((g) => g.isCorrect).length
  const score = toScore(correct, graded.length)

  const result = applyGrammarEvent(progress, { type: 'CHECK_DONE', score }, settings, new Date())
  try {
    await saveProgress(studentId, point.id, result, { kind: 'CHECK', graded })
  } catch (error) {
    console.error('[grammar-unit] 확인 테스트 저장 실패:', error)
    return { ok: false, error: SAVE_FAILED }
  }
  await runSideEffects(studentId, point.id, byId, graded, result)
  revalidateGrammar()

  return {
    ok: true,
    result: {
      score,
      correctCount: correct,
      totalCount: graded.length,
      passed: result.passedNow,
      passScore: settings.passScore,
      state: result.progress.state,
      xpEarned: result.firstPass ? XP_PASS : 0,
      items: buildResultItems(byId, graded),
    },
  }
}
