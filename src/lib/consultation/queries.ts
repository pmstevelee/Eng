import 'server-only'

import type { Prisma } from '@/generated/prisma'
import { prisma } from '@/lib/prisma/client'
import { leadScopeWhere, type ConsultationActor } from './access'
import { normalizePhone, type LeadStatusValue } from './constants'

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
}

export type LeadListResult = {
  items: LeadListItem[]
  totalCount: number
  statusCounts: Record<string, number>
  allCount: number
}

type LeadListParams = {
  /** 학원장 지점 선택 필터 (actor.academyIds의 부분집합만 허용) */
  viewAcademyIds?: string[]
  status?: LeadStatusValue
  query?: string
  page: number
}

function buildBaseWhere(actor: ConsultationActor, params: LeadListParams): Prisma.LeadWhereInput {
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

  return { AND: and }
}

export async function getLeadList(actor: ConsultationActor, params: LeadListParams): Promise<LeadListResult> {
  const baseWhere = buildBaseWhere(actor, params)
  const where: Prisma.LeadWhereInput = params.status ? { AND: [baseWhere, { status: params.status }] } : baseWhere

  const [grouped, totalCount, rows] = await Promise.all([
    prisma.lead.groupBy({ by: ['status'], where: baseWhere, _count: { _all: true } }),
    prisma.lead.count({ where }),
    prisma.lead.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      skip: (params.page - 1) * LEAD_PAGE_SIZE,
      take: LEAD_PAGE_SIZE,
      select: {
        id: true,
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
      },
    }),
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
    items: rows.map((r) => ({
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
    })),
  }
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
    siblings,
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
