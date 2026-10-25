'use client'

// 복습 퀴즈 — 포인트 복습(5문항)·문항 복습(오답노트 만기분) 공용
// 끝까지 풀고 한꺼번에 채점한다 (풀이 중에는 정답을 보여 주지 않음)

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CheckCircle2, ChevronLeft, ChevronRight, XCircle } from 'lucide-react'
import { PracticeQuestionBody } from '@/app/(dashboard)/student/learn/_components/practice-session'
import type { PracticeQuestion } from '@/app/(dashboard)/student/learn/actions'
import { QuestionReportButton } from '@/components/grammar/question-report-button'
import { GrammarStateBadge } from '@/components/grammar/grammar-state-badge'
import type { GrammarReviewResult } from '@/lib/grammar/review-queries'
import { cn } from '@/lib/utils'
import { submitGrammarReview, submitQuestionReview } from '../actions'

type Mode = { kind: 'point'; code: string } | { kind: 'questions'; groupKey: string; remaining: number }

interface Props {
  mode: Mode
  questions: PracticeQuestion[]
  intro: string
}

export function ReviewQuiz({ mode, questions, intro }: Props) {
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [index, setIndex] = useState(0)
  const [readingTab, setReadingTab] = useState<'passage' | 'question'>('passage')
  const [error, setError] = useState('')
  const [result, setResult] = useState<GrammarReviewResult | null>(null)
  const [isSubmitting, startSubmitting] = useTransition()

  if (result) return <ReviewResultView result={result} mode={mode} />

  const ids = questions.map((q) => q.id)
  const question = questions[Math.min(index, questions.length - 1)]
  const answeredCount = ids.filter((id) => answers[id]).length
  const allAnswered = answeredCount === ids.length

  function setAnswer(value: string) {
    setAnswers((prev) => {
      const next = { ...prev, [question.id]: value }
      if (!value) delete next[question.id]
      return next
    })
  }

  function goTo(i: number) {
    setIndex(Math.max(0, Math.min(i, questions.length - 1)))
    setReadingTab('passage')
  }

  function handleSubmit() {
    if (!allAnswered || isSubmitting) return
    setError('')
    const payload = ids.map((id) => ({ questionId: id, answer: answers[id] ?? '' }))
    startSubmitting(async () => {
      const res = await (mode.kind === 'point' ? submitGrammarReview(mode.code, payload) : submitQuestionReview(payload)).catch(
        () => null,
      )
      if (!res || !res.ok) {
        setError(res && !res.ok ? res.error : '채점하지 못했어요. 다시 눌러 주세요.')
        return
      }
      setResult(res.result)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    })
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-200 bg-white px-5 py-4">
        <p className="text-sm text-gray-700">{intro}</p>
        <div className="mt-3 flex flex-wrap gap-2" aria-label="문항 이동">
          {questions.map((q, i) => (
            <button
              key={q.id}
              type="button"
              onClick={() => goTo(i)}
              aria-current={i === index ? 'step' : undefined}
              aria-label={`${i + 1}번 문제${answers[q.id] ? ' (답함)' : ''}`}
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

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', timeZone: 'Asia/Seoul' })
}

function pointMessage(p: NonNullable<GrammarReviewResult['point']>): string {
  if (p.state === 'MASTERED') return '숙달했어요! 이 단원은 이제 복습하지 않아도 돼요.'
  if (p.state === 'WEAK') return '취약 단원으로 표시됐어요. 단원에서 개념을 다시 보고 확인 테스트를 통과해 주세요.'
  if (p.passed) {
    const left = Math.max(0, p.masteryReviewStreak - p.reviewStreak)
    const next = p.nextReviewAt ? ` 다음 복습은 ${formatDate(p.nextReviewAt)}이에요.` : ''
    return `숙달까지 복습 통과 ${left}번 남았어요.${next}`
  }
  return p.nextReviewAt ? `조금 더 연습이 필요해요. ${formatDate(p.nextReviewAt)}에 다시 복습해요.` : '조금 더 연습이 필요해요.'
}

function ReviewResultView({ result, mode }: { result: GrammarReviewResult; mode: Mode }) {
  const router = useRouter()
  const wrong = result.items.filter((i) => !i.isCorrect)
  const p = result.point
  const good = p ? p.passed : result.correctCount === result.totalCount
  const color = good ? '#1FAF54' : p && p.state === 'WEAK' ? '#D92916' : '#1865F2'

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-200 bg-white p-6 text-center">
        <p className="text-sm font-semibold" style={{ color }}>
          {p ? (p.passed ? '복습 통과!' : '복습 결과') : '복습 결과'}
        </p>
        <p className="mt-2 text-5xl font-black" style={{ color }}>
          {result.score}
          <span className="text-2xl">점</span>
        </p>
        <p className="mt-1 text-sm text-gray-500">
          {result.totalCount}문제 중 {result.correctCount}개 정답{p ? ` · 통과 기준 ${p.passScore}%` : ''}
        </p>
        {p && (
          <>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <GrammarStateBadge state={p.state} />
              {p.xpEarned > 0 && (
                <span className="rounded-full bg-[#FFF4D6] px-2.5 py-0.5 text-xs font-semibold text-[#9A6700]">+{p.xpEarned} XP</span>
              )}
            </div>
            <p className={cn('mt-3 text-sm', p.state === 'WEAK' ? 'text-[#B42318]' : 'text-gray-600')}>{pointMessage(p)}</p>
          </>
        )}
        {!p && (
          <p className="mt-3 text-sm text-gray-600">
            맞힌 문제는 다음 복습 날짜로 미뤄지고, 2번 연속 맞히면 오답노트에서 해결돼요. 틀린 문제는 내일 다시 나와요.
          </p>
        )}
      </div>

      {wrong.length > 0 && (
        <section className="rounded-xl border border-gray-200 bg-white p-5">
          <h3 className="text-base font-bold text-gray-900">틀린 문제 해설 ({wrong.length})</h3>
          <ul className="mt-3 space-y-3">
            {wrong.map((item, i) => (
              <li key={item.questionId} className="rounded-lg border border-gray-200 p-4">
                <p className="text-sm font-medium text-gray-900">
                  {i + 1}. {item.questionText}
                </p>
                <p className="mt-2 flex items-start gap-1.5 text-sm text-[#B42318]">
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  <span>내 답: {item.myAnswer}</span>
                </p>
                <p className="mt-1 flex items-start gap-1.5 text-sm font-medium text-[#15803D]">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  <span>정답: {item.correctAnswer}</span>
                </p>
                {item.explanation && (
                  <p className="mt-2 rounded-lg bg-gray-50 px-3 py-2 text-sm leading-relaxed text-gray-700">{item.explanation}</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        {mode.kind === 'questions' && mode.remaining > 0 ? (
          <button
            type="button"
            onClick={() => router.refresh()}
            className="h-11 flex-1 rounded-lg bg-[#1865F2] text-sm font-semibold text-white hover:bg-[#1558d6]"
          >
            남은 {mode.remaining}문제 이어서 풀기
          </button>
        ) : (
          <Link
            href="/student/grammar/review"
            className="flex h-11 flex-1 items-center justify-center rounded-lg bg-[#1865F2] text-sm font-semibold text-white hover:bg-[#1558d6]"
          >
            복습 목록으로
          </Link>
        )}
        {mode.kind === 'point' && p?.state === 'WEAK' ? (
          <Link
            href={`/student/grammar/${encodeURIComponent(mode.code)}`}
            className="flex h-11 flex-1 items-center justify-center rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            단원 다시 학습하기
          </Link>
        ) : (
          <Link
            href="/student/grammar/wrong-notes"
            className="flex h-11 flex-1 items-center justify-center rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            오답노트 보기
          </Link>
        )}
      </div>
    </div>
  )
}
