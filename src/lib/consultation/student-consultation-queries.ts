import 'server-only'

import type { Prisma } from '@/generated/prisma'
import { prisma } from '@/lib/prisma/client'
import { leadScopeWhere, studentScopeWhere, type ConsultationActor } from './access'
import {
  DEFAULT_REGULAR_CYCLE,
  REGULAR_CYCLE_MONTHS,
  addMonthsToDateKey,
  diffDateKeys,
  readRegularCycle,
  toKstDateKey,
  todayKst,
  type AnyConsultationTypeValue,
  type AppointmentStatusValue,
  type RegularCycleValue,
} from './constants'
import { asLearningSummary, type LearningSummary } from './learning-summary-types'

// ─── 학생 상담 타임라인 ────────────────────────────────────────────────────────

export type StudentConsultationItem = {
  id: string
  /** STUDENT: 재원생 상담 기록 / LEAD: 등록 전 문의 시절 기록 (읽기 전용) */
  source: 'STUDENT' | 'LEAD'
  consultedAt: string
  type: AnyConsultationTypeValue
  counselorId: string | null
  counselorName: string | null
  learningHistory: string | null
  prevAcademy: string | null
  goal: string | null
  parentNeeds: string | null
  memo: string | null
  parentComment: string | null
  snapshot: LearningSummary | null
  report: { url: string; expiresAt: string; expired: boolean } | null
  /** 리포트 알림 발송 성공(또는 log 모드) 여부 */
  reportSent: boolean
}

export type StudentAppointmentItem = {
  id: string
  scheduledAt: string
  durationMinutes: number
  status: AppointmentStatusValue
  counselorId: string | null
  counselorName: string | null
}

export type StudentConsultationData = NonNullable<Awaited<ReturnType<typeof getStudentConsultationData>>>

/**
 * 학생 상세 "상담" 영역 — 재원생 상담 + 연결된 문의 시절 상담 기록, 예약, 학부모 연락처.
 * 권한 밖 학생이면 null.
 */
export async function getStudentConsultationData(actor: ConsultationActor, studentId: string, baseUrl: string) {
  const student = await prisma.student.findFirst({
    where: { id: studentId, ...studentScopeWhere(actor) },
    select: {
      id: true,
      status: true,
      parentPhone: true,
      user: { select: { name: true, academyId: true } },
      lead: { select: { id: true } },
      consultations: {
        orderBy: { consultedAt: 'desc' },
        take: 100,
        select: {
          id: true,
          consultedAt: true,
          type: true,
          counselorId: true,
          counselor: { select: { name: true } },
          goal: true,
          parentNeeds: true,
          memo: true,
          parentComment: true,
          reportSnapshot: true,
          reportToken: true,
          reportExpiresAt: true,
          notificationLogs: {
            where: { templateKey: 'STUDENT_REPORT', status: { in: ['SENT', 'SKIPPED'] } },
            select: { id: true },
            take: 1,
          },
        },
      },
      consultationAppointments: {
        where: { status: 'SCHEDULED' },
        orderBy: { scheduledAt: 'asc' },
        take: 10,
        select: {
          id: true,
          scheduledAt: true,
          durationMinutes: true,
          status: true,
          counselorId: true,
          counselor: { select: { name: true } },
        },
      },
    },
  })
  if (!student) return null

  // 등록 전 문의 시절 상담 기록 — 학생 권한이 있으면 함께 보여준다 (수정은 문의 화면에서만)
  const leadConsultations = student.lead
    ? await prisma.consultation.findMany({
        where: { leadId: student.lead.id },
        orderBy: { consultedAt: 'desc' },
        select: {
          id: true,
          consultedAt: true,
          type: true,
          counselorId: true,
          counselor: { select: { name: true } },
          learningHistory: true,
          prevAcademy: true,
          goal: true,
          parentNeeds: true,
          memo: true,
        },
      })
    : []

  // 문의 상세 링크는 문의 권한이 있을 때만
  const leadAccessible = student.lead
    ? (await prisma.lead.count({ where: { id: student.lead.id, ...leadScopeWhere(actor) } })) > 0
    : false

  const now = Date.now()
  const items: StudentConsultationItem[] = [
    ...student.consultations.map((c) => ({
      id: c.id,
      source: 'STUDENT' as const,
      consultedAt: c.consultedAt.toISOString(),
      type: c.type as AnyConsultationTypeValue,
      counselorId: c.counselorId,
      counselorName: c.counselor?.name ?? null,
      learningHistory: null,
      prevAcademy: null,
      goal: c.goal,
      parentNeeds: c.parentNeeds,
      memo: c.memo,
      parentComment: c.parentComment,
      snapshot: asLearningSummary(c.reportSnapshot),
      report:
        c.reportToken && c.reportExpiresAt
          ? {
              url: `${baseUrl}/report/${c.reportToken}`,
              expiresAt: c.reportExpiresAt.toISOString(),
              expired: c.reportExpiresAt.getTime() < now,
            }
          : null,
      reportSent: c.notificationLogs.length > 0,
    })),
    ...leadConsultations.map((c) => ({
      id: c.id,
      source: 'LEAD' as const,
      consultedAt: c.consultedAt.toISOString(),
      type: c.type as AnyConsultationTypeValue,
      counselorId: c.counselorId,
      counselorName: c.counselor?.name ?? null,
      learningHistory: c.learningHistory,
      prevAcademy: c.prevAcademy,
      goal: c.goal,
      parentNeeds: c.parentNeeds,
      memo: c.memo,
      parentComment: null,
      snapshot: null,
      report: null,
      reportSent: false,
    })),
  ].sort((a, b) => b.consultedAt.localeCompare(a.consultedAt))

  return {
    studentId: student.id,
    studentName: student.user.name,
    academyId: student.user.academyId,
    status: student.status,
    parentPhone: student.parentPhone,
    leadId: leadAccessible ? (student.lead?.id ?? null) : null,
    items,
    appointments: student.consultationAppointments.map((a) => ({
      id: a.id,
      scheduledAt: a.scheduledAt.toISOString(),
      durationMinutes: a.durationMinutes,
      status: a.status as AppointmentStatusValue,
      counselorId: a.counselorId,
      counselorName: a.counselor?.name ?? null,
    })) satisfies StudentAppointmentItem[],
  }
}

