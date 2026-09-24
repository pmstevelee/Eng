import 'server-only'

import type { Prisma } from '@/generated/prisma'
import { prisma } from '@/lib/prisma/client'
import { leadScopeWhere, type ConsultationActor } from './access'
import {
  DEFAULT_STALE_DAYS,
  LEAD_STATUS_ORDER,
  STALE_EXCLUDED_STATUSES,
  readStaleDays,
  kstDateStart,
  normalizePhone,
  todayKst,
  type AppointmentStatusValue,
  type LeadChannelValue,
  type LeadStatusValue,
} from './constants'

export const LEAD_PAGE_SIZE = 20

export type LeadListItem = {
  id: string
  studentName: string
  parentName: string | null
  phone: string
  grade: string | null
  school: string | null
  channel: string
  status: LeadStatusValue
  assigneeName: string | null
  academyLabel: string
  consultationCount: number
  lastConsultedAt: string | null
  createdAt: string
  /** 마지막 활동 후 방치 기준 일수 경과 (등록·이탈 제외) */
  isStale: boolean
}

export type LeadListResult = {
  items: LeadListItem[]
  totalCount: number
  statusCounts: Record<string, number>
  allCount: number
}

/** 목록·칸반 공통 필터 (값 검증은 페이지에서 끝난 상태로 전달) */
export type LeadFilters = {
  /** 학원장 지점 선택 필터 (actor.academyIds의 부분집합만 허용) */
  viewAcademyIds?: string[]
  query?: string
  /** 담당자 ID, 'none' = 미배정 (학원장만 적용) */
  assignee?: string
  channel?: LeadChannelValue
  /** 문의 등록일 범위 (YYYY-MM-DD, KST) */
  from?: string
  to?: string
}

type LeadListParams = LeadFilters & {
  status?: LeadStatusValue
  page: number
}

function buildBaseWhere(actor: ConsultationActor, params: LeadFilters): Prisma.LeadWhereInput {
  const and: Prisma.LeadWhereInput[] = [leadScopeWhere(actor)]

  if (actor.role === 'ACADEMY_OWNER' && params.viewAcademyIds) {
    const allowed = params.viewAcademyIds.filter((id) => actor.academyIds.includes(id))
    and.push({ academyId: { in: allowed } })
  }

  const q = params.query?.trim()
  if (q) {
    const digits = normalizePhone(q)
    const or: Prisma.LeadWhereInput[] = [
      { studentName: { contains: q, mode: 'insensitive' } },
      { parentName: { contains: q, mode: 'insensitive' } },
      { school: { contains: q, mode: 'insensitive' } },
    ]
    if (digits.length >= 3) or.push({ phone: { contains: digits } })
    and.push({ OR: or })
  }

  // 담당자 필터는 학원장만 (교사는 이미 본인 담당으로 한정됨)
  if (actor.role === 'ACADEMY_OWNER' && params.assignee) {
    and.push({ assigneeId: params.assignee === 'none' ? null : params.assignee })
  }

  if (params.channel) and.push({ channel: params.channel })

  // 기간: KST 날짜 경계 기준 (to는 해당일 23:59:59까지 포함)
  const createdAt: Prisma.DateTimeFilter = {}
  if (params.from) createdAt.gte = new Date(`${params.from}T00:00:00+09:00`)
  if (params.to) createdAt.lt = new Date(new Date(`${params.to}T00:00:00+09:00`).getTime() + 24 * 60 * 60 * 1000)
  if (createdAt.gte || createdAt.lt) and.push({ createdAt })

  return { AND: and }
}

const LEAD_CARD_SELECT = {
  id: true,
  academyId: true,
  lastActivityAt: true,
  studentName: true,
  parentName: true,
  phone: true,
  grade: true,
  school: true,
  channel: true,
  status: true,
  createdAt: true,
  assignee: { select: { name: true } },
  academy: { select: { name: true, branchName: true, parentAcademyId: true } },
  _count: { select: { consultations: true } },
  consultations: { select: { consultedAt: true }, orderBy: { consultedAt: 'desc' }, take: 1 },
} satisfies Prisma.LeadSelect

