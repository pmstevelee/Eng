import { redirect } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import { getFlashcards } from '@/app/(dashboard)/student/words/_actions'
import { RecallClient } from './_components/recall-client'

interface Props {
  params: Promise<{ setId: string }>
}

export default async function RecallPage({ params }: Props) {
  const { setId } = await params
  const result = await getFlashcards(setId, 'RECALL')

  if (!result.ok) {
    if (result.error.code === 'FORBIDDEN' || result.error.code === 'NOT_FOUND') {
      redirect('/student/words')
    }
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 text-center px-4">
        <p className="text-gray-500">{result.error.message}</p>
        <Link href="/student/words" className="text-sm text-[#1865F2] underline underline-offset-4">
          단어 허브로 돌아가기
        </Link>
      </div>
    )
  }

  const { cards } = result.data as {
    setId: string
    cards: Parameters<typeof RecallClient>[0]['initialCards']
  }

  return (
    <div className="max-w-md mx-auto px-4 pt-4 pb-8">
      <div className="flex items-center gap-2 mb-6">
        <Link
          href={`/student/words`}
          className="flex items-center text-sm text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
          aria-label="단어 허브로 돌아가기"
        >
          <ChevronLeft className="w-4 h-4" />
          단어 허브
        </Link>
        <span className="text-gray-300 text-sm">/</span>
        <span className="text-sm text-gray-400">리콜</span>
      </div>

      <RecallClient setId={setId} initialCards={cards} />
    </div>
  )
}
