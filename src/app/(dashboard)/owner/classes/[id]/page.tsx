import { redirect, notFound } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { getOwnerAcademyIds } from '@/lib/branch'
import { prisma } from '@/lib/prisma/client'
import ClassDetailClient from './_components/class-detail-client'
import type { ScheduleData } from '../actions'
import { DAY_OF_WEEK_LABEL, isValidTime, type ClassScheduleRow } from '@/lib/attendance/constants'

/** 저장된 정기 시간표가 없을 때 기존 반 정보(요일 + 공통 시각)를 편집기 초기값으로 변환 */
function legacyScheduleRows(schedule: ScheduleData | null): ClassScheduleRow[] {
  if (!schedule || !isValidTime(schedule.startTime) || !isValidTime(schedule.endTime)) return []
  return schedule.days
    .map((d) => DAY_OF_WEEK_LABEL.indexOf(d as (typeof DAY_OF_WEEK_LABEL)[number]))
    .filter((d) => d >= 0)
    .sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))
    .map((dayOfWeek) => ({ dayOfWeek, startTime: schedule.startTime, endTime: schedule.endTime }))
}

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

// 학생 반 배정 변경이 즉시 반영되도록 매 요청 실시간 조회한다.
// academyIds: 학원장의 본원 + 지점 (지점 반 상세도 조회 가능)
const getClassDetail = async (academyIds: string[], classId: string) => {
      const sixMonths = new Date()
      sixMonths.setMonth(sixMonths.getMonth() - 6)
      const [cls, allSessions, domainSessions, unassignedStudents, allClasses] = await Promise.all([
        prisma.class.findFirst({
          where: { id: classId, academyId: { in: academyIds } },
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
          where: { classId: null, status: 'ACTIVE', user: { academyId: { in: academyIds }, isDeleted: false } },
          select: { id: true, currentLevel: true, user: { select: { name: true, academyId: true } } },
          orderBy: { user: { name: 'asc' } },
        }),
        prisma.class.findMany({
          where: { academyId: { in: academyIds }, isActive: true, id: { not: classId } },
          select: { id: true, name: true, academyId: true },
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
        // 배정 후보·이동 대상은 반과 같은 학원(본원/지점)으로 한정
        unassignedStudents: unassignedStudents
          .filter((s) => s.user.academyId === cls.academyId)
          .map((s) => ({
          id: s.id,
          name: s.user.name,
          level: s.currentLevel,
        })),
        allClasses: allClasses
          .filter((c) => c.academyId === cls.academyId)
          .map((c) => ({ id: c.id, name: c.name })),
      }
}

export default async function ClassDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ACADEMY_OWNER' || !user.academyId) redirect('/login')

  const { id: classId } = await params
  const ownerIds = await getOwnerAcademyIds(user.id)
  const academyIds = ownerIds.length > 0 ? ownerIds : [user.academyId]

  const [data, scheduleRows] = await Promise.all([
    getClassDetail(academyIds, classId),
    prisma.classSchedule.findMany({
      where: { classId, class: { academyId: { in: academyIds } } },
      select: { dayOfWeek: true, startTime: true, endTime: true },
    }),
  ])
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

  const schedule = parseSchedule(cls.scheduleJson)
  // 월요일부터 표시
  scheduleRows.sort(
    (a, b) => ((a.dayOfWeek + 6) % 7) - ((b.dayOfWeek + 6) % 7) || a.startTime.localeCompare(b.startTime),
  )
  const legacyRows = scheduleRows.length === 0 ? legacyScheduleRows(schedule) : []

  return (
    <ClassDetailClient
      classItem={{
        id: cls.id,
        name: cls.name,
        levelRange: cls.levelRange,
        isActive: cls.isActive,
        schedule,
        teacher: cls.teacher,
      }}
      scheduleRows={scheduleRows.length > 0 ? scheduleRows : legacyRows}
      scheduleFromLegacy={legacyRows.length > 0}
      students={students}
      monthlyScores={monthlyScores}
      domainAvg={domainAvg}
      studentScoreDistribution={studentScoreDistribution}
      allClasses={allClasses}
      unassignedStudents={unassignedStudents}
    />
  )
}
