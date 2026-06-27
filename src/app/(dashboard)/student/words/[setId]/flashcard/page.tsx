import { redirect } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import { getFlashcards, startWordSet } from '@/app/(dashboard)/student/words/_actions'
import { FlashcardClient } from './_components/flashcard-client'

interface Props {
  params: Promise<{ setId: string }>
}

export default async function FlashcardPage({ params }: Props) {
  const { setId } = await params
  // 세트 진입 시 신규 단어의 학습 진도를 먼저 초기화한다.
  // (일일 한도 도달/이미 시작됨 등은 정상 흐름이므로 실패해도 그대로 진행)
  await startWordSet(setId)
  const result = await getFlashcards(setId, 'FLASHCARD')

  if (!result.ok) {
    if (result.error.code === 'FORBIDDEN' || result.error.code === 'NOT_FOUND') {
      redirect('/student/words')
    }
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 text-center px-4">
        <p className="text-gray-500">{result.error.message}</p>
        <Link href="/student/words" className="text-sm text-[#7854F7] underline underline-offset-4">
          단어 허브로 돌아가기
        </Link>
      </div>
    )
  }

  const { cards, totalWords, masteredWords } = result.data as {
    setId: string
    cards: Parameters<typeof FlashcardClient>[0]['initialCards']
    totalWords: number
    masteredWords: number
  }

  return (
    <div className="max-w-md mx-auto px-4 pt-4 pb-8">
      {/* 상단 네비게이션 */}
      <div className="flex items-center gap-2 mb-6">
        <Link
          href={`/student/words`}
          className="flex items-center text-sm text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
          aria-label="단어 허브로 돌아가기"
        >
          <ChevronLeft className="w-4 h-4" />
          단어 허브
        </Link>
      </div>

      <FlashcardClient
        setId={setId}
        initialCards={cards}
        totalWords={totalWords}
        masteredWords={masteredWords}
      />
    </div>
  )
}
