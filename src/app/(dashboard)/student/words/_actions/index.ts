'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma/client'
import { requireStudent } from '@/lib/auth-student'
import { assertCanUseWordLearning, getWordLearningLimits } from '@/lib/words/access-guard'
import { getDueWords, applySrsResult } from '@/lib/words/progress'
import { checkSpelling } from '@/lib/words/spell-check'
import { QUALITY, type SrsQuality } from '@/lib/words/srs'
import type { LearnStage } from '@/generated/prisma'

// ─── 공통 응답 타입 ────────────────────────────────────────────────────────────

type Ok<T> = { ok: true; data: T }
type Err = { ok: false; error: { code: string; message: string } }
type Result<T> = Ok<T> | Err

function ok<T>(data: T): Ok<T> {
  return { ok: true, data }
}

function err(code: string, message: string): Err {
  return { ok: false, error: { code, message } }
}

// ─── 인증 헬퍼 ────────────────────────────────────────────────────────────────

async function getAuthContext() {
  const { studentId, userId } = await requireStudent()

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { academyId: true },
  })

  const academyId = user?.academyId
  if (!academyId) throw new Error('소속 학원을 찾을 수 없습니다.')

  await assertCanUseWordLearning(academyId)

  return { studentId, academyId }
}

// ─── 1. getWordSet ─────────────────────────────────────────────────────────────

const GetWordSetSchema = z.object({ setId: z.string().uuid() })

export async function getWordSet(setId: string): Promise<Result<unknown>> {
  try {
    const { setId: validSetId } = GetWordSetSchema.parse({ setId })
    const { studentId, academyId } = await getAuthContext()

    const wordSet = await prisma.wordSet.findFirst({
      where: {
        id: validSetId,
        OR: [
          { isPublic: true },
          { ownerId: studentId },
          { academyId },
        ],
      },
      include: {
        items: {
          orderBy: { order: 'asc' },
          include: { word: true },
        },
      },
    })

    if (!wordSet) return err('NOT_FOUND', '단어 세트를 찾을 수 없습니다.')

    return ok(wordSet)
  } catch (e) {
    if (e instanceof z.ZodError) return err('INVALID_INPUT', e.errors[0]?.message ?? '입력 오류')
    if (e instanceof Error) return err('FORBIDDEN', e.message)
    return err('UNKNOWN', '오류가 발생했습니다.')
  }
}

// ─── 2. startWordSet ──────────────────────────────────────────────────────────

const StartWordSetSchema = z.object({ setId: z.string().uuid() })

export async function startWordSet(setId: string): Promise<Result<{ created: number }>> {
  try {
    const { setId: validSetId } = StartWordSetSchema.parse({ setId })
    const { studentId, academyId } = await getAuthContext()

    const limits = await getWordLearningLimits(academyId)

    const wordSet = await prisma.wordSet.findFirst({
      where: {
        id: validSetId,
        OR: [{ isPublic: true }, { ownerId: studentId }, { academyId }],
      },
      include: { items: { select: { wordId: true } } },
    })

    if (!wordSet) return err('NOT_FOUND', '단어 세트를 찾을 수 없습니다.')

    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const todayNewCount = await prisma.wordProgress.count({
      where: { studentId, createdAt: { gte: todayStart } },
    })

    const remaining = limits.dailyNewWords - todayNewCount
    if (remaining <= 0)
      return err('DAILY_LIMIT', `오늘 신규 단어 학습 한도(${limits.dailyNewWords}개)에 도달했습니다.`)

    const existingWordIds = new Set(
      (
        await prisma.wordProgress.findMany({
          where: { studentId, wordId: { in: wordSet.items.map((i) => i.wordId) } },
          select: { wordId: true },
        })
      ).map((p) => p.wordId),
    )

    const newWordIds = wordSet.items
      .map((i) => i.wordId)
      .filter((id) => !existingWordIds.has(id))
      .slice(0, remaining)

    if (newWordIds.length === 0) return ok({ created: 0 })

    await prisma.wordProgress.createMany({
      data: newWordIds.map((wordId) => ({ studentId, wordId })),
      skipDuplicates: true,
    })

    revalidatePath('/student/words')

    return ok({ created: newWordIds.length })
  } catch (e) {
    if (e instanceof z.ZodError) return err('INVALID_INPUT', e.errors[0]?.message ?? '입력 오류')
    if (e instanceof Error) return err('FORBIDDEN', e.message)
    return err('UNKNOWN', '오류가 발생했습니다.')
  }
}

