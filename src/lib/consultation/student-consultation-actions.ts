'use server'

import { randomBytes, randomUUID } from 'crypto'
import { revalidatePath } from 'next/cache'
import type { Prisma } from '@/generated/prisma'
import { prisma } from '@/lib/prisma/client'
import { appBaseUrl } from './app-url'
import { findScopedStudent, getConsultationActor, studentScopeWhere, type ConsultationActor } from './access'
import {
  REPORT_LINK_DAYS,
  STUDENT_CONSULTATION_TYPE_LABEL,
  addDaysToDateKey,
  diffDateKeys,
  isDateKey,
  isValidPhone,
  normalizePhone,
  todayKst,
  type StudentConsultationTypeValue,
} from './constants'
import { buildLearningSummary } from './learning-summary'
import type { LearningSummary } from './learning-summary-types'
import { notifyStudentReport } from './notify'

type ActionResult<T = object> = ({ error: string } & Partial<T>) | ({ error?: undefined } & T)

const NO_PERMISSION = '권한이 없습니다.'
const STUDENT_NOT_FOUND = '학생을 찾을 수 없거나 접근 권한이 없습니다.'
const CONSULTATION_NOT_FOUND = '상담 기록을 찾을 수 없거나 접근 권한이 없습니다.'
/** 학습 요약 조회 기간 상한 */
const MAX_SUMMARY_DAYS = 366

function revalidateStudentConsultation(studentId: string) {
  revalidatePath(`/owner/students/${studentId}`)
  revalidatePath(`/teacher/students/${studentId}`)
  revalidatePath('/owner/consultations', 'layout')
  revalidatePath('/teacher/consultations', 'layout')
}

function optionalText(v: string | undefined | null, max: number): string | null {
  const t = (v ?? '').trim()
  return t ? t.slice(0, max) : null
}

function isStudentConsultationType(v: string): v is StudentConsultationTypeValue {
  return Object.prototype.hasOwnProperty.call(STUDENT_CONSULTATION_TYPE_LABEL, v)
}

/** 학습 요약 기간 검증 (KST 날짜, 미래 불가, 최대 1년) */
function parsePeriod(from: string, to: string): { error: string } | { from: string; to: string } {
  if (!isDateKey(from) || !isDateKey(to)) return { error: '학습 요약 기간을 확인해주세요.' }
  if (from > to) return { error: '시작일이 종료일보다 늦습니다.' }
  if (to > todayKst()) return { error: '종료일은 오늘 이후로 선택할 수 없습니다.' }
  if (diffDateKeys(from, to) + 1 > MAX_SUMMARY_DAYS) return { error: '학습 요약 기간은 최대 1년입니다.' }
  return { from, to }
}

/** 권한 범위 안의 재원생 상담 기록 1건 */
async function findScopedStudentConsultation(actor: ConsultationActor, consultationId: string) {
  return prisma.consultation.findFirst({
    where: { id: consultationId, studentId: { not: null }, student: studentScopeWhere(actor) },
    select: {
      id: true,
      studentId: true,
      parentComment: true,
      reportSnapshot: true,
      reportToken: true,
      reportExpiresAt: true,
    },
  })
}

// ─── 학습 요약 ─────────────────────────────────────────────────────────────────

export async function getLearningSummary(
  studentId: string,
  from: string,
  to: string,
): Promise<ActionResult<{ summary: LearningSummary }>> {
  const actor = await getConsultationActor()
  if (!actor) return { error: NO_PERMISSION }
  const student = await findScopedStudent(actor, studentId)
  if (!student) return { error: STUDENT_NOT_FOUND }

  const period = parsePeriod(from, to)
  if ('error' in period) return { error: period.error }
  return { summary: await buildLearningSummary(student.id, period.from, period.to) }
}

// ─── 학부모 연락처 ─────────────────────────────────────────────────────────────

/** 학부모 연락처 저장 — 학원장·담당 반 교사 (빈 값이면 삭제) */
export async function updateParentPhone(studentId: string, phone: string): Promise<ActionResult> {
  const actor = await getConsultationActor()
  if (!actor) return { error: NO_PERMISSION }
  const student = await findScopedStudent(actor, studentId)
  if (!student) return { error: STUDENT_NOT_FOUND }

  const digits = normalizePhone(phone)
  if (digits && !isValidPhone(digits)) return { error: '연락처 형식이 올바르지 않습니다. (예: 010-1234-5678)' }

  await prisma.student.update({ where: { id: student.id }, data: { parentPhone: digits || null } })
  revalidateStudentConsultation(student.id)
  return {}
}

