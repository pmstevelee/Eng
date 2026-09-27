import 'server-only'

import { Prisma } from '@/generated/prisma'
import { prisma } from '@/lib/prisma/client'
import { academyDisplayName } from '@/lib/consultation/notify'
import type { NotificationJobTypeValue } from '@/lib/credits/constants'
import { getCreditPricing, getWallet, walletAcademyIdOf } from '@/lib/credits/wallet'
import { dbDate, fromDbDate } from './time'

// 출결 알림 발송 대기열 — 여기서는 NotificationJob(PENDING)만 만들고 실제 발송은
// /api/cron/notifications(1분 주기)가 처리한다. 출결 저장 흐름은 SOLAPI를 기다리지 않는다.

export type AttendanceNotificationType = 'CHECK_IN' | 'CHECK_OUT' | 'ABSENT'

/** 같은 학생·같은 알림 종류가 이 시간 안에 이미 있으면 중복으로 건너뜀 */
const DUPLICATE_WINDOW_MS = 10 * 60_000

const CLOCK_FMT = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
})

/** 알림 문구용 시각 — "오후 4:05" */
export function formatNotifyClock(value: Date): string {
  return CLOCK_FMT.format(value)
}

/** 미등원 안내 중복 방지 키 — 반 출결은 수업 회차당, 원 출결은 하루 1회 */
export function absentDedupeKey(studentId: string, sessionId: string | null, dateKey: string): string {
  return sessionId ? `absent:${sessionId}:${studentId}` : `absent:${dateKey}:${studentId}`
}

export type CreateJobInput = {
  academyId: string
  studentId: string
  recordId: string | null
  sessionId: string | null
  type: NotificationJobTypeValue
  phone: string
  variables: Record<string, string>
  dedupeKey?: string
  /** 호출부가 이미 알면 넘겨서 조회 1회 절약 (지점 → 본원 지갑) */
  walletAcademyId?: string
}

export type CreateJobResult = 'PENDING' | 'SKIPPED_NO_CREDIT' | 'SKIPPED_DUPLICATE'

function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002'
}

/**
 * 발송 작업 등록 — 중복·잔액을 확인해 PENDING / SKIPPED_* 로 기록한다.
 * 건너뛴 건도 (키가 비어 있으면) dedupeKey를 남겨 미등원 안내가 매분 다시 등록되지 않게 한다.
 */
export async function createNotificationJob(input: CreateJobInput): Promise<CreateJobResult> {
  const walletAcademyId = input.walletAcademyId ?? (await walletAcademyIdOf(input.academyId))
  const [recent, keyTaken, pricing, wallet] = await Promise.all([
    prisma.notificationJob.findFirst({
      where: {
        studentId: input.studentId,
        type: input.type,
        status: { in: ['PENDING', 'SENT'] },
        createdAt: { gte: new Date(Date.now() - DUPLICATE_WINDOW_MS) },
      },
      select: { id: true },
    }),
    input.dedupeKey
      ? prisma.notificationJob.findUnique({ where: { dedupeKey: input.dedupeKey }, select: { id: true } })
      : null,
    getCreditPricing(),
    getWallet(walletAcademyId),
  ])

  const base = {
    academyId: input.academyId,
    studentId: input.studentId,
    recordId: input.recordId,
    sessionId: input.sessionId,
    type: input.type,
    phone: input.phone,
    variables: input.variables,
  }

  const skipDuplicate = async (dedupeKey: string | null): Promise<CreateJobResult> => {
    try {
      await prisma.notificationJob.create({ data: { ...base, status: 'SKIPPED_DUPLICATE', dedupeKey } })
    } catch (err) {
      if (!dedupeKey || !isUniqueViolation(err)) throw err
      await prisma.notificationJob.create({ data: { ...base, status: 'SKIPPED_DUPLICATE' } })
    }
    return 'SKIPPED_DUPLICATE'
  }
  // 키가 아직 없으면 건너뛴 기록에 키를 남겨 같은 수업으로 다시 등록되지 않게 한다
  if (keyTaken) return skipDuplicate(null)
  if (recent) return skipDuplicate(input.dedupeKey ?? null)

  const status = wallet.balance >= pricing.ALIMTALK ? 'PENDING' : 'SKIPPED_NO_CREDIT'
  try {
    await prisma.notificationJob.create({
      data: {
        ...base,
        status,
        dedupeKey: input.dedupeKey ?? null,
        errorMessage: status === 'SKIPPED_NO_CREDIT' ? `크레딧 부족 (잔액 ${wallet.balance})` : null,
      },
    })
    return status
  } catch (err) {
    // 동시에 같은 키로 등록된 경우
    if (input.dedupeKey && isUniqueViolation(err)) return skipDuplicate(null)
    throw err
  }
}

