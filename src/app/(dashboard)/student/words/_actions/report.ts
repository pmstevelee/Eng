'use server'

import { prisma } from '@/lib/prisma/client'
import { requireStudent } from '@/lib/auth-student'
import { addDays, dbDate, fromDbDate, toKstDateKey, todayKst } from '@/lib/attendance/time'
import { isDifficultWord } from '@/lib/words/mastery'

const CEFR_LABEL: Record<number, string> = {
  1: 'Pre-A1', 2: 'A1 하', 3: 'A1 상', 4: 'A2 하', 5: 'A2 상',
  6: 'B1 하', 7: 'B1 상', 8: 'B2 하', 9: 'B2 상', 10: 'C1+',
}

export type DailyTrendPoint = {
  date: string
  /** 학습 완료 신규 + 복습 단어 */
  words: number
  /** 단어 응답 수 (플래시카드·뜻 고르기·스펠링·복습·시험) */
  wordAnswers: number
  /** 단어 정답률 (%) — 응답이 없으면 null */
  wordAccuracy: number | null
  grammarSolved: number
  /** 문법 정답률 (%) — 풀이가 없으면 null */
  grammarAccuracy: number | null
  points: number
}

export type StudentWordStats = {
  totalLearned: number
  totalMastered: number
  /** 마스터 퍼널: 학습 중(단계 진행) → 학습 완료(복습 중) → 마스터 */
  funnel: { inProgress: number; learned: number; mastered: number }
  /** 어려운 단어 (망각 2회↑ 또는 오답이 정답 이상) */
  difficultWords: { word: string; meaning: string | null; lapses: number; wrongCount: number; correctCount: number }[]
  dailyTrend: DailyTrendPoint[]
  /** 아직 해결하지 못한 문법 오답 유형 */
  grammarWeakAreas: { category: string; open: number; wrongTotal: number }[]
  openGrammarReviews: number
  cefrProgress: { level: number; label: string; learned: number; mastered: number }[]
  weeklyActivity: { date: string; count: number }[]
  weakWords: { word: string; meaning: string | null; wrongCount: number; correctCount: number }[]
  nextRecommendedSet: { id: string; title: string; cefrLevel: number; itemCount: number } | null
}

