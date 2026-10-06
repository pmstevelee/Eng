import { redirect } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import { getFlashcards, startWordSet } from '@/app/(dashboard)/student/words/_actions'
import { SpellClient } from './_components/spell-client'

interface Props {
  params: Promise<{ setId: string }>
  searchParams: Promise<{ from?: string }>
}

export default async function SpellPage({ params, searchParams }: Props) {
  const [{ setId }, { from }] = await Promise.all([params, searchParams])
  // 오늘의 단어학습에서 진입했으면 상단 링크도 오늘의 학습 허브로
  const hubHref = from === 'daily' ? '/student/daily-mission' : '/student/words'
  const hubLabel = from === 'daily' ? '오늘의 학습' : '단어 허브'
  // 플래시카드/리콜을 거치지 않고 스펠링을 바로 선택한 경우를 대비해 진도를 초기화한다.
  await startWordSet(setId)
  const result = await getFlashcards(setId, 'SPELL')

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
    cards: Parameters<typeof SpellClient>[0]['initialCards']
  }

  return (
    <div className="max-w-md mx-auto px-4 pt-4 pb-8">
      <div className="flex items-center gap-2 mb-6 shrink-0">
        <Link
          href={hubHref}
          className="flex items-center text-sm text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
          aria-label={`${hubLabel}(으)로 돌아가기`}
        >
          <ChevronLeft className="w-4 h-4" />
          {hubLabel}
        </Link>
        <span className="text-gray-300 text-sm">/</span>
        <span className="text-sm text-gray-400">스펠</span>
      </div>

      <SpellClient setId={setId} initialCards={cards} />
    </div>
  )
}