// ─── 상담 기록 ─────────────────────────────────────────────────────────────────

export type StudentConsultationInput = {
  consultedAt: string // ISO
  type: string
  goal?: string
  parentNeeds?: string
  memo?: string
  parentComment?: string
}

type ParsedStudentConsultation = {
  consultedAt: Date
  type: StudentConsultationTypeValue
  goal: string | null
  parentNeeds: string | null
  memo: string | null
  parentComment: string | null
}

function parseInput(input: StudentConsultationInput): { error: string } | { data: ParsedStudentConsultation } {
  const consultedAt = new Date(input.consultedAt)
  if (Number.isNaN(consultedAt.getTime())) return { error: '상담 일시를 입력해주세요.' }
  if (!isStudentConsultationType(input.type)) return { error: '상담 유형을 선택해주세요.' }
  const data = {
    consultedAt,
    type: input.type,
    goal: optionalText(input.goal, 2000),
    parentNeeds: optionalText(input.parentNeeds, 2000),
    memo: optionalText(input.memo, 5000),
    parentComment: optionalText(input.parentComment, 2000),
  }
  if (!data.goal && !data.parentNeeds && !data.memo && !data.parentComment) {
    return { error: '상담 내용을 한 가지 이상 입력해주세요.' }
  }
  return { data }
}

/** 요약 저장용 기간 — 선택하지 않으면 스냅샷 없이 저장 */
type SnapshotPeriod = { from: string; to: string } | null

async function buildSnapshot(
  studentId: string,
  period: SnapshotPeriod,
): Promise<{ error: string } | { snapshot: Prisma.InputJsonValue | undefined }> {
  if (!period) return { snapshot: undefined }
  const parsed = parsePeriod(period.from, period.to)
  if ('error' in parsed) return { error: parsed.error }
  // 스냅샷은 클라이언트 값이 아니라 저장 시점에 서버에서 다시 계산한다
  const summary = await buildLearningSummary(studentId, parsed.from, parsed.to)
  return { snapshot: summary as unknown as Prisma.InputJsonValue }
}

/**
 * 재원생 상담 기록 작성 — 선택한 기간의 학습 요약을 reportSnapshot 에 함께 저장.
 * appointmentId가 있으면 해당 예약을 완료 처리하고 기록과 연결한다.
 * 퇴원 상담(WITHDRAWAL)을 저장해도 학생 상태는 바꾸지 않는다 (퇴원 처리는 학원장이 별도로).
 */
