'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, Building2, Crown, Check, GitBranch, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { setSelectedBranch } from '@/app/(dashboard)/owner/branches/actions'

export type BranchOption = {
  id: string
  label: string  // 표시명
  isHq: boolean
}

interface BranchSwitcherProps {
  branches: BranchOption[]
  selectedId: string   // 'all' or academyId
  collapsed: boolean
}

export function BranchSwitcher({ branches, selectedId, collapsed }: BranchSwitcherProps) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [pendingLabel, setPendingLabel] = useState<string | null>(null)
  const router = useRouter()

  const allOption: BranchOption = { id: 'all', label: '전체 지점', isHq: false }
  const options = [allOption, ...branches]

  const current =
    selectedId === 'all'
      ? allOption
      : (options.find((o) => o.id === selectedId) ?? allOption)

  function select(id: string) {
    const selected = options.find((o) => o.id === id)
    setPendingLabel(selected?.label ?? '지점')
    setOpen(false)
    startTransition(async () => {
      await setSelectedBranch(id)
      router.refresh()
      setPendingLabel(null)
    })
  }

  if (collapsed) {
    return (
      <>
        <button
          title={`지점: ${current.label}`}
          className="flex items-center justify-center w-full py-1.5 text-blue-200 hover:text-white transition-colors"
          onClick={() => setOpen((v) => !v)}
        >
          {isPending ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <GitBranch size={16} />
          )}
        </button>
        {isPending && <BranchLoadingOverlay label={pendingLabel} />}
      </>
    )
  }

  return (
    <>
      <div className="relative mx-2 mb-1">
        <button
          onClick={() => setOpen((v) => !v)}
          disabled={isPending}
          className={cn(
            'w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm transition-colors',
            'bg-primary-800 text-blue-100 hover:bg-primary-700 hover:text-white',
            open && 'bg-primary-700 text-white',
            isPending && 'opacity-70 cursor-wait',
          )}
        >
          <div className="flex items-center gap-2 min-w-0">
            {isPending ? (
              <Loader2 size={14} className="shrink-0 animate-spin" />
            ) : (
              <GitBranch size={14} className="shrink-0 opacity-70" />
            )}
            <span className="truncate font-medium">
              {isPending && pendingLabel ? pendingLabel : current.label}
            </span>
          </div>
          <ChevronDown size={14} className={cn('shrink-0 transition-transform', open && 'rotate-180')} />
        </button>

        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <div className="absolute left-0 right-0 top-full mt-1 z-20 rounded-lg border border-primary-700 bg-primary-900 shadow-lg overflow-hidden">
              {options.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => select(opt.id)}
                  className={cn(
                    'w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors',
                    'hover:bg-primary-700 text-blue-200 hover:text-white',
                    opt.id === selectedId && 'bg-primary-800 text-white',
                  )}
                >
                  {opt.id === 'all' ? (
                    <Building2 size={14} className="shrink-0 opacity-60" />
                  ) : opt.isHq ? (
                    <Crown size={14} className="shrink-0 opacity-60" />
                  ) : (
                    <Building2 size={14} className="shrink-0 opacity-60" />
                  )}
                  <span className="flex-1 truncate">{opt.label}</span>
                  {opt.id === selectedId && <Check size={13} className="shrink-0 text-primary-400" />}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {isPending && <BranchLoadingOverlay label={pendingLabel} />}
    </>
  )
}

function BranchLoadingOverlay({ label }: { label: string | null }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" aria-live="polite">
      <div className="absolute inset-0 bg-white/50 backdrop-blur-[2px]" />
      <div className="relative flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-6 py-4 shadow-sm">
        <Loader2 size={20} className="animate-spin text-primary-700" />
        <div>
          <p className="text-sm font-semibold text-gray-900">
            {label ? `${label}` : '지점'} 로딩 중
          </p>
          <p className="text-xs text-gray-500">잠시만 기다려 주세요</p>
        </div>
      </div>
    </div>
  )
}
