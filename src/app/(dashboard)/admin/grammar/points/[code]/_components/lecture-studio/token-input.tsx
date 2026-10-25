'use client'

// 화면 문장 편집 — 문장을 입력하고, 조각(단어)을 눌러 색 역할을 지정한다.

import { useEffect, useState } from 'react'
import { joinTokens, type Token, type TokenRole } from '@/types/grammar-video'
import { TOKEN_ROLE_COLORS } from '@/lib/grammar/video/constants'
import { mergeWithNext, retokenize, setTokenRole, splitToken } from '@/lib/grammar/video/token-edit'
import { cn } from '@/lib/utils'
import { inputClass } from './studio-ui'

const ROLE_OPTIONS: { role: TokenRole | null; label: string }[] = [
  { role: 'subj', label: '주어' },
  { role: 'obj', label: '목적어' },
  { role: 'verb', label: '동사' },
  { role: 'hl', label: '강조' },
  { role: 'warn', label: '틀림' },
  { role: 'strike', label: '생략' },
  { role: null, label: '색 없음' },
]

function chipStyle(role: TokenRole | undefined): React.CSSProperties {
  if (!role) return { color: '#18224B', background: '#F3F4F6' }
  const c = TOKEN_ROLE_COLORS[role]
  return {
    color: c.fg,
    background: c.bg ?? 'transparent',
    textDecoration: role === 'strike' ? 'line-through' : undefined,
    textDecorationColor: role === 'strike' ? '#E0364A' : undefined,
  }
}

export function TokenInput({ value, onChange, label }: { value: Token[]; onChange: (v: Token[]) => void; label: string }) {
  const joined = joinTokens(value)
  const [text, setText] = useState(joined)
  const [selected, setSelected] = useState<number | null>(null)

  // 밖에서 바뀌면(장면 이동·되돌리기) 입력칸도 맞춘다
  useEffect(() => {
    setText(joined)
  }, [joined])

  function commitText() {
    if (text.trim() === joined) return
    onChange(retokenize(text, value))
    setSelected(null)
  }

  const sel = selected !== null && selected < value.length ? selected : null

  return (
    <div className="space-y-2">
      <input
        type="text"
        lang="en"
        aria-label={label}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commitText}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            commitText()
          }
        }}
        className={inputClass}
      />
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={`${label} 조각 — 눌러서 색 지정`}>
        {value.map((t, i) => (
          <button
            key={`${i}-${t.text}`}
            type="button"
            onClick={() => setSelected(sel === i ? null : i)}
            aria-pressed={sel === i}
            className={cn(
              'min-h-[36px] rounded-md px-2 text-sm font-semibold',
              sel === i && 'ring-2 ring-[#1865F2] ring-offset-1',
            )}
            style={chipStyle(t.role)}
          >
            {t.text}
          </button>
        ))}
      </div>
      {sel !== null && (
        <div className="flex flex-wrap items-center gap-1.5 rounded-lg bg-gray-50 p-2">
          <span className="mr-1 text-xs text-gray-500">&quot;{value[sel].text}&quot;</span>
          {ROLE_OPTIONS.map((o) => (
            <button
              key={o.label}
              type="button"
              onClick={() => onChange(setTokenRole(value, sel, o.role))}
              className={cn(
                'min-h-[36px] rounded-md border border-gray-200 px-2.5 text-xs font-semibold',
                (value[sel].role ?? null) === o.role && 'border-[#1865F2]',
              )}
              style={chipStyle(o.role ?? undefined)}
            >
              {o.label}
            </button>
          ))}
          <span className="mx-1 h-5 w-px bg-gray-200" />
          <button
            type="button"
            disabled={sel >= value.length - 1}
            onClick={() => onChange(mergeWithNext(value, sel))}
            className="min-h-[36px] rounded-md border border-gray-200 bg-white px-2.5 text-xs text-gray-600 disabled:opacity-40"
          >
            다음 조각과 합치기
          </button>
          <button
            type="button"
            disabled={!/\s/.test(value[sel].text)}
            onClick={() => onChange(splitToken(value, sel))}
            className="min-h-[36px] rounded-md border border-gray-200 bg-white px-2.5 text-xs text-gray-600 disabled:opacity-40"
          >
            단어로 나누기
          </button>
        </div>
      )}
    </div>
  )
}
