// 학생 성취도 상태 배지 (미학습·학습 중·통과·숙달·취약) — 색·라벨은 constants.ts의 GRAMMAR_STATE_STYLE만 쓴다

import type { GrammarMasteryState } from '@/generated/prisma'
import { GRAMMAR_STATE_STYLE } from '@/lib/grammar/constants'
import { cn } from '@/lib/utils'

export function GrammarStateBadge({ state, className }: { state: GrammarMasteryState; className?: string }) {
  const style = GRAMMAR_STATE_STYLE[state]
  return (
    <span
      className={cn('inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold', className)}
      style={{ backgroundColor: style.bg, color: style.text }}
    >
      {style.label}
    </span>
  )
}
