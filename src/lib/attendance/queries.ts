import 'server-only'
import { prisma } from '@/lib/prisma/client'
import { canAccessClass, canEditDate, classWhereForScope, type AttendanceScope } from './access'
import type { AttendanceModeValue } from './constants'
import { RECORD_VIEW_SELECT, toRecordView, type AttendanceRecordView } from './records'
import { ensureSessionsForDate, getClassRosters, rosterStatusWhere } from './sessions'
import { getOrCreateAttendanceSetting } from './settings'
import {
  addDays,
  dayOfWeekOf,
  dbDate,
  formatKstTime,
  fromDbDate,
  monthRange,
  toKstDateKey,
  todayKst,
} from './time'

// ─── 오늘 출결 ─────────────────────────────────────────────────────────────────

export type TodaySession = {
  id: string
  className: string
  teacherName: string | null
  startAt: string
  endAt: string
  endedAt: string | null
  cancelled: boolean
  total: number
  checked: number
}

/** 원 출결: 학생 1명 = 1행 / 반 출결: 수업-학생 1쌍 = 1행 */
export type TodayStudentRow = {
  key: string
  studentId: string
  name: string
  className: string | null
  sessionId: string | null
  record: AttendanceRecordView | null
}

export type TodayAttendanceData = {
  dateKey: string
  mode: AttendanceModeValue
  lateGraceMinutes: number
  canEdit: boolean
  sessions: TodaySession[]
  students: TodayStudentRow[]
}

export async function getTodayAttendance(
  scope: AttendanceScope,
  academyId: string,
  dateKey: string,
): Promise<TodayAttendanceData> {
  const [setting] = await Promise.all([
    getOrCreateAttendanceSetting(academyId),
    ensureSessionsForDate(academyId, dateKey),
  ])

  const sessions = await prisma.classSession.findMany({
    where: { date: dbDate(dateKey), class: { ...classWhereForScope(scope, academyId), isActive: true } },
    select: {
      id: true,
      classId: true,
      startAt: true,
      endAt: true,
      endedAt: true,
      cancelled: true,
      class: { select: { name: true, teacher: { select: { name: true } } } },
    },
    orderBy: [{ startAt: 'asc' }, { class: { name: 'asc' } }],
  })

  const [rosters, sessionRecords] = await Promise.all([
    getClassRosters(
      Array.from(new Set(sessions.map((s) => s.classId))),
      dateKey,
    ),
    prisma.attendanceRecord.findMany({
      where: { sessionId: { in: sessions.map((s) => s.id) } },
      select: { ...RECORD_VIEW_SELECT, sessionId: true, student: { select: { user: { select: { name: true } } } } },
    }),
  ])

  const recordsBySession = new Map<string, typeof sessionRecords>()
  for (const r of sessionRecords) {
    if (!r.sessionId) continue
    const list = recordsBySession.get(r.sessionId) ?? []
    list.push(r)
    recordsBySession.set(r.sessionId, list)
  }

  const sessionRows: TodayStudentRow[] = []
  const todaySessions: TodaySession[] = sessions.map((s) => {
    const records = recordsBySession.get(s.id) ?? []
    const recordByStudent = new Map(records.map((r) => [r.studentId, r]))
    const roster = rosters.get(s.classId) ?? []
    // 명단 + (반 이동 등으로 명단에서 빠졌지만 기록이 있는 학생)
    const students = [
      ...roster.map((st) => ({ id: st.id, name: st.name })),
      ...records
        .filter((r) => !roster.some((st) => st.id === r.studentId))
        .map((r) => ({ id: r.studentId, name: r.student.user.name })),
    ]
    let checked = 0
    for (const st of students) {
      const rec = recordByStudent.get(st.id)
      if (rec && rec.status !== 'UNCHECKED') checked++
      sessionRows.push({
        key: `${s.id}:${st.id}`,
        studentId: st.id,
        name: st.name,
        className: s.class.name,
        sessionId: s.id,
        record: rec ? toRecordView(rec) : null,
      })
    }
    return {
      id: s.id,
      className: s.class.name,
      teacherName: s.class.teacher?.name ?? null,
      startAt: s.startAt.toISOString(),
      endAt: s.endAt.toISOString(),
      endedAt: s.endedAt?.toISOString() ?? null,
      cancelled: s.cancelled,
      total: students.length,
      checked,
    }
  })

  const base = {
    dateKey,
    mode: setting.mode,
    lateGraceMinutes: setting.lateGraceMinutes,
    canEdit: canEditDate(scope, dateKey),
    sessions: todaySessions,
  }
  if (setting.mode === 'CLASS') return { ...base, students: sessionRows }
  return { ...base, students: await getAcademyModeRows(scope, academyId, dateKey) }
}

