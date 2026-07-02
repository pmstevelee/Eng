import { prisma } from '@/lib/prisma/client'
import { formatDateStr } from '@/components/schedule/types'
import type { ActivityEvent, ActivityKind } from '@/components/schedule/types'

const ACTIVITY_WINDOW_DAYS = 60
const MAX_STUDENT_NAMES = 10

/** 학생 ID 목록의 최근 활동(단어학습/단어시험/테스트응시)을 날짜×유형으로 집계 */
export async function getStudentActivityEvents(studentIds: string[]): Promise<ActivityEvent[]> {
  if (studentIds.length === 0) return []

  const since = new Date()
  since.setDate(since.getDate() - ACTIVITY_WINDOW_DAYS)

  const [wordProgress, wordTestAttempts, testSessions] = await Promise.all([
    prisma.wordProgress.findMany({
      where: { studentId: { in: studentIds }, lastStudiedAt: { gte: since } },
      select: {
        lastStudiedAt: true,
        student: { select: { user: { select: { name: true } } } },
      },
    }),
    prisma.wordTestAttempt.findMany({
      where: { studentId: { in: studentIds }, completedAt: { gte: since } },
      select: {
        completedAt: true,
        student: { select: { user: { select: { name: true } } } },
      },
    }),
    prisma.testSession.findMany({
      where: { studentId: { in: studentIds }, completedAt: { gte: since }, status: { in: ['COMPLETED', 'GRADED'] } },
      select: {
        completedAt: true,
        student: { select: { user: { select: { name: true } } } },
      },
    }),
  ])

  const bucket = new Map<string, { count: number; names: Set<string> }>()

  const add = (kind: ActivityKind, date: Date | null, name: string) => {
    if (!date) return
    const key = `${formatDateStr(date)}__${kind}`
    const entry = bucket.get(key) ?? { count: 0, names: new Set<string>() }
    entry.count += 1
    entry.names.add(name)
    bucket.set(key, entry)
  }

  wordProgress.forEach((p) => add('WORD_STUDY', p.lastStudiedAt, p.student.user.name))
  wordTestAttempts.forEach((a) => add('WORD_TEST', a.completedAt, a.student.user.name))
  testSessions.forEach((s) => add('TEST', s.completedAt, s.student.user.name))

  return Array.from(bucket.entries()).map(([key, { count, names }]) => {
    const [date, kind] = key.split('__') as [string, ActivityKind]
    return {
      date,
      kind,
      count,
      studentNames: Array.from(names).slice(0, MAX_STUDENT_NAMES),
    }
  })
}
