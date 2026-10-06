import { prisma } from '@/lib/prisma/client'
import { dbDate, todayKst } from '@/lib/attendance/time'

// 학생 일자별 학습량 집계 (StudentDailyStat) — 랭킹·추이 분석의 원천 데이터.
// 날짜는 KST 기준. 실패해도 학습 흐름을 막지 않도록 호출부에서 catch한다.

export type DailyStatDelta = {
  points?: number
  newWords?: number
  reviewWords?: number
  masteredWords?: number
  wordCorrect?: number
  wordWrong?: number
  grammarSolved?: number
  grammarCorrect?: number
}

const DELTA_KEYS = [
  'points',
  'newWords',
  'reviewWords',
  'masteredWords',
  'wordCorrect',
  'wordWrong',
  'grammarSolved',
  'grammarCorrect',
] as const

/** 오늘(KST) 집계 행의 @db.Date 값 */
export function todayStatDate(): Date {
  return dbDate(todayKst())
}

/** 오늘 집계 행에 증분을 더하는 upsert 쿼리 (배열 트랜잭션에 넣을 수 있도록 PrismaPromise 반환) */
export function dailyStatUpsert(studentId: string, delta: DailyStatDelta, extra?: { planCompleted?: boolean }) {
  const statDate = todayStatDate()
  const create: Record<string, number> = {}
  const update: Record<string, { increment: number }> = {}
  for (const key of DELTA_KEYS) {
    const v = delta[key]
    if (!v) continue
    create[key] = v
    update[key] = { increment: v }
  }
  return prisma.studentDailyStat.upsert({
    where: { studentId_statDate: { studentId, statDate } },
    create: { studentId, statDate, ...create, ...(extra ?? {}) },
    update: { ...update, ...(extra ?? {}) },
  })
}

function hasDelta(delta: DailyStatDelta): boolean {
  return DELTA_KEYS.some((k) => (delta[k] ?? 0) !== 0)
}

/** 오늘 집계에 증분 반영 (실패 시 로그만 남김) */
export async function bumpDailyStat(studentId: string, delta: DailyStatDelta): Promise<void> {
  if (!hasDelta(delta)) return
  try {
    await dailyStatUpsert(studentId, delta)
  } catch (error) {
    console.error('[daily-stats] 집계 실패:', error)
  }
}
