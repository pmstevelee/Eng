'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { deleteTeacherWordSet } from '@/app/(dashboard)/teacher/words/actions'

interface Props {
  setId: string
  setTitle: string
}

export function DeleteSetButton({ setId, setTitle }: Props) {
  const router = useRouter()
  const [confirm, setConfirm] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleDelete() {
    setError(null)
    startTransition(async () => {
      const result = await deleteTeacherWordSet(setId)
      if (result.error) {
        setError(result.error)
        setConfirm(false)
      } else {
        router.refresh()
      }
    })
  }

  if (confirm) {
    return (
      <div className="flex flex-col items-end gap-1.5">
        <div className="flex gap-2">
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
            onClick={handleDelete}
            disabled={isPending}
            className="h-8 text-xs bg-[#D92916] hover:bg-[#D92916]/90 text-white"
          >
            {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : '삭제 확인'}
          </Button>
        </div>
        {error && <p className="text-xs text-[#D92916]">{error}</p>}
      </div>
    )
  }

  return (
    <button
      onClick={() => setConfirm(true)}
      className="w-8 h-8 rounded-full flex items-center justify-center text-gray-300 hover:bg-[#D92916]/10 hover:text-[#D92916] transition-colors"
      title={`"${setTitle}" 세트 삭제`}
    >
      <Trash2 className="w-3.5 h-3.5" />
    </button>
  )
}
