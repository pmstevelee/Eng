import { ATTENDANCE_STATUS_META, type AttendanceStatusValue } from '@/lib/attendance/constants'
import { cn } from '@/lib/utils'

/** 출결 상태 배지 — 미체크는 회색 테두리 */
export function AttendanceStatusBadge({
  status,
  className,
}: {
  status: AttendanceStatusValue
  className?: string
}) {
  const meta = ATTENDANCE_STATUS_META[status]
  if (status === 'UNCHECKED') {
    return (
      <span
        className={cn(
          'inline-flex items-center h-6 px-2.5 rounded-full border border-gray-300 text-xs font-medium text-gray-500 bg-white',
          className,
        )}
      >
        {meta.label}
      </span>
    )
  }
  return (
    <span
      className={cn('inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full text-xs font-semibold text-gray-900', className)}
      style={{ backgroundColor: `${meta.color}26` }}
    >
      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: meta.color }} aria-hidden />
      {meta.label}
    </span>
  )
}

export function KeypadTag() {
  return (
    <span className="inline-flex items-center h-5 px-1.5 rounded-md bg-gray-100 text-[11px] font-medium text-gray-700">
      키패드
    </span>
  )
}

export function AutoTag() {
  return (
    <span className="inline-flex items-center h-5 px-1.5 rounded-md bg-gray-100 text-[11px] font-medium text-gray-500">
      자동
    </span>
  )
}
