'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { RotateCcw } from 'lucide-react'
import { retakeWrong } from '@/app/(dashboard)/student/words/_actions'

interface Props {
  testId: string
  wrongCount: number
}

export function RetakeWrongButton({ testId, wrongCount }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleClick() {
    setError(null)
    startTransition(async () => {
      const result = await retakeWrong(testId)
      if (!result.ok) {
        setError(result.error.message)
        return
      }
      const data = result.data as { setId?: string; message?: string }
      if (data.setId) {
        router.push(`/student/words/${data.setId}/flashcard`)
      }
    })
  }

  return (
    <div className="space-y-2">
      <Button
        onClick={handleClick}
        disabled={isPending}
        className="w-full h-12 rounded-xl bg-[#7854F7] hover:bg-[#7854F7]/90 text-white font-semibold"
      >
        <RotateCcw className="w-4 h-4 mr-2" />
        {isPending ? '복습 준비 중...' : `오답 ${wrongCount}개 모아 복습하기`}
      </Button>
      {error && <p className="text-xs text-[#D92916] text-center">{error}</p>}
    </div>
  )
}
