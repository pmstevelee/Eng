'use client'

import { useState, useTransition } from 'react'
import { PracticeSession } from '../../../_components/practice-session'
import { gradeAnswer, getDomainQuestions, savePracticeSession } from '../../../actions'
import type { PracticeQuestion, PracticeResultItem } from '../../../actions'

const DIFFICULTY_LABELS = [
  { value: 1, label: '쉬움' },
  { value: 2, label: '보통' },
  { value: 3, label: '어려움' },
] as const

type Props = {
  domain: string
  domainColor: string
  initialQuestions: PracticeQuestion[]
}

export function DomainClient({ domain, domainColor, initialQuestions }: Props) {
  const [difficulty, setDifficulty] = useState<1 | 2 | 3>(2)
  const [questions, setQuestions] = useState(initialQuestions)
  const [sessionKey, setSessionKey] = useState(0) // reset key
  const [isPending, startTransition] = useTransition()

  function handleDifficultyChange(newDifficulty: 1 | 2 | 3) {
    if (newDifficulty === difficulty || isPending) return
    startTransition(async () => {
      const next = await getDomainQuestions(domain, newDifficulty)
      setDifficulty(newDifficulty)
      setQuestions(next)
      setSessionKey((k) => k + 1)
    })
  }

  async function handleLoadMore(excludeIds: string[]): Promise<PracticeQuestion[]> {
    return getDomainQuestions(domain, difficulty, excludeIds)
  }

  function handleComplete(results: Array<{ questionId: string; domain: string; isCorrect: boolean }>) {
    const items: PracticeResultItem[] = results.map((r) => ({
      questionId: r.questionId,
      domain: r.domain,
      isCorrect: r.isCorrect,
    }))
    savePracticeSession({ mode: 'domain', domain: domain.toUpperCase(), results: items }).catch(() => {})
  }

  const header = (
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium text-gray-500">난이도</span>
      <div className="flex rounded-xl border border-gray-200 bg-white p-0.5">
        {DIFFICULTY_LABELS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => handleDifficultyChange(value as 1 | 2 | 3)}
            disabled={isPending}
            className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition-all disabled:opacity-60 ${
              difficulty === value
                ? 'text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            style={
              difficulty === value
                ? { backgroundColor: domainColor }
                : {}
            }
          >
            {isPending && difficulty !== value ? label : label}
          </button>
        ))}
      </div>
      {isPending && (
        <span className="text-xs text-gray-400">불러오는 중...</span>
      )}
    </div>
  )

  return (
    <PracticeSession
      key={sessionKey}
      questions={questions}
      onGrade={gradeAnswer}
      onLoadMore={handleLoadMore}
      onComplete={handleComplete}
      headerSlot={header}
    />
  )
}
