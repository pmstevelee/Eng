'use server'

import { randomUUID } from 'crypto'
import { revalidatePath, revalidateTag } from 'next/cache'
import { prisma } from '@/lib/prisma/client'
import { createStudentAccount, rollbackStudentAccount } from '@/lib/students/create-student-account'
import {
  findScopedLead,
  getConsultationActor,
  isValidAssignee,
  leadScopeWhere,
  type ConsultationActor,
} from './access'
import {
  LEAD_CHANNEL_LABEL,
  LOST_REASON_LABEL,
  CONSULTATION_TYPE_LABEL,
  MANUAL_LEAD_STATUSES,
  isValidPhone,
  normalizePhone,
  type ConsultationTypeValue,
  type LeadChannelValue,
  type LeadStatusValue,
  type LostReasonValue,
} from './constants'

type ActionResult<T = object> = ({ error: string } & Partial<T>) | ({ error?: undefined } & T)

const NO_PERMISSION = '권한이 없습니다.'
const NOT_FOUND = '문의를 찾을 수 없거나 접근 권한이 없습니다.'

function revalidateConsultation() {
  revalidatePath('/owner/consultations', 'layout')
  revalidatePath('/teacher/consultations', 'layout')
}

/** 빈 문자열 → null, 길이 제한 */
function optionalText(v: string | undefined | null, max = 200): string | null {
  const t = (v ?? '').trim()
  return t ? t.slice(0, max) : null
}

function isChannel(v: string): v is LeadChannelValue {
  return Object.prototype.hasOwnProperty.call(LEAD_CHANNEL_LABEL, v)
}
function isLostReason(v: string): v is LostReasonValue {
  return Object.prototype.hasOwnProperty.call(LOST_REASON_LABEL, v)
}
function isConsultationType(v: string): v is ConsultationTypeValue {
  return Object.prototype.hasOwnProperty.call(CONSULTATION_TYPE_LABEL, v)
}

function validatePhone(phone: string): string | null {
  const digits = normalizePhone(phone)
  return isValidPhone(digits) ? digits : null
}

// ─── 중복 문의 확인 ────────────────────────────────────────────────────────────

export type DuplicateLead = { id: string; studentName: string; status: LeadStatusValue }

/**
 * 같은 학원 내 동일 연락처 문의 확인.
 * 교사에게는 본인 담당 건만 상세 노출하고, 나머지는 건수만 알려준다.
 */
