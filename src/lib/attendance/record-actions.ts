'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma/client'
import { logActivity } from '@/lib/activity-log'
import { ACTIVITY_ACTIONS } from '@/lib/constants/activity-actions'
import { canAccessClass, canEditDate, getAttendanceScope, type AttendanceScope } from './access'
import {
  isPastLateLine,
  isValidTime,
  SELECTABLE_STATUSES,
  type AttendanceStatusValue,
} from './constants'
import { bulkSetUnchecked, writeAttendanceRecord, type AttendanceRecordView } from './records'
import { ensureSession, getClassRosters } from './sessions'
import { getOrCreateAttendanceSetting } from './settings'
import { dbDate, fromDbDate, isDateKey, todayKst } from './time'

type RecordResult = { error?: string; record?: AttendanceRecordView }

const NO_PERMISSION = '권한이 없습니다.'
const PAST_LOCKED = '지난 날짜의 출결은 학원장만 수정할 수 있습니다.'
const SAVE_FAILED = '저장하지 못했습니다. 잠시 후 다시 시도해주세요.'

function isStatus(value: unknown): value is AttendanceStatusValue {
  return typeof value === 'string' && (SELECTABLE_STATUSES as string[]).includes(value)
}

function revalidateAttendance() {
  revalidatePath('/owner/attendance', 'layout')
  revalidatePath('/teacher/attendance', 'layout')
}

// ─── 반 출결 ───────────────────────────────────────────────────────────────────

async function loadSessionForWrite(scope: AttendanceScope, sessionId: string) {
  const session = await prisma.classSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      classId: true,
      date: true,
      startAt: true,
      endedAt: true,
      cancelled: true,
      class: { select: { academyId: true, teacherId: true } },
    },
  })
  if (!session || !canAccessClass(scope, session.class)) return { error: NO_PERMISSION } as const
  const dateKey = fromDbDate(session.date)
  if (!canEditDate(scope, dateKey)) return { error: PAST_LOCKED } as const
  if (session.cancelled) return { error: '휴강한 수업입니다.' } as const
  return { session, dateKey } as const
}

/** 이 반 명단에 있거나(퇴원 규칙 무관) 이미 이 회차 기록이 있는 학생인지 */
async function isSessionStudent(studentId: string, classId: string, sessionId: string): Promise<boolean> {
  const found = await prisma.student.findFirst({
    where: { id: studentId, OR: [{ classId }, { attendanceRecords: { some: { sessionId } } }] },
    select: { id: true },
  })
  return !!found
}

/**
 * 반 출석 카드 상태 변경.
 * autoLate: 카드 탭으로 '출석'을 누른 경우 — 오늘 수업이고 시작+지각 허용시간이 지났으면 지각으로 저장.
 */
export async function setSessionAttendance(input: {
  sessionId: string
  studentId: string
  status: AttendanceStatusValue
  reason?: string | null
  autoLate?: boolean
}): Promise<RecordResult> {
  const scope = await getAttendanceScope()
  if (!scope) return { error: NO_PERMISSION }
  if (!isStatus(input.status)) return { error: '출결 상태를 선택해주세요.' }

  const loaded = await loadSessionForWrite(scope, input.sessionId)
  if ('error' in loaded) return { error: loaded.error }
  const { session, dateKey } = loaded
  if (!(await isSessionStudent(input.studentId, session.classId, session.id))) {
    return { error: '이 반 학생이 아닙니다.' }
  }

  let status = input.status
  if (status === 'PRESENT' && input.autoLate && dateKey === todayKst()) {
    const setting = await getOrCreateAttendanceSetting(session.class.academyId)
    if (isPastLateLine(session.startAt.toISOString(), setting.lateGraceMinutes, Date.now())) status = 'LATE'
  }

  try {
    const record = await writeAttendanceRecord(
      { academyId: session.class.academyId, studentId: input.studentId, sessionId: session.id, dateKey, mode: 'CLASS' },
      { status, actorId: scope.userId, reason: input.reason },
    )
    revalidateAttendance()
    return { record }
  } catch (err) {
    console.error('[attendance] setSessionAttendance', err)
    return { error: SAVE_FAILED }
  }
}

/** 명단 중 미체크 학생 */
async function uncheckedStudentIds(session: { id: string; classId: string }, dateKey: string): Promise<string[]> {
  const [rosters, records] = await Promise.all([
    getClassRosters([session.classId], dateKey),
    prisma.attendanceRecord.findMany({
      where: { sessionId: session.id },
      select: { studentId: true, status: true },
    }),
  ])
  const statusByStudent = new Map(records.map((r) => [r.studentId, r.status]))
  const ids = new Set<string>()
  for (const s of rosters.get(session.classId) ?? []) {
    if ((statusByStudent.get(s.id) ?? 'UNCHECKED') === 'UNCHECKED') ids.add(s.id)
  }
  // 명단 밖이지만 미체크 기록이 남아 있는 학생
  for (const r of records) if (r.status === 'UNCHECKED') ids.add(r.studentId)
  return Array.from(ids)
}

