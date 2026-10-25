'use client'

// 오답노트 문항 카드 — 정답·해설 펼치기, 다시 풀기(채점만, 기록·복습 일정은 그대로)

import { useState, useTransition } from 'react'
import { CheckCircle2, RotateCcw, XCircle } from 'lucide-react'
import { FeedbackPanel, PracticeQuestionBody } from '@/app/(dashboard)/student/learn/_components/practice-session'
import type { GradeResult } from '@/app/(dashboard)/student/learn/actions'
import type { WrongNoteItem } from '@/lib/grammar/review-queries'
import { checkWrongNoteAnswer } from '../../review/actions'

export function WrongNoteCard({ item, number }: { item: WrongNoteItem; number: number }) {
  const [showAnswer, setShowAnswer] = useState(false)
  const [retrying, setRetrying] = useState(false)
  const [answer, setAnswer] = useState('')
  const [grade, setGrade] = useState<GradeResult | null>(null)
  const [readingTab, setReadingTab] = useState<'passage' | 'question'>('passage')
  const [error, setError] = useState('')
  const [isChecking, startChecking] = useTransition()

  function startRetry() {
    setRetrying(true)
    setShowAnswer(false)
    setAnswer('')
    setGrade(null)
    setError('')
  }

  function handleCheck() {
    if (!answer || isChecking) return
    setError('')
    startChecking(async () => {
      const res = await checkWrongNoteAnswer(item.questionId, answer).catch(() => null)
      if (!res || !res.ok) {
        setError(res && !res.ok ? res.error : '채점하지 못했어요. 다시 눌러 주세요.')
        return
      }
      setGrade({ isCorrect: res.isCorrect, correctAnswer: res.correctAnswer, explanation: res.explanation })
    })
  }

  return (
    <li className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium leading-relaxed text-gray-900">
          {number}. {item.questionText}
        </p>
        <span
          className={
            item.isMastered
              ? 'shrink-0 rounded-full bg-[#E8F7EE] px-2.5 py-0.5 text-xs font-semibold text-[#15803D]'
              : 'shrink-0 rounded-full bg-[#FDECEA] px-2.5 py-0.5 text-xs font-semibold text-[#D92916]'
          }
        >
          {item.isMastered ? '해결됨' : `${item.wrongCount}번 틀림`}
        </span>
      </div>

      {retrying && item.question ? (
        <div className="mt-4 rounded-lg border border-gray-100 p-4">
          <PracticeQuestionBody
            question={item.question}
            answer={answer}
            onAnswer={(v) => !grade && setAnswer(v)}
            gradeResult={grade}
            readingTab={readingTab}
            onReadingTabChange={setReadingTab}
          />
          {grade && <FeedbackPanel result={grade} />}
          {error && <p className="mt-3 text-sm text-[#D92916]">{error}</p>}
          <div className="mt-4 flex gap-2">
            {grade ? (
              <button
                type="button"
                onClick={startRetry}
                className="h-11 flex-1 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                한 번 더 풀기
              </button>
            ) : (
              <button
                type="button"
                onClick={handleCheck}
                disabled={!answer || isChecking}
                className="h-11 flex-1 rounded-lg bg-[#1865F2] text-sm font-semibold text-white hover:bg-[#1558d6] disabled:opacity-50"
              >
                {isChecking ? '채점 중...' : '정답 확인'}
              </button>
            )}
            <button
              type="button"
              onClick={() => setRetrying(false)}
              className="h-11 rounded-lg border border-gray-200 px-4 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              닫기
            </button>
          </div>
          <p className="mt-2 text-xs text-gray-500">다시 풀기는 연습이에요. 복습 일정은 &lsquo;복습&rsquo; 탭에서 풀 때 바뀌어요.</p>
        </div>
      ) : (
        <>
          {item.myAnswer && (
            <p className="mt-2 flex items-start gap-1.5 text-sm text-[#B42318]">
              <XCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>내 답: {item.myAnswer}</span>
            </p>
          )}
          {showAnswer && (
            <>
              {item.correctAnswer && (
                <p className="mt-1 flex items-start gap-1.5 text-sm font-medium text-[#15803D]">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  <span>정답: {item.correctAnswer}</span>
                </p>
              )}
              {item.explanation && (
                <p className="mt-2 rounded-lg bg-gray-50 px-3 py-2 text-sm leading-relaxed text-gray-700">{item.explanation}</p>
              )}
            </>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setShowAnswer((v) => !v)}
              aria-expanded={showAnswer}
              className="min-h-[44px] rounded-lg border border-gray-200 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              {showAnswer ? '정답·해설 접기' : '정답·해설 보기'}
            </button>
            {item.question && (
              <button
                type="button"
                onClick={startRetry}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg bg-[#1865F2] px-4 text-sm font-semibold text-white hover:bg-[#1558d6]"
              >
                <RotateCcw className="h-4 w-4" aria-hidden />
                다시 풀기
              </button>
            )}
          </div>
        </>
      )}
    </li>
  )
}
