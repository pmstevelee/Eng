'use client'

import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { GripVertical, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { changeLeadStatus, getConvertOptions } from '@/lib/consultation/actions'
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
import type { LeadBoardColumn, LeadListItem } from '@/lib/consultation/queries'
import { ConvertToStudentDialog } from './convert-to-student-dialog'
import { StatusBadge, StaleBadge } from './modal-shell'
import { StatusChangeDialog } from './status-change-dialog'

type Props = {
  basePath: string
  columns: LeadBoardColumn[]
  showAssignee: boolean
  showAcademy: boolean
  /** 컬럼 초과분 안내 링크 (리스트 보기 + 해당 상태 필터) */
  listHref: (status: LeadStatusValue) => string
}

type PendingDialog =
  | { kind: 'lost'; lead: LeadListItem }
  | { kind: 'convert'; lead: LeadListItem; classOptions: { id: string; name: string }[]; grade: string | null }
  | null

/**
 * 상담 칸반 보드
 * - 카드 드래그로 상태 변경 (서버에서 권한 검증 + LeadStatusHistory 기록)
 * - '이탈'로 이동: 사유 선택 모달 필수 / '등록'으로 이동: 학생으로 등록 모달
 * - 터치 기기는 HTML5 드래그가 동작하지 않아 카드의 '상태 이동' 선택으로 대체
 */
export function LeadBoard({ basePath, columns: initialColumns, showAssignee, showAcademy, listHref }: Props) {
  const router = useRouter()
  const [columns, setColumns] = useState(initialColumns)
  const [dragging, setDragging] = useState<{ id: string; from: LeadStatusValue } | null>(null)
  const [overStatus, setOverStatus] = useState<LeadStatusValue | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [dialog, setDialog] = useState<PendingDialog>(null)
  const [, startTransition] = useTransition()

  // 서버 데이터가 갱신되면(router.refresh) 로컬 상태 동기화
  useEffect(() => setColumns(initialColumns), [initialColumns])

  const findLead = (id: string) => {
    for (const col of columns) {
      const lead = col.items.find((l) => l.id === id)
      if (lead) return lead
    }
    return null
  }

  /** 낙관적 이동: 카드를 대상 컬럼 맨 위로 옮기고 건수 조정 */
  const moveLocal = (lead: LeadListItem, to: LeadStatusValue) => {
    setColumns((cols) =>
      cols.map((col) => {
        if (col.status === lead.status) {
          return { ...col, total: col.total - 1, items: col.items.filter((l) => l.id !== lead.id) }
        }
        if (col.status === to) {
          return { ...col, total: col.total + 1, items: [{ ...lead, status: to }, ...col.items] }
        }
        return col
      }),
    )
  }

  const moveTo = (leadId: string, to: LeadStatusValue) => {
    const lead = findLead(leadId)
    if (!lead || lead.status === to || lead.status === 'ENROLLED') return
    setError('')

    if (to === 'LOST') {
      setDialog({ kind: 'lost', lead })
      return
    }

    if (to === 'ENROLLED') {
      setSavingId(lead.id)
      startTransition(async () => {
        const result = await getConvertOptions(lead.id)
        setSavingId(null)
        if (result.error || !result.classOptions) {
          setError(result.error ?? '등록 전환 정보를 불러오지 못했습니다.')
          return
        }
        setDialog({ kind: 'convert', lead, classOptions: result.classOptions, grade: result.grade ?? null })
      })
      return
    }

    const snapshot = columns
    moveLocal(lead, to)
    setSavingId(lead.id)
    startTransition(async () => {
      const result = await changeLeadStatus(lead.id, { status: to })
      setSavingId(null)
      if (result.error) {
        setColumns(snapshot)
        setError(result.error)
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-accent-red bg-accent-red-light px-3 py-2 rounded-lg">{error}</p>}

      <div className="-mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto pb-2">
        <div className="flex gap-3 min-w-max items-start">
          {columns.map((col) => {
            const canDrop = !!dragging && dragging.from !== col.status
            return (
              <section
                key={col.status}
                aria-label={`${LEAD_STATUS_LABEL[col.status]} ${col.total}건`}
                onDragOver={(e) => {
                  if (!canDrop) return
                  e.preventDefault()
                  e.dataTransfer.dropEffect = 'move'
                  if (overStatus !== col.status) setOverStatus(col.status)
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOverStatus(null)
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  const id = e.dataTransfer.getData('text/plain') || dragging?.id
                  setOverStatus(null)
                  setDragging(null)
                  if (id) moveTo(id, col.status)
                }}
                className={cn(
                  'w-72 shrink-0 rounded-xl border bg-gray-50 flex flex-col transition-colors',
                  overStatus === col.status ? 'border-primary-700 bg-primary-100' : 'border-gray-200',
                )}
              >
                <header className="flex items-center justify-between px-3 py-2.5 border-b border-gray-200">
                  <StatusBadge className={LEAD_STATUS_BADGE[col.status]} label={LEAD_STATUS_LABEL[col.status]} />
                  <span className="text-sm font-medium text-gray-500 tabular-nums">{col.total}</span>
                </header>

                <div className="p-2 space-y-2 max-h-[65vh] min-h-[120px] overflow-y-auto">
                  {col.items.length === 0 && (
                    <p className="text-xs text-gray-500 text-center py-6">
                      {canDrop ? '여기로 끌어다 놓으세요' : '문의가 없습니다'}
                    </p>
                  )}
                  {col.items.map((lead) => (
                    <LeadCard
                      key={lead.id}
                      lead={lead}
                      href={`${basePath}/${lead.id}`}
                      saving={savingId === lead.id}
                      showAssignee={showAssignee}
                      showAcademy={showAcademy}
                      onDragStart={() => setDragging({ id: lead.id, from: lead.status })}
                      onDragEnd={() => {
                        setDragging(null)
                        setOverStatus(null)
                      }}
                      onMove={(to) => moveTo(lead.id, to)}
                    />
                  ))}
                  {col.total > col.items.length && (
                    <Link
                      href={listHref(col.status)}
                      className="block text-center text-xs font-medium text-primary-700 hover:underline py-2"
                    >
                      외 {col.total - col.items.length}건 리스트에서 보기
                    </Link>
                  )}
                </div>
              </section>
            )
          })}
        </div>
      </div>

      {dialog?.kind === 'lost' && (
        <StatusChangeDialog
          leadId={dialog.lead.id}
          currentStatus={dialog.lead.status}
          currentLostReason={null}
          currentLostReasonNote={null}
          initialStatus="LOST"
          lockStatus
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'convert' && (
        <ConvertToStudentDialog
          leadId={dialog.lead.id}
          studentName={dialog.lead.studentName}
          defaultGrade={dialog.grade}
          classOptions={dialog.classOptions}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  )
}

function LeadCard({
  lead,
  href,
  saving,
  showAssignee,
  showAcademy,
  onDragStart,
  onDragEnd,
  onMove,
}: {
  lead: LeadListItem
  href: string
  saving: boolean
  showAssignee: boolean
  showAcademy: boolean
  onDragStart: () => void
  onDragEnd: () => void
  onMove: (to: LeadStatusValue) => void
}) {
  const router = useRouter()
  const draggable = lead.status !== 'ENROLLED' && !saving

  return (
    <article
      draggable={draggable}
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', lead.id)
        e.dataTransfer.effectAllowed = 'move'
        onDragStart()
      }}
      onDragEnd={onDragEnd}
      onClick={() => router.push(href)}
      className={cn(
        'group rounded-lg border border-gray-200 bg-white p-3 cursor-pointer hover:border-primary-600 transition-colors',
        draggable && 'active:cursor-grabbing',
        saving && 'opacity-60',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <Link
          href={href}
          onClick={(e) => e.stopPropagation()}
          className="font-semibold text-sm text-gray-900 hover:text-primary-700"
        >
          {lead.studentName}
        </Link>
        {lead.isStale && <StaleBadge />}
        <span className="flex-1" />
        {saving ? (
          <Loader2 size={14} className="animate-spin text-gray-500 shrink-0 mt-0.5" />
        ) : (
          draggable && <GripVertical size={14} className="text-gray-300 group-hover:text-gray-500 shrink-0 mt-0.5" />
        )}
      </div>
      <p className="text-xs text-gray-700 mt-1 tabular-nums">
        {maskPhone(lead.phone)}
        {lead.grade && ` · ${lead.grade}`}
      </p>
      {lead.school && <p className="text-xs text-gray-500 truncate">{lead.school}</p>}
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 mt-2 text-[11px] text-gray-500">
        <span>{LEAD_CHANNEL_LABEL[lead.channel as LeadChannelValue] ?? lead.channel}</span>
        {showAssignee && <span>· {lead.assigneeName ?? '미배정'}</span>}
        {showAcademy && <span>· {lead.academyLabel}</span>}
        <span className="ml-auto">
          {lead.lastConsultedAt ? `상담 ${formatKstDate(lead.lastConsultedAt).slice(6)}` : `문의 ${formatKstDate(lead.createdAt).slice(6)}`}
        </span>
      </div>

      {/* 터치 기기용 상태 이동 (HTML5 드래그 미지원 대체) */}
      {draggable && (
        <select
          aria-label="상태 이동"
          value=""
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => {
            if (e.target.value) onMove(e.target.value as LeadStatusValue)
          }}
          className="hidden [@media(pointer:coarse)]:block mt-2 w-full h-11 px-2 rounded-lg border border-gray-200 bg-white text-xs text-gray-700"
        >
          <option value="">상태 이동…</option>
          {LEAD_STATUS_ORDER.filter((s) => s !== lead.status).map((s) => (
            <option key={s} value={s}>
              {s === 'ENROLLED' ? '등록 (학생 계정 생성)' : LEAD_STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      )}
    </article>
  )
}
