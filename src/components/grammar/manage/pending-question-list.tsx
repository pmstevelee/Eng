'use client'

// 검수 대기 — 우리 학원 AI 생성 문법 문항을 확인해 검수 완료(출제) 또는 사용 안 함

import { useMemo, useState, useTransition } from 'react'
import { Check, ClipboardCheck, Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { QuestionPreview } from '@/components/grammar/question-preview'
import { reviewAcademyQuestions } from '@/lib/grammar/manage-actions'
import type { PendingAcademyQuestion } from '@/lib/grammar/manage-queries'
import { cn } from '@/lib/utils'

interface Props {
  rows: PendingAcademyQuestion[]
  total: number
}

export function PendingQuestionList({ rows, total }: Props) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  const [hidden, setHidden] = useState<Set<string>>(() => new Set())
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [pending, startTransition] = useTransition()

  const visible = rows.filter((r) => !hidden.has(r.id))
  const groups = useMemo(() => {
    const map = new Map<string, { point: PendingAcademyQuestion['point']; academyLabel: string | null; items: PendingAcademyQuestion[] }>()
    for (const r of visible) {
      const key = `${r.point.id}:${r.academyLabel ?? ''}`
      const g = map.get(key) ?? { point: r.point, academyLabel: r.academyLabel, items: [] }
      g.items.push(r)
      map.set(key, g)
    }
    return Array.from(map.values())
  }, [visible])

  const act = (ids: string[], op: 'verify' | 'discard') => {
    if (ids.length === 0) return
    setNotice(null)
    startTransition(async () => {
      const res = await reviewAcademyQuestions(ids, op)
      if (!res.ok) return setNotice({ type: 'error', text: res.error })
      setHidden((prev) => new Set([...Array.from(prev), ...ids]))
      setSelected((prev) => new Set(Array.from(prev).filter((id) => !ids.includes(id))))
      setNotice({
        type: 'success',
        text: op === 'verify' ? `${res.count}개 문항을 검수 완료했어요. 이제 학생에게 출제됩니다.` : `${res.count}개 문항을 사용하지 않도록 뺐어요.`,
      })
    })
  }

  if (visible.length === 0) {
    return (
      <div className="space-y-3">
        {notice && <p className="rounded-lg bg-[#E8F7EE] px-3 py-2.5 text-sm text-[#15803D]">{notice.text}</p>}
        <div className="flex flex-col items-center rounded-xl border border-gray-200 bg-white px-6 py-14 text-center">
          <ClipboardCheck className="h-10 w-10 text-gray-300" aria-hidden />
          <p className="mt-3 font-medium text-gray-900">검수할 문제가 없습니다</p>
          <p className="mt-1 text-sm text-gray-500">반 배정 화면의 &lsquo;문제 AI 생성&rsquo;으로 만든 우리 학원 문제가 여기에 모입니다.</p>
        </div>
      </div>
    )
  }

  const selectedIds = Array.from(selected)
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-500">
          검수 대기 {total - hidden.size}개{total > rows.length ? ` (오래된 ${rows.length}개만 표시)` : ''} — 정답·해설이 맞는지 확인하고 검수 완료해 주세요.
        </p>
        <div className="flex gap-2">
          <Button type="button" variant="outline" className="min-h-[44px]" disabled={pending || selectedIds.length === 0} onClick={() => act(selectedIds, 'discard')}>
            사용 안 함
          </Button>
          <Button type="button" className="min-h-[44px]" disabled={pending || selectedIds.length === 0} onClick={() => act(selectedIds, 'verify')}>
            {pending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            {selectedIds.length > 0 ? `${selectedIds.length}개 검수 완료` : '검수 완료'}
          </Button>
        </div>
      </div>

      {notice && (
        <p className={cn('rounded-lg px-3 py-2.5 text-sm', notice.type === 'success' ? 'bg-[#E8F7EE] text-[#15803D]' : 'bg-[#FDECEA] text-[#D92916]')}>
          {notice.text}
        </p>
      )}

      {groups.map((g) => {
        const ids = g.items.map((i) => i.id)
        const allOn = ids.every((id) => selected.has(id))
        return (
          <section key={`${g.point.id}:${g.academyLabel ?? ''}`} className="rounded-xl border border-gray-200 bg-white">
            <header className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-4 py-2.5">
              <p className="text-sm font-semibold text-gray-900">
                {g.point.title}
                <span className="ml-1.5 font-mono text-xs font-normal text-gray-400">{g.point.code}</span>
                {g.academyLabel && <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-normal text-gray-600">{g.academyLabel}</span>}
              </p>
              <button
                type="button"
                className="min-h-[44px] rounded-lg px-2 text-sm font-medium text-[#1865F2] hover:bg-[#EFF4FF]"
                onClick={() =>
                  setSelected((prev) => {
                    const next = new Set(prev)
                    for (const id of ids) {
                      if (allOn) next.delete(id)
                      else next.add(id)
                    }
                    return next
                  })
                }
              >
                {allOn ? '모두 해제' : `${ids.length}개 모두 선택`}
              </button>
            </header>
            <ul className="divide-y divide-gray-100">
              {g.items.map((q) => (
                <li key={q.id} className="flex gap-3 px-4 py-3">
                  <input
                    type="checkbox"
                    aria-label="문항 선택"
                    className="mt-1 h-5 w-5 shrink-0 accent-[#1865F2]"
                    checked={selected.has(q.id)}
                    onChange={() =>
                      setSelected((prev) => {
                        const next = new Set(prev)
                        if (next.has(q.id)) next.delete(q.id)
                        else next.add(q.id)
                        return next
                      })
                    }
                  />
                  <div className="min-w-0 flex-1">
                    <QuestionPreview contentJson={q.contentJson} showExplanation />
                    <p className="mt-1 text-xs text-gray-400">난이도 Lv.{q.difficulty}</p>
                  </div>
                  <div className="flex shrink-0 flex-col gap-1">
                    <button
                      type="button"
                      onClick={() => act([q.id], 'verify')}
                      disabled={pending}
                      aria-label="검수 완료"
                      title="검수 완료"
                      className="flex h-11 w-11 items-center justify-center rounded-lg text-[#1FAF54] hover:bg-[#E8F7EE] disabled:opacity-40"
                    >
                      <Check className="h-5 w-5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => act([q.id], 'discard')}
                      disabled={pending}
                      aria-label="사용 안 함"
                      title="사용 안 함"
                      className="flex h-11 w-11 items-center justify-center rounded-lg text-gray-400 hover:bg-[#FDECEA] hover:text-[#D92916] disabled:opacity-40"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
