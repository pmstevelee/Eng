'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, MessagesSquare, Plus, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  LEAD_CHANNEL_LABEL,
  LEAD_STATUS_BADGE,
  LEAD_STATUS_LABEL,
  LEAD_STATUS_ORDER,
  formatKstDate,
  maskPhone,
  type LeadChannelValue,
  type LeadStatusValue,
} from '@/lib/consultation/constants'
import type { LeadListItem } from '@/lib/consultation/queries'
import { LeadFormDialog } from './lead-form-dialog'
import { StatusBadge } from './modal-shell'

type Option = { id: string; name: string }

type Props = {
  basePath: string
  items: LeadListItem[]
  statusCounts: Record<string, number>
  allCount: number
  totalCount: number
  page: number
  pageSize: number
  status: LeadStatusValue | ''
  query: string
  showAcademyColumn: boolean
  showAssigneeColumn: boolean
  academyOptions: Option[]
  defaultAcademyId?: string
  assigneeOptions: Option[]
}

export function LeadListClient(props: Props) {
  const router = useRouter()
  const [q, setQ] = useState(props.query)
  const [openCreate, setOpenCreate] = useState(false)

  const buildHref = (next: { status?: string; q?: string; page?: number }) => {
    const params = new URLSearchParams()
    const status = next.status ?? props.status
    const query = next.q ?? props.query
    if (status) params.set('status', status)
    if (query) params.set('q', query)
    if (next.page && next.page > 1) params.set('page', String(next.page))
    const s = params.toString()
    return s ? `${props.basePath}?${s}` : props.basePath
  }

  const totalPages = Math.max(1, Math.ceil(props.totalCount / props.pageSize))

  const tabs: { key: LeadStatusValue | ''; label: string; count: number }[] = [
    { key: '', label: '전체', count: props.allCount },
    ...LEAD_STATUS_ORDER.map((s) => ({ key: s, label: LEAD_STATUS_LABEL[s], count: props.statusCounts[s] ?? 0 })),
  ]

  return (
    <div className="space-y-4">
      {/* 상단: 검색 + 등록 */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            router.push(buildHref({ q: q.trim(), page: 1 }))
          }}
          className="relative flex-1 sm:max-w-sm"
        >
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="학생·학부모 이름, 학교, 연락처 검색"
            className="w-full h-11 pl-9 pr-3 rounded-xl border border-gray-200 bg-white text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-700 focus:border-transparent"
          />
        </form>
        <button
          type="button"
          onClick={() => setOpenCreate(true)}
          className="h-11 px-4 rounded-xl bg-primary-700 text-white text-sm font-medium hover:bg-primary-800 transition-colors inline-flex items-center justify-center gap-1.5"
        >
          <Plus size={16} />
          신규 문의 등록
        </button>
      </div>

      {/* 상태 탭 */}
      <div className="-mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto">
        <div className="flex gap-1.5 min-w-max">
          {tabs.map((t) => {
            const active = props.status === t.key
            return (
              <Link
                key={t.key || 'all'}
                href={buildHref({ status: t.key, page: 1 })}
                className={cn(
                  'h-10 px-3.5 rounded-full text-sm font-medium inline-flex items-center gap-1.5 border transition-colors',
                  active
                    ? 'bg-primary-700 border-primary-700 text-white'
                    : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50',
                )}
              >
                {t.label}
                <span className={cn('text-xs', active ? 'text-white/80' : 'text-gray-500')}>{t.count}</span>
              </Link>
            )
          })}
        </div>
      </div>

      {props.items.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white py-16 px-6 flex flex-col items-center text-center">
          <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center mb-3">
            <MessagesSquare size={22} className="text-primary-700" />
          </div>
          <p className="text-base font-semibold text-gray-900">
            {props.query || props.status ? '조건에 맞는 문의가 없습니다' : '아직 등록된 상담 문의가 없습니다'}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            전화·방문 문의가 들어오면 등록해 상담 기록과 진행 상태를 관리하세요.
          </p>
          <button
            type="button"
            onClick={() => setOpenCreate(true)}
            className="mt-5 h-11 px-4 rounded-xl bg-primary-700 text-white text-sm font-medium hover:bg-primary-800 inline-flex items-center gap-1.5"
          >
            <Plus size={16} />
            신규 문의 등록
          </button>
        </div>
      ) : (
        <>
          {/* 데스크톱 테이블 */}
          <div className="hidden md:block rounded-xl border border-gray-200 bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-xs uppercase text-left">
                  <th className="px-4 py-3 font-medium">학생</th>
                  <th className="px-4 py-3 font-medium">학부모 연락처</th>
                  <th className="px-4 py-3 font-medium">학년/학교</th>
                  <th className="px-4 py-3 font-medium">채널</th>
                  <th className="px-4 py-3 font-medium">상태</th>
                  {props.showAssigneeColumn && <th className="px-4 py-3 font-medium">담당자</th>}
                  {props.showAcademyColumn && <th className="px-4 py-3 font-medium">지점</th>}
                  <th className="px-4 py-3 font-medium">최근 상담</th>
                  <th className="px-4 py-3 font-medium">등록일</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {props.items.map((lead) => (
                  <tr
                    key={lead.id}
                    onClick={() => router.push(`${props.basePath}/${lead.id}`)}
                    className="hover:bg-gray-50 cursor-pointer"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`${props.basePath}/${lead.id}`}
                        className="font-medium text-gray-900 hover:text-primary-700"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {lead.studentName}
                      </Link>
                      {lead.parentName && <p className="text-xs text-gray-500">학부모 {lead.parentName}</p>}
                    </td>
                    <td className="px-4 py-3 text-gray-700 tabular-nums">{maskPhone(lead.phone)}</td>
                    <td className="px-4 py-3 text-gray-700">
                      {[lead.grade, lead.school].filter(Boolean).join(' · ') || '-'}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {LEAD_CHANNEL_LABEL[lead.channel as LeadChannelValue] ?? lead.channel}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge className={LEAD_STATUS_BADGE[lead.status]} label={LEAD_STATUS_LABEL[lead.status]} />
                    </td>
                    {props.showAssigneeColumn && (
                      <td className="px-4 py-3 text-gray-700">{lead.assigneeName ?? <span className="text-gray-500">미배정</span>}</td>
                    )}
                    {props.showAcademyColumn && <td className="px-4 py-3 text-gray-700">{lead.academyLabel}</td>}
                    <td className="px-4 py-3 text-gray-700">
                      {lead.lastConsultedAt ? (
                        <>
                          {formatKstDate(lead.lastConsultedAt)}
                          <span className="text-xs text-gray-500 ml-1">({lead.consultationCount}회)</span>
                        </>
                      ) : (
                        <span className="text-gray-500">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{formatKstDate(lead.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 모바일 카드 */}
          <ul className="md:hidden space-y-2">
            {props.items.map((lead) => (
              <li key={lead.id}>
                <Link
                  href={`${props.basePath}/${lead.id}`}
                  className="block rounded-xl border border-gray-200 bg-white px-4 py-3 active:bg-gray-50"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-gray-900">{lead.studentName}</span>
                    <StatusBadge className={LEAD_STATUS_BADGE[lead.status]} label={LEAD_STATUS_LABEL[lead.status]} />
                  </div>
                  <p className="text-sm text-gray-700 mt-1 tabular-nums">
                    {maskPhone(lead.phone)}
                    {lead.grade && ` · ${lead.grade}`}
                    {lead.school && ` · ${lead.school}`}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {LEAD_CHANNEL_LABEL[lead.channel as LeadChannelValue] ?? lead.channel}
                    {props.showAssigneeColumn && ` · 담당 ${lead.assigneeName ?? '미배정'}`}
                    {props.showAcademyColumn && ` · ${lead.academyLabel}`}
                    {` · 등록 ${formatKstDate(lead.createdAt)}`}
                  </p>
                </Link>
              </li>
            ))}
          </ul>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <PageLink href={buildHref({ page: props.page - 1 })} disabled={props.page <= 1} label="이전 페이지">
                <ChevronLeft size={16} />
              </PageLink>
              <span className="text-sm text-gray-700 tabular-nums px-2">
                {props.page} / {totalPages}
              </span>
              <PageLink href={buildHref({ page: props.page + 1 })} disabled={props.page >= totalPages} label="다음 페이지">
                <ChevronRight size={16} />
              </PageLink>
            </div>
          )}
        </>
      )}

      {openCreate && (
        <LeadFormDialog
          mode="create"
          basePath={props.basePath}
          onClose={() => setOpenCreate(false)}
          academyOptions={props.academyOptions}
          defaultAcademyId={props.defaultAcademyId}
          assigneeOptions={props.assigneeOptions}
        />
      )}
    </div>
  )
}

function PageLink({
  href,
  disabled,
  label,
  children,
}: {
  href: string
  disabled: boolean
  label: string
  children: React.ReactNode
}) {
  const cls = 'w-11 h-11 rounded-xl border border-gray-200 bg-white flex items-center justify-center text-gray-700'
  if (disabled) {
    return (
      <span aria-disabled className={cn(cls, 'opacity-40')} aria-label={label}>
        {children}
      </span>
    )
  }
  return (
    <Link href={href} className={cn(cls, 'hover:bg-gray-50')} aria-label={label}>
      {children}
    </Link>
  )
}
