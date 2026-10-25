'use client'

// 확인 테스트 단계 — 끝까지 풀고 한꺼번에 채점 (풀이 중에는 정답을 보여 주지 않음)

import { useEffect, useMemo, useState, useTransition } from 'react'
import { ChevronLeft, ChevronRight, ClipboardCheck } from 'lucide-react'
import { PracticeQuestionBody } from '@/app/(dashboard)/student/learn/_components/practice-session'
import type { PracticeQuestion } from '@/app/(dashboard)/student/learn/actions'
import { QuestionReportButton } from '@/components/grammar/question-report-button'
import type { GrammarCheckResult } from '@/lib/grammar/unit-queries'
import { cn } from '@/lib/utils'
import { submitGrammarCheck } from '../actions'
import { backupKey, clearBackup, readBackup, writeBackup } from './local-backup'

interface Props {
  code: string
  studentId: string
  questions: PracticeQuestion[]
  passScore: number
  onResult: (result: GrammarCheckResult) => void
}

export function CheckStep({ code, studentId, questions, passScore, onResult }: Props) {
  const ids = useMemo(() => questions.map((q) => q.id), [questions])
  const storageKey = backupKey(studentId, code, 'check')
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [index, setIndex] = useState(0)
  const [readingTab, setReadingTab] = useState<'passage' | 'question'>('passage')
  const [error, setError] = useState('')
  const [isSubmitting, startSubmitting] = useTransition()

  useEffect(() => {
    const saved = readBackup(storageKey, ids)
    const restored: Record<string, string> = {}
    for (const [id, a] of Object.entries(saved)) if (a.answer) restored[id] = a.answer
    setAnswers(restored)
    const firstOpen = ids.findIndex((id) => !restored[id])
    setIndex(firstOpen === -1 ? 0 : firstOpen)
  }, [storageKey, ids])

  if (questions.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-xl border border-gray-200 bg-white px-6 py-12 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#EEF4FF]">
          <ClipboardCheck className="h-7 w-7 text-[#1865F2]" />
        </div>
        <h3 className="mt-4 text-lg font-bold text-gray-900">확인 테스트 문제를 준비하고 있어요</h3>
        <p className="mt-1 text-sm text-gray-500">문제가 준비되면 이 단원을 통과할 수 있어요.</p>
      </div>
    )
  }

  const question = questions[Math.min(index, questions.length - 1)]
  const answeredCount = ids.filter((id) => answers[id]).length
  const allAnswered = answeredCount === ids.length

  function setAnswer(value: string) {
    const next = { ...answers, [question.id]: value }
    if (!value) delete next[question.id]
    setAnswers(next)
    writeBackup(
      storageKey,
      ids,
      Object.fromEntries(Object.entries(next).map(([id, answer]) => [id, { answer }])),
    )
  }

  function goTo(i: number) {
    setIndex(Math.max(0, Math.min(i, questions.length - 1)))
    setReadingTab('passage')
  }

  function handleSubmit() {
    if (!allAnswered || isSubmitting) return
    setError('')
    startSubmitting(async () => {
      const res = await submitGrammarCheck(
        code,
        ids.map((id) => ({ questionId: id, answer: answers[id] ?? '' })),
      ).catch(() => null)
      if (!res || !res.ok) {
        setError(res && !res.ok ? res.error : '채점하지 못했어요. 다시 눌러 주세요.')
        return
      }
      clearBackup(storageKey)
      onResult(res.result)
    })
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-200 bg-white px-5 py-4">
        <p className="text-sm text-gray-700">
          {questions.length}문제를 모두 풀고 제출하면 한꺼번에 채점해요. <span className="font-semibold text-gray-900">{passScore}% 이상</span>이면
          통과예요.
        </p>
        <div className="mt-3 flex flex-wrap gap-2" aria-label="문항 이동">
          {questions.map((q, i) => (
            <button
              key={q.id}
              type="button"
              onClick={() => goTo(i)}
              aria-current={i === index ? 'step' : undefined}
              className={cn(
                'flex h-11 w-11 items-center justify-center rounded-lg border text-sm font-semibold',
                i === index
                  ? 'border-[#1865F2] bg-[#1865F2] text-white'
                  : answers[q.id]
                    ? 'border-[#1865F2] bg-[#EEF4FF] text-[#1865F2]'
                    : 'border-gray-200 text-gray-500 hover:bg-gray-50',
              )}
            >
              {i + 1}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="flex items-center justify-between gap-2 border-b border-gray-100 px-5 py-3">
          <span className="text-xs font-semibold text-[#1865F2]">
            문제 {index + 1} / {questions.length}
          </span>
          <QuestionReportButton questionId={question.id} />
        </div>
        <div className="px-5 py-5">
          <PracticeQuestionBody
            key={question.id}
            question={question}
            answer={answers[question.id] ?? ''}
            onAnswer={setAnswer}
            gradeResult={null}
            readingTab={readingTab}
            onReadingTabChange={setReadingTab}
          />
          {error && <p className="mt-3 text-sm text-[#D92916]">{error}</p>}
        </div>
        <div className="flex gap-2 border-t border-gray-100 px-5 py-4">
          <button
            type="button"
            onClick={() => goTo(index - 1)}
            disabled={index === 0}
            className="flex h-11 items-center gap-1 rounded-lg border border-gray-200 px-4 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
            이전
          </button>
          {index < questions.length - 1 ? (
            <button
              type="button"
              onClick={() => goTo(index + 1)}
              className="flex h-11 flex-1 items-center justify-center gap-1 rounded-lg bg-[#1865F2] text-sm font-semibold text-white hover:bg-[#1558d6]"
            >
              다음 문제
              <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={allAnswered ? handleSubmit : () => goTo(ids.findIndex((id) => !answers[id]))}
              disabled={isSubmitting}
              className="h-11 flex-1 rounded-lg bg-[#1865F2] text-sm font-semibold text-white hover:bg-[#1558d6] disabled:opacity-60"
            >
              {isSubmitting
                ? '채점 중...'
                : allAnswered
                  ? '제출하고 채점하기'
                  : `안 푼 문제 ${ids.length - answeredCount}개 풀기`}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
