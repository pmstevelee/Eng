// 문법 학습 기록 저장 — 단원 학습([code]/actions.ts)과 포인트 복습(review/actions.ts)이 같이 쓴다 (서버 전용)
//
// - 시도 기록(GrammarAttempt)과 진도(GrammarPointProgress)는 한 트랜잭션으로 저장
// - 오답노트·일자별 통계·XP·연속 학습은 그 뒤 병렬로, 실패해도 학습을 막지 않는다

import { prisma } from '@/lib/prisma/client'
import { recordQuestionAnswers } from '@/lib/missions/question-review'
import { awardXP } from '@/lib/missions/xp-manager'
import { updateStreak } from '@/lib/missions/streak-manager'
import type { Prisma, QuestionDomain } from '@/generated/prisma'
import type { GrammarAttemptAnswer } from '@/types/grammar'
import { XP_MASTER, XP_PASS } from './constants'
import { toScore, type MasteryResult } from './mastery-engine'
import { progressData, type GradedAnswer, type PoolQuestion } from './unit-queries'

/** 진도 저장 (+ 시도 기록) — 한 트랜잭션 */
export async function saveGrammarProgress(
  studentId: string,
  grammarPointId: string,
  result: MasteryResult,
  attempt?: { kind: 'PRACTICE' | 'CHECK' | 'REVIEW'; graded: GradedAnswer[] },
): Promise<void> {
  const data = progressData(result.progress)
  const upsert = prisma.grammarPointProgress.upsert({
    where: { studentId_grammarPointId: { studentId, grammarPointId } },
    create: { studentId, grammarPointId, ...data },
    update: data,
  })
  if (!attempt) {
    await upsert
    return
  }
  const correct = attempt.graded.filter((g) => g.isCorrect).length
  const answers: GrammarAttemptAnswer[] = attempt.graded.map((g) => ({
    questionId: g.questionId,
    answer: g.answer,
    isCorrect: g.isCorrect,
  }))
  await prisma.$transaction([
    prisma.grammarAttempt.create({
      data: {
        studentId,
        grammarPointId,
        kind: attempt.kind,
        score: toScore(correct, attempt.graded.length),
        correctCount: correct,
        totalCount: attempt.graded.length,
        answersJson: answers as unknown as Prisma.InputJsonValue,
      },
    }),
    upsert,
  ])
}

/** 부가 작업 — 오답노트(+문법 일자 통계), 통과·숙달 보상. 실패해도 학습은 계속 */
export async function runGrammarSideEffects(
  studentId: string,
  grammarPointId: string,
  pool: Map<string, PoolQuestion>,
  graded: GradedAnswer[],
  result: MasteryResult,
): Promise<void> {
  const tasks: Promise<unknown>[] = [
    // recordQuestionAnswers가 StudentDailyStat.grammarSolved/grammarCorrect도 함께 올린다
    recordQuestionAnswers(
      studentId,
      graded.flatMap((g) => {
        const q = pool.get(g.questionId)
        return q ? [{ questionId: g.questionId, domain: q.domain as QuestionDomain, isCorrect: g.isCorrect, gradable: true }] : []
      }),
    ),
  ]
  if (result.firstPass) tasks.push(awardXP(studentId, XP_PASS, 'GRAMMAR_PASS', grammarPointId))
  if (result.firstMastery) tasks.push(awardXP(studentId, XP_MASTER, 'GRAMMAR_MASTER', grammarPointId))
  if (result.firstPass || result.firstMastery) tasks.push(updateStreak(studentId))

  const settled = await Promise.allSettled(tasks)
  for (const s of settled) {
    if (s.status === 'rejected') console.error('[grammar] 부가 작업 실패:', s.reason)
  }
}

export interface SubmittedAnswer {
  questionId: string
  answer: string
}

/** 제출 답안 정리 — 중복 문항 제거, 답은 문자열 300자까지 */
export function normalizeSubmitted(answers: SubmittedAnswer[]): SubmittedAnswer[] {
  const seen = new Set<string>()
  const out: SubmittedAnswer[] = []
  for (const a of Array.isArray(answers) ? answers : []) {
    if (!a || typeof a.questionId !== 'string' || seen.has(a.questionId)) continue
    seen.add(a.questionId)
    out.push({ questionId: a.questionId, answer: typeof a.answer === 'string' ? a.answer.slice(0, 300) : '' })
  }
  return out
}
