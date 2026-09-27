import 'server-only'
import { prisma } from '@/lib/prisma/client'
import { isArrivedStatus, isPastLateLine, type AttendanceStatusValue } from './constants'
import type { KioskDevice } from './keypad-device'
import {
  KIOSK_CHECKOUT_MIN_GAP_MIN,
  KIOSK_EARLY_CHECK_MIN,
  type KioskCheckRequest,
  type KioskCheckResult,
  type KioskSessionChoice,
} from './kiosk-types'
import { writeAttendanceRecord } from './records'
import { ensureSessionsForDate } from './sessions'
import { getOrCreateAttendanceSetting } from './settings'
import { dbDate, todayKst } from './time'

// ─── 회차 생성 캐시 ────────────────────────────────────────────────────────────
// 키패드 입력마다 ensureSessionsForDate(2회 왕복)를 돌지 않도록 학원·날짜별로 10분간 기억.
// 서버 액션/라우트 모듈이 서로 다른 인스턴스로 로드될 수 있어 globalThis에 둔다.
const ENSURE_TTL_MS = 10 * 60 * 1000
const globalForKiosk = globalThis as unknown as { kioskEnsuredSessions?: Map<string, number> }
const ensuredSessions = (globalForKiosk.kioskEnsuredSessions ??= new Map<string, number>())

async function ensureSessionsCached(academyId: string, dateKey: string): Promise<void> {
  const key = `${academyId}:${dateKey}`
  const at = ensuredSessions.get(key)
  if (at && Date.now() - at < ENSURE_TTL_MS) return
  await ensureSessionsForDate(academyId, dateKey)
  if (ensuredSessions.size > 500) ensuredSessions.clear()
  ensuredSessions.set(key, Date.now())
}

// ─── 체크 ──────────────────────────────────────────────────────────────────────

export type KioskStudent = {
  id: string
  academyId: string | null
  name: string
  classId: string | null
  className: string | null
}

/**
 * 같은 키패드 번호의 재원생 후보.
 * 기기 인증과 병렬로 돌리려고 학원 조건 없이 조회하며, 호출 측에서 기기 학원으로 반드시 거른다.
 */
export async function findKioskStudents(input: KioskCheckRequest): Promise<KioskStudent[]> {
  const rows = await prisma.student.findMany({
    where: {
      keypadCode: input.code,
      status: 'ACTIVE',
      ...(input.studentId ? { id: input.studentId } : {}),
      user: { isDeleted: false },
    },
    select: {
      id: true,
      classId: true,
      user: { select: { name: true, academyId: true } },
      class: { select: { name: true } },
    },
    orderBy: { user: { name: 'asc' } },
  })
  return rows.map((s) => ({
    id: s.id,
    academyId: s.user.academyId,
    name: s.user.name,
    classId: s.classId,
    className: s.class?.name ?? null,
  }))
}

/**
 * 키패드 입력 처리.
 * at: 판정 기준 시각 — 실시간 입력은 서버 시각, 오프라인 재전송은 기기에서 입력한 시각.
 * replay: 재전송분이면 선택 화면을 띄울 수 없으므로 수업이 여럿이면 가장 가까운 수업으로 자동 선택한다.
 */
