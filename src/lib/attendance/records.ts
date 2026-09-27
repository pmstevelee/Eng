import 'server-only'
import { randomUUID } from 'crypto'
import { prisma } from '@/lib/prisma/client'
import {
  isArrivedStatus,
  SPECIAL_STATUSES,
  type AttendanceModeValue,
  type AttendanceSourceValue,
  type AttendanceStatusValue,
} from './constants'
import { enqueueAttendanceNotification } from './notify'
import { dbDate } from './time'

/** 클라이언트로 돌려주는 기록 스냅샷 */
export type AttendanceRecordView = {
  id: string
  studentId: string
  status: AttendanceStatusValue
  checkInAt: string | null
  checkOutAt: string | null
  source: AttendanceSourceValue
  reason: string | null
}

export const RECORD_VIEW_SELECT = {
  id: true,
  studentId: true,
  status: true,
  checkInAt: true,
  checkOutAt: true,
  source: true,
  reason: true,
} as const

type RecordRow = {
  id: string
  studentId: string
  status: AttendanceStatusValue
  checkInAt: Date | null
  checkOutAt: Date | null
  source: AttendanceSourceValue
  reason: string | null
}

export function toRecordView(r: RecordRow): AttendanceRecordView {
  return {
    id: r.id,
    studentId: r.studentId,
    status: r.status,
    checkInAt: r.checkInAt?.toISOString() ?? null,
    checkOutAt: r.checkOutAt?.toISOString() ?? null,
    source: r.source,
    reason: r.reason,
  }
}

/** 기록 대상 — 반 출결은 sessionId, 원 출결은 sessionId null (학생·날짜당 1건) */
export type RecordTarget = {
  academyId: string
  studentId: string
  sessionId: string | null
  dateKey: string
  mode: AttendanceModeValue
}

type WriteOptions = {
  status: AttendanceStatusValue
  /** 변경자 — 키패드 기기처럼 로그인 사용자가 없으면 null */
  actorId: string | null
  source?: AttendanceSourceValue
  /** undefined면 기존 사유 유지 (특수 상태가 아니면 항상 비움) */
  reason?: string | null
  /** 등원 시각 지정 (원 출결 [등원]) */
  checkInAt?: Date
  /** 하원 시각 지정 (원 출결 [하원]) */
  checkOutAt?: Date
}

function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: unknown }).code === 'P2002'
}

async function findExisting(target: RecordTarget): Promise<RecordRow | null> {
  if (target.sessionId) {
    return prisma.attendanceRecord.findUnique({
      where: { studentId_sessionId: { studentId: target.studentId, sessionId: target.sessionId } },
      select: RECORD_VIEW_SELECT,
    })
  }
  // 원 출결: (studentId, date) 부분 unique 인덱스로 1건 보장
  return prisma.attendanceRecord.findFirst({
    where: { studentId: target.studentId, date: dbDate(target.dateKey), sessionId: null, mode: 'ACADEMY' },
    select: RECORD_VIEW_SELECT,
  })
}

/**
 * 출결 기록 생성·수정 + 상태가 바뀌면 AttendanceChangeLog 기록.
 * 원격 DB에서 대화형 트랜잭션은 타임아웃이 잦아 배열 트랜잭션으로 묶는다.
 */
export async function writeAttendanceRecord(target: RecordTarget, opts: WriteOptions): Promise<AttendanceRecordView> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const existing = await findExisting(target)
    try {
      const view = await applyWrite(target, existing, opts)
      await notifyIfNeeded(existing, view, opts)
      return view
    } catch (err) {
      // 동시 생성 경합 → 다시 읽어서 수정으로 처리
      if (attempt === 0 && !existing && isUniqueViolation(err)) continue
      throw err
    }
  }
  throw new Error('출결 기록 저장에 실패했습니다.')
}