type LeadCardRow = Prisma.LeadGetPayload<{ select: typeof LEAD_CARD_SELECT }>

/**
 * 학원별 방치 기준 일수 — 학원 설정 → 본원 설정 → 기본값 순.
 * (지점 교사도 학원장이 본원에서 정한 기준을 따르도록 본원 설정까지 확인)
 */
export async function getStaleDaysByAcademy(academyIds: string[]): Promise<Map<string, number>> {
  const rows = await prisma.academy.findMany({
    where: { id: { in: academyIds } },
    select: { id: true, settingsJson: true, parentAcademy: { select: { settingsJson: true } } },
  })
  return new Map(
    rows.map((a) => [
      a.id,
      readStaleDays(a.settingsJson) ?? readStaleDays(a.parentAcademy?.settingsJson) ?? DEFAULT_STALE_DAYS,
    ]),
  )
}

function isStaleLead(r: { academyId: string; status: string; lastActivityAt: Date }, staleDays: Map<string, number>) {
  if ((STALE_EXCLUDED_STATUSES as string[]).includes(r.status)) return false
  const days = staleDays.get(r.academyId) ?? DEFAULT_STALE_DAYS
  return Date.now() - r.lastActivityAt.getTime() >= days * 24 * 60 * 60 * 1000
}

function toListItem(r: LeadCardRow, staleDays: Map<string, number>): LeadListItem {
  return {
    isStale: isStaleLead(r, staleDays),
    id: r.id,
    studentName: r.studentName,
    parentName: r.parentName,
    phone: r.phone,
    grade: r.grade,
    school: r.school,
    channel: r.channel,
    status: r.status,
    assigneeName: r.assignee?.name ?? null,
    academyLabel: r.academy.parentAcademyId ? (r.academy.branchName ?? r.academy.name) : '본원',
    consultationCount: r._count.consultations,
    lastConsultedAt: r.consultations[0]?.consultedAt.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
  }
}

export async function getLeadList(actor: ConsultationActor, params: LeadListParams): Promise<LeadListResult> {
  const baseWhere = buildBaseWhere(actor, params)
  const where: Prisma.LeadWhereInput = params.status ? { AND: [baseWhere, { status: params.status }] } : baseWhere

  const [grouped, totalCount, rows, staleDays] = await Promise.all([
    prisma.lead.groupBy({ by: ['status'], where: baseWhere, _count: { _all: true } }),
    prisma.lead.count({ where }),
    prisma.lead.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      skip: (params.page - 1) * LEAD_PAGE_SIZE,
      take: LEAD_PAGE_SIZE,
      select: LEAD_CARD_SELECT,
    }),
    getStaleDaysByAcademy(actor.academyIds),
  ])

  const statusCounts: Record<string, number> = {}
  let allCount = 0
  for (const g of grouped) {
    statusCounts[g.status] = g._count._all
    allCount += g._count._all
  }

  return {
    totalCount,
    statusCounts,
    allCount,
    items: rows.map((r) => toListItem(r, staleDays)),
  }
}

/** 칸반 컬럼당 최대 카드 수 (초과분은 리스트 보기로 안내) */
export const BOARD_COLUMN_LIMIT = 50

export type LeadBoardColumn = { status: LeadStatusValue; total: number; items: LeadListItem[] }

