import { prisma } from '@/lib/prisma/client'
import { addDays, dbDate, todayKst } from '@/lib/attendance/time'
import { DIFFICULT_MIN_LAPSES } from '@/lib/words/mastery'

// 교사·학원장 반 리포트용 학생별 최근 7일 학습 지표 (오늘의 단어학습 완료일·포인트·어려운 단어)

export type StudentLearningInsight = {
  /** 최근 7일 중 오늘의 학습을 모두 완료한 날 */
  planDays7: number
  points7: number
  words7: number
  /** 최근 7일 문법 정답률 (%) — 풀이가 없으면 null */
  grammarAccuracy7: number | null
  /** 망각 2회 이상 단어 수 */
  difficultWords: number
}

export const EMPTY_INSIGHT: StudentLearningInsight = {
  planDays7: 0,
  points7: 0,
  words7: 0,
  grammarAccuracy7: null,
  difficultWords: 0,
}

export async function getStudentLearningInsights(
  studentIds: string[],
): Promise<Record<string, StudentLearningInsight>> {
  if (studentIds.length === 0) return {}
  const since = dbDate(addDays(todayKst(), -6))

  const [stats, difficult] = await Promise.all([
    prisma.studentDailyStat.findMany({
      where: { studentId: { in: studentIds }, statDate: { gte: since } },
      select: {
        studentId: true,
        points: true,
        newWords: true,
        reviewWords: true,
        grammarSolved: true,
        grammarCorrect: true,
        planCompleted: true,
      },
    }),
    prisma.wordProgress.groupBy({
      by: ['studentId'],
      where: { studentId: { in: studentIds }, lapses: { gte: DIFFICULT_MIN_LAPSES } },
      _count: { _all: true },
    }),
  ])

  const result: Record<string, StudentLearningInsight> = {}
  const grammarTally = new Map<string, { solved: number; correct: number }>()
  for (const id of studentIds) result[id] = { ...EMPTY_INSIGHT }

  for (const s of stats) {
    const r = result[s.studentId]
    if (!r) continue
    r.points7 += s.points
    r.words7 += s.newWords + s.reviewWords
    if (s.planCompleted) r.planDays7++
    const g = grammarTally.get(s.studentId) ?? { solved: 0, correct: 0 }
    g.solved += s.grammarSolved
    g.correct += s.grammarCorrect
    grammarTally.set(s.studentId, g)
  }
  for (const [id, g] of Array.from(grammarTally.entries())) {
    if (result[id] && g.solved > 0) result[id].grammarAccuracy7 = Math.round((g.correct / g.solved) * 100)
  }
  for (const d of difficult) {
    if (result[d.studentId]) result[d.studentId].difficultWords = d._count._all
  }
  return result
}