/**
 * 출결 기록 변화에 따른 학부모 알림 등록.
 * 알림 설정이 꺼져 있거나 학부모 연락처가 없으면 아무것도 하지 않는다.
 * 알림 등록 실패가 출결 저장을 막지 않도록 예외를 삼킨다.
 */
export async function enqueueAttendanceNotification(
  recordId: string,
  type: AttendanceNotificationType,
): Promise<void> {
  try {
    await enqueue(recordId, type)
  } catch (err) {
    console.error('[attendance-notify] 알림 등록 실패:', recordId, type, err)
  }
}

async function enqueue(recordId: string, type: AttendanceNotificationType): Promise<void> {
  const record = await prisma.attendanceRecord.findUnique({
    where: { id: recordId },
    select: {
      academyId: true,
      studentId: true,
      sessionId: true,
      date: true,
      status: true,
      checkInAt: true,
      checkOutAt: true,
      session: { select: { startAt: true } },
      student: {
        select: {
          parentPhone: true,
          classId: true,
          status: true,
          user: { select: { name: true } },
        },
      },
      academy: {
        select: {
          name: true,
          businessName: true,
          branchName: true,
          phone: true,
          parentAcademyId: true,
          parentAcademy: { select: { name: true, businessName: true, phone: true } },
          attendanceSetting: { select: { notifyCheckIn: true, notifyCheckOut: true, notifyAbsent: true } },
        },
      },
    },
  })
  if (!record) return

  const phone = (record.student.parentPhone ?? '').replace(/\D/g, '')
  if (!phone) return

  // 설정 행이 없으면 스키마 기본값 (등원·하원 켜짐, 미등원 꺼짐)
  const setting = record.academy.attendanceSetting ?? { notifyCheckIn: true, notifyCheckOut: true, notifyAbsent: false }
  const enabled =
    type === 'CHECK_IN' ? setting.notifyCheckIn : type === 'CHECK_OUT' ? setting.notifyCheckOut : setting.notifyAbsent
  if (!enabled) return

  const dateKey = fromDbDate(record.date)
  const vars: Record<string, string> = {
    학원명: academyDisplayName(record.academy),
    학생명: record.student.user.name,
  }

  // 수업 시작 시각: 반 출결은 해당 회차, 원 출결은 학생 반의 그날 첫 수업
  const classStart = async (): Promise<Date | null> => {
    if (record.session) return record.session.startAt
    if (!record.student.classId) return null
    const first = await prisma.classSession.findFirst({
      where: { classId: record.student.classId, date: dbDate(dateKey), cancelled: false },
      orderBy: { startAt: 'asc' },
      select: { startAt: true },
    })
    return first?.startAt ?? null
  }

  const base = {
    academyId: record.academyId,
    walletAcademyId: record.academy.parentAcademyId ?? record.academyId,
    studentId: record.studentId,
    recordId,
    sessionId: record.sessionId,
    phone,
  }

  if (type === 'CHECK_IN') {
    vars['시각'] = formatNotifyClock(record.checkInAt ?? new Date())
    if (record.status === 'LATE') {
      const start = await classStart()
      if (start) vars['수업시작'] = formatNotifyClock(start)
    }
    await createNotificationJob({ ...base, type: 'CHECK_IN', variables: vars })
    return
  }

  if (type === 'CHECK_OUT') {
    vars['시각'] = formatNotifyClock(record.checkOutAt ?? new Date())
    // 학습 요약(#{학습요약})은 아직 채우지 않는다 → 요약 줄 없는 하원 템플릿으로 발송
    await createNotificationJob({ ...base, type: 'CHECK_OUT', variables: vars })
    return
  }

  // 결석 처리 → 미등원 안내 (크론의 미등원 안내와 같은 키로 수업당 1회, 재원생만)
  if (record.student.status !== 'ACTIVE') return
  const start = await classStart()
  if (!start) return
  vars['수업시작'] = formatNotifyClock(start)
  await createNotificationJob({
    ...base,
    type: 'ABSENT_ALERT',
    variables: vars,
    dedupeKey: absentDedupeKey(record.studentId, record.sessionId, dateKey),
  })
}
