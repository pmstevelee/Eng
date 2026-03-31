import { prisma } from '@/lib/prisma/client'
import { BadgeType } from '@/generated/prisma'

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
): Promise<XpResult> {
  const [, updated] = await prisma.$transaction([
    prisma.studentXp.create({
      data: { studentId, amount, source, ...(sourceId ? { sourceId } : {}) },
    }),
    prisma.student.update({
      where: { id: studentId },
      data: { totalXp: { increment: amount } },
      select: { totalXp: true },
    }),
  ])

  return { totalXp: updated.totalXp, earned: amount }
}
