import { prisma } from '@/lib/prisma/client'
import { bumpDailyStat } from '@/lib/learning/daily-stats'
import type { QuestionDomain } from '@/generated/prisma'

// 문법·어휘 문제 오답노트 (QuestionReview)
// - 미션에서 틀린 문제 → 다음 날 복습 대상
// - 복습에서 연속 정답: 1일 → 3일 → 7일 간격, 2회 연속 정답이면 해제(isMastered)
// - 다시 틀리면 연속 정답 초기화

const DAY_MS = 24 * 60 * 60 * 1000
const REVIEW_INTERVAL_DAYS = [1, 3, 7]
export const QUESTION_REVIEW_MASTER_STREAK = 2

const REVIEW_DOMAINS: QuestionDomain[] = ['GRAMMAR', 'VOCABULARY']

export type QuestionAnswerRecord = {
  questionId: string
  domain: QuestionDomain
  isCorrect: boolean
  /** 서술형 등 채점 불가 문항은 오답노트·통계에서 제외 */
  gradable: boolean
}

function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * DAY_MS)
}

/**
 * 미션 답안들을 오답노트와 일자별 문법 통계에 반영한다.
 * 실패해도 미션 진행을 막지 않도록 호출부에서 catch한다.
 */
export async function recordQuestionAnswers(studentId: string, answers: QuestionAnswerRecord[]): Promise<void> {
  const targets = answers.filter((a) => a.gradable && REVIEW_DOMAINS.includes(a.domain))
  if (targets.length === 0) return

  const existing = await prisma.questionReview.findMany({
    where: { studentId, questionId: { in: targets.map((t) => t.questionId) } },
    select: { questionId: true, consecutiveCorrect: true, isMastered: true },
  })
  const byQuestion = new Map(existing.map((e) => [e.questionId, e]))
  const now = new Date()

  const ops = targets.flatMap((t) => {
    const prev = byQuestion.get(t.questionId)
    if (!t.isCorrect) {
      return [
        prisma.questionReview.upsert({
          where: { studentId_questionId: { studentId, questionId: t.questionId } },
          create: { studentId, questionId: t.questionId, wrongCount: 1, nextReviewAt: daysFromNow(1) },
          update: {
            wrongCount: { increment: 1 },
            consecutiveCorrect: 0,
            isMastered: false,
            nextReviewAt: daysFromNow(1),
            lastAnsweredAt: now,
          },
        }),
      ]
    }
    // 정답: 오답노트에 있는 문제만 연속 정답 진행
    if (!prev || prev.isMastered) return []
    const streak = prev.consecutiveCorrect + 1
    const interval = REVIEW_INTERVAL_DAYS[Math.min(streak, REVIEW_INTERVAL_DAYS.length - 1)]
    return [
      prisma.questionReview.update({
        where: { studentId_questionId: { studentId, questionId: t.questionId } },
        data: {
          consecutiveCorrect: streak,
          isMastered: streak >= QUESTION_REVIEW_MASTER_STREAK,
          nextReviewAt: daysFromNow(interval),
          lastAnsweredAt: now,
        },
      }),
    ]
  })

  if (ops.length > 0) await prisma.$transaction(ops)

  const grammar = targets.filter((t) => t.domain === 'GRAMMAR')
  await bumpDailyStat(studentId, {
    grammarSolved: grammar.length,
    grammarCorrect: grammar.filter((t) => t.isCorrect).length,
  })
}
