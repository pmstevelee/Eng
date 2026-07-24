'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, Loader2 } from 'lucide-react'
import { deleteOwnerWordTestAssignment } from '../../_actions/test'

interface Props {
  testId: string
  testTitle: string
  hasAttempts: boolean
}

export function DeleteTestButton({ testId, testTitle, hasAttempts }: Props) {
  const router = useRouter()
  const [confirm, setConfirm] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleDelete() {
    setError(null)
    startTransition(async () => {
      const result = await deleteOwnerWordTestAssignment(testId)
      if (result.error) {
        setError(result.error)
        return
      }
      setConfirm(false)
      router.refresh()
    })
  }

  if (confirm) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
        onClick={() => setConfirm(false)}
      >
        <div
          className="bg-white rounded-xl border border-gray-200 p-5 max-w-sm w-full"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-sm text-gray-700 mb-1">
            <span className="font-semibold text-[#D92916]">&ldquo;{testTitle}&rdquo;</span> 시험을 삭제하시겠습니까?
          </p>
          {hasAttempts && (
            <p className="text-xs text-[#D92916] mt-2">이미 응시한 학생의 결과도 함께 삭제됩니다.</p>
          )}
          {error && <p className="text-xs text-[#D92916] mt-2">{error}</p>}
          <div className="flex gap-2 justify-end mt-4">
            <button
              type="button"
              onClick={() => setConfirm(false)}
              disabled={isPending}
              className="h-9 px-4 rounded-md border border-gray-200 text-sm text-gray-600 hover:bg-gray-50"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={isPending}
              className="h-9 px-4 rounded-md bg-[#D92916] hover:bg-[#D92916]/90 text-white text-sm font-medium flex items-center gap-1.5"
            >
              {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              삭제
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => setConfirm(true)}
      className="h-9 w-9 flex items-center justify-center rounded-md border border-[#D92916]/30 text-[#D92916] hover:bg-[#D92916]/5 shrink-0"
    >
      <Trash2 className="w-3.5 h-3.5" />
    </button>
  )
}