/** 칸반 보기: 상태별 컬럼 (필터 공통 적용, 컬럼별 최근 수정순 상위 N건) */
export async function getLeadBoard(actor: ConsultationActor, params: LeadFilters): Promise<LeadBoardColumn[]> {
  const baseWhere = buildBaseWhere(actor, params)

  const [grouped, staleDays, ...columns] = await Promise.all([
    prisma.lead.groupBy({ by: ['status'], where: baseWhere, _count: { _all: true } }),
    getStaleDaysByAcademy(actor.academyIds),
    ...LEAD_STATUS_ORDER.map((status) =>
      prisma.lead.findMany({
        where: { AND: [baseWhere, { status }] },
        orderBy: { updatedAt: 'desc' },
        take: BOARD_COLUMN_LIMIT,
        select: LEAD_CARD_SELECT,
      }),
    ),
  ])

  const totals = new Map(grouped.map((g) => [g.status, g._count._all]))
  return LEAD_STATUS_ORDER.map((status, i) => ({
    status,
    total: totals.get(status) ?? 0,
    items: columns[i].map((r) => toListItem(r, staleDays)),
  }))
}

export type LeadDetail = NonNullable<Awaited<ReturnType<typeof getLeadDetail>>>

export async function getLeadDetail(actor: ConsultationActor, leadId: string) {
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, ...leadScopeWhere(actor) },
    select: {
      id: true,
      academyId: true,
      studentName: true,
      parentName: true,
      phone: true,
      grade: true,
      school: true,
      preferredSchedule: true,
      channel: true,
      source: true,
      status: true,
      lostReason: true,
      lostReasonNote: true,
      assigneeId: true,
      studentId: true,
      privacyConsentAt: true,
      createdAt: true,
      updatedAt: true,
      assignee: { select: { name: true } },
      academy: { select: { name: true, branchName: true, parentAcademyId: true } },
      student: { select: { id: true, user: { select: { name: true, email: true } } } },
      consultations: {
        orderBy: { consultedAt: 'desc' },
        select: {
          id: true,
          consultedAt: true,
          type: true,
          learningHistory: true,
          prevAcademy: true,
          goal: true,
          parentNeeds: true,
          memo: true,
          counselorId: true,
          counselor: { select: { name: true } },
        },
      },
      appointments: {
        orderBy: { scheduledAt: 'desc' },
        select: {
          id: true,
          scheduledAt: true,
          durationMinutes: true,
          status: true,
          counselorId: true,
          rescheduledFromId: true,
          consultationId: true,
          counselor: { select: { name: true } },
        },
      },
      followUpTasks: {
        orderBy: [{ completedAt: { sort: 'desc', nulls: 'first' } }, { dueAt: 'asc' }],
        take: 50,
        select: {
          id: true,
          dueAt: true,
          content: true,
          completedAt: true,
          assigneeId: true,
          createdById: true,
          assignee: { select: { name: true } },
        },
      },
      placementInvites: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { id: true, status: true, token: true, expiresAt: true, createdAt: true },
      },
      placementAttempts: {
        where: { status: 'COMPLETED' },
        orderBy: { completedAt: 'desc' },
        take: 1,
        select: {
          id: true,
          overallLevel: true,
          assessedLevels: true,
          placementResult: true,
          completedAt: true,
          resultToken: true,
          resultExpiresAt: true,
        },
      },
      notificationLogs: {
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true,
          templateKey: true,
          channel: true,
          status: true,
          errorMessage: true,
          sentAt: true,
          createdAt: true,
        },
      },
      statusHistory: {
        orderBy: { changedAt: 'desc' },
        select: {
          id: true,
          fromStatus: true,
          toStatus: true,
          changedAt: true,
          changedBy: { select: { name: true } },
        },
      },
    },
  })
  if (!lead) return null

  // 같은 번호의 다른 문의 (형제 문의 등) — 권한 범위 안에서만 노출
  const siblings = await prisma.lead.findMany({
    where: { AND: [leadScopeWhere(actor), { academyId: lead.academyId, phone: lead.phone, id: { not: lead.id } }] },
    select: { id: true, studentName: true, status: true },
    take: 5,
  })

  return {
    ...lead,
    privacyConsentAt: lead.privacyConsentAt?.toISOString() ?? null,
    createdAt: lead.createdAt.toISOString(),
    updatedAt: lead.updatedAt.toISOString(),
    academyLabel: lead.academy.parentAcademyId ? (lead.academy.branchName ?? lead.academy.name) : '본원',
    consultations: lead.consultations.map((c) => ({ ...c, consultedAt: c.consultedAt.toISOString() })),
    statusHistory: lead.statusHistory.map((h) => ({ ...h, changedAt: h.changedAt.toISOString() })),
    appointments: lead.appointments.map((a) => ({
      ...a,
      status: a.status as AppointmentStatusValue,
      scheduledAt: a.scheduledAt.toISOString(),
    })),
    noShowCount: lead.appointments.filter((a) => a.status === 'NO_SHOW').length,
    placementInvite: lead.placementInvites[0]
      ? {
          ...lead.placementInvites[0],
          expiresAt: lead.placementInvites[0].expiresAt.toISOString(),
          createdAt: lead.placementInvites[0].createdAt.toISOString(),
        }
      : null,
    placementResult: toPlacementSummary(lead.placementAttempts[0]),
    placementResultSent: lead.notificationLogs.some(
      (n) => n.templateKey === 'PLACEMENT_TEST_RESULT' && (n.status === 'SENT' || n.status === 'SKIPPED'),
    ),
    notificationLogs: lead.notificationLogs.map((n) => ({
      ...n,
      sentAt: n.sentAt?.toISOString() ?? null,
      createdAt: n.createdAt.toISOString(),
    })),
    followUpTasks: lead.followUpTasks.map((t) => ({
      ...t,
      dueAt: t.dueAt.toISOString(),
      completedAt: t.completedAt?.toISOString() ?? null,
    })),
    siblings,
  }
}

