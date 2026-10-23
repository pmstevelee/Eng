import 'server-only'

import { prisma } from '@/lib/prisma/client'
import { addDays, dbDate, fromDbDate, todayKst } from '@/lib/attendance/time'
import { buildQuestions, type WordTestQuestion } from '@/lib/words/test-grader'
import { weekDaysOf, weekStartOf, weeklySetTitle } from '@/lib/words/week'

// ─── 주간 단어학습 ────────────────────────────────────────────────────────────
// 매일 자동 생성되는 '오늘의 단어' 세트(DailyWordPlan)를 한 주(월~일, KST) 단위로 묶어 보여주고,
// 그 주의 단어 전체로 주간 테스트를 본다. 월요일이 되면 새 주로 갱신된다.
// 주간 테스트 세트는 학생 소유 비공개 WordSet(제목 = weeklySetTitle)이고,
// 응시 결과는 WordTest(학생 자기 테스트 기록)에 setId로 연결해 저장한다.

export const WEEKLY_TEST_MAX_QUESTIONS = 60
export const WEEKLY_TEST_PASSING_SCORE = 80
export const WEEKLY_TEST_SECONDS_PER_QUESTION = 15

export interface WeeklyDay {
  dateKey: string
  isToday: boolean
  isFuture: boolean
  setId: string | null
  wordCount: number
  learnedCount: number
  /** 플래시카드 후 리콜·스펠 중 하나까지 마침 */
  isDone: boolean
  isStarted: boolean
}

export interface WeeklyWordOverview {
  weekStart: string
  days: WeeklyDay[]
  totalWords: number
  learnedWords: number
  test: {
    attempts: number
    bestScore: number | null
    lastScore: number | null
    lastResultId: string | null
  }
}

async function getWeekPlans(studentId: string, weekStart: string) {
  return prisma.dailyWordPlan.findMany({
    where: {
      studentId,
      planDate: { gte: dbDate(weekStart), lte: dbDate(addDays(weekStart, 6)) },
    },
    select: {
      planDate: true,
      setId: true,
      targetLevel: true,
      newWordIds: true,
      flashcardDone: true,
      recallDone: true,
      spellDone: true,
    },
    orderBy: { planDate: 'asc' },
  })
}

function uniqueWordIds(plans: { newWordIds: unknown }[]): string[] {
  const seen = new Set<string>()
  for (const plan of plans) {
    for (const id of (plan.newWordIds as string[] | null) ?? []) seen.add(id)
  }
  return Array.from(seen)
}

function findWeeklySet(userId: string, weekStart: string) {
  return prisma.wordSet.findFirst({
    where: { ownerId: userId, source: 'AI_GENERATED', title: weeklySetTitle(weekStart) },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  })
}

/** 단어학습 메뉴에 보여줄 이번 주 날짜별 세트·주간 테스트 현황 */
export async function getWeeklyWordOverview(studentId: string, userId: string): Promise<WeeklyWordOverview> {
  const today = todayKst()
  const weekStart = weekStartOf(today)

  const [plans, weeklySet] = await Promise.all([getWeekPlans(studentId, weekStart), findWeeklySet(userId, weekStart)])
  const wordIds = uniqueWordIds(plans)

  const [learned, tests] = await Promise.all([
    wordIds.length > 0
      ? prisma.wordProgress.findMany({
          where: { studentId, wordId: { in: wordIds }, learnedAt: { not: null } },
          select: { wordId: true },
        })
      : Promise.resolve([]),
    weeklySet
      ? prisma.wordTest.findMany({
          where: { studentId, setId: weeklySet.id },
          select: { id: true, score: true },
          orderBy: { takenAt: 'desc' },
        })
      : Promise.resolve([]),
  ])
  const learnedSet = new Set(learned.map((l) => l.wordId))
  const planByDate = new Map(plans.map((p) => [fromDbDate(p.planDate), p]))

  const days: WeeklyDay[] = weekDaysOf(weekStart).map((dateKey) => {
    const plan = planByDate.get(dateKey)
    const ids = (plan?.newWordIds as string[] | null) ?? []
    return {
      dateKey,
      isToday: dateKey === today,
      isFuture: dateKey > today,
      setId: plan?.setId ?? null,
      wordCount: ids.length,
      learnedCount: ids.filter((id) => learnedSet.has(id)).length,
      isDone: !!plan && (plan.recallDone || plan.spellDone),
      isStarted: !!plan && plan.flashcardDone,
    }
  })

  return {
    weekStart,
    days,
    totalWords: wordIds.length,
    learnedWords: wordIds.filter((id) => learnedSet.has(id)).length,
    test: {
      attempts: tests.length,
      bestScore: tests.length > 0 ? Math.max(...tests.map((t) => t.score)) : null,
      lastScore: tests[0]?.score ?? null,
      lastResultId: tests[0]?.id ?? null,
    },
  }
}

/**
 * 이번 주 단어를 모은 주간 세트를 만들거나(없으면) 이후 추가된 날의 단어를 덧붙인다.
 * 이번 주 단어가 하나도 없으면 null.
 */
async function ensureWeeklySet(studentId: string, userId: string, weekStart: string): Promise<string | null> {
  const plans = await getWeekPlans(studentId, weekStart)
  const wordIds = uniqueWordIds(plans)
  if (wordIds.length === 0) return null

  const existing = await findWeeklySet(userId, weekStart)
  if (!existing) {
    const created = await prisma.wordSet.create({
      data: {
        title: weeklySetTitle(weekStart),
        description: '이번 주 오늘의 단어를 모은 주간 테스트 세트',
        cefrLevel: Math.max(...plans.map((p) => p.targetLevel)),
        isPublic: false,
        source: 'AI_GENERATED',
        ownerId: userId,
        items: { create: wordIds.map((wordId, order) => ({ wordId, order })) },
      },
      select: { id: true },
    })
    return created.id
  }

  const items = await prisma.wordSetItem.findMany({
    where: { setId: existing.id },
    select: { wordId: true },
  })
  const have = new Set(items.map((i) => i.wordId))
  const missing = wordIds.filter((id) => !have.has(id))
  if (missing.length > 0) {
    await prisma.wordSetItem.createMany({
      data: missing.map((wordId, i) => ({ setId: existing.id, wordId, order: items.length + i })),
      skipDuplicates: true,
    })
  }
  return existing.id
}

export interface WeeklyTestData {
  setId: string
  weekStart: string
  title: string
  questions: WordTestQuestion[]
}

/** 이번 주 단어 전체(최대 60문항)로 주간 테스트 문항을 만든다 */
export async function buildWeeklyTest(studentId: string, userId: string): Promise<WeeklyTestData | null> {
  const weekStart = weekStartOf(todayKst())
  const setId = await ensureWeeklySet(studentId, userId, weekStart)
  if (!setId) return null

  const items = await prisma.wordSetItem.findMany({
    where: { setId },
    orderBy: { order: 'asc' },
    select: { word: { select: { id: true, term: true, meaning: true, partOfSpeech: true } } },
  })
  const usable = items.filter((i) => i.word.meaning)
  if (usable.length === 0) return null

  const allWords = usable.map((i) => i.word)
  return {
    setId,
    weekStart,
    title: weeklySetTitle(weekStart).replace('주간 단어', '주간 테스트'),
    questions: buildQuestions(usable, 'MIXED', WEEKLY_TEST_MAX_QUESTIONS, allWords),
  }
}