async function applyWrite(
  target: RecordTarget,
  existing: RecordRow | null,
  opts: WriteOptions,
): Promise<AttendanceRecordView> {
  const now = new Date()
  const { status } = opts
  const fromStatus: AttendanceStatusValue = existing?.status ?? 'UNCHECKED'

  let checkInAt: Date | null = existing?.checkInAt ?? null
  let checkOutAt: Date | null = existing?.checkOutAt ?? null
  if (status === 'UNCHECKED' || status === 'ABSENT' || status === 'EXCUSED') {
    checkInAt = null
    checkOutAt = null
  } else {
    if (opts.checkInAt) checkInAt = opts.checkInAt
    else if (!checkInAt && isArrivedStatus(status)) checkInAt = now
    if (opts.checkOutAt) checkOutAt = opts.checkOutAt
    else if (status === 'EARLY_LEAVE' && !checkOutAt) checkOutAt = now
  }

  const reason = SPECIAL_STATUSES.includes(status)
    ? opts.reason !== undefined
      ? opts.reason?.trim().slice(0, 200) || null
      : (existing?.reason ?? null)
    : null

  const data = {
    status,
    checkInAt,
    checkOutAt,
    reason,
    source: opts.source ?? 'MANUAL',
    updatedById: opts.actorId,
  }

  const recordId = existing?.id ?? randomUUID()
  const writeRecord = existing
    ? prisma.attendanceRecord.update({ where: { id: recordId }, data, select: RECORD_VIEW_SELECT })
    : prisma.attendanceRecord.create({
        data: {
          id: recordId,
          academyId: target.academyId,
          studentId: target.studentId,
          sessionId: target.sessionId,
          date: dbDate(target.dateKey),
          mode: target.mode,
          ...data,
        },
        select: RECORD_VIEW_SELECT,
      })

  if (fromStatus === status) {
    return toRecordView(await writeRecord)
  }
  const [record] = await prisma.$transaction([
    writeRecord,
    prisma.attendanceChangeLog.create({
      data: { recordId, fromStatus, toStatus: status, changedById: opts.actorId },
    }),
  ])
  return toRecordView(record)
}

async function notifyIfNeeded(existing: RecordRow | null, view: AttendanceRecordView, opts: WriteOptions) {
  const wasArrived = existing ? isArrivedStatus(existing.status) : false
  if (view.status === 'ABSENT' && existing?.status !== 'ABSENT') {
    await enqueueAttendanceNotification(view.id, 'ABSENT')
  } else if (isArrivedStatus(view.status) && !wasArrived) {
    await enqueueAttendanceNotification(view.id, 'CHECK_IN')
  }
  if (opts.checkOutAt && !existing?.checkOutAt) {
    await enqueueAttendanceNotification(view.id, 'CHECK_OUT')
  }
}

/**
 * 여러 학생을 한 번에 같은 상태로 (전체 출석 · 수업 종료 자동 결석).
 * 미체크 학생만 대상 — 기존 기록은 status가 여전히 UNCHECKED일 때만 갱신한다.
 */
export async function bulkSetUnchecked(params: {
  academyId: string
  sessionId: string
  dateKey: string
  studentIds: string[]
  status: AttendanceStatusValue
  source: AttendanceSourceValue
  actorId: string
}): Promise<string[]> {
  const { academyId, sessionId, dateKey, studentIds, status, source, actorId } = params
  if (studentIds.length === 0) return []

  const existing = await prisma.attendanceRecord.findMany({
    where: { sessionId, studentId: { in: studentIds } },
    select: { id: true, studentId: true, status: true },
  })
  const existingByStudent = new Map(existing.map((r) => [r.studentId, r]))
  const toUpdate = existing.filter((r) => r.status === 'UNCHECKED').map((r) => r.id)
  const toCreate = studentIds
    .filter((id) => !existingByStudent.has(id))
    .map((studentId) => ({ id: randomUUID(), studentId }))

  const now = new Date()
  const checkInAt = isArrivedStatus(status) ? now : null
  const recordIds = [...toUpdate, ...toCreate.map((r) => r.id)]
  if (recordIds.length === 0) return []

  await prisma.$transaction([
    prisma.attendanceRecord.updateMany({
      where: { id: { in: toUpdate }, status: 'UNCHECKED' },
      data: { status, source, checkInAt, updatedById: actorId },
    }),
    prisma.attendanceRecord.createMany({
      data: toCreate.map((r) => ({
        id: r.id,
        academyId,
        studentId: r.studentId,
        sessionId,
        date: dbDate(dateKey),
        mode: 'CLASS' as const,
        status,
        source,
        checkInAt,
        updatedById: actorId,
      })),
    }),
    prisma.attendanceChangeLog.createMany({
      data: recordIds.map((recordId) => ({
        recordId,
        fromStatus: 'UNCHECKED' as const,
        toStatus: status,
        changedById: actorId,
      })),
    }),
  ])

  const type = status === 'ABSENT' ? 'ABSENT' : 'CHECK_IN'
  for (const id of recordIds) await enqueueAttendanceNotification(id, type)
  return recordIds
}
