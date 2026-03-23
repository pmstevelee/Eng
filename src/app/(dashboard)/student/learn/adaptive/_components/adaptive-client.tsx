'use client'

import { PracticeSession } from '../../_components/practice-session'
import { gradeAnswer } from '../../actions'
import type { PracticeQuestion } from '../../actions'

type Props = {
  questions: PracticeQuestion[]
}

export function AdaptiveClient({ questions }: Props) {
  return <PracticeSession questions={questions} onGrade={gradeAnswer} />
}