// ─── 3. getFlashcards ─────────────────────────────────────────────────────────

const GetFlashcardsSchema = z.object({ setId: z.string().uuid() })

export async function getFlashcards(setId: string): Promise<Result<unknown>> {
  try {
    const { setId: validSetId } = GetFlashcardsSchema.parse({ setId })
    const { studentId, academyId } = await getAuthContext()

    const limits = await getWordLearningLimits(academyId)

    const wordSet = await prisma.wordSet.findFirst({
      where: {
        id: validSetId,
        OR: [{ isPublic: true }, { ownerId: studentId }, { academyId }],
      },
      include: {
        items: {
          orderBy: { order: 'asc' },
          include: {
            word: {
              include: {
                wordProgress: {
                  where: { studentId },
                  take: 1,
                },
              },
            },
          },
        },
      },
    })

    if (!wordSet) return err('NOT_FOUND', '단어 세트를 찾을 수 없습니다.')

    const cards = wordSet.items
      .filter((item) => item.word.wordProgress.length > 0)
      .slice(0, limits.dailyNewWords)
      .map((item) => ({
        word: {
          id: item.word.id,
          term: item.word.term,
          meaning: item.word.meaning,
          definition: item.word.definition,
          partOfSpeech: item.word.partOfSpeech,
          example: item.word.example,
          audioUrl: item.word.audioUrl,
          cefrLevel: item.word.cefrLevel,
        },
        progress: item.word.wordProgress[0],
        order: item.order,
      }))

    return ok({ setId: validSetId, cards })
  } catch (e) {
    if (e instanceof z.ZodError) return err('INVALID_INPUT', e.errors[0]?.message ?? '입력 오류')
    if (e instanceof Error) return err('FORBIDDEN', e.message)
    return err('UNKNOWN', '오류가 발생했습니다.')
  }
}

// ─── 4. recordProgress ────────────────────────────────────────────────────────

const LearnStageSchema = z.enum(['FLASHCARD', 'RECALL', 'SPELL', 'MASTERED'])

const RecordProgressSchema = z.object({
  wordId: z.string().uuid(),
  stage: LearnStageSchema,
  quality: z.number().int().min(0).max(5) as z.ZodType<SrsQuality>,
  isCorrect: z.boolean(),
  userAnswer: z.string().optional(),
})

export async function recordProgress(
  input: z.infer<typeof RecordProgressSchema>,
): Promise<Result<unknown>> {
  try {
    const { wordId, stage, quality, isCorrect } = RecordProgressSchema.parse(input)
    const { studentId } = await getAuthContext()

    const existing = await prisma.wordProgress.findUnique({
      where: { studentId_wordId: { studentId, wordId } },
    })

    if (!existing) return err('NOT_FOUND', '진도 기록을 찾을 수 없습니다. startWordSet을 먼저 호출하세요.')

    const updated = await applySrsResult(studentId, wordId, quality)

    let nextStage: LearnStage = stage
    if (isCorrect) {
      if (stage === 'FLASHCARD') nextStage = 'RECALL'
      else if (stage === 'RECALL') nextStage = 'SPELL'
      else if (stage === 'SPELL') nextStage = 'MASTERED'
    }

    if (nextStage !== stage) {
      await prisma.wordProgress.update({
        where: { studentId_wordId: { studentId, wordId } },
        data: { stage: nextStage },
      })
    }

    revalidatePath('/student/words')

    return ok({ ...updated, stage: nextStage })
  } catch (e) {
    if (e instanceof z.ZodError) return err('INVALID_INPUT', e.errors[0]?.message ?? '입력 오류')
    if (e instanceof Error) return err('FORBIDDEN', e.message)
    return err('UNKNOWN', '오류가 발생했습니다.')
  }
}

