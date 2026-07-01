'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { deleteOwnerWordSet } from '@/app/(dashboard)/owner/words/_actions/sets'

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
      const result = await deleteOwnerWordSet(setId)
      if (result.error) {
        setError(result.error)
        setConfirm(false)
      } else {
        router.push('/owner/words?tab=sets')
      }
    })
  }

  if (confirm) {
    return (
      <div className="flex flex-col items-end gap-2">
        <p className="text-sm text-gray-600">
          <span className="font-semibold text-[#D92916]">"{setTitle}"</span> 세트를 삭제하시겠습니까?
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setConfirm(false)}
            disabled={isPending}
            className="h-9"
          >
            취소
          </Button>
          <Button
            size="sm"
            onClick={handleDelete}
            disabled={isPending}
            className="h-9 bg-[#D92916] hover:bg-[#D92916]/90 text-white"
          >
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : '삭제'}
          </Button>
        </div>
        {error && <p className="text-xs text-[#D92916]">{error}</p>}
      </div>
    )
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => setConfirm(true)}
      className="h-9 text-[#D92916] border-[#D92916]/30 hover:bg-[#D92916]/5 shrink-0"
    >
      <Trash2 className="w-4 h-4 mr-1.5" />
      세트 삭제
    </Button>
  )
}
