'use client'

// ② 포인트 추가 — 트리에서 체크해 배정 목록 끝에 붙인다 (이미 배정된 포인트는 고를 수 없음)
// 반 배정과 학생 개인 배정(학생 상세 '문법' 탭)이 같이 쓴다 — 저장은 onAssign이 한다

import { useState, useTransition } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { GrammarTreeCategory } from '@/lib/grammar/curriculum'
import { ManageDialog } from './manage-dialog'
import { PointPicker } from './point-picker'

interface Props {
  open: boolean
  onClose: () => void
  tree: GrammarTreeCategory[]
  assignedPointIds: Set<string>
  onAssign: (input: { pointIds: string[]; dueDate: string | null }) => Promise<AssignResult>
  onDone: (message: string) => void
  title?: string
  description?: string
}

export type AssignResult = { ok: true; added: number; skippedDuplicate: number } | { ok: false; error: string }

export function AddPointsDialog({
  open,
  onClose,
  tree,
  assignedPointIds,
  onAssign,
  onDone,
  title = '포인트 추가',
  description = '고른 순서대로 배정 목록 끝에 붙습니다.',
}: Props) {
  const [selected, setSelected] = useState<string[]>([])
  const [dueDate, setDueDate] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const submit = () => {
    setError(null)
    if (selected.length === 0) return setError('추가할 포인트를 골라 주세요.')
    startTransition(async () => {
      const res = await onAssign({ pointIds: selected, dueDate: dueDate || null })
      if (!res.ok) return setError(res.error)
      onDone(
        res.skippedDuplicate > 0
          ? `${res.added}개 포인트를 추가했어요. 이미 배정된 ${res.skippedDuplicate}개는 건너뛰었어요.`
          : `${res.added}개 포인트를 추가했어요.`,
      )
      setSelected([])
      setDueDate('')
      onClose()
    })
  }

  return (
    <ManageDialog open={open} onClose={onClose} busy={pending} title={title} description={description} className="max-w-2xl">
      <div className="space-y-4">
        <PointPicker tree={tree} selected={selected} onChange={setSelected} disabledIds={assignedPointIds} />
        <div className="sticky bottom-0 -mx-5 -mb-4 space-y-3 border-t border-gray-100 bg-white px-5 py-3">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label htmlFor="add-due">마감일 (선택)</Label>
              <Input
                id="add-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="mt-1 min-h-[44px] w-44"
              />
            </div>
            <p className="pb-3 text-sm text-gray-500">{selected.length}개 선택</p>
          </div>
          {error && <p className="text-sm text-[#D92916]">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" className="min-h-[44px]" onClick={onClose} disabled={pending}>
              취소
            </Button>
            <Button type="button" className="min-h-[44px]" onClick={submit} disabled={pending}>
              {pending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              {selected.length > 0 ? `${selected.length}개 추가` : '추가'}
            </Button>
          </div>
        </div>
      </div>
    </ManageDialog>
  )
}