/** [전체 출석] — 미체크 학생만 출석 (지각 기준이 지났으면 지각) */
export async function markAllPresent(sessionId: string): Promise<{ error?: string; count?: number }> {
  const scope = await getAttendanceScope()
  if (!scope) return { error: NO_PERMISSION }
  const loaded = await loadSessionForWrite(scope, sessionId)
  if ('error' in loaded) return { error: loaded.error }
  const { session, dateKey } = loaded

  try {
    const setting = await getOrCreateAttendanceSetting(session.class.academyId)
    const late =
      dateKey === todayKst() && isPastLateLine(session.startAt.toISOString(), setting.lateGraceMinutes, Date.now())
    const ids = await bulkSetUnchecked({
      academyId: session.class.academyId,
      sessionId: session.id,
      dateKey,
      studentIds: await uncheckedStudentIds(session, dateKey),
      status: late ? 'LATE' : 'PRESENT',
      source: 'MANUAL',
      actorId: scope.userId,
    })
    revalidateAttendance()
    return { count: ids.length }
  } catch (err) {
    console.error('[attendance] markAllPresent', err)
    return { error: SAVE_FAILED }
  }
}

/** [수업 종료] — 종료 시각 기록, 자동 결석 설정이 켜져 있으면 미체크 학생 결석(AUTO) */
export async function endSession(sessionId: string): Promise<{ error?: string; absentCount?: number }> {
  const scope = await getAttendanceScope()
  if (!scope) return { error: NO_PERMISSION }
  const loaded = await loadSessionForWrite(scope, sessionId)
  if ('error' in loaded) return { error: loaded.error }
  const { session, dateKey } = loaded
  if (session.endedAt) return { error: '이미 종료된 수업입니다.' }

  try {
    // 동시에 두 번 눌러도 한 번만 종료 처리
    const ended = await prisma.classSession.updateMany({
      where: { id: session.id, endedAt: null },
      data: { endedAt: new Date() },
    })
    if (ended.count === 0) return { error: '이미 종료된 수업입니다.' }

    const setting = await getOrCreateAttendanceSetting(session.class.academyId)
    let absentCount = 0
    if (setting.autoAbsentOnEnd) {
      const ids = await bulkSetUnchecked({
        academyId: session.class.academyId,
        sessionId: session.id,
        dateKey,
        studentIds: await uncheckedStudentIds(session, dateKey),
        status: 'ABSENT',
        source: 'AUTO',
        actorId: scope.userId,
      })
      absentCount = ids.length
    }
    await logActivity({
      userId: scope.userId,
      role: scope.role,
      academyId: session.class.academyId,
      action: ACTIVITY_ACTIONS.ATTENDANCE_SESSION_END,
      metadata: { sessionId: session.id, classId: session.classId, absentCount },
    })
    revalidateAttendance()
    return { absentCount }
  } catch (err) {
    console.error('[attendance] endSession', err)
    return { error: SAVE_FAILED }
  }
}

// ─── 원 출결 (등원·하원) ───────────────────────────────────────────────────────

async function loadStudentForScope(scope: AttendanceScope, studentId: string) {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: {
      id: true,
      classId: true,
      user: { select: { academyId: true, isDeleted: true } },
      class: { select: { teacherId: true } },
    },
  })
  const academyId = student?.user.academyId
  if (!student || !academyId || student.user.isDeleted || !scope.academyIds.includes(academyId)) return null
  if (scope.role === 'TEACHER' && student.class?.teacherId !== scope.userId) return null
  return { ...student, academyId }
}

/** [등원] · [하원] — 오늘 날짜만 */
export async function academyCheck(studentId: string, kind: 'IN' | 'OUT'): Promise<RecordResult> {
  const scope = await getAttendanceScope()
  if (!scope) return { error: NO_PERMISSION }
  const student = await loadStudentForScope(scope, studentId)
  if (!student) return { error: NO_PERMISSION }

  const dateKey = todayKst()
  const existing = await prisma.attendanceRecord.findFirst({
    where: { studentId, date: dbDate(dateKey), sessionId: null, mode: 'ACADEMY' },
    select: { status: true, checkInAt: true, checkOutAt: true },
  })
  const target = { academyId: student.academyId, studentId, sessionId: null, dateKey, mode: 'ACADEMY' as const }
  const now = new Date()

  try {
    if (kind === 'IN') {
      if (existing?.checkInAt) return { error: '이미 등원 처리되었습니다.' }
      // 오늘 이 학생 반의 첫 수업 시작 + 지각 허용시간이 지났으면 지각
      let status: AttendanceStatusValue = 'PRESENT'
      if (student.classId) {
        const [firstSession, setting] = await Promise.all([
          prisma.classSession.findFirst({
            where: { classId: student.classId, date: dbDate(dateKey), cancelled: false },
            orderBy: { startAt: 'asc' },
            select: { startAt: true },
          }),
          getOrCreateAttendanceSetting(student.academyId),
        ])
        if (firstSession && isPastLateLine(firstSession.startAt.toISOString(), setting.lateGraceMinutes, now.getTime())) {
          status = 'LATE'
        }
      }
      const record = await writeAttendanceRecord(target, { status, actorId: scope.userId, checkInAt: now })
      revalidateAttendance()
      return { record }
    }

    if (!existing?.checkInAt) return { error: '등원 기록이 없습니다.' }
    if (existing.checkOutAt) return { error: '이미 하원 처리되었습니다.' }
    const record = await writeAttendanceRecord(target, {
      status: existing.status,
      actorId: scope.userId,
      checkOutAt: now,
    })
    revalidateAttendance()
    return { record }
  } catch (err) {
    console.error('[attendance] academyCheck', err)
    return { error: SAVE_FAILED }
  }
}

