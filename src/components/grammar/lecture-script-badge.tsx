// AI 강의 스크립트 상태 배지 (관리자 화면 전용) + 트리용 제작 단계 배지
import { cn } from '@/lib/utils'

const SCRIPT_STATUS: Record<string, { label: string; className: string }> = {
  DRAFT: { label: '스크립트 초안', className: 'bg-gray-100 text-gray-600' },
  APPROVED: { label: '승인됨', className: 'bg-[#EEF4FF] text-[#1865F2]' },
  AUDIO_READY: { label: '음성 준비', className: 'bg-[#E8F7EE] text-[#15803D]' },
  LINKED: { label: 'YouTube 연결', className: 'bg-[#F1EDFF] text-[#7854F7]' },
}

export function LectureScriptBadge({ status, className }: { status: string; className?: string }) {
  const s = SCRIPT_STATUS[status] ?? SCRIPT_STATUS.DRAFT
  return (
    <span className={cn('inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold', s.className, className)}>
      {s.label}
    </span>
  )
}

const PRODUCTION: Record<'SCRIPT' | 'AUDIO_READY' | 'LINKED', { label: string; className: string }> = {
  SCRIPT: { label: '강의 스크립트', className: 'bg-gray-100 text-gray-600' },
  AUDIO_READY: { label: '강의 음성 준비', className: 'bg-[#E8F7EE] text-[#15803D]' },
  LINKED: { label: '강의 YouTube', className: 'bg-[#F1EDFF] text-[#7854F7]' },
}

/** 트리 포인트 행의 AI 강의 제작 단계 (없으면 아무것도 그리지 않음) */
export function LectureProductionBadge({ stage }: { stage: 'SCRIPT' | 'AUDIO_READY' | 'LINKED' | null | undefined }) {
  if (!stage) return null
  const s = PRODUCTION[stage]
  return (
    <span className={cn('hidden shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-semibold md:inline-flex', s.className)}>
      {s.label}
    </span>
  )
}
