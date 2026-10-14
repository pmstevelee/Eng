import 'server-only'

import { prisma } from '@/lib/prisma/client'
import { dbDate, kstDateTime, monthRange, addDays, toKstDateKey, fromDbDate } from '@/lib/attendance/time'

export type CalendarDayActivity = {
  word: boolean
  grammar: boolean
  writing: boolean
}

/** 월간 학습 캘린더 — 날짜 키(YYYY-MM-DD, KST) → 단어/문법/쓰기 학습 여부 */
export async function getMonthlyLearningActivity(
  studentId: string,
  monthKey: string,
): Promise<Record<string, CalendarDayActivity>> {
  const { first, last } = monthRange(monthKey)

  const [stats, writings] = await Promise.all([
    prisma.studentDailyStat.findMany({
      where: { studentId, statDate: { gte: dbDate(first), lte: dbDate(last) } },
      select: {
        statDate: true,
        newWords: true,
        reviewWords: true,
        wordCorrect: true,
        wordWrong: true,
        grammarSolved: true,
      },
    }),
    prisma.report.findMany({
      where: {
        studentId,
        type: 'WRITING_PRACTICE',
        createdAt: { gte: kstDateTime(first, '00:00'), lt: kstDateTime(addDays(last, 1), '00:00') },
      },
      select: { createdAt: true },
    }),
  ])

  const result: Record<string, CalendarDayActivity> = {}
  const ensure = (key: string) => (result[key] ??= { word: false, grammar: false, writing: false })

  for (const s of stats) {
    const day = ensure(fromDbDate(s.statDate))
    if (s.newWords + s.reviewWords + s.wordCorrect + s.wordWrong > 0) day.word = true
    if (s.grammarSolved > 0) day.grammar = true
  }
  for (const w of writings) {
    ensure(toKstDateKey(w.createdAt)).writing = true
  }
  return result
}
