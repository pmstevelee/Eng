'use client'

import { PracticeSession } from '../../_components/practice-session'
import { gradeAnswer, savePracticeSession } from '../../actions'
import type { PracticeQuestion, PracticeResultItem } from '../../actions'

type Props = {
  questions: PracticeQuestion[]
}

export function AdaptiveClient({ questions }: Props) {
  function handleComplete(results: Array<{ questionId: string; domain: string; isCorrect: boolean }>) {
    const items: PracticeResultItem[] = results.map((r) => ({
      questionId: r.questionId,
      domain: r.domain,
      isCorrect: r.isCorrect,
    }))
    savePracticeSession({ mode: 'adaptive', results: items }).catch(() => {})
  }

  return (
    <PracticeSession
      questions={questions}
      onGrade={gradeAnswer}
      onComplete={handleComplete}
    />
  )
}
