'use client'

// 태깅 제안 검수 목록 — 확정 / 다른 포인트로 확정 / 해당 없음, 선택 일괄 처리
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Loader2, Pencil, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { QuestionPreview } from '@/components/grammar/question-preview'
import { AUTO_ACCEPT_CONFIDENCE } from '@/lib/grammar/question-tagging'
import type { TagSuggestionRow } from '@/lib/grammar/questions'
import { cn } from '@/lib/utils'
import { PointPicker, type PointOption } from '../../_components/point-picker'
import {
  acceptGrammarTagSuggestions,
  assignGrammarTagSuggestion,
  rejectGrammarTagSuggestions,
} from '../../question-actions'

type Message = { kind: 'ok' | 'error'; text: string } | null

function ConfidenceBadge({ value }: { value: number | null }) {
  const pct = Math.round((value ?? 0) * 100)
  const high = (value ?? 0) >= AUTO_ACCEPT_CONFIDENCE
  return (
    <span
      className={cn(
        'rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums',
        high ? 'bg-[#E8F7EE] text-[#15803D]' : pct >= 50 ? 'bg-[#FFF4D6] text-[#8A5A00]' : 'bg-gray-100 text-gray-600',
      )}
    >
      확신도 {pct}%
    </span>
  )
}

export function SuggestionList({ rows, options }: { rows: TagSuggestionRow[]; options: PointOption[] }) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [editing, setEditing] = useState<string | null>(null)
  const [message, setMessage] = useState<Message>(null)
  const [pending, startTransition] = useTransition()

  const acceptable = rows.filter((r) => r.suggestedPoint).map((r) => r.id)
  const selectedIds = Array.from(selected)
  const selectedAcceptable = selectedIds.filter((id) => acceptable.includes(id))
  const allSelected = rows.length > 0 && selected.size === rows.length

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function run(task: () => Promise<{ ok: true; count?: number } | { ok: false; error: string }>, okText: (n: number) => string) {
    setMessage(null)
    startTransition(async () => {
      const res = await task()
      if (res.ok) {
        setMessage({ kind: 'ok', text: okText(res.count ?? 1) })
        setSelected(new Set())
        setEditing(null)
        router.refresh()
      } else {
        setMessage({ kind: 'error', text: res.error })
      }
    })
  }

  const accept = (ids: string[]) => run(() => acceptGrammarTagSuggestions(ids), (n) => `${n}개를 확정했습니다.`)
  const reject = (ids: string[]) => run(() => rejectGrammarTagSuggestions(ids), (n) => `${n}개를 해당 없음으로 처리했습니다.`)
  const assign = (id: string, point: PointOption) =>
    run(() => assignGrammarTagSuggestion(id, point.id), () => `${point.code} ${point.title}에 연결했습니다.`)

  return (
    <div className="space-y-3">
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2">
        <label className="flex min-h-[44px] cursor-pointer items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            className="h-4 w-4 accent-[#1865F2]"
            checked={allSelected}
            onChange={() => setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)))}
          />
          이 페이지 전체 선택 ({selected.size}/{rows.length})
        </label>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button
            type="button"
            className="min-h-[44px] bg-[#1FAF54] hover:bg-[#1a9648]"
            disabled={pending || selectedAcceptable.length === 0}
            onClick={() => accept(selectedAcceptable)}
          >
            <Check className="mr-1.5 h-4 w-4" />
            선택 확정 {selectedAcceptable.length > 0 && `(${selectedAcceptable.length})`}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="min-h-[44px]"
            disabled={pending || selectedIds.length === 0}
            onClick={() => reject(selectedIds)}
          >
            선택 해당 없음
          </Button>
        </div>
        {message && (
          <p className={cn('w-full text-sm', message.kind === 'ok' ? 'text-[#15803D]' : 'text-[#D92916]')} role="status">
            {message.text}
          </p>
        )}
      </div>

      <ul className="space-y-2">
        {rows.map((r) => (
          <li
            key={r.id}
            className={cn(
              'rounded-xl border bg-white p-4',
              selected.has(r.id) ? 'border-[#1865F2]' : 'border-gray-200',
            )}
          >
            <div className="flex gap-3">
              <label className="flex h-11 w-8 shrink-0 cursor-pointer items-start justify-center pt-1">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[#1865F2]"
                  checked={selected.has(r.id)}
                  onChange={() => toggle(r.id)}
                  aria-label="선택"
                />
              </label>
              <div className="grid min-w-0 flex-1 gap-4 lg:grid-cols-[1fr_320px]">
                <div className="min-w-0 space-y-2">
                  <p className="flex flex-wrap gap-x-2 text-xs text-gray-400">
                    <span>기존 분류: {r.question.subCategory ?? '없음'}</span>
                    <span>· 난이도 {r.question.difficulty}</span>
                    {r.question.academyName && <span>· 학원 전용({r.question.academyName})</span>}
                  </p>
                  <QuestionPreview contentJson={r.question.contentJson} />
                </div>

                <div className="space-y-2 lg:border-l lg:border-gray-100 lg:pl-4">
                  {r.suggestedPoint ? (
                    <div className="space-y-1">
                      <p className="text-xs text-gray-500">AI 제안</p>
                      <p className="text-sm font-medium text-gray-900">
                        <span className="mr-1.5 font-mono text-xs text-gray-400">{r.suggestedPoint.code}</span>
                        {r.suggestedPoint.title}
                      </p>
                      <ConfidenceBadge value={r.confidence} />
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">AI가 맞는 포인트를 찾지 못했습니다.</p>
                  )}

                  {editing === r.id ? (
                    <div className="space-y-2">
                      <PointPicker options={options} disabled={pending} autoFocus onPick={(p) => assign(r.id, p)} />
                      <Button type="button" variant="ghost" className="min-h-[44px]" onClick={() => setEditing(null)}>
                        취소
                      </Button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {r.suggestedPoint && (
                        <Button
                          type="button"
                          className="min-h-[44px] bg-[#1FAF54] hover:bg-[#1a9648]"
                          disabled={pending}
                          onClick={() => accept([r.id])}
                        >
                          {pending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Check className="mr-1 h-4 w-4" />}
                          확정
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        className="min-h-[44px]"
                        disabled={pending}
                        onClick={() => setEditing(r.id)}
                      >
                        <Pencil className="mr-1 h-4 w-4" />
                        {r.suggestedPoint ? '다른 포인트' : '포인트 고르기'}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        className="min-h-[44px] text-gray-600"
                        disabled={pending}
                        onClick={() => reject([r.id])}
                      >
                        <X className="mr-1 h-4 w-4" />
                        해당 없음
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
