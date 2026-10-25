import type { GrammarPointStatus } from '@/generated/prisma'
import { GRAMMAR_POINT_STATUS_LABEL } from '@/lib/grammar/constants'
import { cn } from '@/lib/utils'

const STATUS_CLASS: Record<GrammarPointStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-600',
  REVIEW: 'bg-[#FFF4D6] text-[#8A5A00]',
  PUBLISHED: 'bg-[#E8F7EE] text-[#15803D]',
}

export function GrammarStatusBadge({ status, className }: { status: GrammarPointStatus; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
        STATUS_CLASS[status],
        className,
      )}
    >
      {GRAMMAR_POINT_STATUS_LABEL[status]}
    </span>
  )
}