export async function getStudentWordStats(): Promise<StudentWordStats> {
  const { studentId, userId } = await requireStudent()

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { academyId: true, student: { select: { currentLevel: true } } },
  })

  const progress = await prisma.wordProgress.findMany({
    where: { studentId },
    select: {
      stage: true,
      wrongCount: true,
      correctCount: true,
      lapses: true,
      learnedAt: true,
      lastStudiedAt: true,
      word: { select: { term: true, meaning: true, cefrLevel: true } },
    },
  })

  const trendStart = addDays(todayKst(), -13)
  const [dailyStats, grammarReviews] = await Promise.all([
    prisma.studentDailyStat.findMany({
      where: { studentId, statDate: { gte: dbDate(trendStart) } },
      orderBy: { statDate: 'asc' },
    }),
    prisma.questionReview.findMany({
      where: { studentId, isMastered: false, question: { domain: 'GRAMMAR' } },
      select: { wrongCount: true, question: { select: { subCategory: true } } },
    }),
  ])

  // 최근 14일 학습 추이 (KST 날짜, 기록 없는 날은 0)
  const statByDate = new Map(dailyStats.map((d) => [fromDbDate(d.statDate), d]))
  const dailyTrend: DailyTrendPoint[] = Array.from({ length: 14 }, (_, i) => {
    const date = addDays(trendStart, i)
    const d = statByDate.get(date)
    const wordAnswers = (d?.wordCorrect ?? 0) + (d?.wordWrong ?? 0)
    return {
      date,
      words: (d?.newWords ?? 0) + (d?.reviewWords ?? 0),
      wordAnswers,
      wordAccuracy: wordAnswers > 0 ? Math.round(((d?.wordCorrect ?? 0) / wordAnswers) * 100) : null,
      grammarSolved: d?.grammarSolved ?? 0,
      grammarAccuracy:
        d && d.grammarSolved > 0 ? Math.round((d.grammarCorrect / d.grammarSolved) * 100) : null,
      points: d?.points ?? 0,
    }
  })

  // 문법 오답 유형 (미해결 오답노트 기준)
  const areaMap = new Map<string, { open: number; wrongTotal: number }>()
  for (const r of grammarReviews) {
    const key = r.question.subCategory ?? '기타'
    const e = areaMap.get(key) ?? { open: 0, wrongTotal: 0 }
    e.open++
    e.wrongTotal += r.wrongCount
    areaMap.set(key, e)
  }
  const grammarWeakAreas = Array.from(areaMap.entries())
    .map(([category, v]) => ({ category, ...v }))
    .sort((a, b) => b.open - a.open || b.wrongTotal - a.wrongTotal)
    .slice(0, 5)

  const funnel = { inProgress: 0, learned: 0, mastered: 0 }
  for (const p of progress) {
    if (p.stage === 'MASTERED') funnel.mastered++
    else if (p.learnedAt) funnel.learned++
    else if (p.lastStudiedAt) funnel.inProgress++
  }

  const difficultWords = progress
    .filter(isDifficultWord)
    .sort((a, b) => b.lapses - a.lapses || b.wrongCount - a.wrongCount)
    .slice(0, 20)
    .map((p) => ({
      word: p.word.term,
      meaning: p.word.meaning,
      lapses: p.lapses,
      wrongCount: p.wrongCount,
      correctCount: p.correctCount,
    }))

  const totalLearned = progress.length
  const totalMastered = progress.filter((p) => p.stage === 'MASTERED').length

  // CEFR level 1~10 별 집계
  const cefrMap = new Map<number, { learned: number; mastered: number }>()
  for (let i = 1; i <= 10; i++) cefrMap.set(i, { learned: 0, mastered: 0 })
  for (const p of progress) {
    const lvl = p.word.cefrLevel
    const entry = cefrMap.get(lvl)
    if (entry) {
      entry.learned++
      if (p.stage === 'MASTERED') entry.mastered++
    }
  }
  const cefrProgress = Array.from(cefrMap.entries()).map(([level, data]) => ({
    level,
    label: CEFR_LABEL[level] ?? `L${level}`,
    ...data,
  }))

  // 최근 7일 활동 (KST 날짜별 학습량). 일자별 집계 도입 이전 날짜는 마지막 학습일 기준으로 보완한다.
  const legacyByDate = new Map<string, number>()
  for (const p of progress) {
    if (!p.lastStudiedAt) continue
    const key = toKstDateKey(p.lastStudiedAt)
    legacyByDate.set(key, (legacyByDate.get(key) ?? 0) + 1)
  }
  const weeklyActivity = dailyTrend.slice(-7).map((d) => ({
    date: d.date,
    count: statByDate.has(d.date) ? d.wordAnswers : (legacyByDate.get(d.date) ?? 0),
  }))

  // 약점 단어 TOP10
  const weakWords = progress
    .filter((p) => p.wrongCount > 0)
    .sort((a, b) => b.wrongCount - a.wrongCount)
    .slice(0, 10)
    .map((p) => ({
      word: p.word.term,
      meaning: p.word.meaning,
      wrongCount: p.wrongCount,
      correctCount: p.correctCount,
    }))

  // 다음 추천 세트: 현재 레벨 이상 단어 세트 중 학생이 아직 학습 안 한 것
  const currentLevel = user?.student?.currentLevel ?? 1
  const academyId = user?.academyId ?? null

  const learnedWordIds = new Set(progress.map((p) => p.word.term))
  const nextSet = await prisma.wordSet.findFirst({
    where: {
      cefrLevel: { gte: currentLevel },
      OR: [{ isPublic: true }, ...(academyId ? [{ academyId }] : [])],
    },
    select: {
      id: true,
      title: true,
      cefrLevel: true,
      _count: { select: { items: true } },
    },
    orderBy: { cefrLevel: 'asc' },
  })

  return {
    totalLearned,
    totalMastered,
    funnel,
    difficultWords,
    dailyTrend,
    grammarWeakAreas,
    openGrammarReviews: grammarReviews.length,
    cefrProgress,
    weeklyActivity,
    weakWords,
    nextRecommendedSet: nextSet
      ? { id: nextSet.id, title: nextSet.title, cefrLevel: nextSet.cefrLevel, itemCount: nextSet._count.items }
      : null,
  }
}
