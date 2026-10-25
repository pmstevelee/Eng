'use client'

// 연습 단계 — 문항마다 바로 정답·해설. 점수는 상태에 영향 없음(활동량만)

import { useEffect, useMemo, useState, useTransition } from 'react'
import { ChevronRight, PencilLine } from 'lucide-react'
import { FeedbackPanel, PracticeQuestionBody } from '@/app/(dashboard)/student/learn/_components/practice-session'
import type { PracticeQuestion } from '@/app/(dashboard)/student/learn/actions'
import { QuestionReportButton } from '@/components/grammar/question-report-button'
import { checkGrammarPracticeAnswer, submitGrammarPractice } from '../actions'
import { backupKey, clearBackup, readBackup, writeBackup, type BackupAnswer } from './local-backup'

interface Props {
  code: string
  studentId: string
  questions: PracticeQuestion[]
  onDone: () => void
}

type Graded = Required<Pick<BackupAnswer, 'answer' | 'isCorrect' | 'correctAnswer'>> & { explanation: string | null }

export function PracticeStep({ code, studentId, questions, onDone }: Props) {
  const ids = useMemo(() => questions.map((q) => q.id), [questions])
  const storageKey = backupKey(studentId, code, 'practice')
  const [graded, setGraded] = useState<Record<string, Graded>>({})
  const [index, setIndex] = useState(0)
  const [selected, setSelected] = useState('')
  const [readingTab, setReadingTab] = useState<'passage' | 'question'>('passage')
  const [error, setError] = useState('')
  const [isGrading, startGrading] = useTransition()
  const [isFinishing, startFinishing] = useTransition()

  // 중간에 나갔다 왔으면 백업한 풀이를 복원하고 첫 미풀이 문항으로 이동
  useEffect(() => {
    const saved = readBackup(storageKey, ids)
    const restored: Record<string, Graded> = {}
    for (const [id, a] of Object.entries(saved)) {
      if (typeof a.isCorrect === 'boolean' && typeof a.correctAnswer === 'string') {
        restored[id] = { answer: a.answer, isCorrect: a.isCorrect, correctAnswer: a.correctAnswer, explanation: a.explanation ?? null }
      }
    }
    setGraded(restored)
    const firstOpen = ids.findIndex((id) => !restored[id])
    setIndex(firstOpen === -1 ? Math.max(ids.length - 1, 0) : firstOpen)
    setSelected('')
  }, [storageKey, ids])

  if (questions.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-xl border border-gray-200 bg-white px-6 py-12 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#EEF4FF]">
          <PencilLine className="h-7 w-7 text-[#1865F2]" />
        </div>
        <h3 className="mt-4 text-lg font-bold text-gray-900">연습 문제를 준비하고 있어요</h3>
        <p className="mt-1 text-sm text-gray-500">바로 확인 테스트로 넘어갈 수 있어요.</p>
        <button
          type="button"
          onClick={onDone}
          className="mt-6 inline-flex min-h-[44px] items-center rounded-lg bg-[#1865F2] px-5 text-sm font-semibold text-white hover:bg-[#1558d6]"
        >
          확인 테스트로
        </button>
      </div>
    )
  }

  const question = questions[Math.min(index, questions.length - 1)]
  const current = graded[question.id]
  const answeredCount = ids.filter((id) => graded[id]).length
  const allDone = answeredCount === ids.length
  const isLast = index >= questions.length - 1

  function handleSubmit() {
    if (!selected || isGrading || current) return
    setError('')
    const answer = selected
    startGrading(async () => {
      const res = await checkGrammarPracticeAnswer(code, question.id, answer).catch(() => null)
      if (!res || !res.ok) {
        setError(res && !res.ok ? res.error : '채점하지 못했어요. 다시 눌러 주세요.')
        return
      }
      const next = {
        ...graded,
        [question.id]: { answer, isCorrect: res.isCorrect, correctAnswer: res.correctAnswer, explanation: res.explanation },
      }
      setGraded(next)
      writeBackup(storageKey, ids, next)
    })
  }

  function goTo(i: number) {
    setIndex(i)
    setSelected('')
    setReadingTab('passage')
    setError('')
  }

  function handleFinish() {
    setError('')
    startFinishing(async () => {
      const answers = ids.flatMap((id) => (graded[id] ? [{ questionId: id, answer: graded[id].answer }] : []))
      const res = await submitGrammarPractice(code, answers).catch(() => null)
      if (!res || !res.ok) {
        setError(res && !res.ok ? res.error : '저장하지 못했어요. 다시 눌러 주세요.')
        return
      }
      clearBackup(storageKey)
      onDone()
    })
  }

  const correctCount = ids.filter((id) => graded[id]?.isCorrect).length

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-1 flex items-center justify-between text-xs text-gray-500">
          <span>
            연습 {index + 1} / {questions.length}
          </span>
          <span>
            맞힌 문제 {correctCount} / {answeredCount}
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
          <div className="h-1.5 rounded-full bg-[#1865F2] transition-all" style={{ width: `${(answeredCount / questions.length) * 100}%` }} />
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="flex items-center justify-between gap-2 border-b border-gray-100 px-5 py-3">
          <span className="text-xs font-semibold text-[#1865F2]">문제 {index + 1}</span>
          <QuestionReportButton questionId={question.id} />
        </div>
        <div className="px-5 py-5">
          <PracticeQuestionBody
            key={question.id}
            question={question}
            answer={current ? current.answer : selected}
            onAnswer={setSelected}
            gradeResult={current ? { isCorrect: current.isCorrect, correctAnswer: current.correctAnswer, explanation: current.explanation } : null}
            readingTab={readingTab}
            onReadingTabChange={setReadingTab}
          />
          {current && (
            <FeedbackPanel result={{ isCorrect: current.isCorrect, correctAnswer: current.correctAnswer, explanation: current.explanation }} />
          )}
          {error && <p className="mt-3 text-sm text-[#D92916]">{error}</p>}
        </div>
        <div className="flex gap-2 border-t border-gray-100 px-5 py-4">
          {index > 0 && (
            <button
              type="button"
              onClick={() => goTo(index - 1)}
              className="h-11 rounded-lg border border-gray-200 px-4 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              이전
            </button>
          )}
          {!current ? (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!selected || isGrading}
              className="h-11 flex-1 rounded-lg bg-[#1865F2] text-sm font-semibold text-white hover:bg-[#1558d6] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isGrading ? '채점 중...' : '정답 확인'}
            </button>
          ) : !isLast ? (
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
              onClick={allDone ? handleFinish : () => goTo(ids.findIndex((id) => !graded[id]))}
              disabled={isFinishing}
              className="flex h-11 flex-1 items-center justify-center gap-1 rounded-lg bg-[#1865F2] text-sm font-semibold text-white hover:bg-[#1558d6] disabled:opacity-60"
            >
              {isFinishing ? '저장 중...' : allDone ? '연습 마치고 확인 테스트로' : '안 푼 문제로'}
              <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
