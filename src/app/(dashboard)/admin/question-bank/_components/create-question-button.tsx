'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import CreateQuestionModal from './create-question-modal'

export default function CreateQuestionButton() {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  function handleCreated() {
    setOpen(false)
    router.refresh()
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)} className="flex items-center gap-1.5">
        <Plus size={14} />
        문제 출제
      </Button>
      {open && (
        <CreateQuestionModal onClose={() => setOpen(false)} onCreated={handleCreated} />
      )}
    </>
  )
}
