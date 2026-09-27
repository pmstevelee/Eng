'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { ATTENDANCE_STATUS_META, SPECIAL_STATUSES, type AttendanceStatusValue } from '@/lib/attendance/constants'
import { cn } from '@/lib/utils'

/**
 * 상태 선택 + 사유 입력 시트 (모바일은 하단 시트, 넓은 화면은 가운데 모달)
 * 사유 입력칸은 인정결석·조퇴·보강을 골랐을 때만 표시
 */
export function AttendanceStatusSheet({
  title,
  statuses,
  initialStatus,
  initialReason,
  onClose,
  onSubmit,
}: {
  title: string
  statuses: AttendanceStatusValue[]
  initialStatus?: AttendanceStatusValue
  initialReason?: string | null
  onClose: () => void
  onSubmit: (status: AttendanceStatusValue, reason: string | null) => void
}) {
  const [status, setStatus] = useState<AttendanceStatusValue | null>(
    initialStatus && statuses.includes(initialStatus) ? initialStatus : null,
  )
  const [reason, setReason] = useState(initialReason ?? '')
  const needsReason = status !== null && SPECIAL_STATUSES.includes(status)

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="attendance-sheet-title"
        className="relative z-10 w-full sm:max-w-sm rounded-t-xl sm:rounded-xl border border-gray-200 bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-sm"
      >
        <div className="flex items-center justify-between">
          <h3 id="attendance-sheet-title" className="text-base font-bold text-gray-900">
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="w-11 h-11 -mr-2 inline-flex items-center justify-center rounded-xl text-gray-500 hover:bg-gray-50"
          >
            <X size={20} />
          </button>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          {statuses.map((s) => {
            const meta = ATTENDANCE_STATUS_META[s]
            const selected = status === s
            return (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(s)}
                aria-pressed={selected}
                className={cn(
                  'h-12 rounded-xl border text-sm font-semibold inline-flex items-center justify-center gap-1.5 transition-colors',
                  selected ? 'border-2 text-gray-900' : 'border-gray-200 text-gray-700 hover:bg-gray-50',
                )}
                style={selected ? { borderColor: meta.color, backgroundColor: `${meta.color}1A` } : undefined}
              >
                {s !== 'UNCHECKED' && (
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: meta.color }} aria-hidden />
                )}
                {meta.label}
              </button>
            )
          })}
        </div>

        {needsReason && (
          <label className="block mt-4">
            <span className="text-sm font-medium text-gray-700">사유 (선택)</span>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={200}
              placeholder="예: 병원 진료, 학교 행사"
              className="mt-1.5 w-full h-11 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-700"
            />
          </label>
        )}

        <button
          type="button"
          disabled={!status}
          onClick={() => status && onSubmit(status, needsReason ? reason.trim() || null : null)}
          className="mt-5 w-full h-11 rounded-xl bg-primary-700 text-white text-sm font-semibold hover:bg-primary-800 disabled:opacity-50"
        >
          저장
        </button>
      </div>
    </div>
  )
}
