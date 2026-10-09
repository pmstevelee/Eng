'use client'

import { useState, useTransition } from 'react'
import { ChevronDown, Building2, Check, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { switchAcademyProfile } from '@/lib/actions/academy-switch-actions'

export type AcademyOption = {
  profileId: string
  academyName: string
}

interface AcademySwitcherProps {
  academies: AcademyOption[]
  currentProfileId: string
  collapsed: boolean
}

/** 여러 학원에 가입된 교사·학생의 학원 전환 메뉴 (사이드바 상단) */
export function AcademySwitcher({ academies, currentProfileId, collapsed }: AcademySwitcherProps) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [pendingLabel, setPendingLabel] = useState<string | null>(null)

  const current = academies.find((a) => a.profileId === currentProfileId) ?? academies[0]

  function select(option: AcademyOption) {
    setOpen(false)
    if (option.profileId === currentProfileId) return
    setError(null)
    setPendingLabel(option.academyName)
    startTransition(async () => {
      const result = await switchAcademyProfile(option.profileId)
      if (result?.error) {
        setError(result.error)
        setPendingLabel(null)
      }
    })
  }

  const menu = open && (
    <>
      <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
      <div
        className={cn(
          'absolute z-20 mt-1 rounded-lg border border-primary-700 bg-primary-900 shadow-sm overflow-hidden',
          collapsed ? 'left-2 top-full w-56' : 'left-0 right-0 top-full',
        )}
      >
        <p className="px-3 pt-2 pb-1 text-xs text-gray-400">학원 전환</p>
        {academies.map((opt) => (
          <button
            key={opt.profileId}
            onClick={() => select(opt)}
            className={cn(
              'w-full flex items-center gap-2.5 px-3 min-h-[44px] text-sm text-left transition-colors',
              'hover:bg-primary-700 text-blue-200 hover:text-white',
              opt.profileId === currentProfileId && 'bg-primary-800 text-white',
            )}
          >
            <Building2 size={14} className="shrink-0 opacity-60" />
            <span className="flex-1 truncate">{opt.academyName}</span>
            {opt.profileId === currentProfileId && (
              <Check size={13} className="shrink-0 text-primary-400" />
            )}
          </button>
        ))}
      </div>
    </>
  )

  return (
    <>
      <div className={cn('relative', collapsed ? '' : 'mx-2 mb-1')}>
        {collapsed ? (
          <button
            title={`학원: ${current.academyName}`}
            aria-label="학원 전환"
            className="flex items-center justify-center w-full min-h-[44px] text-blue-200 hover:text-white transition-colors"
            onClick={() => setOpen((v) => !v)}
          >
            {isPending ? <Loader2 size={16} className="animate-spin" /> : <Building2 size={16} />}
          </button>
        ) : (
          <button
            onClick={() => setOpen((v) => !v)}
            disabled={isPending}
            aria-label="학원 전환"
            className={cn(
              'w-full flex items-center justify-between gap-2 px-3 min-h-[44px] rounded-lg text-sm transition-colors',
              'bg-primary-800 text-blue-100 hover:bg-primary-700 hover:text-white',
              open && 'bg-primary-700 text-white',
              isPending && 'opacity-70 cursor-wait',
            )}
          >
            <div className="flex items-center gap-2 min-w-0">
              {isPending ? (
                <Loader2 size={14} className="shrink-0 animate-spin" />
              ) : (
                <Building2 size={14} className="shrink-0 opacity-70" />
              )}
              <span className="truncate font-medium">
                {isPending && pendingLabel ? pendingLabel : current.academyName}
              </span>
            </div>
            <ChevronDown
              size={14}
              className={cn('shrink-0 transition-transform', open && 'rotate-180')}
            />
          </button>
        )}
        {menu}
        {error && !collapsed && <p className="px-1 pt-1 text-xs text-accent-red-light">{error}</p>}
      </div>

      {isPending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" aria-live="polite">
          <div className="absolute inset-0 bg-white/50" />
          <div className="relative flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-6 py-4 shadow-sm">
            <Loader2 size={20} className="animate-spin text-primary-700" />
            <div>
              <p className="text-sm font-semibold text-gray-900">{pendingLabel ?? '학원'}(으)로 이동 중</p>
              <p className="text-xs text-gray-500">잠시만 기다려 주세요</p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