// ─── 정기상담 대상 ─────────────────────────────────────────────────────────────

/** 곧 정기상담 시기가 되는 학생도 미리 보여주는 기간 */
export const REGULAR_DUE_SOON_DAYS = 7

export type RegularDueItem = {
  studentId: string
  name: string
  grade: string | null
  className: string | null
  teacherName: string | null
  academyId: string
  academyLabel: string
  cycle: Exclude<RegularCycleValue, 'OFF'>
  /** 마지막 정기상담일 (KST 날짜) — 없으면 null (등록일 기준으로 판정) */
  lastRegularDate: string | null
  dueDate: string
  /** 양수 = 기한 지남, 0 = 오늘, 음수 = 남은 일수 */
  overdueDays: number
  hasParentPhone: boolean
  upcomingAppointment: { id: string; scheduledAt: string } | null
}

export type RegularDueResult = {
  items: RegularDueItem[]
  /** 조회 범위 학원 중 정기상담을 사용하는 학원이 하나라도 있는지 */
  enabled: boolean
}

/**
 * 정기상담 시기가 된 재원생 (마지막 정기상담일 + 학원 주기 기준, 없으면 등록일 기준).
 * 교사는 담당 반 학생만. 퇴원·휴원 학생 제외.
 */
export async function getRegularDueStudents(
  actor: ConsultationActor,
  viewAcademyIds?: string[],
): Promise<RegularDueResult> {
  const academyIds =
    actor.role === 'TEACHER'
      ? [actor.academyId]
      : (viewAcademyIds ?? actor.academyIds).filter((id) => actor.academyIds.includes(id))

  const academies = await prisma.academy.findMany({
    where: { id: { in: academyIds } },
    select: {
      id: true,
      name: true,
      branchName: true,
      parentAcademyId: true,
      settingsJson: true,
      parentAcademy: { select: { settingsJson: true } },
    },
  })
  // 학원 설정 → 본원 설정 → 기본값(사용 안 함)
  const cycleByAcademy = new Map<string, RegularCycleValue>()
  const labelByAcademy = new Map<string, string>()
  for (const a of academies) {
    cycleByAcademy.set(
      a.id,
      readRegularCycle(a.settingsJson) ?? readRegularCycle(a.parentAcademy?.settingsJson) ?? DEFAULT_REGULAR_CYCLE,
    )
    labelByAcademy.set(a.id, a.parentAcademyId ? (a.branchName ?? a.name) : '본원')
  }
  const activeIds = academyIds.filter((id) => (cycleByAcademy.get(id) ?? 'OFF') !== 'OFF')
  if (activeIds.length === 0) return { items: [], enabled: false }

  const where: Prisma.StudentWhereInput = {
    AND: [studentScopeWhere(actor), { status: 'ACTIVE', user: { academyId: { in: activeIds } } }],
  }
  const now = new Date()
  const students = await prisma.student.findMany({
    where,
    take: 2000,
    select: {
      id: true,
      grade: true,
      createdAt: true,
      parentPhone: true,
      user: { select: { name: true, academyId: true } },
      class: { select: { name: true, teacher: { select: { name: true } } } },
      consultations: {
        where: { type: 'REGULAR' },
        orderBy: { consultedAt: 'desc' },
        take: 1,
        select: { consultedAt: true },
      },
      consultationAppointments: {
        where: { status: 'SCHEDULED', scheduledAt: { gte: now } },
        orderBy: { scheduledAt: 'asc' },
        take: 1,
        select: { id: true, scheduledAt: true },
      },
    },
  })

  const today = todayKst()
  const items: RegularDueItem[] = []
  for (const s of students) {
    const academyId = s.user.academyId
    const cycle = academyId ? cycleByAcademy.get(academyId) : undefined
    if (!academyId || !cycle || cycle === 'OFF') continue
    const last = s.consultations[0]?.consultedAt ?? null
    const baseDate = toKstDateKey(last ?? s.createdAt)
    const dueDate = addMonthsToDateKey(baseDate, REGULAR_CYCLE_MONTHS[cycle])
    const overdueDays = diffDateKeys(dueDate, today)
    if (overdueDays < -REGULAR_DUE_SOON_DAYS) continue
    const appt = s.consultationAppointments[0]
    items.push({
      studentId: s.id,
      name: s.user.name,
      grade: s.grade,
      className: s.class?.name ?? null,
      teacherName: s.class?.teacher?.name ?? null,
      academyId,
      academyLabel: labelByAcademy.get(academyId) ?? '',
      cycle,
      lastRegularDate: last ? toKstDateKey(last) : null,
      dueDate,
      overdueDays,
      hasParentPhone: !!s.parentPhone,
      upcomingAppointment: appt ? { id: appt.id, scheduledAt: appt.scheduledAt.toISOString() } : null,
    })
  }
  // 예약이 없는 학생 먼저, 그 안에서 오래 밀린 순
  items.sort(
    (a, b) =>
      Number(!!a.upcomingAppointment) - Number(!!b.upcomingAppointment) || b.overdueDays - a.overdueDays,
  )
  return { items, enabled: true }
}
