import { notFound, redirect } from 'next/navigation'
import { MessagesSquare } from 'lucide-react'
import { getConsultationActor } from '@/lib/consultation/access'
import { isLeadStatus } from '@/lib/consultation/constants'
import {
  LEAD_PAGE_SIZE,
  getAcademyOptions,
  getAssigneeOptions,
  getClassOptions,
  getLeadDetail,
  getLeadList,
} from '@/lib/consultation/queries'
import { BRANCH_ALL, getSelectedBranchId, getViewableAcademyIds } from '@/lib/branch'
import { LeadDetailClient } from './lead-detail-client'
import { LeadListClient } from './lead-list-client'

export type LeadListSearchParams = { status?: string; q?: string; page?: string }

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

  const status = searchParams.status && isLeadStatus(searchParams.status) ? searchParams.status : ''
  const query = searchParams.q?.trim() ?? ''
  const page = Math.max(1, parseInt(searchParams.page ?? '1', 10) || 1)

  const isOwner = actor.role === 'ACADEMY_OWNER'

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

  const [list, academyOptions, assigneeOptions] = await Promise.all([
    getLeadList(actor, { viewAcademyIds, status: status || undefined, query, page }),
    getAcademyOptions(actor),
    getAssigneeOptions(actor, defaultAcademyId),
  ])

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
        items={list.items}
        statusCounts={list.statusCounts}
        allCount={list.allCount}
        totalCount={list.totalCount}
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
