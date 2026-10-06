import { prisma } from '@/lib/prisma/client'
import { BadgeType } from '@/generated/prisma'
import { dailyStatUpsert, type DailyStatDelta } from '@/lib/learning/daily-stats'

export type XpResult = {
  totalXp: number
  earned: number
}

export const BADGE_XP: Record<BadgeType, number> = {
  STREAK_3: 10,
  STREAK_7: 25,
  STREAK_14: 50,
  STREAK_30: 100,
  STREAK_100: 500,
  FIRST_TEST: 20,
  PERFECT_SCORE: 50,
  SPEED_DEMON: 30,
  LEVEL_UP: 100,
  MASTER: 200,
  WEEKLY_GOAL: 30,
  MISSION_COMPLETE: 15,
}

export async function awardXP(
  studentId: string,
  amount: number,
  source: string,
  sourceId?: string,
  /** 같은 트랜잭션으로 함께 누적할 일자별 학습량 (DB 왕복 절약) */
  statDelta?: Omit<DailyStatDelta, 'points'>,
): Promise<XpResult> {
  // 포인트 랭킹용 일자별 집계(StudentDailyStat.points)도 같은 트랜잭션으로 누적한다.
  const [, updated] = await prisma.$transaction([
    prisma.studentXp.create({
      data: { studentId, amount, source, ...(sourceId ? { sourceId } : {}) },
    }),
    prisma.student.update({
      where: { id: studentId },
      data: { totalXp: { increment: amount } },
      select: { totalXp: true },
    }),
    dailyStatUpsert(studentId, { ...statDelta, points: amount }),
  ])

  return { totalXp: updated.totalXp, earned: amount }
}