// ─── 5. getTodayReview ────────────────────────────────────────────────────────

export async function getTodayReview(): Promise<Result<unknown>> {
  try {
    const { studentId } = await getAuthContext()

    const dueWords = await getDueWords(studentId, 50)

    return ok({ words: dueWords, count: dueWords.length })
  } catch (e) {
    if (e instanceof Error) return err('FORBIDDEN', e.message)
    return err('UNKNOWN', '오류가 발생했습니다.')
  }
}

// ─── 6. getRecallOptions ──────────────────────────────────────────────────────

const GetRecallOptionsSchema = z.object({ wordId: z.string().uuid() })

export async function getRecallOptions(wordId: string): Promise<Result<unknown>> {
  try {
    const { wordId: validWordId } = GetRecallOptionsSchema.parse({ wordId })
    await getAuthContext()

    const target = await prisma.word.findUnique({ where: { id: validWordId } })
    if (!target) return err('NOT_FOUND', '단어를 찾을 수 없습니다.')

    const DISTRACTOR_COUNT = 3

    let distractors = await prisma.word.findMany({
      where: {
        id: { not: validWordId },
        cefrLevel: target.cefrLevel,
        partOfSpeech: target.partOfSpeech,
      },
      take: DISTRACTOR_COUNT * 3,
    })

    if (distractors.length < DISTRACTOR_COUNT) {
      const extra = await prisma.word.findMany({
        where: {
          id: { not: validWordId },
          cefrLevel: { in: [target.cefrLevel - 1, target.cefrLevel + 1] },
          partOfSpeech: target.partOfSpeech,
        },
        take: DISTRACTOR_COUNT * 2,
      })
      distractors = [...distractors, ...extra]
    }

    const shuffled = distractors.sort(() => Math.random() - 0.5).slice(0, DISTRACTOR_COUNT)

    const options = [target, ...shuffled].sort(() => Math.random() - 0.5).map((w) => ({
      id: w.id,
      term: w.term,
      meaning: w.meaning,
      partOfSpeech: w.partOfSpeech,
    }))

    return ok({ correctId: validWordId, options })
  } catch (e) {
    if (e instanceof z.ZodError) return err('INVALID_INPUT', e.errors[0]?.message ?? '입력 오류')
    if (e instanceof Error) return err('FORBIDDEN', e.message)
    return err('UNKNOWN', '오류가 발생했습니다.')
  }
}

// ─── 7. checkSpell ────────────────────────────────────────────────────────────

const CheckSpellSchema = z.object({
  wordId: z.string().uuid(),
  userAnswer: z.string().min(1, '답변을 입력하세요.'),
  usedHint: z.boolean().default(false),
})

export async function checkSpell(
  input: z.infer<typeof CheckSpellSchema>,
): Promise<Result<unknown>> {
  try {
    const { wordId, userAnswer, usedHint } = CheckSpellSchema.parse(input)
    await getAuthContext()

    const word = await prisma.word.findUnique({ where: { id: wordId } })
    if (!word) return err('NOT_FOUND', '단어를 찾을 수 없습니다.')

    const { correct, nearlyCorrect, normalized } = checkSpelling(word.term, userAnswer)

    let quality: SrsQuality
    let feedback: string

    if (correct) {
      quality = usedHint ? QUALITY.SPELL_HINT : QUALITY.SPELL_CORRECT
      feedback = '정답입니다!'
    } else if (nearlyCorrect) {
      quality = 4 as SrsQuality
      feedback = '거의 정답입니다! (오타 1개)'
    } else {
      quality = QUALITY.SPELL_WRONG
      feedback = `오답입니다. 정답: ${word.term}`
    }

    return ok({
      correct,
      nearlyCorrect,
      quality,
      feedback,
      correctTerm: word.term,
      normalized,
    })
  } catch (e) {
    if (e instanceof z.ZodError) return err('INVALID_INPUT', e.errors[0]?.message ?? '입력 오류')
    if (e instanceof Error) return err('FORBIDDEN', e.message)
    return err('UNKNOWN', '오류가 발생했습니다.')
  }
}
