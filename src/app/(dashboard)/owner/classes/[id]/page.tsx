import { redirect, notFound } from 'next/navigation'
import { unstable_cache } from 'next/cache'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma/client'
import ClassDetailClient from './_components/class-detail-client'
import type { ScheduleData } from '../actions'

function parseSchedule(json: unknown): ScheduleData | null {
  if (!json || typeof json !== 'object' || Array.isArray(json)) return null
  const obj = json as Record<string, unknown>
  return {
    days: Array.isArray(obj.days) ? (obj.days as string[]) : [],
    startTime: typeof obj.startTime === 'string' ? obj.startTime : '',
    endTime: typeof obj.endTime === 'string' ? obj.endTime : '',
    room: typeof obj.room === 'string' ? obj.room : '',
  }
}

function avgOf(vals: (number | null)[]): number {
  const filtered = vals.filter((v): v is number => v !== null)
  return filtered.length
    ? Math.round(filtered.reduce((a, b) => a + b, 0) / filtered.length)
    : 0
}

const getClassDetail = (academyId: string, classId: string) => {
  const sixMonthsAgo = new Date()
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
  const sixMonthsAgoStr = sixMonthsAgo.toISOString()

  return unstable_cache(
    async () => {
      const sixMonths = new Date(sixMonthsAgoStr)
      const [cls, allSessions, domainSessions, unassignedStudents, allClasses] = await Promise.all([
        prisma.class.findFirst({
          where: { id: classId, academyId },
          include: {
            teacher: { select: { id: true, name: true } },
            students: {
              where: { status: 'ACTIVE' },
              include: {
                user: { select: { name: true } },
                testSessions: {
                  where: { score: { not: null } },
                  select: { score: true },
                  orderBy: { completedAt: 'desc' },
                  take: 10,
                },
                attendance: {
                  where: { classId },
                  select: { status: true },
                },
              },
            },
          },
        }),
        prisma.testSession.findMany({
          where: {
            score: { not: null },
            completedAt: { gte: sixMonths },
            student: { classId },
          },
          select: { score: true, completedAt: true },
        }),
        prisma.testSession.findMany({
          where: { score: { not: null }, student: { classId } },
          select: {
            grammarScore: true,
            vocabularyScore: true,
            readingScore: true,
            writingScore: true,
          },
          orderBy: { completedAt: 'desc' },
          take: 100,
        }),
        prisma.student.findMany({
          where: { classId: null, status: 'ACTIVE', user: { academyId, isDeleted: false } },
          select: { id: true, currentLevel: true, user: { select: { name: true } } },
          orderBy: { user: { name: 'asc' } },
        }),
        prisma.class.findMany({
          where: { academyId, isActive: true, id: { not: classId } },
          select: { id: true, name: true },
          orderBy: { name: 'asc' },
        }),
      ])

      if (!cls) return null

      return {
        cls: {
          id: cls.id,
          name: cls.name,
          levelRange: cls.levelRange,
          isActive: cls.isActive,
          scheduleJson: cls.scheduleJson,
          teacher: cls.teacher ? { id: cls.teacher.id, name: cls.teacher.name } : null,
          students: cls.students.map((s) => ({
            id: s.id,
            name: s.user.name,
            level: s.currentLevel,
            scores: s.testSessions.map((ts) => ts.score!),
            attendance: s.attendance.map((a) => a.status),
          })),
        },
        allSessions: allSessions.map((s) => ({
          score: s.score!,
          completedAt: s.completedAt?.toISOString() ?? null,
        })),
        domainSessions,
        unassignedStudents: unassignedStudents.map((s) => ({
          id: s.id,
          name: s.user.name,
          level: s.currentLevel,
        })),
        allClasses: allClasses.map((c) => ({ id: c.id, name: c.name })),
      }
    },
    ['owner-class-detail', academyId, classId],
    { revalidate: 30, tags: [`academy-${academyId}-classes`, `class-${classId}`] },
  )()
}

export default async function ClassDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ACADEMY_OWNER' || !user.academyId) redirect('/login')

  const { id: classId } = await params

  const data = await getClassDetail(user.academyId, classId)
  if (!data) notFound()

  const { cls, allSessions, domainSessions, unassignedStudents, allClasses } = data

  // Monthly scores
  const monthMap = new Map<string, number[]>()
  for (const s of allSessions) {
    if (!s.completedAt) continue
    const key = s.completedAt.slice(0, 7)
    if (!monthMap.has(key)) monthMap.set(key, [])
    monthMap.get(key)!.push(s.score)
  }
  const monthlyScores = Array.from(monthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, scores]) => ({
      month,
      avg: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
    }))

  // Domain avg
  const domainAvg = {
    grammar: avgOf(domainSessions.map((s) => s.grammarScore)),
    vocabulary: avgOf(domainSessions.map((s) => s.vocabularyScore)),
    reading: avgOf(domainSessions.map((s) => s.readingScore)),
    writing: avgOf(domainSessions.map((s) => s.writingScore)),
  }

  // Students data
  const students = cls.students.map((s) => {
    const avgScore =
      s.scores.length > 0
        ? Math.round((s.scores.reduce((a, b) => a + b, 0) / s.scores.length) * 10) / 10
        : null
    const total = s.attendance.length
    const present = s.attendance.filter((a) => a === 'PRESENT' || a === 'LATE').length
    const attendanceRate = total > 0 ? Math.round((present / total) * 100) : null

    return {
      id: s.id,
      name: s.name,
      level: s.level,
      lastScore: s.scores[0] ?? null,
      avgScore,
      attendanceRate,
    }
  })

  const studentScoreDistribution = students
    .filter((s) => s.avgScore !== null)
    .map((s) => ({ name: s.name, avg: s.avgScore! }))

  return (
    <ClassDetailClient
      classItem={{
        id: cls.id,
        name: cls.name,
        levelRange: cls.levelRange,
        isActive: cls.isActive,
        schedule: parseSchedule(cls.scheduleJson),
        teacher: cls.teacher,
      }}
      students={students}
      monthlyScores={monthlyScores}
      domainAvg={domainAvg}
      studentScoreDistribution={studentScoreDistribution}
      allClasses={allClasses}
      unassignedStudents={unassignedStudents}
    />
  )
}