/** 원 출결 학생 목록 (교사는 담당 반 학생만) */
async function getAcademyModeRows(
  scope: AttendanceScope,
  academyId: string,
  dateKey: string,
): Promise<TodayStudentRow[]> {
  const teacherOnly = scope.role === 'TEACHER'
  const [students, records] = await Promise.all([
    prisma.student.findMany({
      where: {
        user: { academyId, isDeleted: false },
        ...rosterStatusWhere(dateKey),
        ...(teacherOnly ? { class: { teacherId: scope.userId } } : {}),
      },
      select: { id: true, user: { select: { name: true } }, class: { select: { name: true } } },
      orderBy: { user: { name: 'asc' } },
    }),
    prisma.attendanceRecord.findMany({
      where: {
        academyId,
        date: dbDate(dateKey),
        sessionId: null,
        mode: 'ACADEMY',
        ...(teacherOnly ? { student: { class: { teacherId: scope.userId } } } : {}),
      },
      select: {
        ...RECORD_VIEW_SELECT,
        student: { select: { user: { select: { name: true } }, class: { select: { name: true } } } },
      },
    }),
  ])

  const recordByStudent = new Map(records.map((r) => [r.studentId, r]))
  const rows: TodayStudentRow[] = students.map((s) => {
    const rec = recordByStudent.get(s.id)
    return {
      key: s.id,
      studentId: s.id,
      name: s.user.name,
      className: s.class?.name ?? null,
      sessionId: null,
      record: rec ? toRecordView(rec) : null,
    }
  })
  // 휴원 등으로 명단에서 빠졌지만 기록이 있는 학생
  for (const r of records) {
    if (students.some((s) => s.id === r.studentId)) continue
    rows.push({
      key: r.studentId,
      studentId: r.studentId,
      name: r.student.user.name,
      className: r.student.class?.name ?? null,
      sessionId: null,
      record: toRecordView(r),
    })
  }
  return rows
}

// ─── 반 출석 체크 ──────────────────────────────────────────────────────────────

export type SessionDetail = {
  id: string
  className: string
  teacherName: string | null
  dateKey: string
  startAt: string
  endAt: string
  endedAt: string | null
  cancelled: boolean
  lateGraceMinutes: number
  autoAbsentOnEnd: boolean
  canEdit: boolean
  students: { id: string; name: string; record: AttendanceRecordView | null }[]
}

/** 접근 권한이 없거나 없는 회차면 null (교사는 담당 반만) */
export async function getSessionDetail(scope: AttendanceScope, sessionId: string): Promise<SessionDetail | null> {
  const session = await prisma.classSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      classId: true,
      date: true,
      startAt: true,
      endAt: true,
      endedAt: true,
      cancelled: true,
      class: {
        select: { name: true, academyId: true, teacherId: true, teacher: { select: { name: true } } },
      },
    },
  })
  if (!session || !canAccessClass(scope, session.class)) return null

  const dateKey = fromDbDate(session.date)
  const [setting, rosters, records] = await Promise.all([
    getOrCreateAttendanceSetting(session.class.academyId),
    getClassRosters([session.classId], dateKey),
    prisma.attendanceRecord.findMany({
      where: { sessionId },
      select: { ...RECORD_VIEW_SELECT, student: { select: { user: { select: { name: true } } } } },
    }),
  ])

  const roster = rosters.get(session.classId) ?? []
  const recordByStudent = new Map(records.map((r) => [r.studentId, r]))
  const students = [
    ...roster.map((s) => ({ id: s.id, name: s.name })),
    ...records
      .filter((r) => !roster.some((s) => s.id === r.studentId))
      .map((r) => ({ id: r.studentId, name: r.student.user.name })),
  ].map((s) => {
    const rec = recordByStudent.get(s.id)
    return { ...s, record: rec ? toRecordView(rec) : null }
  })

  return {
    id: session.id,
    className: session.class.name,
    teacherName: session.class.teacher?.name ?? null,
    dateKey,
    startAt: session.startAt.toISOString(),
    endAt: session.endAt.toISOString(),
    endedAt: session.endedAt?.toISOString() ?? null,
    cancelled: session.cancelled,
    lateGraceMinutes: setting.lateGraceMinutes,
    autoAbsentOnEnd: setting.autoAbsentOnEnd,
    canEdit: canEditDate(scope, dateKey),
    students,
  }
}

// ─── 월간 출석부 ───────────────────────────────────────────────────────────────

/** 출석부 열 = 그 반의 수업 1회 (아직 회차가 생성되지 않은 정기 수업일 포함) */
export type MonthlyColumn = {
  key: string
  dateKey: string
  startTime: string
  endTime: string
  sessionId: string | null
}

export type MonthlyCell = { status: AttendanceRecordView['status']; reason: string | null }

export type MonthlySheet = {
  classes: { id: string; name: string }[]
  classId: string | null
  className: string | null
  monthKey: string
  today: string
  mode: AttendanceModeValue
  /** 오늘 이전 날짜 수정 가능 여부 (학원장만) */
  canEditPast: boolean
  columns: MonthlyColumn[]
  students: { id: string; name: string; withdrawnDateKey: string | null }[]
  /** key: `${studentId}|${column.key}` */
  cells: Record<string, MonthlyCell>
}

