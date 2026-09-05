import { prisma } from '@/lib/prisma/client'

/** 학생 목록 화면에서 한눈에 보여줄 단어학습 요약 지표 */
export type StudentWordStat = {
  /** 학습을 시작한 단어 수 */
  learned: number
  /** 마스터 단계에 도달한 단어 수 */
  mastered: number
  /** 플래시카드/복습 누적 정답률 (%) — 응답 기록이 없으면 null */
  accuracy: number | null
  /** 단어시험 누적 정답률 (%) — 응시 기록이 없으면 null */
  testAccuracy: number | null
  /** 단어시험 응시 횟수 (자율학습 + 교사 출제 합산) */
  testCount: number
  /** 마지막 단어 학습일 (ISO 문자열) */
  lastStudiedAt: string | null
}

export const EMPTY_WORD_STAT: StudentWordStat = {
  learned: 0,
  mastered: 0,
  accuracy: null,
  testAccuracy: null,
  testCount: 0,
  lastStudiedAt: null,
}

/**
 * 여러 학생의 단어학습 통계를 groupBy 집계로 한 번에 계산한다.
 * 학생별 wordProgress row를 전부 로딩하면 수천 건이 되므로 DB 집계만 사용한다.
 */
export async function getStudentWordStats(
  studentIds: string[],
): Promise<Record<string, StudentWordStat>> {
  if (studentIds.length === 0) return {}

  const [progressAgg, masteredAgg, selfTestAgg, assignedTestAgg] = await Promise.all([
    prisma.wordProgress.groupBy({
      by: ['studentId'],
      where: { studentId: { in: studentIds } },
      _count: { _all: true },
      _sum: { correctCount: true, wrongCount: true },
      _max: { lastStudiedAt: true },
    }),
    prisma.wordProgress.groupBy({
      by: ['studentId'],
      where: { studentId: { in: studentIds }, stage: 'MASTERED' },
      _count: { _all: true },
    }),
    prisma.wordTest.groupBy({
      by: ['studentId'],
      where: { studentId: { in: studentIds } },
      _count: { _all: true },
      _avg: { score: true },
    }),
    prisma.wordTestAttempt.groupBy({
      by: ['studentId'],
      where: { studentId: { in: studentIds } },
      _count: { _all: true },
      _avg: { score: true },
    }),
  ])

  const masteredById = new Map(masteredAgg.map((r) => [r.studentId, r._count._all]))

  // score는 이미 0~100 정답률(%)이므로, 자율학습/교사출제 시험 횟수로 가중 평균한다.
  const testTally = new Map<string, { weightedScoreSum: number; count: number }>()
  for (const agg of [selfTestAgg, assignedTestAgg]) {
    for (const r of agg) {
      const t = testTally.get(r.studentId) ?? { weightedScoreSum: 0, count: 0 }
      t.weightedScoreSum += (r._avg.score ?? 0) * r._count._all
      t.count += r._count._all
      testTally.set(r.studentId, t)
    }
  }

  const result: Record<string, StudentWordStat> = {}
  for (const id of studentIds) result[id] = { ...EMPTY_WORD_STAT }

  for (const r of progressAgg) {
    const correct = r._sum.correctCount ?? 0
    const wrong = r._sum.wrongCount ?? 0
    const answered = correct + wrong
    const stat = result[r.studentId]
    if (!stat) continue
    stat.learned = r._count._all
    stat.mastered = masteredById.get(r.studentId) ?? 0
    stat.accuracy = answered > 0 ? Math.round((correct / answered) * 100) : null
    stat.lastStudiedAt = r._max.lastStudiedAt?.toISOString() ?? null
  }

  testTally.forEach((t, studentId) => {
    const stat = result[studentId]
    if (!stat) return
    stat.testCount = t.count
    stat.testAccuracy = t.count > 0 ? Math.round(t.weightedScoreSum / t.count) : null
  })

  return result
}

const CEFR_LABEL: Record<number, string> = {
  1: 'Pre-A1', 2: 'A1 하', 3: 'A1 상', 4: 'A2 하', 5: 'A2 상',
  6: 'B1 하', 7: 'B1 상', 8: 'B2 하', 9: 'B2 상', 10: 'C1+',
}

/** 학생 상세 페이지(교사/학원장)에서 보여줄 단어학습 상세 통계 */
export type StudentWordDetail = StudentWordStat & {
  cefrProgress: { level: number; label: string; learned: number; mastered: number }[]
  weeklyActivity: { date: string; count: number }[]
  weakWords: { word: string; meaning: string | null; wrongCount: number; correctCount: number }[]
}

/**
 * 단일 학생의 단어학습 상세 통계를 계산한다.
 * 학생 상세 페이지는 한 명의 row만 로딩하므로 findMany로 전체 진도를 가져와 메모리에서 집계한다.
 */
export async function getStudentWordDetail(studentId: string): Promise<StudentWordDetail> {
  const [progress, selfTestAgg, assignedTestAgg] = await Promise.all([
    prisma.wordProgress.findMany({
      where: { studentId },
      select: {
        stage: true,
        wrongCount: true,
        correctCount: true,
        lastStudiedAt: true,
        word: { select: { term: true, meaning: true, cefrLevel: true } },
      },
    }),
    prisma.wordTest.aggregate({
      where: { studentId },
      _count: { _all: true },
      _avg: { score: true },
    }),
    prisma.wordTestAttempt.aggregate({
      where: { studentId },
      _count: { _all: true },
      _avg: { score: true },
    }),
  ])

  const learned = progress.length
  const mastered = progress.filter((p) => p.stage === 'MASTERED').length
  const correct = progress.reduce((sum, p) => sum + p.correctCount, 0)
  const wrong = progress.reduce((sum, p) => sum + p.wrongCount, 0)
  const answered = correct + wrong
  const lastStudiedAt = progress.reduce<Date | null>((latest, p) => {
    if (!p.lastStudiedAt) return latest
    return !latest || p.lastStudiedAt > latest ? p.lastStudiedAt : latest
  }, null)

  // score는 이미 0~100 정답률(%)이므로, 자율학습/교사출제 시험 횟수로 가중 평균한다.
  const testCount = selfTestAgg._count._all + assignedTestAgg._count._all
  const weightedScoreSum =
    (selfTestAgg._avg.score ?? 0) * selfTestAgg._count._all +
    (assignedTestAgg._avg.score ?? 0) * assignedTestAgg._count._all

  const cefrMap = new Map<number, { learned: number; mastered: number }>()
  for (let i = 1; i <= 10; i++) cefrMap.set(i, { learned: 0, mastered: 0 })
  for (const p of progress) {
    const entry = cefrMap.get(p.word.cefrLevel)
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

  const now = new Date()
  const weeklyActivity = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now)
    d.setDate(d.getDate() - (6 - i))
    const dateStr = d.toISOString().slice(0, 10)
    const count = progress.filter((p) => p.lastStudiedAt?.toISOString().slice(0, 10) === dateStr).length
    return { date: dateStr, count }
  })

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

  return {
    learned,
    mastered,
    accuracy: answered > 0 ? Math.round((correct / answered) * 100) : null,
    testAccuracy: testCount > 0 ? Math.round(weightedScoreSum / testCount) : null,
    testCount,
    lastStudiedAt: lastStudiedAt?.toISOString() ?? null,
    cefrProgress,
    weeklyActivity,
    weakWords,
  }
}
