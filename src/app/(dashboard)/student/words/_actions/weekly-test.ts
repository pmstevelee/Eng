'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma/client'
import { requireStudent } from '@/lib/auth-student'
import { assertCanUseWordLearning } from '@/lib/words/access-guard'
import { queueWrongWordsForReview } from '@/lib/words/progress'
import { bumpDailyStat } from '@/lib/learning/daily-stats'
import { gradeTest } from '@/lib/words/test-grader'
import { logActivity } from '@/lib/activity-log'
import { ACTIVITY_ACTIONS } from '@/lib/constants/activity-actions'
import { WEEKLY_TEST_MAX_QUESTIONS, WEEKLY_TEST_PASSING_SCORE } from '@/lib/words/weekly-words'

type Result<T> = { ok: true; data: T } | { ok: false; error: { code: string; message: string } }

const SubmitSchema = z.object({
  setId: z.string().uuid(),
  answers: z.record(z.string().uuid(), z.string().max(500)),
  directions: z.record(z.string().uuid(), z.enum(['EN_TO_KO', 'KO_TO_EN'])),
})

/** 주간 테스트 제출 — 채점 후 WordTest에 기록하고 오답은 복습 큐에 넣는다 */
export async function submitWeeklyWordTest(
  input: z.infer<typeof SubmitSchema>,
): Promise<Result<{ resultId: string; score: number }>> {
  try {
    const { studentId, userId, user } = await requireStudent()
    if (!user.academyId) return { ok: false, error: { code: 'FORBIDDEN', message: '소속 학원을 찾을 수 없습니다.' } }
    await assertCanUseWordLearning(user.academyId)

    const parsed = SubmitSchema.safeParse(input)
    if (!parsed.success) return { ok: false, error: { code: 'INVALID', message: '제출 내용이 올바르지 않습니다.' } }
    const { setId, answers, directions } = parsed.data

    const submittedIds = Object.keys(answers)
    if (submittedIds.length === 0 || submittedIds.length > WEEKLY_TEST_MAX_QUESTIONS) {
      return { ok: false, error: { code: 'INVALID', message: '제출 내용이 올바르지 않습니다.' } }
    }

    // 본인 소유 주간 세트에 있는 단어만 채점
    const set = await prisma.wordSet.findFirst({
      where: { id: setId, ownerId: userId, source: 'AI_GENERATED' },
      select: {
        id: true,
        items: {
          where: { wordId: { in: submittedIds } },
          select: { word: { select: { id: true, term: true, meaning: true, partOfSpeech: true } } },
        },
      },
    })
    if (!set || set.items.length === 0) {
      return { ok: false, error: { code: 'NOT_FOUND', message: '주간 테스트를 찾을 수 없습니다.' } }
    }

    const questions = set.items.map(({ word }) => ({
      wordId: word.id,
      term: word.term,
      meaning: word.meaning ?? '',
      partOfSpeech: word.partOfSpeech,
      direction: directions[word.id] ?? ('EN_TO_KO' as const),
      isSpell: false,
    }))
    const result = gradeTest(questions, answers, WEEKLY_TEST_PASSING_SCORE)

    const test = await prisma.wordTest.create({
      data: {
        studentId,
        setId: set.id,
        mode: 'MIXED',
        score: result.score,
        totalQuestions: result.totalQuestions,
        answers: result.answers as unknown as object[],
      },
      select: { id: true },
    })

    const wrongWordIds = result.answers.filter((a) => !a.isCorrect).map((a) => a.wordId)
    try {
      await queueWrongWordsForReview(studentId, wrongWordIds)
      await bumpDailyStat(studentId, {
        wordCorrect: result.correctCount,
        wordWrong: wrongWordIds.length,
      })
    } catch {
      // 복습 큐 반영 실패는 응시 기록에 영향 없음
    }

    await logActivity({
      userId,
      role: 'STUDENT',
      academyId: user.academyId,
      action: ACTIVITY_ACTIONS.WORD_TEST_SUBMIT,
      metadata: { weeklySetId: set.id, score: result.score, isPassed: result.isPassed },
    })

    revalidatePath('/student/words')
    return { ok: true, data: { resultId: test.id, score: result.score } }
  } catch (e) {
    return {
      ok: false,
      error: { code: 'UNKNOWN', message: e instanceof Error ? e.message : '오류가 발생했습니다.' },
    }
  }
}