export async function getMonthlySheet(
  scope: AttendanceScope,
  requestedClassId: string | undefined,
  monthKey: string,
): Promise<MonthlySheet> {
  const classes = await prisma.class.findMany({
    where: { ...classWhereForScope(scope), isActive: true },
    select: { id: true, name: true, academyId: true },
    orderBy: { name: 'asc' },
  })
  const cls = classes.find((c) => c.id === requestedClassId) ?? classes[0] ?? null
  const today = todayKst()
  const base = {
    classes: classes.map((c) => ({ id: c.id, name: c.name })),
    monthKey,
    today,
    canEditPast: scope.role === 'ACADEMY_OWNER',
  }
  if (!cls) {
    return { ...base, classId: null, className: null, mode: 'ACADEMY', columns: [], students: [], cells: {} }
  }

  const { first, last } = monthRange(monthKey)
  const [setting, sessions, schedules, rosterStudents] = await Promise.all([
    getOrCreateAttendanceSetting(cls.academyId),
    prisma.classSession.findMany({
      where: { classId: cls.id, date: { gte: dbDate(first), lte: dbDate(last) }, cancelled: false },
      select: { id: true, date: true, startAt: true, endAt: true },
    }),
    prisma.classSchedule.findMany({
      where: { classId: cls.id },
      select: { dayOfWeek: true, startTime: true, endTime: true, createdAt: true },
    }),
    prisma.student.findMany({
      where: { classId: cls.id, user: { isDeleted: false }, ...rosterStatusWhere(first) },
      select: { id: true, withdrawnAt: true, user: { select: { name: true } } },
      orderBy: { user: { name: 'asc' } },
    }),
  ])

  // 열: 생성된 회차 + 정기 시간표상 수업일(시간표 등록 이후 날짜만)
  const columns = new Map<string, MonthlyColumn>()
  for (const s of sessions) {
    const dateKey = fromDbDate(s.date)
    const startTime = formatKstTime(s.startAt.toISOString())
    const key = `${dateKey}_${startTime}`
    columns.set(key, { key, dateKey, startTime, endTime: formatKstTime(s.endAt.toISOString()), sessionId: s.id })
  }
  if (schedules.length > 0) {
    const scheduleSince = toKstDateKey(new Date(Math.min(...schedules.map((s) => s.createdAt.getTime()))))
    for (let d = first; d <= last; d = addDays(d, 1)) {
      if (d < scheduleSince) continue
      const dow = dayOfWeekOf(d)
      for (const sc of schedules) {
        if (sc.dayOfWeek !== dow) continue
        const key = `${d}_${sc.startTime}`
        if (!columns.has(key)) {
          columns.set(key, { key, dateKey: d, startTime: sc.startTime, endTime: sc.endTime, sessionId: null })
        }
      }
    }
  }
  const sortedColumns = Array.from(columns.values()).sort((a, b) => a.key.localeCompare(b.key))

  const sessionIds = sessions.map((s) => s.id)
  const sessionRecords = await prisma.attendanceRecord.findMany({
    where: { sessionId: { in: sessionIds } },
    select: {
      studentId: true,
      sessionId: true,
      status: true,
      reason: true,
      student: { select: { withdrawnAt: true, user: { select: { name: true } } } },
    },
  })

  const students = rosterStudents.map((s) => ({
    id: s.id,
    name: s.user.name,
    withdrawnDateKey: s.withdrawnAt ? toKstDateKey(s.withdrawnAt) : null,
  }))
  for (const r of sessionRecords) {
    if (students.some((s) => s.id === r.studentId)) continue
    students.push({
      id: r.studentId,
      name: r.student.user.name,
      withdrawnDateKey: r.student.withdrawnAt ? toKstDateKey(r.student.withdrawnAt) : null,
    })
  }
  students.sort((a, b) => a.name.localeCompare(b.name, 'ko'))

  const academyRecords = await prisma.attendanceRecord.findMany({
    where: {
      studentId: { in: students.map((s) => s.id) },
      date: { gte: dbDate(first), lte: dbDate(last) },
      sessionId: null,
      mode: 'ACADEMY',
    },
    select: { studentId: true, date: true, status: true, reason: true },
  })

  const sessionCell = new Map<string, MonthlyCell>()
  for (const r of sessionRecords) sessionCell.set(`${r.studentId}|${r.sessionId}`, { status: r.status, reason: r.reason })
  const academyCell = new Map<string, MonthlyCell>()
  for (const r of academyRecords) {
    academyCell.set(`${r.studentId}|${fromDbDate(r.date)}`, { status: r.status, reason: r.reason })
  }

  // 현재 출결 방식의 기록을 우선 표시하고, 없으면 다른 방식 기록으로 보완
  const cells: Record<string, MonthlyCell> = {}
  for (const st of students) {
    for (const col of sortedColumns) {
      const bySession = col.sessionId ? sessionCell.get(`${st.id}|${col.sessionId}`) : undefined
      const byDate = academyCell.get(`${st.id}|${col.dateKey}`)
      const cell = setting.mode === 'CLASS' ? (bySession ?? byDate) : (byDate ?? bySession)
      if (cell) cells[`${st.id}|${col.key}`] = cell
    }
  }

  return {
    ...base,
    classId: cls.id,
    className: cls.name,
    mode: setting.mode,
    columns: sortedColumns,
    students,
    cells,
  }
}
