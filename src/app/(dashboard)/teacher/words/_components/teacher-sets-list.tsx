'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { deleteTeacherWordSets } from '../actions'
import { DeleteSetButton } from './delete-set-button'

const SOURCE_LABEL: Record<string, string> = {
  PUBLISHER: '시스템',
  TEACHER: '교사 제작',
  AI_GENERATED: 'AI 자동',
  OXFORD_3000: 'Oxford 3000',
  OXFORD_5000: 'Oxford 5000',
}

const CEFR_MAP: Record<number, string> = {
  1: 'Pre-A1', 2: 'A1', 3: 'A1+', 4: 'A2', 5: 'A2+',
  6: 'B1', 7: 'B1+', 8: 'B2', 9: 'B2+', 10: 'C1',
}

interface TeacherSet {
  id: string
  title: string
  cefrLevel: number
  source: string
  _count: { items: number; wordTestAssignments: number }
}

export function TeacherSetsList({ sets }: { sets: TeacherSet[] }) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirm, setConfirm] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const allSelected = sets.length > 0 && selected.size === sets.length

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(sets.map((s) => s.id)))
  }

  function handleBulkDelete() {
    setError(null)
    startTransition(async () => {
      const result = await deleteTeacherWordSets(Array.from(selected))
      if (result.error) {
        setError(result.error)
        setConfirm(false)
        return
      }
      if (result.skippedTitles && result.skippedTitles.length > 0) {
        setError(`시험에 출제된 세트는 삭제되지 않았습니다: ${result.skippedTitles.join(', ')}`)
      }
      setSelected(new Set())
      setConfirm(false)
      router.refresh()
    })
  }

  if (sets.length === 0) return null

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={toggleAll}
            className="w-4 h-4 rounded border-gray-300 accent-[#1865F2]"
          />
          전체 선택
        </label>
        {selected.size > 0 && (
          <div className="flex items-center gap-2">
            {confirm ? (
              <>
                <span className="text-xs text-gray-600">{selected.size}개 세트를 삭제할까요?</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setConfirm(false)}
                  disabled={isPending}
                  className="h-8 text-xs"
                >
                  취소
                </Button>
                <Button
                  size="sm"
                  onClick={handleBulkDelete}
                  disabled={isPending}
                  className="h-8 text-xs bg-[#D92916] hover:bg-[#D92916]/90 text-white"
                >
                  {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : '삭제 확인'}
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                onClick={() => setConfirm(true)}
                className="h-8 gap-1.5 text-xs bg-[#D92916] hover:bg-[#D92916]/90 text-white"
              >
                <Trash2 className="w-3.5 h-3.5" />
                선택 삭제 ({selected.size})
              </Button>
            )}
          </div>
        )}
      </div>

      {error && <p className="text-xs text-[#D92916] px-1">{error}</p>}

      {sets.map((set) => (
        <div
          key={set.id}
          className="rounded-xl border border-gray-200 bg-white px-5 py-4 flex items-center gap-4"
        >
          <input
            type="checkbox"
            checked={selected.has(set.id)}
            onChange={() => toggle(set.id)}
            className="w-4 h-4 rounded border-gray-300 accent-[#1865F2] shrink-0"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-xs font-medium text-[#7854F7] bg-[#7854F7]/10 px-2 py-0.5 rounded-full">
                {SOURCE_LABEL[set.source] ?? set.source}
              </span>
              <span className="text-xs text-gray-400">
                {CEFR_MAP[set.cefrLevel] ?? `Lv${set.cefrLevel}`}
              </span>
            </div>
            <p className="font-semibold text-gray-900 truncate">{set.title}</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {set._count.items}단어 · 시험 출제 {set._count.wordTestAssignments}회
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <DeleteSetButton setId={set.id} setTitle={set.title} />
            <Link href={`/teacher/words/sets/${set.id}`}>
              <Button variant="outline" size="sm" className="h-9 text-gray-600 border-gray-200">
                <Pencil className="w-3.5 h-3.5 mr-1" />
                보기
              </Button>
            </Link>
            <Link href={`/teacher/words/sets/${set.id}/test/new`}>
              <Button size="sm" className="h-9 bg-[#1865F2] hover:bg-[#1865F2]/90 text-white">
                <Plus className="w-3.5 h-3.5 mr-1" />
                시험 출제
              </Button>
            </Link>
          </div>
        </div>
      ))}
    </div>
  )
}
