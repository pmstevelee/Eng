'use client'

// 문법 포인트 검색 선택 — 코드·제목·분류로 검색 (라이브러리 없이 입력 + 결과 목록)
import { useMemo, useState } from 'react'
import { Input } from '@/components/ui/input'

export interface PointOption {
  id: string
  code: string
  title: string
  group: string
}

const MAX_RESULTS = 12

export function PointPicker({
  options,
  onPick,
  disabled,
  autoFocus,
}: {
  options: PointOption[]
  onPick: (option: PointOption) => void
  disabled?: boolean
  autoFocus?: boolean
}) {
  const [query, setQuery] = useState('')
  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return options
      .filter((o) => `${o.code} ${o.title} ${o.group}`.toLowerCase().includes(q))
      .slice(0, MAX_RESULTS)
  }, [query, options])

  return (
    <div className="space-y-1">
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="포인트 코드·제목 검색 (예: 수동태, G05)"
        disabled={disabled}
        autoFocus={autoFocus}
        className="min-h-[44px]"
      />
      {query.trim() && (
        <ul className="max-h-64 overflow-y-auto rounded-lg border border-gray-200 bg-white">
          {results.length === 0 ? (
            <li className="px-3 py-3 text-sm text-gray-500">검색 결과가 없습니다.</li>
          ) : (
            results.map((o) => (
              <li key={o.id}>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    onPick(o)
                    setQuery('')
                  }}
                  className="flex min-h-[44px] w-full flex-col items-start px-3 py-2 text-left hover:bg-[#F5F8FF] disabled:opacity-50"
                >
                  <span className="text-sm text-gray-900">
                    <span className="mr-2 font-mono text-xs text-gray-400">{o.code}</span>
                    {o.title}
                  </span>
                  <span className="text-xs text-gray-400">{o.group}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}
