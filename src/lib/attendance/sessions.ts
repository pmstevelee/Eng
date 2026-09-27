import 'server-only'
import { prisma } from '@/lib/prisma/client'
import { dayOfWeekOf, dbDate, kstDateTime, kstMonthStart } from './time'

/**
 * 해당 날짜 요일의 정기 시간표(ClassSchedule)로 수업 회차(ClassSession)를 만든다.
 * 이미 있는 회차는 (classId, date, startAt) unique로 건너뜀 — 여러 번 호출해도 안전.
 * 크론 없이 오늘 출결 화면이 열릴 때 호출한다.
 */
export async function ensureSessionsForDate(academyId: string, dateKey: string): Promise<void> {
  const schedules = await prisma.classSchedule.findMany({
    where: { dayOfWeek: dayOfWeekOf(dateKey), class: { academyId, isActive: true } },
    select: { classId: true, startTime: true, endTime: true },
  })
  if (schedules.length === 0) return

  await prisma.classSession.createMany({
    data: schedules.map((s) => ({
      classId: s.classId,
      date: dbDate(dateKey),
      startAt: kstDateTime(dateKey, s.startTime),
      endAt: kstDateTime(dateKey, s.endTime),
    })),
    skipDuplicates: true,
  })
}

/** 특정 반·회차 하나만 보장 (월간 출석부에서 아직 생성되지 않은 수업일 셀을 수정할 때) */
export async function ensureSession(
  classId: string,
  dateKey: string,
  startTime: string,
  endTime: string,
): Promise<{ id: string }> {
  const startAt = kstDateTime(dateKey, startTime)
  return prisma.classSession.upsert({
    where: { classId_date_startAt: { classId, date: dbDate(dateKey), startAt } },
    create: { classId, date: dbDate(dateKey), startAt, endAt: kstDateTime(dateKey, endTime) },
    update: {},
    select: { id: true },
  })
}

export type RosterStudent = { id: string; name: string; classId: string | null }

/**
 * 출결 명단에 포함되는 학생 조건.
 * 재원생 + 퇴원생은 퇴원한 달의 말일까지만 포함 (휴원생은 제외).
 */
export function rosterStatusWhere(dateKey: string) {
  return {
    OR: [
      { status: 'ACTIVE' as const },
      { status: 'WITHDRAWN' as const, withdrawnAt: { gte: kstMonthStart(dateKey) } },
    ],
  }
}

/** 반별 명단 (날짜 기준 퇴원생 규칙 적용) */
export async function getClassRosters(classIds: string[], dateKey: string): Promise<Map<string, RosterStudent[]>> {
  const map = new Map<string, RosterStudent[]>()
  if (classIds.length === 0) return map
  const students = await prisma.student.findMany({
    where: { classId: { in: classIds }, user: { isDeleted: false }, ...rosterStatusWhere(dateKey) },
    select: { id: true, classId: true, user: { select: { name: true } } },
    orderBy: { user: { name: 'asc' } },
  })
  for (const s of students) {
    if (!s.classId) continue
    const list = map.get(s.classId) ?? []
    list.push({ id: s.id, name: s.user.name, classId: s.classId })
    map.set(s.classId, list)
  }
  return map
}
