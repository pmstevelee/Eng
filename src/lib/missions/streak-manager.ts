import { prisma } from '@/lib/prisma/client'

export type StreakResult = {
  currentStreak: number
  longestStreak: number
  isNewRecord: boolean
}

export async function updateStreak(studentId: string): Promise<StreakResult> {
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const existing = await prisma.studentStreak.findUnique({ where: { studentId } })

  if (existing?.lastActivityDate) {
    const last = new Date(existing.lastActivityDate)
    last.setHours(0, 0, 0, 0)
    const diffDays = Math.round((todayStart.getTime() - last.getTime()) / 86400000)

    // Already updated today — no change
    if (diffDays === 0) {
      return {
        currentStreak: existing.currentStreak,
        longestStreak: existing.longestStreak,
        isNewRecord: false,
      }
    }
  }

  let newStreakValue = 1
  if (existing?.lastActivityDate) {
    const last = new Date(existing.lastActivityDate)
    last.setHours(0, 0, 0, 0)
    const diffDays = Math.round((todayStart.getTime() - last.getTime()) / 86400000)
    if (diffDays === 1) {
      newStreakValue = existing.currentStreak + 1
    }
  }

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
