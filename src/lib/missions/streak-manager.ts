import { prisma } from '@/lib/prisma/client'
import { dbDate, toKstDateKey, todayKst } from '@/lib/attendance/time'

export type StreakResult = {
  currentStreak: number
  longestStreak: number
  isNewRecord: boolean
}

const DAY_MS = 24 * 60 * 60 * 1000

/** 두 시각 사이의 KST 날짜 차이 (일) */
function kstDayDiff(from: Date, toKey: string): number {
  return Math.round((dbDate(toKey).getTime() - dbDate(toKstDateKey(from)).getTime()) / DAY_MS)
}

// 날짜 경계는 KST 자정 기준 (서버가 UTC라 setHours(0)을 쓰면 KST 오전 9시가 경계가 됨)
export async function updateStreak(studentId: string): Promise<StreakResult> {
  const todayKey = todayKst()

  const existing = await prisma.studentStreak.findUnique({ where: { studentId } })

  const diffDays = existing?.lastActivityDate ? kstDayDiff(existing.lastActivityDate, todayKey) : null

  // Already updated today — no change
  if (existing && diffDays === 0) {
    return {
      currentStreak: existing.currentStreak,
      longestStreak: existing.longestStreak,
      isNewRecord: false,
    }
  }

  const newStreakValue = existing && diffDays === 1 ? existing.currentStreak + 1 : 1

  const newLongest = Math.max(existing?.longestStreak ?? 0, newStreakValue)
  const isNewRecord = newLongest > (existing?.longestStreak ?? 0)

  const updated = await prisma.studentStreak.upsert({
    where: { studentId },
    create: {
      studentId,
      currentStreak: 1,
      longestStreak: 1,
      lastActivityDate: new Date(),
      totalDays: 1,
    },
    update: {
      currentStreak: newStreakValue,
      longestStreak: newLongest,
      lastActivityDate: new Date(),
      totalDays: { increment: 1 },
    },
  })

  return {
    currentStreak: updated.currentStreak,
    longestStreak: updated.longestStreak,
    isNewRecord,
  }
}
