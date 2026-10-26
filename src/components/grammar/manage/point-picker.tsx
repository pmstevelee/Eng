'use client'

// 커리큘럼 트리에서 포인트 고르기 — 대분류 펼침 → 중분류 → 포인트 체크
// 이미 들어 있는 포인트(disabledIds)는 "배정됨"으로 표시하고 고를 수 없다.

import { useMemo, useState } from 'react'
import { ChevronDown, Search } from 'lucide-react'
import type { GrammarTreeCategory, GrammarTreePoint } from '@/lib/grammar/curriculum'
import { cn } from '@/lib/utils'

interface Props {
  tree: GrammarTreeCategory[]
  /** 고른 순서를 유지하기 위해 배열로 */
  selected: string[]
  onChange: (next: string[]) => void
  disabledIds?: Set<string>
  disabledLabel?: string
}

function matches(point: GrammarTreePoint, q: string): boolean {
  return point.title.toLowerCase().includes(q) || point.code.toLowerCase().includes(q)
}

export function PointPicker({ tree, selected, onChange, disabledIds, disabledLabel = '배정됨' }: Props) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState<Set<string>>(() => new Set())
  const selectedSet = useMemo(() => new Set(selected), [selected])
  const q = query.trim().toLowerCase()

  const filtered = useMemo(() => {
    if (!q) return tree
    return tree
      .map((c) => ({
        ...c,
        children: c.children.map((s) => ({ ...s, points: s.points.filter((p) => matches(p, q)) })).filter((s) => s.points.length > 0),
      }))
      .filter((c) => c.children.length > 0)
  }, [tree, q])

  const toggle = (id: string) => {
    onChange(selectedSet.has(id) ? selected.filter((s) => s !== id) : [...selected, id])
  }
  const toggleGroup = (points: GrammarTreePoint[], allOn: boolean) => {
    const ids = points.map((p) => p.id).filter((id) => !disabledIds?.has(id))
    if (allOn) {
      const remove = new Set(ids)
      onChange(selected.filter((s) => !remove.has(s)))
    } else {
      onChange([...selected, ...ids.filter((id) => !selectedSet.has(id))])
    }
  }

  if (tree.length === 0) {
    return <p className="py-8 text-center text-sm text-gray-500">아직 공개된 문법 포인트가 없습니다.</p>
  }

  return (
    <div className="space-y-3">
      <label className="relative block">
        <span className="sr-only">포인트 검색</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="포인트 이름이나 코드로 찾기"
          className="min-h-[44px] w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#1865F2]"
        />
      </label>

      {filtered.length === 0 && <p className="py-6 text-center text-sm text-gray-500">찾는 포인트가 없습니다.</p>}

      <ul className="space-y-2">
        {filtered.map((c) => {
          const expanded = q !== '' || open.has(c.id)
          const count = c.children.reduce((n, s) => n + s.points.filter((p) => selectedSet.has(p.id)).length, 0)
          return (
            <li key={c.id} className="rounded-xl border border-gray-200">
              <button
                type="button"
                onClick={() =>
                  setOpen((prev) => {
                    const next = new Set(prev)
                    if (next.has(c.id)) next.delete(c.id)
                    else next.add(c.id)
                    return next
                  })
                }
                aria-expanded={expanded}
                className="flex min-h-[44px] w-full items-center justify-between gap-2 px-3 py-2 text-left"
              >
                <span className="min-w-0 truncate text-sm font-semibold text-gray-900">
                  <span className="mr-1.5 font-mono text-xs text-gray-400">{c.code}</span>
                  {c.name}
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  {count > 0 && <span className="rounded-full bg-[#EFF4FF] px-2 py-0.5 text-xs font-medium text-[#1865F2]">{count}개 선택</span>}
                  <ChevronDown className={cn('h-4 w-4 text-gray-400 transition-transform', expanded && 'rotate-180')} aria-hidden />
                </span>
              </button>
              {expanded && (
                <div className="space-y-3 border-t border-gray-100 px-3 pb-3 pt-2">
                  {c.children.map((s) => {
                    const selectable = s.points.filter((p) => !disabledIds?.has(p.id))
                    const allOn = selectable.length > 0 && selectable.every((p) => selectedSet.has(p.id))
                    return (
                      <div key={s.id}>
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-medium text-gray-500">{s.name}</p>
                          {selectable.length > 1 && (
                            <button
                              type="button"
                              onClick={() => toggleGroup(s.points, allOn)}
                              className="min-h-[32px] rounded px-2 text-xs font-medium text-[#1865F2] hover:bg-[#EFF4FF]"
                            >
                              {allOn ? '모두 해제' : '모두 선택'}
                            </button>
                          )}
                        </div>
                        <ul className="mt-1">
                          {s.points.map((p) => {
                            const disabled = disabledIds?.has(p.id) ?? false
                            return (
                              <li key={p.id}>
                                <label
                                  className={cn(
                                    'flex min-h-[44px] items-center gap-3 rounded-lg px-2 py-1.5',
                                    disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:bg-gray-50',
                                  )}
                                >
                                  <input
                                    type="checkbox"
                                    className="h-5 w-5 shrink-0 accent-[#1865F2]"
                                    checked={disabled || selectedSet.has(p.id)}
                                    disabled={disabled}
                                    onChange={() => toggle(p.id)}
                                  />
                                  <span className="min-w-0 flex-1 text-sm text-gray-900">
                                    {p.title}
                                    <span className="ml-1.5 font-mono text-xs text-gray-400">{p.code}</span>
                                  </span>
                                  {disabled && <span className="shrink-0 text-xs text-gray-500">{disabledLabel}</span>}
                                </label>
                              </li>
                            )
                          })}
                        </ul>
                      </div>
                    )
                  })}
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
