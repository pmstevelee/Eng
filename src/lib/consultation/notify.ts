import 'server-only'

import { prisma } from '@/lib/prisma/client'
import { sendNotification, type SendNotificationResult } from '@/lib/notifications/send'
import { formatPhone, readConsultationNotifications } from './constants'

const ACADEMY_NOTIFY_SELECT = {
  name: true,
  businessName: true,
  branchName: true,
  phone: true,
  parentAcademyId: true,
  settingsJson: true,
  parentAcademy: { select: { name: true, businessName: true, phone: true } },
} as const

type AcademyNotifyRow = {
  name: string
  businessName: string | null
  branchName: string | null
  phone: string | null
  parentAcademyId: string | null
  settingsJson?: unknown
  parentAcademy: { name: string; businessName: string | null; phone: string | null } | null
}

/** 알림에 표시할 학원명 (지점은 "학원명 지점명") */
export function academyDisplayName(a: AcademyNotifyRow): string {
  const base = a.businessName ?? a.parentAcademy?.businessName ?? a.parentAcademy?.name ?? a.name
  return a.parentAcademyId && a.branchName ? `${base} ${a.branchName}` : base
}

function academyPhone(a: AcademyNotifyRow): string {
  const phone = a.phone ?? a.parentAcademy?.phone
  return phone ? formatPhone(phone) : '학원 대표번호'
}

const KST_NOTIFY_DATETIME = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul',
  month: 'long',
  day: 'numeric',
  weekday: 'short',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
})

/** 9월 26일 (토) 오후 4:00 */
export function formatNotifyDateTime(date: Date): string {
  const parts = Object.fromEntries(KST_NOTIFY_DATETIME.formatToParts(date).map((p) => [p.type, p.value]))
  return `${parts.month} ${parts.day}일 (${parts.weekday}) ${parts.dayPeriod} ${parts.hour}:${parts.minute}`
}

type AppointmentKind = 'confirmed' | 'reminder'

const NO_PARENT_PHONE = '학부모 연락처가 등록되어 있지 않습니다. 학생 정보에서 학부모 연락처를 입력해주세요.'

/** 재원생 알림 대상 (학부모 번호·학원) — 퇴원 학생·삭제 계정은 null */
async function findStudentNotifyTarget(studentId: string) {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: {
      id: true,
      status: true,
      parentPhone: true,
      user: { select: { name: true, academyId: true, isDeleted: true, academy: { select: ACADEMY_NOTIFY_SELECT } } },
    },
  })
  if (!student || student.status === 'WITHDRAWN' || student.user.isDeleted) return null
  if (!student.user.academyId || !student.user.academy) return null
  return {
    studentId: student.id,
    academyId: student.user.academyId,
    academy: student.user.academy,
    studentName: student.user.name,
    phone: student.parentPhone,
  }
}

/**
 * 상담 예약 확정/전날 리마인드 알림 — 예약·문의(또는 재원생) 상태를 다시 확인하고 발송.
 * 재원생에게 학부모 연락처가 없으면 FAILED로 안내만 돌려준다 (기록 없음).
 */
export async function notifyAppointment(appointmentId: string, kind: AppointmentKind): Promise<SendNotificationResult | null> {
  const appointment = await prisma.consultationAppointment.findUnique({
    where: { id: appointmentId },
    select: {
      id: true,
      status: true,
      scheduledAt: true,
      studentId: true,
      lead: {
        select: {
          id: true,
          academyId: true,
          studentName: true,
          phone: true,
          status: true,
          academy: { select: ACADEMY_NOTIFY_SELECT },
        },
      },
    },
  })
  // 취소·완료된 예약에는 보내지 않음
  if (!appointment || appointment.status !== 'SCHEDULED') return null

  let target: {
    leadId?: string
    studentId?: string
    academyId: string
    academy: AcademyNotifyRow
    studentName: string
    phone: string | null
  }
  if (appointment.lead) {
    // 등록·이탈 처리된 문의에는 보내지 않음
    if (appointment.lead.status === 'ENROLLED' || appointment.lead.status === 'LOST') return null
    target = { ...appointment.lead, leadId: appointment.lead.id }
  } else if (appointment.studentId) {
    const student = await findStudentNotifyTarget(appointment.studentId)
    if (!student) return null
    target = student
  } else {
    return null
  }
  // 전날 리마인드는 학원 설정에서 끌 수 있음 (예약 확정 알림은 예약 화면에서 건별 선택)
  if (kind === 'reminder' && !readConsultationNotifications(target.academy.settingsJson).appointmentReminder) {
    return { status: 'SKIPPED' }
  }
  if (!target.phone) return { status: 'FAILED', error: NO_PARENT_PHONE }

  const common = {
    academyId: target.academyId,
    leadId: target.leadId,
    studentId: target.studentId,
    appointmentId: appointment.id,
    phone: target.phone,
  }
  const base = {
    학원명: academyDisplayName(target.academy),
    학생명: target.studentName,
    일시: formatNotifyDateTime(appointment.scheduledAt),
  }

  return kind === 'confirmed'
    ? sendNotification({
        ...common,
        templateKey: 'APPOINTMENT_CONFIRMED',
        variables: { ...base, 학원연락처: academyPhone(target.academy) },
        dedupeKey: `confirmed:${appointment.id}`,
      })
    : sendNotification({
        ...common,
        templateKey: 'APPOINTMENT_REMINDER',
        variables: base,
        dedupeKey: `reminder:${appointment.id}`,
      })
}

/**
 * 학부모 학습 리포트 알림 — 같은 링크(토큰)로는 한 번만 발송 (DUPLICATE).
 * 다시 보내려면 링크를 재발급한다.
 */
export async function notifyStudentReport(
  consultationId: string,
  studentId: string,
  token: string,
  link: string,
): Promise<SendNotificationResult | null> {
  const target = await findStudentNotifyTarget(studentId)
  if (!target) return null
  if (!target.phone) return { status: 'FAILED', error: NO_PARENT_PHONE }

  return sendNotification({
    academyId: target.academyId,
    studentId: target.studentId,
    consultationId,
    phone: target.phone,
    templateKey: 'STUDENT_REPORT',
    variables: { 학원명: academyDisplayName(target.academy), 학생명: target.studentName, 리포트링크: link },
    dedupeKey: `report:${consultationId}:${token}`,
  })
}