export async function createStudentConsultation(
  studentId: string,
  input: StudentConsultationInput,
  period: SnapshotPeriod,
  appointmentId?: string,
): Promise<ActionResult<{ consultationId: string }>> {
  const actor = await getConsultationActor()
  if (!actor) return { error: NO_PERMISSION }
  const student = await findScopedStudent(actor, studentId)
  if (!student) return { error: STUDENT_NOT_FOUND }

  const parsed = parseInput(input)
  if ('error' in parsed) return { error: parsed.error }

  if (appointmentId) {
    const appointment = await prisma.consultationAppointment.findFirst({
      where: { id: appointmentId, studentId: student.id },
      select: { status: true },
    })
    if (!appointment) return { error: '예약을 찾을 수 없습니다.' }
    if (appointment.status !== 'SCHEDULED') return { error: '이미 처리된 예약입니다.' }
  }

  const built = await buildSnapshot(student.id, period)
  if ('error' in built) return { error: built.error }

  const consultationId = randomUUID()
  await prisma.$transaction([
    prisma.consultation.create({
      data: {
        ...parsed.data,
        id: consultationId,
        studentId: student.id,
        counselorId: actor.userId,
        reportSnapshot: built.snapshot,
      },
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
  ])

  revalidateStudentConsultation(student.id)
  return { consultationId }
}

/** 재원생 상담 기록 수정 — period를 주면 학습 요약을 그 기간으로 다시 저장 */
export async function updateStudentConsultation(
  consultationId: string,
  input: StudentConsultationInput,
  period: SnapshotPeriod,
): Promise<ActionResult> {
  const actor = await getConsultationActor()
  if (!actor) return { error: NO_PERMISSION }
  const consultation = await findScopedStudentConsultation(actor, consultationId)
  if (!consultation?.studentId) return { error: CONSULTATION_NOT_FOUND }

  const parsed = parseInput(input)
  if ('error' in parsed) return { error: parsed.error }

  const built = await buildSnapshot(consultation.studentId, period)
  if ('error' in built) return { error: built.error }

  await prisma.consultation.update({
    where: { id: consultation.id },
    data: { ...parsed.data, ...(built.snapshot ? { reportSnapshot: built.snapshot } : {}) },
  })
  revalidateStudentConsultation(consultation.studentId)
  return {}
}

/** 재원생 상담 기록 삭제 — 학원장만 (공유 링크도 함께 사라짐) */
export async function deleteStudentConsultation(consultationId: string): Promise<ActionResult> {
  const actor = await getConsultationActor()
  if (!actor || actor.role !== 'ACADEMY_OWNER') return { error: NO_PERMISSION }
  const consultation = await findScopedStudentConsultation(actor, consultationId)
  if (!consultation?.studentId) return { error: CONSULTATION_NOT_FOUND }

  await prisma.consultation.delete({ where: { id: consultation.id } })
  revalidateStudentConsultation(consultation.studentId)
  return {}
}

// ─── 학부모 공유 리포트 ────────────────────────────────────────────────────────

function generateReportToken(): string {
  return randomBytes(24).toString('base64url')
}

/** 날짜 키 기준 만료 시각: 오늘(KST) + 30일의 자정 직전까지 */
function reportExpiry(): Date {
  return new Date(`${addDaysToDateKey(todayKst(), REPORT_LINK_DAYS)}T23:59:59+09:00`)
}

type ReportLink = { url: string; expiresAt: string; token: string }

async function ensureReportLink(
  consultation: NonNullable<Awaited<ReturnType<typeof findScopedStudentConsultation>>>,
  renew: boolean,
): Promise<{ error: string } | ReportLink> {
  if (!consultation.reportSnapshot && !consultation.parentComment) {
    return { error: '학습 요약이나 학부모 공유용 코멘트가 있어야 리포트를 만들 수 있습니다.' }
  }
  const valid =
    !renew &&
    consultation.reportToken &&
    consultation.reportExpiresAt &&
    consultation.reportExpiresAt.getTime() > Date.now()
  if (valid && consultation.reportToken && consultation.reportExpiresAt) {
    return {
      token: consultation.reportToken,
      url: `${appBaseUrl()}/report/${consultation.reportToken}`,
      expiresAt: consultation.reportExpiresAt.toISOString(),
    }
  }
  const token = generateReportToken()
  const expiresAt = reportExpiry()
  await prisma.consultation.update({
    where: { id: consultation.id },
    data: { reportToken: token, reportExpiresAt: expiresAt },
  })
  return { token, url: `${appBaseUrl()}/report/${token}`, expiresAt: expiresAt.toISOString() }
}

/** 리포트 링크 발급 (renew=true면 기존 링크를 무효화하고 새로 발급) */
export async function issueReportLink(
  consultationId: string,
  renew = false,
): Promise<ActionResult<{ url: string; expiresAt: string }>> {
  const actor = await getConsultationActor()
  if (!actor) return { error: NO_PERMISSION }
  const consultation = await findScopedStudentConsultation(actor, consultationId)
  if (!consultation?.studentId) return { error: CONSULTATION_NOT_FOUND }

  const link = await ensureReportLink(consultation, renew)
  if ('error' in link) return { error: link.error }
  revalidateStudentConsultation(consultation.studentId)
  return { url: link.url, expiresAt: link.expiresAt }
}

/** 리포트 발송 — 유효한 링크가 없으면 발급 후 학부모에게 알림톡(STUDENT_REPORT) */
export async function sendStudentReport(
  consultationId: string,
): Promise<ActionResult<{ url: string; expiresAt: string; skipped?: boolean }>> {
  const actor = await getConsultationActor()
  if (!actor) return { error: NO_PERMISSION }
  const consultation = await findScopedStudentConsultation(actor, consultationId)
  if (!consultation?.studentId) return { error: CONSULTATION_NOT_FOUND }

  const link = await ensureReportLink(consultation, false)
  if ('error' in link) return { error: link.error }

  const result = await notifyStudentReport(consultation.id, consultation.studentId, link.token, link.url)
  revalidateStudentConsultation(consultation.studentId)
  if (!result) return { error: '퇴원했거나 학원 정보가 없는 학생에게는 발송할 수 없습니다.' }
  if (result.status === 'DUPLICATE') {
    return { error: '이미 이 링크로 발송했습니다. 다시 보내려면 [링크 재발급] 후 발송해주세요.' }
  }
  if (result.status === 'FAILED') return { error: result.error }
  return { url: link.url, expiresAt: link.expiresAt, skipped: result.status === 'SKIPPED' }
}
