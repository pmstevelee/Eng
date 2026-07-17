'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { BookOpen } from 'lucide-react'
import { createOwnerSupplementarySet } from '@/app/(dashboard)/owner/words/_actions/test'

interface Props {
  assignmentId: string
  studentId: string
  studentName: string
}

export function SupplementaryButton({ assignmentId, studentId, studentName }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleClick() {
    setError(null)
    startTransition(async () => {
      const result = await createOwnerSupplementarySet(assignmentId, studentId)
      if (result.error) {
        setError(result.error)
        return
      }
      router.push(`/owner/words/sets/${result.setId}`)
    })
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        size="sm"
        variant="outline"
        onClick={handleClick}
        disabled={isPending}
        className="text-xs h-8"
      >
        <BookOpen className="w-3 h-3 mr-1" />
        {isPending ? '생성 중...' : '보충 세트 생성'}
      </Button>
      {error && <p className="text-xs text-[#D92916]">{error}</p>}
    </div>
  )
}
