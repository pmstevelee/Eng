'use client'

// ③ 배정 날짜 수정 — 시작일·마감일 (비우면 날짜 없음)

import { useEffect, useState, useTransition } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { updateClassAssignmentDates } from '@/lib/grammar/manage-actions'
import { ManageDialog } from './manage-dialog'

export interface DateTarget {
  assignmentId: string
  title: string
  startKey: string | null
  dueKey: string | null
}

export function AssignmentDateDialog({ target, onClose, onDone }: { target: DateTarget | null; onClose: () => void; onDone: (m: string) => void }) {
  const [start, setStart] = useState('')
  const [due, setDue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    setStart(target?.startKey ?? '')
    setDue(target?.dueKey ?? '')
    setError(null)
  }, [target])

  const submit = () => {
    if (!target) return
    setError(null)
    if (start && due && due < start) return setError('마감일은 시작일보다 빠를 수 없습니다.')
    startTransition(async () => {
      const res = await updateClassAssignmentDates(target.assignmentId, { startDate: start || null, dueDate: due || null })
      if (!res.ok) return setError(res.error)
      onDone(`'${target.title}' 날짜를 바꿨어요.`)
      onClose()
    })
  }

  return (
    <ManageDialog open={target !== null} onClose={onClose} busy={pending} title="날짜 수정" description={target?.title} className="max-w-md">
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="date-start">시작일</Label>
            <Input id="date-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} className="mt-1 min-h-[44px]" />
          </div>
          <div>
            <Label htmlFor="date-due">마감일</Label>
            <Input id="date-due" type="date" value={due} onChange={(e) => setDue(e.target.value)} className="mt-1 min-h-[44px]" />
          </div>
        </div>
        <p className="text-xs text-gray-500">시작일 전에는 학생 화면에 보이지 않아요. 비워 두면 날짜 없이 배정됩니다.</p>
        {error && <p className="text-sm text-[#D92916]">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" className="min-h-[44px]" onClick={onClose} disabled={pending}>
            취소
          </Button>
          <Button type="button" className="min-h-[44px]" onClick={submit} disabled={pending}>
            {pending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            저장
          </Button>
        </div>
      </div>
    </ManageDialog>
  )
}
