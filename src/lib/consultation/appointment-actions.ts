'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma/client'
import { findScopedLead, getConsultationActor, isValidAssignee, leadScopeWhere, type ConsultationActor } from './access'
import { APPOINTMENT_DURATION_OPTIONS, formatKstDateTime } from './constants'

type ActionResult<T = object> = ({ error: string } & Partial<T>) | ({ error?: undefined } & T)

const NO_PERMISSION = '권한이 없습니다.'
const NOT_FOUND = '문의를 찾을 수 없거나 접근 권한이 없습니다.'
const APPOINTMENT_NOT_FOUND = '예약을 찾을 수 없거나 접근 권한이 없습니다.'

function revalidateConsultation() {
  revalidatePath('/owner/consultations', 'layout')
  revalidatePath('/teacher/consultations', 'layout')
}

export type AppointmentInput = {
  scheduledAt: string // ISO
  durationMinutes: number
  /** 학원장만 지정 가능 — 교사는 항상 본인 */
  counselorId?: string
  /** 같은 담당자 일정 겹침 경고를 확인하고 저장 */
  confirmOverlap?: boolean
}

export type AppointmentConflict = { id: string; studentName: string; scheduledAt: string; durationMinutes: number }

type SaveResult = ActionResult<{ conflicts?: AppointmentConflict[] }>

type ParsedAppointment = { scheduledAt: Date; durationMinutes: number; counselorId: string }

async function parseAppointmentInput(
  actor: ConsultationActor,
  leadAcademyId: string,
  input: AppointmentInput,
): Promise<{ error: string } | { data: ParsedAppointment }> {
  const scheduledAt = new Date(input.scheduledAt)
  if (Number.isNaN(scheduledAt.getTime())) return { error: '상담 일시를 입력해주세요.' }
  if (!APPOINTMENT_DURATION_OPTIONS.includes(input.durationMinutes)) return { error: '상담 시간을 선택해주세요.' }

  let counselorId = actor.userId
  if (actor.role === 'ACADEMY_OWNER' && input.counselorId && input.counselorId !== actor.userId) {
    if (!(await isValidAssignee(actor, leadAcademyId, input.counselorId))) return { error: '상담 담당자를 찾을 수 없습니다.' }
    counselorId = input.counselorId
  }
  return { data: { scheduledAt, durationMinutes: input.durationMinutes, counselorId } }
}

/** 같은 담당자의 예정 일정 중 시간이 겹치는 예약 */
async function findConflicts(data: ParsedAppointment, excludeId?: string): Promise<AppointmentConflict[]> {
  const start = data.scheduledAt.getTime()
  const end = start + data.durationMinutes * 60_000
  // 최대 상담 시간만큼 앞에서 시작한 예약까지 후보로 조회 후 메모리에서 겹침 판정
  const maxDuration = Math.max(...APPOINTMENT_DURATION_OPTIONS)
  const rows = await prisma.consultationAppointment.findMany({
    where: {
      counselorId: data.counselorId,
      status: 'SCHEDULED',
      scheduledAt: { gt: new Date(start - maxDuration * 60_000), lt: new Date(end) },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true, scheduledAt: true, durationMinutes: true, lead: { select: { studentName: true } } },
    orderBy: { scheduledAt: 'asc' },
  })
  return rows
    .filter((r) => r.scheduledAt.getTime() + r.durationMinutes * 60_000 > start)
    .map((r) => ({
      id: r.id,
      studentName: r.lead.studentName,
      scheduledAt: r.scheduledAt.toISOString(),
      durationMinutes: r.durationMinutes,
    }))
}

/** 권한 범위 안의 예약 1건 */
async function findScopedAppointment(actor: ConsultationActor, appointmentId: string) {
  return prisma.consultationAppointment.findFirst({
    where: { id: appointmentId, lead: leadScopeWhere(actor) },
    select: {
      id: true,
      status: true,
      scheduledAt: true,
      durationMinutes: true,
      counselorId: true,
      lead: { select: { id: true, academyId: true, status: true, studentId: true } },
    },
  })
}

// ─── 예약 생성 ─────────────────────────────────────────────────────────────────