export async function processKioskCheck(
  device: KioskDevice,
  input: KioskCheckRequest,
  candidates: KioskStudent[],
  at: Date,
  replay: boolean,
): Promise<KioskCheckResult> {
  const students = candidates.filter((s) => s.academyId === device.academyId)
  if (students.length === 0) return { kind: 'NOT_FOUND' }
  if (students.length > 1) {
    return {
      kind: 'CHOOSE_STUDENT',
      students: students.map((s) => ({ studentId: s.id, name: s.name, className: s.className })),
    }
  }
  const student = students[0]
  const dateKey = todayKst(at.getTime())
  const date = dbDate(dateKey)

  // 설정 조회와 회차 생성·조회를 병렬로
  const [setting, [sessions, academyRecord]] = await Promise.all([
    getOrCreateAttendanceSetting(device.academyId),
    ensureSessionsCached(device.academyId, dateKey).then(() =>
      Promise.all([
        student.classId
          ? prisma.classSession.findMany({
              where: { classId: student.classId, date, cancelled: false },
              orderBy: { startAt: 'asc' },
              select: {
                id: true,
                startAt: true,
                endAt: true,
                endedAt: true,
                class: { select: { name: true } },
                records: { where: { studentId: student.id }, select: { status: true } },
              },
            })
          : Promise.resolve([]),
        prisma.attendanceRecord.findFirst({
          where: { studentId: student.id, date, sessionId: null, mode: 'ACADEMY' },
          select: { status: true, checkInAt: true, checkOutAt: true },
        }),
      ]),
    ),
  ])

  const atMs = at.getTime()

  // ── 원 출결: 첫 입력 = 등원, 5분 이후 두 번째 입력 = 하원 ──
  if (setting.mode === 'ACADEMY') {
    const target = { academyId: device.academyId, studentId: student.id, sessionId: null, dateKey, mode: 'ACADEMY' as const }
    if (academyRecord?.checkOutAt) return { kind: 'ALREADY', name: student.name, what: 'CHECKED_OUT' }

    if (academyRecord?.checkInAt) {
      // 등원 직후 재입력(또는 순서가 뒤바뀐 재전송)은 무시
      if (atMs - academyRecord.checkInAt.getTime() < KIOSK_CHECKOUT_MIN_GAP_MIN * 60_000) {
        return { kind: 'IGNORED', name: student.name }
      }
      await writeAttendanceRecord(target, {
        status: academyRecord.status,
        actorId: null,
        source: 'KEYPAD',
        checkOutAt: at,
      })
      return { kind: 'CHECKED_OUT', name: student.name, at: at.toISOString() }
    }

    // 오늘 반의 첫 수업 시작 + 지각 허용시간이 지났으면 지각 (수기 [등원]과 같은 기준)
    const first = sessions[0]
    const late = !!first && isPastLateLine(first.startAt.toISOString(), setting.lateGraceMinutes, atMs)
    await writeAttendanceRecord(target, {
      status: late ? 'LATE' : 'PRESENT',
      actorId: null,
      source: 'KEYPAD',
      checkInAt: at,
    })
    return { kind: 'CHECKED_IN', name: student.name, className: student.className, at: at.toISOString(), late }
  }

  // ── 반 출결: 시작 30분 전 ~ 종료 전인 오늘 수업 ──
  const inWindow = sessions.filter((s) => {
    const opensAt = s.startAt.getTime() - KIOSK_EARLY_CHECK_MIN * 60_000
    const closesAt = Math.min(s.endAt.getTime(), s.endedAt?.getTime() ?? Infinity)
    return atMs >= opensAt && atMs < closesAt
  })
  if (inWindow.length === 0) return { kind: 'NO_SESSION', name: student.name }

  const isChecked = (s: (typeof inWindow)[number]) =>
    isArrivedStatus((s.records[0]?.status ?? 'UNCHECKED') as AttendanceStatusValue)
  // 이미 출석한 수업은 후보에서 빼고, 남은 수업이 없으면 "이미 출석했어요"
  const open = inWindow.filter((s) => !isChecked(s))
  if (input.sessionId) {
    const chosen = inWindow.find((s) => s.id === input.sessionId)
    if (!chosen) return { kind: 'NO_SESSION', name: student.name }
    if (isChecked(chosen)) return { kind: 'ALREADY', name: student.name, what: 'ATTENDED' }
    return checkInSession(device, student, chosen, dateKey, at, setting.lateGraceMinutes)
  }
  if (open.length === 0) return { kind: 'ALREADY', name: student.name, what: 'ATTENDED' }

  // 가장 가까운 수업 순 (시작 시각과의 차이)
  open.sort((a, b) => Math.abs(a.startAt.getTime() - atMs) - Math.abs(b.startAt.getTime() - atMs))
  if (open.length > 1 && !replay) {
    const choices: KioskSessionChoice[] = open.map((s) => ({
      sessionId: s.id,
      className: s.class.name,
      startAt: s.startAt.toISOString(),
      endAt: s.endAt.toISOString(),
    }))
    return { kind: 'CHOOSE_SESSION', studentId: student.id, name: student.name, sessions: choices }
  }
  return checkInSession(device, student, open[0], dateKey, at, setting.lateGraceMinutes)
}

async function checkInSession(
  device: KioskDevice,
  student: KioskStudent,
  session: { id: string; startAt: Date; class: { name: string } },
  dateKey: string,
  at: Date,
  lateGraceMinutes: number,
): Promise<KioskCheckResult> {
  const late = isPastLateLine(session.startAt.toISOString(), lateGraceMinutes, at.getTime())
  await writeAttendanceRecord(
    { academyId: device.academyId, studentId: student.id, sessionId: session.id, dateKey, mode: 'CLASS' },
    { status: late ? 'LATE' : 'PRESENT', actorId: null, source: 'KEYPAD', checkInAt: at },
  )
  return { kind: 'CHECKED_IN', name: student.name, className: session.class.name, at: at.toISOString(), late }
}
