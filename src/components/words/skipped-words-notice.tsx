'use client'

import { useState } from 'react'
import { AlertTriangle, ChevronDown } from 'lucide-react'

export type SkippedWord = {
  /** 단어 또는 원래 줄 */
  label: string
  reason: string
}

interface Props {
  title?: string
  items: SkippedWord[]
  /** 처음부터 펼쳐 둘지 */
  defaultOpen?: boolean
  /** 목록 아래 추가 버튼 등 */
  children?: React.ReactNode
}

/** 카드로 만들지(추가하지) 못한 단어와 사유 목록 — 같은 사유끼리 묶어 보여준다 */
export function SkippedWordsNotice({ title = '추가되지 않은 단어', items, defaultOpen = true, children }: Props) {
  const [open, setOpen] = useState(defaultOpen)
  if (items.length === 0) return null

  const groups = new Map<string, string[]>()
  for (const item of items) groups.set(item.reason, [...(groups.get(item.reason) ?? []), item.label])

  return (
    <div className="rounded-xl border border-accent-gold/40 bg-accent-gold/10 text-sm text-gray-900">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-11 w-full items-center gap-2 px-4 py-2 text-left"
        aria-expanded={open}
      >
        <AlertTriangle className="h-4 w-4 shrink-0 text-accent-gold" />
        <span className="flex-1 font-semibold">
          {title} {items.length}개
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="space-y-3 border-t border-accent-gold/30 px-4 py-3">
          {Array.from(groups.entries()).map(([reason, labels]) => (
            <div key={reason}>
              <p className="text-gray-700">{reason}</p>
              <p className="mt-1 break-words font-mono text-xs text-gray-600">{labels.join(', ')}</p>
            </div>
          ))}
          {children}
        </div>
      )}
    </div>
  )
}