// ─── 레벨테스트 결과 요약 ──────────────────────────────────────────────────────

export type PlacementDomainKey = 'GRAMMAR' | 'VOCABULARY' | 'READING' | 'LISTENING' | 'WRITING'

export type PlacementSummary = {
  attemptId: string
  overallLevel: number
  /** null = 미측정 (듣기 문항 부족) */
  domains: { domain: PlacementDomainKey; level: number | null }[]
  weakestDomain: PlacementDomainKey | null
  strongestDomain: PlacementDomainKey | null
  imbalanceWarning: boolean
  completedAt: string
  resultToken: string | null
  resultExpiresAt: string | null
}

type AttemptSummaryRow = {
  id: string
  overallLevel: number | null
  assessedLevels: Prisma.JsonValue
  placementResult: Prisma.JsonValue
  completedAt: Date | null
  resultToken: string | null
  resultExpiresAt: Date | null
}

function jsonObject(v: Prisma.JsonValue): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
}

/** 완료된 비회원 응시 → 화면용 요약 (문항·답안 정보는 포함하지 않음) */
export function toPlacementSummary(row: AttemptSummaryRow | undefined): PlacementSummary | null {
  if (!row || row.overallLevel === null || !row.completedAt) return null
  const levels = jsonObject(row.assessedLevels)
  const result = jsonObject(row.placementResult)
  const level = (key: string): number | null => (typeof levels[key] === 'number' ? (levels[key] as number) : null)
  const domainKey = (v: unknown): PlacementDomainKey | null =>
    typeof v === 'string' && ['GRAMMAR', 'VOCABULARY', 'READING', 'LISTENING', 'WRITING'].includes(v)
      ? (v as PlacementDomainKey)
      : null
  return {
    attemptId: row.id,
    overallLevel: row.overallLevel,
    domains: [
      { domain: 'GRAMMAR', level: level('grammar') },
      { domain: 'VOCABULARY', level: level('vocabulary') },
      { domain: 'READING', level: level('reading') },
      { domain: 'LISTENING', level: level('listening') },
      { domain: 'WRITING', level: level('writing') },
    ],
    weakestDomain: domainKey(result.weakestDomain),
    strongestDomain: domainKey(result.strongestDomain),
    imbalanceWarning: result.imbalanceWarning === true,
    completedAt: row.completedAt.toISOString(),
    resultToken: row.resultToken,
    resultExpiresAt: row.resultExpiresAt?.toISOString() ?? null,
  }
}

