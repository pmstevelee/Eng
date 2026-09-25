import { AlertTriangle } from 'lucide-react'
import { RISK_LEVEL_BADGE, RISK_LEVEL_LABEL, type RiskLevelValue } from '@/lib/consultation/risk-constants'
import { cn } from '@/lib/utils'

/**
 * 퇴원 위험 등급 배지 (주의·위험) — 교사·학원장 화면 전용.
 * 사유는 title(마우스 오버)로 보여준다. 정상이면 아무것도 그리지 않는다.
 */
export function RiskBadge({
  level,
  reasons,
  className,
}: {
  level: RiskLevelValue | null | undefined
  reasons?: string[]
  className?: string
}) {
  if (!level || level === 'NORMAL') return null
  const label = `퇴원 ${RISK_LEVEL_LABEL[level]}`
  return (
    <span
      title={reasons && reasons.length > 0 ? reasons.join('\n') : undefined}
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap',
        RISK_LEVEL_BADGE[level],
        className,
      )}
    >
      <AlertTriangle size={11} aria-hidden />
      {label}
    </span>
  )
}
