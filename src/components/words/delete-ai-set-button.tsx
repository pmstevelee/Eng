'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { deleteAiFlashcardSet } from '@/lib/words/ai-flashcard-actions'

interface Props {
  setId: string
  setTitle: string
  className?: string
}

/** AI 플래시카드 세트 삭제 버튼 (확인 후 삭제, 실패하면 사유 표시) */
export function DeleteAiSetButton({ setId, setTitle, className }: Props) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleDelete() {
    if (!window.confirm(`'${setTitle}' 세트를 삭제할까요?\n세트만 지워지고 학습 기록은 그대로 남습니다.`)) return
    setError(null)
    setPending(true)
    try {
      const res = await deleteAiFlashcardSet(setId)
      if (!res.ok) {
        setError(res.error)
        return
      }
      router.replace(res.redirectTo)
      router.refresh()
    } catch {
      setError('세트를 삭제하지 못했습니다. 잠시 후 다시 시도해주세요.')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className={className}>
      <Button
        type="button"
        variant="outline"
        onClick={handleDelete}
        disabled={pending}
        className="h-11 gap-1.5 border-red-200 text-accent-red hover:bg-red-50"
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
        세트 삭제
      </Button>
      {error && (
        <p role="alert" className="mt-2 text-sm text-accent-red">
          {error}
        </p>
      )}
    </div>
  )
}