export async function checkDuplicatePhone(
  phone: string,
  academyId?: string,
  excludeLeadId?: string,
): Promise<ActionResult<{ total: number; visible: DuplicateLead[] }>> {
  const actor = await getConsultationActor()
  if (!actor) return { error: NO_PERMISSION }

  const digits = validatePhone(phone)
  if (!digits) return { total: 0, visible: [] }

  // 수정 중인 문의는 그 문의의 소속 학원 기준으로 확인하고 자기 자신은 제외
  let targetAcademyId = resolveTargetAcademy(actor, academyId)
  if (excludeLeadId) {
    const self = await findScopedLead(actor, excludeLeadId)
    if (!self) return { error: NOT_FOUND }
    targetAcademyId = self.academyId
  }
  if (!targetAcademyId) return { error: NO_PERMISSION }

  const where = {
    academyId: targetAcademyId,
    phone: digits,
    ...(excludeLeadId ? { id: { not: excludeLeadId } } : {}),
  }
  const [total, visible] = await Promise.all([
    prisma.lead.count({ where }),
    prisma.lead.findMany({
      where: { AND: [leadScopeWhere(actor), where] },
      select: { id: true, studentName: true, status: true },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
  ])
  return { total, visible }
}

/** 신규 문의 소속 학원 결정: 교사는 소속 학원 고정, 학원장은 본인 소유 학원만 허용 */
function resolveTargetAcademy(actor: ConsultationActor, academyId?: string): string | null {
  if (actor.role === 'TEACHER') return actor.academyId
  if (!academyId) return actor.academyId
  return actor.academyIds.includes(academyId) ? academyId : null
}

// ─── 문의 등록/수정/삭제 ───────────────────────────────────────────────────────

export type LeadInput = {
  studentName: string
  parentName?: string
  phone: string
  grade?: string
  school?: string
  preferredSchedule?: string
  channel: string
  source?: string
}

type ParsedLead = {
  studentName: string
  parentName: string | null
  phone: string
  grade: string | null
  school: string | null
  preferredSchedule: string | null
  channel: LeadChannelValue
  source: string | null
}

function parseLeadInput(input: LeadInput): { error: string } | { data: ParsedLead } {
  const studentName = input.studentName.trim()
  if (!studentName) return { error: '학생 이름을 입력해주세요.' }
  const phone = validatePhone(input.phone)
  if (!phone) return { error: '연락처 형식이 올바르지 않습니다. (예: 010-1234-5678)' }
  if (!isChannel(input.channel)) return { error: '문의 채널을 선택해주세요.' }

  return {
    data: {
      studentName: studentName.slice(0, 50),
      parentName: optionalText(input.parentName, 50),
      phone,
      grade: optionalText(input.grade, 20),
      school: optionalText(input.school, 100),
      preferredSchedule: optionalText(input.preferredSchedule, 200),
      channel: input.channel,
      source: optionalText(input.source, 100),
    },
  }
}

export async function createLead(
  input: LeadInput & { privacyConsent: boolean; academyId?: string; assigneeId?: string },
): Promise<ActionResult<{ leadId: string }>> {
  const actor = await getConsultationActor()
  if (!actor) return { error: NO_PERMISSION }

  const parsed = parseLeadInput(input)
  if ('error' in parsed) return { error: parsed.error }
  if (!input.privacyConsent) return { error: '개인정보 수집·이용 동의를 확인해주세요.' }

  const academyId = resolveTargetAcademy(actor, input.academyId)
  if (!academyId) return { error: NO_PERMISSION }

  // 교사가 등록한 문의는 본인 담당 (그래야 이후 조회 가능)
  let assigneeId: string | null = actor.role === 'TEACHER' ? actor.userId : null
  if (actor.role === 'ACADEMY_OWNER' && input.assigneeId) {
    if (!(await isValidAssignee(actor, academyId, input.assigneeId))) {
      return { error: '담당자를 찾을 수 없습니다.' }
    }
    assigneeId = input.assigneeId
  }

  const lead = await prisma.lead.create({
    data: {
      ...parsed.data,
      academyId,
      assigneeId,
      status: 'NEW',
      privacyConsentAt: new Date(),
      statusHistory: { create: { fromStatus: null, toStatus: 'NEW', changedById: actor.userId } },
    },
    select: { id: true },
  })

  revalidateConsultation()
  return { leadId: lead.id }
}

export async function updateLead(leadId: string, input: LeadInput): Promise<ActionResult> {
  const actor = await getConsultationActor()
  if (!actor) return { error: NO_PERMISSION }

  const lead = await findScopedLead(actor, leadId)
  if (!lead) return { error: NOT_FOUND }

  const parsed = parseLeadInput(input)
  if ('error' in parsed) return { error: parsed.error }

  await prisma.lead.update({ where: { id: lead.id }, data: parsed.data })
  revalidateConsultation()
  return {}
}

/** 삭제는 학원장만 (상담 기록·상태 이력은 Cascade 삭제, 전환된 학생 계정은 유지) */
export async function deleteLead(leadId: string): Promise<ActionResult> {
  const actor = await getConsultationActor()
  if (!actor || actor.role !== 'ACADEMY_OWNER') return { error: NO_PERMISSION }

  const lead = await findScopedLead(actor, leadId)
  if (!lead) return { error: NOT_FOUND }

  await prisma.lead.delete({ where: { id: lead.id } })
  revalidateConsultation()
  return {}
}

// ─── 상태 변경 / 담당자 배정 ───────────────────────────────────────────────────

export async function changeLeadStatus(
  leadId: string,
  input: { status: string; lostReason?: string; lostReasonNote?: string },
): Promise<ActionResult> {
  const actor = await getConsultationActor()
  if (!actor) return { error: NO_PERMISSION }

  const lead = await findScopedLead(actor, leadId)
  if (!lead) return { error: NOT_FOUND }

  if (lead.status === 'ENROLLED' || lead.studentId) {
    return { error: '이미 등록 전환된 문의는 상태를 변경할 수 없습니다.' }
  }
  if (!(MANUAL_LEAD_STATUSES as string[]).includes(input.status)) {
    return { error: '등록 상태는 [학생으로 등록]으로만 변경할 수 있습니다.' }
  }
  const status = input.status as LeadStatusValue

  let lostReason: LostReasonValue | null = null
  let lostReasonNote: string | null = null
  if (status === 'LOST') {
    if (!input.lostReason || !isLostReason(input.lostReason)) return { error: '이탈 사유를 선택해주세요.' }
    lostReason = input.lostReason
    lostReasonNote = optionalText(input.lostReasonNote, 500)
    if (lostReason === 'OTHER' && !lostReasonNote) return { error: '기타 사유를 입력해주세요.' }
  }

  if (status === lead.status && status !== 'LOST') return {}

  await prisma.$transaction([
    prisma.lead.update({ where: { id: lead.id }, data: { status, lostReason, lostReasonNote } }),
    ...(status !== lead.status
      ? [
          prisma.leadStatusHistory.create({
            data: { leadId: lead.id, fromStatus: lead.status, toStatus: status, changedById: actor.userId },
          }),
        ]
      : []),
  ])

  revalidateConsultation()
  return {}
}

/** 담당자 배정 — 학원장만 */
export async function assignLead(leadId: string, assigneeId: string | null): Promise<ActionResult> {
  const actor = await getConsultationActor()
  if (!actor || actor.role !== 'ACADEMY_OWNER') return { error: NO_PERMISSION }

  const lead = await findScopedLead(actor, leadId)
  if (!lead) return { error: NOT_FOUND }

  if (assigneeId && !(await isValidAssignee(actor, lead.academyId, assigneeId))) {
    return { error: '담당자를 찾을 수 없습니다.' }
  }

  await prisma.lead.update({ where: { id: lead.id }, data: { assigneeId: assigneeId || null } })
  revalidateConsultation()
  return {}
}

// ─── 상담 기록 ─────────────────────────────────────────────────────────────────

export type ConsultationInput = {
  consultedAt: string // ISO
  type: string
  learningHistory?: string
  prevAcademy?: string
  goal?: string
  parentNeeds?: string
  memo?: string
}

function parseConsultationInput(input: ConsultationInput) {
  const consultedAt = new Date(input.consultedAt)
  if (Number.isNaN(consultedAt.getTime())) return { error: '상담 일시를 입력해주세요.' } as const
  if (!isConsultationType(input.type)) return { error: '상담 유형을 선택해주세요.' } as const

  const data = {
    consultedAt,
    type: input.type,
    learningHistory: optionalText(input.learningHistory, 2000),
    prevAcademy: optionalText(input.prevAcademy, 2000),
    goal: optionalText(input.goal, 2000),
    parentNeeds: optionalText(input.parentNeeds, 2000),
    memo: optionalText(input.memo, 5000),
  }
  if (!data.learningHistory && !data.prevAcademy && !data.goal && !data.parentNeeds && !data.memo) {
    return { error: '상담 내용을 한 가지 이상 입력해주세요.' } as const
  }
  return { data } as const
}

/**
 * 상담 기록 추가 — 문의/상담예약 상태였다면 자동으로 상담완료 처리.
 * appointmentId가 있으면 해당 예약을 완료 처리하고 기록과 연결한다.
 */
export async function createConsultation(
  leadId: string,
  input: ConsultationInput,
  appointmentId?: string,
): Promise<ActionResult> {
  const actor = await getConsultationActor()
  if (!actor) return { error: NO_PERMISSION }

  const lead = await findScopedLead(actor, leadId)
  if (!lead) return { error: NOT_FOUND }

  const parsed = parseConsultationInput(input)
  if ('error' in parsed) return { error: parsed.error ?? '입력값을 확인해주세요.' }

  if (appointmentId) {
    const appointment = await prisma.consultationAppointment.findFirst({
      where: { id: appointmentId, leadId: lead.id },
      select: { status: true },
    })
    if (!appointment) return { error: '예약을 찾을 수 없습니다.' }
    if (appointment.status !== 'SCHEDULED') return { error: '이미 처리된 예약입니다.' }
  }

  const autoAdvance = lead.status === 'NEW' || lead.status === 'SCHEDULED'
  const consultationId = randomUUID()

  await prisma.$transaction([
    prisma.consultation.create({
      data: { ...parsed.data, id: consultationId, leadId: lead.id, counselorId: actor.userId },
    }),
    ...(appointmentId
      ? [
          prisma.consultationAppointment.update({
            // 동시에 다른 처리가 먼저 된 경우 update가 실패해 기록 생성까지 롤백된다
            where: { id: appointmentId, status: 'SCHEDULED' },
            data: { status: 'COMPLETED', consultationId },
          }),
        ]
      : []),
    ...(autoAdvance
      ? [
          prisma.lead.update({ where: { id: lead.id }, data: { status: 'CONSULTED' } }),
          prisma.leadStatusHistory.create({
            data: { leadId: lead.id, fromStatus: lead.status, toStatus: 'CONSULTED', changedById: actor.userId },
          }),
        ]
      : [prisma.lead.update({ where: { id: lead.id }, data: { updatedAt: new Date() } })]),
  ])

  revalidateConsultation()
  return {}
}

/** 상담 기록 수정 — 해당 문의에 접근 가능한 학원장/담당 교사 */
export async function updateConsultation(consultationId: string, input: ConsultationInput): Promise<ActionResult> {
  const actor = await getConsultationActor()
  if (!actor) return { error: NO_PERMISSION }

  const consultation = await prisma.consultation.findFirst({
    where: { id: consultationId, lead: leadScopeWhere(actor) },
    select: { id: true },
  })
  if (!consultation) return { error: '상담 기록을 찾을 수 없거나 접근 권한이 없습니다.' }

  const parsed = parseConsultationInput(input)
  if ('error' in parsed) return { error: parsed.error ?? '입력값을 확인해주세요.' }

  await prisma.consultation.update({ where: { id: consultation.id }, data: parsed.data })
  revalidateConsultation()
  return {}
}

/** 상담 기록 삭제 — 학원장만 */
export async function deleteConsultation(consultationId: string): Promise<ActionResult> {
  const actor = await getConsultationActor()
  if (!actor || actor.role !== 'ACADEMY_OWNER') return { error: NO_PERMISSION }

  const consultation = await prisma.consultation.findFirst({
    where: { id: consultationId, lead: leadScopeWhere(actor) },
    select: { id: true },
  })
  if (!consultation) return { error: '상담 기록을 찾을 수 없거나 접근 권한이 없습니다.' }

  await prisma.consultation.delete({ where: { id: consultation.id } })
  revalidateConsultation()
  return {}
}

// ─── 등록 전환 ─────────────────────────────────────────────────────────────────

/** 칸반에서 등록 전환 다이얼로그를 열 때 필요한 반 선택지 (Lead 소속 학원 기준) */
export async function getConvertOptions(
  leadId: string,
): Promise<ActionResult<{ classOptions: { id: string; name: string }[]; grade: string | null }>> {
  const actor = await getConsultationActor()
  if (!actor) return { error: NO_PERMISSION }

  const lead = await findScopedLead(actor, leadId)
  if (!lead) return { error: NOT_FOUND }
  if (lead.studentId || lead.status === 'ENROLLED') return { error: '이미 학생으로 등록된 문의입니다.' }

  const classOptions = await prisma.class.findMany({
    where: { academyId: lead.academyId, isActive: true },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  })
  return { classOptions, grade: lead.grade }
}

/**
 * 문의자를 학생 계정으로 전환 — 학원장 또는 담당 교사.
 * 기존 학생 생성 로직(createStudentAccount)을 재사용하고,
 * Lead 연결에 실패하면 생성한 계정을 롤백한다.
 */
export async function convertLeadToStudent(
  leadId: string,
  input: { name?: string; email: string; password: string; classId?: string; grade?: string; currentLevel?: number },
): Promise<ActionResult<{ studentId: string }>> {
  const actor = await getConsultationActor()
  if (!actor) return { error: NO_PERMISSION }

  const lead = await findScopedLead(actor, leadId)
  if (!lead) return { error: NOT_FOUND }
  if (lead.studentId || lead.status === 'ENROLLED') return { error: '이미 학생으로 등록된 문의입니다.' }

  const level = input.currentLevel ?? 1
  if (!Number.isInteger(level) || level < 1 || level > 10) return { error: '시작 레벨을 확인해주세요.' }

  const created = await createStudentAccount({
    academyId: lead.academyId,
    name: optionalText(input.name, 50) ?? lead.studentName,
    email: input.email,
    password: input.password,
    classId: input.classId || undefined,
    grade: optionalText(input.grade, 20) ?? lead.grade ?? undefined,
    currentLevel: level,
  })
  if (created.error || !created.studentId) return { error: created.error ?? '학생 생성에 실패했습니다.' }
  const studentId = created.studentId

  try {
    await prisma.$transaction(async (tx) => {
      // 동시 전환 방지: 아직 연결되지 않은 경우에만 갱신
      const updated = await tx.lead.updateMany({
        where: { id: lead.id, studentId: null },
        data: { studentId, status: 'ENROLLED', lostReason: null, lostReasonNote: null },
      })
      if (updated.count === 0) throw new Error('ALREADY_CONVERTED')
      await tx.leadStatusHistory.create({
        data: { leadId: lead.id, fromStatus: lead.status, toStatus: 'ENROLLED', changedById: actor.userId },
      })
    })
  } catch (err) {
    await rollbackStudentAccount(studentId).catch((e) => console.error('rollbackStudentAccount error:', e))
    if (err instanceof Error && err.message === 'ALREADY_CONVERTED') {
      return { error: '이미 학생으로 등록된 문의입니다.' }
    }
    console.error('convertLeadToStudent error:', err)
    return { error: '등록 전환 중 오류가 발생했습니다.' }
  }

  // 학생 목록 캐시는 본원 ID 기준 태그를 사용하므로 본원·지점 태그를 모두 무효화
  const academy = await prisma.academy.findUnique({
    where: { id: lead.academyId },
    select: { parentAcademyId: true },
  })
  revalidateTag(`academy-${lead.academyId}-students`)
  if (academy?.parentAcademyId) revalidateTag(`academy-${academy.parentAcademyId}-students`)
  revalidatePath('/owner/students')
  revalidatePath('/teacher/students')
  revalidateConsultation()
  return { studentId }
}
