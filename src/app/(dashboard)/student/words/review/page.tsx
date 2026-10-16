import { redirect } from 'next/navigation'
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

  // 빈 상태·헤더도 ReviewClient에서 그린다. 답안 기록 중 서버 재렌더(revalidate)로 남은 단어가 0개가 되어도
  // 같은 컴포넌트가 유지되어 진행 중인 복습·완료 화면이 사라지지 않는다.
  return <ReviewClient cards={reviewCards} fromDaily={fromDaily} />
}