/** 원 출결 상태 직접 변경 (결석·인정결석·조퇴 등, 실수 취소는 미체크) */
export async function setAcademyAttendance(input: {
  studentId: string
  dateKey: string
  status: AttendanceStatusValue
  reason?: string | null
}): Promise<RecordResult> {
  const scope = await getAttendanceScope()
  if (!scope) return { error: NO_PERMISSION }
  if (!isStatus(input.status)) return { error: '출결 상태를 선택해주세요.' }
  if (!isDateKey(input.dateKey)) return { error: '날짜가 올바르지 않습니다.' }
  if (!canEditDate(scope, input.dateKey)) return { error: PAST_LOCKED }
  const student = await loadStudentForScope(scope, input.studentId)
  if (!student) return { error: NO_PERMISSION }

  try {
    const record = await writeAttendanceRecord(
      { academyId: student.academyId, studentId: student.id, sessionId: null, dateKey: input.dateKey, mode: 'ACADEMY' },
      { status: input.status, actorId: scope.userId, reason: input.reason },
    )
    revalidateAttendance()
    return { record }
  } catch (err) {
    console.error('[attendance] setAcademyAttendance', err)
    return { error: SAVE_FAILED }
  }
}

// ─── 월간 출석부 ───────────────────────────────────────────────────────────────

/** 출석부 셀 변경 — 현재 출결 방식에 맞는 기록(반: 회차 기록 / 원: 날짜 기록)을 수정 */
export async function setMonthlyCell(input: {
  classId: string
  studentId: string
  dateKey: string
  startTime: string
  endTime: string
  sessionId: string | null
  status: AttendanceStatusValue
}): Promise<{ error?: string }> {
  const scope = await getAttendanceScope()
  if (!scope) return { error: NO_PERMISSION }
  if (!isStatus(input.status)) return { error: '출결 상태를 선택해주세요.' }
  if (!isDateKey(input.dateKey) || !isValidTime(input.startTime) || !isValidTime(input.endTime)) {
    return { error: '수업일이 올바르지 않습니다.' }
  }
  if (!canEditDate(scope, input.dateKey)) return { error: PAST_LOCKED }

  const cls = await prisma.class.findUnique({
    where: { id: input.classId },
    select: { id: true, academyId: true, teacherId: true },
  })
  if (!cls || !canAccessClass(scope, cls)) return { error: NO_PERMISSION }

  try {
    let sessionId = input.sessionId
    if (sessionId) {
      const s = await prisma.classSession.findFirst({ where: { id: sessionId, classId: cls.id }, select: { id: true } })
      if (!s) return { error: '수업을 찾을 수 없습니다.' }
    }

    const member = await prisma.student.findFirst({
      where: {
        id: input.studentId,
        OR: [{ classId: cls.id }, { attendanceRecords: { some: { session: { classId: cls.id } } } }],
      },
      select: { id: true },
    })
    if (!member) return { error: '이 반 학생이 아닙니다.' }

    const setting = await getOrCreateAttendanceSetting(cls.academyId)
    if (setting.mode === 'CLASS') {
      if (!sessionId) sessionId = (await ensureSession(cls.id, input.dateKey, input.startTime, input.endTime)).id
      await writeAttendanceRecord(
        { academyId: cls.academyId, studentId: member.id, sessionId, dateKey: input.dateKey, mode: 'CLASS' },
        { status: input.status, actorId: scope.userId },
      )
    } else {
      await writeAttendanceRecord(
        { academyId: cls.academyId, studentId: member.id, sessionId: null, dateKey: input.dateKey, mode: 'ACADEMY' },
        { status: input.status, actorId: scope.userId },
      )
    }
    revalidateAttendance()
    return {}
  } catch (err) {
    console.error('[attendance] setMonthlyCell', err)
    return { error: SAVE_FAILED }
  }
}