/** 상담 예약 — 문의(NEW) 상태면 상담예약(SCHEDULED)으로 자동 변경 */
export async function createAppointment(leadId: string, input: AppointmentInput): Promise<SaveResult> {
  const actor = await getConsultationActor()
  if (!actor) return { error: NO_PERMISSION }

  const lead = await findScopedLead(actor, leadId)
  if (!lead) return { error: NOT_FOUND }
  if (lead.status === 'ENROLLED' || lead.studentId) return { error: '이미 등록 전환된 문의입니다.' }

  const parsed = await parseAppointmentInput(actor, lead.academyId, input)
  if ('error' in parsed) return { error: parsed.error }

  if (!input.confirmOverlap) {
    const conflicts = await findConflicts(parsed.data)
    if (conflicts.length > 0) return { conflicts }
  }

  const advance = lead.status === 'NEW'
  await prisma.$transaction([
    prisma.consultationAppointment.create({ data: { ...parsed.data, leadId: lead.id } }),
    ...(advance
      ? [
          prisma.lead.update({ where: { id: lead.id }, data: { status: 'SCHEDULED' } }),
          prisma.leadStatusHistory.create({
            data: { leadId: lead.id, fromStatus: 'NEW', toStatus: 'SCHEDULED', changedById: actor.userId },
          }),
        ]
      : [prisma.lead.update({ where: { id: lead.id }, data: { updatedAt: new Date() } })]),
  ])

  revalidateConsultation()
  return {}
}

// ─── 일정 변경 / 취소 / 노쇼 ───────────────────────────────────────────────────

/** 일정 변경: 기존 예약은 취소 처리하고 새 예약에 이전 예약을 연결 */
export async function rescheduleAppointment(appointmentId: string, input: AppointmentInput): Promise<SaveResult> {
  const actor = await getConsultationActor()
  if (!actor) return { error: NO_PERMISSION }

  const current = await findScopedAppointment(actor, appointmentId)
  if (!current) return { error: APPOINTMENT_NOT_FOUND }
  if (current.status !== 'SCHEDULED') return { error: '예정된 예약만 일정을 변경할 수 있습니다.' }

  // 학원장이 지정하지 않으면 기존 담당자 유지
  const parsed = await parseAppointmentInput(actor, current.lead.academyId, {
    ...input,
    counselorId: input.counselorId ?? current.counselorId ?? undefined,
  })
  if ('error' in parsed) return { error: parsed.error }

  if (!input.confirmOverlap) {
    const conflicts = await findConflicts(parsed.data, current.id)
    if (conflicts.length > 0) return { conflicts }
  }

  await prisma.$transaction([
    prisma.consultationAppointment.update({ where: { id: current.id, status: 'SCHEDULED' }, data: { status: 'CANCELED' } }),
    prisma.consultationAppointment.create({
      data: { ...parsed.data, leadId: current.lead.id, rescheduledFromId: current.id },
    }),
  ])

  revalidateConsultation()
  return {}
}

export async function cancelAppointment(appointmentId: string): Promise<ActionResult> {
  const actor = await getConsultationActor()
  if (!actor) return { error: NO_PERMISSION }

  const current = await findScopedAppointment(actor, appointmentId)
  if (!current) return { error: APPOINTMENT_NOT_FOUND }
  if (current.status !== 'SCHEDULED') return { error: '예정된 예약만 취소할 수 있습니다.' }

  await prisma.consultationAppointment.update({ where: { id: current.id, status: 'SCHEDULED' }, data: { status: 'CANCELED' } })
  revalidateConsultation()
  return {}
}

/** 노쇼 처리 — 예약 시각이 지난 뒤에만 가능 */
export async function markAppointmentNoShow(appointmentId: string): Promise<ActionResult> {
  const actor = await getConsultationActor()
  if (!actor) return { error: NO_PERMISSION }

  const current = await findScopedAppointment(actor, appointmentId)
  if (!current) return { error: APPOINTMENT_NOT_FOUND }
  if (current.status !== 'SCHEDULED') return { error: '예정된 예약만 노쇼 처리할 수 있습니다.' }
  if (current.scheduledAt.getTime() > Date.now()) {
    return { error: `예약 시각(${formatKstDateTime(current.scheduledAt)}) 이후에 노쇼 처리할 수 있습니다.` }
  }

  await prisma.consultationAppointment.update({ where: { id: current.id, status: 'SCHEDULED' }, data: { status: 'NO_SHOW' } })
  revalidateConsultation()
  return {}
}
