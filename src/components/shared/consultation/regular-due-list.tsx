'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CalendarCheck2, CalendarClock, ChevronRight, NotebookPen, PhoneOff, Settings } from 'lucide-react'
import { REGULAR_CYCLE_LABEL, formatKstDate, formatKstDateTime } from '@/lib/consultation/constants'
import type { RegularDueItem } from '@/lib/consultation/student-consultation-queries'
import { cn } from '@/lib/utils'
import { AppointmentFormDialog } from './appointment-form-dialog'
import { StatusBadge } from './modal-shell'
import { StudentConsultationFormDialog } from './student-consultation-form-dialog'

type Option = { id: string; name: string }

type Props = {
  items: RegularDueItem[]
  /** 조회 범위 학원 중 정기상담을 사용하는 학원이 있는지 */
  enabled: boolean
  isOwner: boolean
  studentBasePath: string
  counselorOptionsByAcademy: Record<string, Option[]>
  currentUserId: string
}

type Dialog = { kind: 'appointment' | 'consultation'; item: RegularDueItem } | null

function dueBadge(overdueDays: number): { label: string; className: string } {
  if (overdueDays > 0) return { label: `${overdueDays}일 지남`, className: 'bg-accent-red-light text-accent-red' }
  if (overdueDays === 0) return { label: '오늘', className: 'bg-accent-gold-light text-[#9A6B00]' }
  return { label: `D-${-overdueDays}`, className: 'bg-primary-100 text-primary-700' }
}

function toDateLabel(key: string): string {
  return formatKstDate(`${key}T00:00:00+09:00`)
}

/** 재원생 상담 탭 — 정기상담 시기가 된 학생 목록 */
export function RegularDueList({ items, enabled, isOwner, studentBasePath, counselorOptionsByAcademy, currentUserId }: Props) {
  const [dialog, setDialog] = useState<Dialog>(null)
  const multiAcademy = new Set(items.map((i) => i.academyLabel)).size > 1
  // 교사는 ?tab=consultation 으로 상담 탭을 바로 열고, 학원장은 상담 섹션으로 이동
  const detailHref = (id: string) =>
    isOwner ? `${studentBasePath}/${id}#consultation` : `${studentBasePath}/${id}?tab=consultation`

  if (!enabled) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white py-14 px-4 flex flex-col items-center text-center">
        <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center mb-3">
          <CalendarCheck2 size={22} className="text-primary-700" />
        </div>
        <p className="text-base font-semibold text-gray-900">정기상담 주기가 설정되지 않았습니다</p>
        <p className="text-sm text-gray-500 mt-1">
          {isOwner
            ? '상담관리 설정에서 매월·격월·분기 중 주기를 정하면 상담 시기가 된 학생이 여기에 표시됩니다.'
            : '학원장이 정기상담 주기를 설정하면 담당 반 학생 중 상담 시기가 된 학생이 표시됩니다.'}
        </p>
        {isOwner && (
          <Link
            href="/owner/settings/consultation"
            className="mt-5 h-11 px-4 rounded-xl bg-primary-700 text-white text-sm font-medium hover:bg-primary-800 inline-flex items-center gap-1.5"
          >
            <Settings size={16} />
            정기상담 주기 설정
          </Link>
        )}
      </div>
    )
  }

  const overdueCount = items.filter((i) => i.overdueDays >= 0 && !i.upcomingAppointment).length

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-700">
        상담이 필요한 학생 <span className="font-semibold text-gray-900">{overdueCount}명</span>
        <span className="text-gray-500"> · 7일 안에 시기가 되는 학생과 예약된 학생도 함께 표시합니다.</span>
      </p>

      {items.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white py-14 px-4 flex flex-col items-center text-center">
          <div className="w-12 h-12 rounded-full bg-accent-green-light flex items-center justify-center mb-3">
            <CalendarCheck2 size={22} className="text-accent-green" />
          </div>
          <p className="text-base font-semibold text-gray-900">지금 정기상담이 필요한 학생이 없습니다</p>
          <p className="text-sm text-gray-500 mt-1">마지막 정기상담일과 학원 주기를 기준으로 자동으로 계산됩니다.</p>
        </div>
      ) : (
        <ul className="rounded-xl border border-gray-200 bg-white divide-y divide-gray-200">
          {items.map((item) => {
            const badge = dueBadge(item.overdueDays)
            return (
              <li key={item.studentId} className="px-4 py-4 flex flex-col lg:flex-row lg:items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={detailHref(item.studentId)}
                      className="text-sm font-semibold text-gray-900 hover:text-primary-700 inline-flex items-center gap-0.5"
                    >
                      {item.name}
                      <ChevronRight size={14} className="text-gray-500" />
                    </Link>
                    {item.grade && <span className="text-xs text-gray-500">{item.grade}</span>}
                    <StatusBadge className={badge.className} label={badge.label} />
                    {item.upcomingAppointment && (
                      <StatusBadge className="bg-accent-green-light text-[#16803D]" label="예약됨" />
                    )}
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    {multiAcademy && `${item.academyLabel} · `}
                    {item.className ?? '반 미배정'}
                    {isOwner && item.teacherName && ` (${item.teacherName})`} · {REGULAR_CYCLE_LABEL[item.cycle]} 주기
                  </p>
                  <p className="mt-0.5 text-xs text-gray-700">
                    {item.lastRegularDate ? `마지막 정기상담 ${toDateLabel(item.lastRegularDate)}` : '정기상담 기록 없음 (등록일 기준)'}
                    {' · '}예정일 {toDateLabel(item.dueDate)}
                  </p>
                  {item.upcomingAppointment && (
                    <p className="mt-0.5 text-xs text-[#16803D]">
                      예약: {formatKstDateTime(item.upcomingAppointment.scheduledAt)}
                    </p>
                  )}
                  {!item.hasParentPhone && (
                    <p className="mt-0.5 text-xs text-gray-500 inline-flex items-center gap-1">
                      <PhoneOff size={11} />
                      학부모 연락처 미등록 (알림 발송 불가)
                    </p>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setDialog({ kind: 'appointment', item })}
                    className={cn(
                      'h-11 px-4 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 inline-flex items-center gap-1.5',
                    )}
                  >
                    <CalendarClock size={16} />
                    {item.upcomingAppointment ? '추가 예약' : '예약'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDialog({ kind: 'consultation', item })}
                    className="h-11 px-4 rounded-xl bg-primary-700 text-white text-sm font-medium hover:bg-primary-800 inline-flex items-center gap-1.5"
                  >
                    <NotebookPen size={16} />
                    기록 작성
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {dialog?.kind === 'appointment' && (
        <AppointmentFormDialog
          studentId={dialog.item.studentId}
          studentName={dialog.item.name}
          counselorOptions={counselorOptionsByAcademy[dialog.item.academyId] ?? []}
          defaultCounselorId={currentUserId}
          notifyUnavailableReason={dialog.item.hasParentPhone ? undefined : '학부모 연락처가 없어 알림을 보낼 수 없습니다.'}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'consultation' && (
        <StudentConsultationFormDialog
          studentId={dialog.item.studentId}
          studentName={dialog.item.name}
          defaultType="REGULAR"
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  )
}