export type SelectOption = { id: string; name: string }

/** 담당자 후보: 해당 학원 교사 + 학원장 본인 */
export async function getAssigneeOptions(actor: ConsultationActor, academyId: string): Promise<SelectOption[]> {
  if (actor.role !== 'ACADEMY_OWNER') return []
  const [owner, teachers] = await Promise.all([
    prisma.user.findUnique({ where: { id: actor.userId }, select: { id: true, name: true } }),
    prisma.user.findMany({
      where: { academyId, role: 'TEACHER', isDeleted: false, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ])
  return [...(owner ? [{ id: owner.id, name: `${owner.name} (학원장)` }] : []), ...teachers]
}

/** 목록 담당자 필터 선택지 (학원장만): 조회 범위 학원의 교사 + 학원장 본인 */
export async function getAssigneeFilterOptions(
  actor: ConsultationActor,
  academyIds: string[],
): Promise<SelectOption[]> {
  if (actor.role !== 'ACADEMY_OWNER') return []
  const ids = academyIds.filter((id) => actor.academyIds.includes(id))
  const [owner, teachers] = await Promise.all([
    prisma.user.findUnique({ where: { id: actor.userId }, select: { id: true, name: true } }),
    prisma.user.findMany({
      where: { academyId: { in: ids }, role: 'TEACHER', isDeleted: false },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ])
  return [...(owner ? [{ id: owner.id, name: `${owner.name} (학원장)` }] : []), ...teachers]
}

/** 등록 전환 시 반 선택지: Lead 소속 학원의 활성 반 */
export async function getClassOptions(academyId: string): Promise<SelectOption[]> {
  return prisma.class.findMany({
    where: { academyId, isActive: true },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  })
}

/** 학원장 문의 등록 시 소속 학원 선택지 (본원 + 지점) */
export async function getAcademyOptions(actor: ConsultationActor): Promise<SelectOption[]> {
  if (actor.role !== 'ACADEMY_OWNER' || actor.academyIds.length <= 1) return []
  const rows = await prisma.academy.findMany({
    where: { id: { in: actor.academyIds }, isDeleted: false },
    select: { id: true, name: true, branchName: true, parentAcademyId: true, branchOrder: true },
    orderBy: { branchOrder: 'asc' },
  })
  return rows
    .sort((a, b) => (a.parentAcademyId ? 1 : 0) - (b.parentAcademyId ? 1 : 0))
    .map((a) => ({ id: a.id, name: a.parentAcademyId ? (a.branchName ?? a.name) : '본원' }))
}

// ─── 상담 일정 ─────────────────────────────────────────────────────────────────

export type AppointmentCalendarItem = {
  id: string
  scheduledAt: string
  durationMinutes: number
  status: AppointmentStatusValue
  counselorId: string | null
  counselorName: string | null
  leadId: string
  studentName: string
  grade: string | null
  leadStatus: LeadStatusValue
  /** 문의 상세를 열 수 있는지 (교사는 본인 담당 문의만) */
  canOpen: boolean
}

/**
 * 기간 내 상담 일정 (취소된 예약 제외)
 * - 교사: 본인이 상담자인 일정 (소속 학원)
 * - 학원장: 조회 범위 학원 전체, 담당자 필터 가능
 * from/to: KST 날짜 (YYYY-MM-DD), to는 포함
 */
export async function getAppointments(
  actor: ConsultationActor,
  params: { from: string; to: string; viewAcademyIds?: string[]; counselorId?: string },
): Promise<AppointmentCalendarItem[]> {
  const start = kstDateStart(params.from)
  const end = new Date(kstDateStart(params.to).getTime() + 24 * 60 * 60 * 1000)

  const where: Prisma.ConsultationAppointmentWhereInput =
    actor.role === 'TEACHER'
      ? { counselorId: actor.userId, lead: { academyId: actor.academyId } }
      : {
          lead: {
            academyId: {
              in: (params.viewAcademyIds ?? actor.academyIds).filter((id) => actor.academyIds.includes(id)),
            },
          },
          ...(params.counselorId ? { counselorId: params.counselorId } : {}),
        }

  const rows = await prisma.consultationAppointment.findMany({
    where: { ...where, status: { not: 'CANCELED' }, scheduledAt: { gte: start, lt: end } },
    orderBy: { scheduledAt: 'asc' },
    take: 500,
    select: {
      id: true,
      scheduledAt: true,
      durationMinutes: true,
      status: true,
      counselorId: true,
      counselor: { select: { name: true } },
      lead: { select: { id: true, studentName: true, grade: true, status: true, assigneeId: true } },
    },
  })

  return rows.map((r) => ({
    id: r.id,
    scheduledAt: r.scheduledAt.toISOString(),
    durationMinutes: r.durationMinutes,
    status: r.status as AppointmentStatusValue,
    counselorId: r.counselorId,
    counselorName: r.counselor?.name ?? null,
    leadId: r.lead.id,
    studentName: r.lead.studentName,
    grade: r.lead.grade,
    leadStatus: r.lead.status as LeadStatusValue,
    canOpen: actor.role === 'ACADEMY_OWNER' || r.lead.assigneeId === actor.userId,
  }))
}

// ─── 팔로업 할 일 ──────────────────────────────────────────────────────────────

export type TodayTaskItem = {
  id: string
  dueAt: string
  content: string
  overdue: boolean
  assigneeName: string | null
  leadId: string
  studentName: string
  canOpen: boolean
}

/**
 * 오늘 할 일: 오늘 마감 + 기한 지난 미완료 할 일
 * - 교사: 본인 배정 할 일 / 학원장: 조회 범위 학원 전체
 */
export async function getTodayTasks(
  actor: ConsultationActor,
  viewAcademyIds?: string[],
): Promise<{ items: TodayTaskItem[]; total: number }> {
  const todayStart = kstDateStart(todayKst())
  const tomorrowStart = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000)
  const where: Prisma.FollowUpTaskWhereInput = {
    completedAt: null,
    dueAt: { lt: tomorrowStart },
    ...(actor.role === 'TEACHER'
      ? { academyId: actor.academyId, assigneeId: actor.userId }
      : { academyId: { in: (viewAcademyIds ?? actor.academyIds).filter((id) => actor.academyIds.includes(id)) } }),
  }

  const [rows, total] = await Promise.all([
    prisma.followUpTask.findMany({
      where,
      orderBy: { dueAt: 'asc' },
      take: 20,
      select: {
        id: true,
        dueAt: true,
        content: true,
        assignee: { select: { name: true } },
        lead: { select: { id: true, studentName: true, assigneeId: true } },
      },
    }),
    prisma.followUpTask.count({ where }),
  ])

  return {
    total,
    items: rows.map((t) => ({
      id: t.id,
      dueAt: t.dueAt.toISOString(),
      content: t.content,
      overdue: t.dueAt < todayStart,
      assigneeName: t.assignee?.name ?? null,
      leadId: t.lead.id,
      studentName: t.lead.studentName,
      canOpen: actor.role === 'ACADEMY_OWNER' || t.lead.assigneeId === actor.userId,
    })),
  }
}

/** 학원장 화면의 방치 기준 일수 (본원 기준) */
export async function getOwnerStaleDays(actor: ConsultationActor): Promise<number> {
  const map = await getStaleDaysByAcademy([actor.academyId])
  return map.get(actor.academyId) ?? DEFAULT_STALE_DAYS
}
