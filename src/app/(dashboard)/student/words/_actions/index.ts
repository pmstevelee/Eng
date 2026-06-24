'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { prisma } from '@/lib/prisma/client'
import { requireStudent } from '@/lib/auth-student'
import { assertCanUseWordLearning, getWordLearningLimits } from '@/lib/words/access-guard'
import { getDueWords, applySrsResult } from '@/lib/words/progress'
import { checkSpelling } from '@/lib/words/spell-check'
import { gradeTest, buildQuestions } from '@/lib/words/test-grader'
import { QUALITY, type SrsQuality } from '@/lib/words/srs'
import { emitWordEvent } from '@/lib/words/word-events'
import type { BadgeType, LearnStage } from '@/generated/prisma'

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

export async function getFlashcards(setId: string, stage?: 'FLASHCARD' | 'RECALL' | 'SPELL'): Promise<Result<unknown>> {
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
                  where: {
                    studentId,
                    ...(stage ? { stage } : {}),
                  },
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
          meaning: item.word.meaning ?? '',
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

    // 게이미피케이션: 단계별 XP 지급 (실패해도 학습 기록에는 영향 없음)
    try {
      if (stage === 'FLASHCARD') {
        await emitWordEvent(studentId, 'FLASHCARD_COMPLETED', wordId)
      } else if (stage === 'RECALL' && isCorrect) {
        await emitWordEvent(studentId, 'RECALL_CORRECT', wordId)
      } else if (stage === 'SPELL' && isCorrect) {
        await emitWordEvent(studentId, 'SPELL_CORRECT', wordId)
      }
      if (nextStage === 'MASTERED' && stage !== 'MASTERED') {
        await emitWordEvent(studentId, 'WORD_MASTERED', wordId)
      }
    } catch {
      // XP/배지 지급 실패는 무시한다 (학습 진도는 이미 저장됨).
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

// ─── 6b. completeReviewSession ────────────────────────────────────────────────

const CompleteReviewSchema = z.object({
  completedCount: z.number().int().min(0),
  correctCount: z.number().int().min(0),
})

export async function completeReviewSession(
  input: z.infer<typeof CompleteReviewSchema>,
): Promise<Result<{ xpEarned: number; currentStreak: number; isNewRecord: boolean; badgesEarned: BadgeType[] }>> {
  try {
    const { completedCount, correctCount } = CompleteReviewSchema.parse(input)
    const { studentId } = await getAuthContext()

    const isPerfect = completedCount > 0 && correctCount === completedCount

    const events = await Promise.all([
      emitWordEvent(studentId, 'DAILY_REVIEW_COMPLETED'),
      ...(isPerfect ? [emitWordEvent(studentId, 'PERFECT_SET')] : []),
    ])

    const totalXp = events.reduce((sum, e) => sum + e.xp.earned, 0)
    const streakResult = events[0].streak
    const badgesEarned = events.flatMap((e) => (e.badgeEarned ? [e.badgeEarned] : []))

    revalidatePath('/student')
    revalidatePath('/student/words')
    revalidatePath('/student/words/review')

    return ok({
      xpEarned: totalXp,
      currentStreak: streakResult?.currentStreak ?? 0,
      isNewRecord: streakResult?.isNewRecord ?? false,
      badgesEarned,
    })
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

// ─── 단어 시험 (교사 배정) ───────────────────────────────────────────────────

export async function getWordTestAssignment(testId: string): Promise<Result<unknown>> {
  try {
    const { studentId } = await getAuthContext()

    const assignment = await prisma.wordTestAssignment.findUnique({
      where: { id: testId },
      include: {
        wordSet: {
          include: {
            items: {
              orderBy: { order: 'asc' },
              include: { word: { select: { id: true, term: true, meaning: true, partOfSpeech: true } } },
            },
          },
        },
        classAssignments: { include: { class: { include: { students: { select: { id: true } } } } } },
        studentAssignments: { select: { studentId: true } },
        attempts: { where: { studentId }, select: { id: true } },
      },
    })

    if (!assignment) return err('NOT_FOUND', '시험을 찾을 수 없습니다.')

    // 배정 대상 확인
    const classStudentIds = assignment.classAssignments.flatMap((ca) =>
      ca.class.students.map((s) => s.id),
    )
    const individualStudentIds = assignment.studentAssignments.map((sa) => sa.studentId)
    const isAssigned = classStudentIds.includes(studentId) || individualStudentIds.includes(studentId)
    if (!isAssigned) return err('FORBIDDEN', '이 시험에 배정되지 않았습니다.')

    // 이미 응시한 경우
    if (assignment.attempts.length > 0) {
      return err('ALREADY_TAKEN', '이미 응시한 시험입니다.')
    }

    // 기간 체크
    const now = new Date()
    if (assignment.startsAt && now < assignment.startsAt) {
      return err('NOT_STARTED', '아직 시험 기간이 아닙니다.')
    }
    if (assignment.endsAt && now > assignment.endsAt) {
      return err('EXPIRED', '시험 기간이 종료되었습니다.')
    }

    const allWords = assignment.wordSet.items.map((i) => i.word)
    const questions = buildQuestions(assignment.wordSet.items, assignment.mode, assignment.numQuestions, allWords)

    return ok({
      assignment: {
        id: assignment.id,
        title: assignment.title,
        mode: assignment.mode,
        timePerQuestion: assignment.timePerQuestion,
        numQuestions: assignment.numQuestions,
        passingScore: assignment.passingScore,
      },
      questions,
    })
  } catch (e) {
    if (e instanceof Error) return err('FORBIDDEN', e.message)
    return err('UNKNOWN', '오류가 발생했습니다.')
  }
}

export async function submitWordTest(
  testId: string,
  userAnswers: Record<string, string>,
): Promise<Result<unknown>> {
  try {
    const { studentId } = await getAuthContext()

    // 중복 응시 방지
    const existing = await prisma.wordTestAttempt.findUnique({
      where: { assignmentId_studentId: { assignmentId: testId, studentId } },
    })
    if (existing) return err('ALREADY_TAKEN', '이미 응시한 시험입니다.')

    const assignment = await prisma.wordTestAssignment.findUnique({
      where: { id: testId },
      include: {
        wordSet: {
          include: {
            items: {
              orderBy: { order: 'asc' },
              include: { word: { select: { id: true, term: true, meaning: true, partOfSpeech: true } } },
            },
          },
        },
      },
    })
    if (!assignment) return err('NOT_FOUND', '시험을 찾을 수 없습니다.')

    const allWords = assignment.wordSet.items.map((i) => i.word)
    // userAnswers의 wordId 목록으로 questions 재구성 (결정론적 채점을 위해 제출된 wordId 순서 사용)
    const submittedWordIds = Object.keys(userAnswers)
    const questionItems = assignment.wordSet.items.filter((i) =>
      submittedWordIds.includes(i.word.id),
    )

    // direction/isSpell은 userAnswers에 포함된 메타로 추론하기 어려우므로
    // mode 기반으로 재생성 (결과만 채점)
    const questions = questionItems.map((item) => {
      const isSpell = assignment.mode === 'SPELL'
      const direction: 'EN_TO_KO' | 'KO_TO_EN' =
        assignment.mode === 'KO_TO_EN' ? 'KO_TO_EN' : 'EN_TO_KO'
      return {
        wordId: item.word.id,
        term: item.word.term,
        meaning: item.word.meaning ?? '',
        partOfSpeech: item.word.partOfSpeech,
        direction,
        isSpell,
      }
    })

    const result = gradeTest(questions, userAnswers, assignment.passingScore)

    const attempt = await prisma.wordTestAttempt.create({
      data: {
        assignmentId: testId,
        studentId,
        score: result.score,
        totalQuestions: result.totalQuestions,
        isPassed: result.isPassed,
        answers: result.answers as unknown as object[],
        completedAt: new Date(),
      },
    })

    revalidatePath(`/student/words/test/${testId}/result`)
    return ok({ attemptId: attempt.id, score: result.score, isPassed: result.isPassed })
  } catch (e) {
    if (e instanceof Error) return err('FORBIDDEN', e.message)
    return err('UNKNOWN', '오류가 발생했습니다.')
  }
}

// ─── 오답 단어 SRS 강제 삽입 + 임시 세트 생성 ──────────────────────────────────

export async function retakeWrong(testId: string): Promise<Result<unknown>> {
  try {
    const { studentId } = await getAuthContext()

    const attempt = await prisma.wordTestAttempt.findUnique({
      where: { assignmentId_studentId: { assignmentId: testId, studentId } },
      include: { assignment: { select: { title: true } } },
    })
    if (!attempt) return err('NOT_FOUND', '응시 기록이 없습니다.')

    const answers = attempt.answers as { wordId: string; isCorrect: boolean }[]
    const wrongWordIds = answers.filter((a) => !a.isCorrect).map((a) => a.wordId)
    if (wrongWordIds.length === 0) return ok({ message: '오답이 없습니다.' })

    // 임시 WordSet 생성
    const set = await prisma.$transaction(async (tx) => {
      const newSet = await tx.wordSet.create({
        data: {
          title: `[오답복습] ${attempt.assignment.title}`,
          cefrLevel: 1,
          isPublic: false,
          source: 'AI_GENERATED',
          ownerId: studentId,
        },
      })
      await tx.wordSetItem.createMany({
        data: wrongWordIds.map((wordId, i) => ({ setId: newSet.id, wordId, order: i })),
      })

      // SRS 큐에 강제 삽입 (nextReviewAt = now → 즉시 복습 대상)
      const existingProgress = await tx.wordProgress.findMany({
        where: { studentId, wordId: { in: wrongWordIds } },
        select: { wordId: true },
      })
      const existingIds = new Set(existingProgress.map((p) => p.wordId))
      const newIds = wrongWordIds.filter((id) => !existingIds.has(id))

      if (newIds.length > 0) {
        await tx.wordProgress.createMany({
          data: newIds.map((wordId) => ({
            studentId,
            wordId,
            nextReviewAt: new Date(),
            intervalDays: 0,
            repetitions: 0,
            easeFactor: 2.5,
          })),
        })
      }

      // 기존 진도는 nextReviewAt을 now로 당김
      if (existingIds.size > 0) {
        await tx.wordProgress.updateMany({
          where: { studentId, wordId: { in: Array.from(existingIds) } },
          data: { nextReviewAt: new Date() },
        })
      }

      return newSet
    })

    return ok({ setId: set.id })
  } catch (e) {
    if (e instanceof Error) return err('FORBIDDEN', e.message)
    return err('UNKNOWN', '오류가 발생했습니다.')
  }
}
