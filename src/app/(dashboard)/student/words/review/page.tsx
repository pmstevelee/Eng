import { redirect } from 'next/navigation'
import { RotateCcw } from 'lucide-react'
import Link from 'next/link'
import { requireStudent } from '@/lib/auth-student'
import { getDueWords } from '@/lib/words/progress'
import { canUseWordLearning } from '@/lib/words/access-guard'
import { ReviewClient } from './_components/review-client'

interface Props {
  searchParams: Promise<{ from?: string }>
}

export default async function ReviewPage({ searchParams }: Props) {
  const [{ studentId, user }, { from }] = await Promise.all([requireStudent(), searchParams])
  const fromDaily = from === 'daily'

  const academyId = user.academyId ?? null
  if (!academyId || !(await canUseWordLearning(academyId))) {
    redirect('/student/words')
  }

  const dueWords = await getDueWords(studentId, 50)

  if (dueWords.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-5 text-center px-4">
        <div className="w-20 h-20 rounded-full bg-[#1FAF54]/10 flex items-center justify-center">
          <span className="text-4xl">🎉</span>
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-1">오늘 복습 완료!</h2>
          <p className="text-sm text-gray-500">복습할 단어가 없어요. 내일 다시 확인해 보세요.</p>
        </div>
        <Link
          href={fromDaily ? '/student/daily-mission' : '/student/words'}
          className="inline-flex h-12 items-center gap-2 rounded-xl px-6 text-sm font-semibold text-white bg-[#7854F7] hover:bg-[#7854F7]/90 transition-colors"
        >
          {fromDaily ? '오늘의 학습으로' : '새 단어 시작하기'}
        </Link>
      </div>
    )
  }

  const reviewCards = dueWords.map((p) => ({
    progressId: p.id,
    wordId: p.wordId,
    correctCount: p.correctCount,
    stage: p.stage,
    word: {
      id: p.word.id,
      term: p.word.term,
      meaning: p.word.meaning,
      partOfSpeech: p.word.partOfSpeech,
      definition: p.word.definition,
      example: p.word.example,
      audioUrl: p.word.audioUrl,
      cefrLevel: p.word.cefrLevel,
    },
  }))

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#7854F7]">
          <RotateCcw className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">오늘 복습할 단어</h1>
          <p className="text-xs text-gray-500">{reviewCards.length}개 대기 중</p>
        </div>
      </div>

      <ReviewClient cards={reviewCards} />
    </div>
  )
}
