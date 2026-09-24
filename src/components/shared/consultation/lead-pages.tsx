import { notFound, redirect } from 'next/navigation'
import { MessagesSquare } from 'lucide-react'
import { getConsultationActor } from '@/lib/consultation/access'
import { LEAD_CHANNEL_LABEL, isLeadStatus, type LeadChannelValue } from '@/lib/consultation/constants'
import {
  LEAD_PAGE_SIZE,
  getAcademyOptions,
  getAssigneeFilterOptions,
  getAssigneeOptions,
  getClassOptions,
  getLeadBoard,
  getLeadDetail,
  getLeadList,
  type LeadFilters,
} from '@/lib/consultation/queries'
import { BRANCH_ALL, getSelectedBranchId, getViewableAcademyIds } from '@/lib/branch'
import { LeadDetailClient } from './lead-detail-client'
import { LeadListClient } from './lead-list-client'

export type LeadListSearchParams = {
  view?: string
  status?: string
  q?: string
  page?: string
  assignee?: string
  channel?: string
  from?: string
  to?: string
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function parseDate(v: string | undefined): string {
  if (!v || !DATE_RE.test(v) || Number.isNaN(new Date(`${v}T00:00:00+09:00`).getTime())) return ''
  return v
}

function parseChannel(v: string | undefined): LeadChannelValue | '' {
  return v && Object.prototype.hasOwnProperty.call(LEAD_CHANNEL_LABEL, v) ? (v as LeadChannelValue) : ''
}

type Role = 'ACADEMY_OWNER' | 'TEACHER'

const BASE_PATH: Record<Role, string> = {
  ACADEMY_OWNER: '/owner/consultations',
  TEACHER: '/teacher/consultations',
}
const STUDENT_BASE_PATH: Record<Role, string> = {
  ACADEMY_OWNER: '/owner/students',
  TEACHER: '/teacher/students',
}

/** 상담 목록 페이지 (학원장/교사 공용 서버 컴포넌트) */
export async function LeadListPage({ role, searchParams }: { role: Role; searchParams: LeadListSearchParams }) {
  const actor = await getConsultationActor()
  if (!actor || actor.role !== role) redirect('/login')

  const isOwner = actor.role === 'ACADEMY_OWNER'
  const view = searchParams.view === 'list' ? 'list' : 'board'
  const status = view === 'list' && searchParams.status && isLeadStatus(searchParams.status) ? searchParams.status : ''
  const query = searchParams.q?.trim().slice(0, 50) ?? ''
  const page = Math.max(1, parseInt(searchParams.page ?? '1', 10) || 1)
  const filterValues = {
    // 담당자 필터는 학원장만 (교사는 본인 담당만 보이므로 무의미)
    assignee: isOwner ? (searchParams.assignee?.slice(0, 64) ?? '') : '',
    channel: parseChannel(searchParams.channel),
    from: parseDate(searchParams.from),
    to: parseDate(searchParams.to),
  }

  // 학원장: 헤더 지점 선택기에 맞춰 조회 범위 결정
  let viewAcademyIds: string[] | undefined
  let defaultAcademyId = actor.academyId
  if (isOwner) {
    const selectedBranchId = await getSelectedBranchId()
    viewAcademyIds = await getViewableAcademyIds(actor.userId, selectedBranchId)
    if (selectedBranchId !== BRANCH_ALL && actor.academyIds.includes(selectedBranchId)) {
      defaultAcademyId = selectedBranchId
    }
  }

  const filters: LeadFilters = {
    viewAcademyIds,
    query,
    assignee: filterValues.assignee || undefined,
    channel: filterValues.channel || undefined,
    from: filterValues.from || undefined,
    to: filterValues.to || undefined,
  }

  const [list, board, academyOptions, assigneeOptions, assigneeFilterOptions] = await Promise.all([
    view === 'list' ? getLeadList(actor, { ...filters, status: status || undefined, page }) : null,
    view === 'board' ? getLeadBoard(actor, filters) : null,
    getAcademyOptions(actor),
    getAssigneeOptions(actor, defaultAcademyId),
    getAssigneeFilterOptions(actor, viewAcademyIds ?? actor.academyIds),
  ])
  const boardTotal = board?.reduce((sum, col) => sum + col.total, 0) ?? 0

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center">
          <MessagesSquare size={20} className="text-primary-700" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">상담관리</h1>
          <p className="text-sm text-gray-500">
            {isOwner ? '신규 문의부터 등록 전환까지 상담 진행 상황을 관리합니다.' : '내가 담당한 상담 문의를 관리합니다.'}
          </p>
        </div>
      </div>

      <LeadListClient
        basePath={BASE_PATH[role]}
        view={view}
        filters={filterValues}
        assigneeFilterOptions={assigneeFilterOptions}
        board={board}
        items={list?.items ?? []}
        statusCounts={list?.statusCounts ?? {}}
        allCount={list?.allCount ?? boardTotal}
        totalCount={list?.totalCount ?? boardTotal}
        page={page}
        pageSize={LEAD_PAGE_SIZE}
        status={status}
        query={query}
        showAcademyColumn={isOwner && actor.academyIds.length > 1}
        showAssigneeColumn={isOwner}
        academyOptions={academyOptions}
        defaultAcademyId={defaultAcademyId}
        assigneeOptions={assigneeOptions}
      />
    </div>
  )
}

/** 상담 상세 페이지 (학원장/교사 공용 서버 컴포넌트) */
export async function LeadDetailPage({ role, leadId }: { role: Role; leadId: string }) {
  const actor = await getConsultationActor()
  if (!actor || actor.role !== role) redirect('/login')

  // 권한 범위 밖(다른 학원·타 교사 담당)이면 존재 여부도 노출하지 않음
  const lead = await getLeadDetail(actor, leadId)
  if (!lead) notFound()

  const [assigneeOptions, classOptions] = await Promise.all([
    getAssigneeOptions(actor, lead.academyId),
    lead.studentId ? Promise.resolve([]) : getClassOptions(lead.academyId),
  ])

  return (
    <LeadDetailClient
      basePath={BASE_PATH[role]}
      studentBasePath={STUDENT_BASE_PATH[role]}
      isOwner={actor.role === 'ACADEMY_OWNER'}
      showAcademy={actor.role === 'ACADEMY_OWNER' && actor.academyIds.length > 1}
      lead={lead}
      assigneeOptions={assigneeOptions}
      classOptions={classOptions}
    />
  )
}
