'use client'

import { useState, useTransition } from 'react'
import {
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  Clock,
} from 'lucide-react'
import { gradeAnswer } from '../../actions'
import type { WrongAnswerItem, GradeResult } from '../../actions'

// ── 상수 ──────────────────────────────────────────────────────────────────────

const LETTERS = ['A', 'B', 'C', 'D'] as const

const DOMAIN_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  GRAMMAR: { label: '문법', color: '#1865F2', bg: '#EEF4FF' },
  VOCABULARY: { label: '어휘', color: '#7854F7', bg: '#F3F0FF' },
  READING: { label: '독해', color: '#0FBFAD', bg: '#EFFAF9' },
  WRITING: { label: '쓰기', color: '#E35C20', bg: '#FFF3EE' },
}

function formatWrongDate(isoString: string): string {
  const date = new Date(isoString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return '오늘'
  if (diffDays === 1) return '1일 전'
  if (diffDays < 7) return `${diffDays}일 전`
  if (diffDays < 14) return '1주 전'
  return `${Math.floor(diffDays / 7)}주 전`
}

function getSpacedLabel(isoString: string): { label: string; color: string } {
  const diffDays = Math.floor(
    (new Date().getTime() - new Date(isoString).getTime()) / (1000 * 60 * 60 * 24),
  )
  if (diffDays <= 1) return { label: '1일', color: '#D92916' }
  if (diffDays <= 3) return { label: '3일', color: '#FFB100' }
  if (diffDays <= 7) return { label: '7일', color: '#1865F2' }
  return { label: '7일+', color: '#7854F7' }
}

// ── 메인 컴포넌트 ──────────────────────────────────────────────────────────────

type Props = {
  items: WrongAnswerItem[]
}

type ItemState = {
  status: 'pending' | 'practicing' | 'correct' | 'wrong'
  selectedAnswer: string
  gradeResult: GradeResult | null
}

export function ReviewClient({ items }: Props) {
  const [itemStates, setItemStates] = useState<Record<string, ItemState>>(() => {
    const init: Record<string, ItemState> = {}
    for (const item of items) {
      init[item.questionId] = {
        status: 'pending',
        selectedAnswer: '',
        gradeResult: null,
      }
    }
    return init
  })

  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [pendingId, setPendingId] = useState<string | null>(null)

  // 표시할 항목 (맞춘 것 제외)
  const visibleItems = items.filter(
    (item) => itemStates[item.questionId]?.status !== 'correct',
  )
  const masteredCount = items.length - visibleItems.length

  function toggleExpand(id: string) {
    setExpandedId((prev) => (prev === id ? null : id))
    // 펼칠 때 상태 초기화 (다시 풀기)
    if (expandedId !== id) {
      setItemStates((prev) => ({
        ...prev,
        [id]: { status: 'practicing', selectedAnswer: '', gradeResult: null },
      }))
    }
  }

  function handleAnswer(questionId: string, answer: string) {
    setItemStates((prev) => ({
      ...prev,
      [questionId]: { ...prev[questionId], selectedAnswer: answer },
    }))
  }

  function handleSubmit(item: WrongAnswerItem) {
    const state = itemStates[item.questionId]
    if (!state?.selectedAnswer || isPending) return
    setPendingId(item.questionId)
    startTransition(async () => {
      const result = await gradeAnswer(item.questionId, state.selectedAnswer)
      setItemStates((prev) => ({
        ...prev,
        [item.questionId]: {
          ...prev[item.questionId],
          gradeResult: result,
          status: result.isCorrect ? 'correct' : 'wrong',
        },
      }))
      setPendingId(null)
      if (result.isCorrect) {
        setExpandedId(null)
      }
    })
  }

  function handleRetry(questionId: string) {
    setItemStates((prev) => ({
      ...prev,
      [questionId]: { status: 'practicing', selectedAnswer: '', gradeResult: null },
    }))
  }

  return (
    <div className="space-y-3">
      {/* 진행 현황 */}
      {masteredCount > 0 && (
        <div className="flex items-center gap-2 rounded-xl border border-[#86EFAC] bg-[#F0FDF4] px-4 py-2.5">
          <CheckCircle2 className="h-4 w-4 text-[#1FAF54]" />
          <p className="text-sm font-medium text-[#15803D]">
            {masteredCount}문제 완료 · {visibleItems.length}문제 남음
          </p>
        </div>
      )}

      {visibleItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#86EFAC] bg-[#F0FDF4] py-16 text-center">
          <div className="mb-3 text-4xl">🎉</div>
          <p className="text-sm font-bold text-[#15803D]">모든 오답을 완료했습니다!</p>
          <p className="mt-1 text-xs text-[#16A34A]">훌륭해요! 모든 문제를 맞췄습니다.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {visibleItems.map((item, idx) => {
            const state = itemStates[item.questionId]
            const domainCfg = DOMAIN_CONFIG[item.domain] ?? DOMAIN_CONFIG.GRAMMAR
            const spaced = getSpacedLabel(item.wrongAt)
            const isExpanded = expandedId === item.questionId
            const isThisPending = pendingId === item.questionId

            return (
              <div
                key={item.questionId}
                className={`overflow-hidden rounded-xl border transition-all ${
                  state.status === 'wrong'
                    ? 'border-[#FCA5A5]'
                    : 'border-gray-200'
                }`}
              >
                {/* 항목 헤더 */}
                <button
                  onClick={() => toggleExpand(item.questionId)}
                  className="flex w-full items-start gap-3 bg-white px-4 py-3.5 text-left hover:bg-gray-50"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-500">
                    {idx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
                        style={{ backgroundColor: domainCfg.color }}
                      >
                        {domainCfg.label}
                      </span>
                      <span
                        className="flex items-center gap-0.5 rounded-full border px-2 py-0.5 text-[10px] font-medium"
                        style={{ borderColor: spaced.color, color: spaced.color }}
                      >
                        <Clock className="h-2.5 w-2.5" />
                        {formatWrongDate(item.wrongAt)}
                      </span>
                    </div>
                    <p className="line-clamp-2 text-sm text-gray-700">
                      {item.content.question_text}
                    </p>
                  </div>
                  <div className="shrink-0 ml-2">
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-gray-400" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-gray-400" />
                    )}
                  </div>
                </button>

                {/* 확장 영역 */}
                {isExpanded && (
                  <div className="border-t border-gray-100 bg-gray-50 px-4 py-4">
                    {(item.content.type === 'multiple_choice' || (item.content.options && item.content.options.length > 0)) ? (
                      <MultipleChoiceReview
                        content={item.content}
                        answer={state.selectedAnswer}
                        onAnswer={(v) => handleAnswer(item.questionId, v)}
                        gradeResult={state.gradeResult}
                      />
                    ) : (
                      <FillBlankReview
                        content={item.content}
                        answer={state.selectedAnswer}
                        onAnswer={(v) => handleAnswer(item.questionId, v)}
                        gradeResult={state.gradeResult}
                      />
                    )}

                    {/* 피드백 */}
                    {state.gradeResult && (
                      <div
                        className="mt-3 rounded-xl border p-3.5"
                        style={{
                          backgroundColor: state.gradeResult.isCorrect ? '#F0FDF4' : '#FFF5F5',
                          borderColor: state.gradeResult.isCorrect ? '#86EFAC' : '#FCA5A5',
                        }}
                      >
                        <div className="flex items-start gap-2">
                          {state.gradeResult.isCorrect ? (
                            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#1FAF54]" />
                          ) : (
                            <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#D92916]" />
                          )}
                          <div className="flex-1">
                            <p
                              className="text-sm font-bold"
                              style={{
                                color: state.gradeResult.isCorrect ? '#1FAF54' : '#D92916',
                              }}
                            >
                              {state.gradeResult.isCorrect ? '정답입니다!' : '오답입니다'}
                            </p>
                            {!state.gradeResult.isCorrect && state.gradeResult.correctAnswer && (
                              <p className="mt-0.5 text-sm text-gray-700">
                                정답:{' '}
                                <span className="font-semibold text-[#1FAF54]">
                                  {state.gradeResult.correctAnswer}
                                </span>
                              </p>
                            )}
                            {state.gradeResult.explanation && (
                              <p className="mt-1 text-sm leading-relaxed text-gray-600">
                                {state.gradeResult.explanation}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 버튼 */}
                    <div className="mt-3">
                      {state.gradeResult === null ? (
                        <button
                          onClick={() => handleSubmit(item)}
                          disabled={!state.selectedAnswer || isThisPending}
                          className="h-11 w-full rounded-xl bg-[#D92916] text-sm font-semibold text-white transition-colors hover:bg-[#c4240f] disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {isThisPending ? '채점 중...' : '답변 제출'}
                        </button>
                      ) : state.status === 'wrong' ? (
                        <button
                          onClick={() => handleRetry(item.questionId)}
                          className="flex h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-[#D92916] text-sm font-medium text-[#D92916] transition-colors hover:bg-[#FFF5F5]"
                        >
                          다시 풀기
                        </button>
                      ) : null}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── 객관식 복습 ────────────────────────────────────────────────────────────────

function MultipleChoiceReview({
  content,
  answer,
  onAnswer,
  gradeResult,
}: {
  content: WrongAnswerItem['content']
  answer: string
  onAnswer: (v: string) => void
  gradeResult: GradeResult | null
}) {
  const options = content.options ?? []
  const isSubmitted = gradeResult !== null

  return (
    <div>
      {content.passage && (
        <div className="mb-3 max-h-36 overflow-y-auto rounded-xl border border-gray-200 bg-white p-3">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">지문</p>
          <p className="whitespace-pre-wrap text-xs leading-relaxed text-gray-700">
            {content.passage}
          </p>
        </div>
      )}
      <p className="mb-3 text-sm leading-relaxed text-gray-900">{content.question_text}</p>
      <div className="space-y-2">
        {options.map((opt, i) => {
          const letter = LETTERS[i] ?? String(i + 1)
          const isSelected = answer === letter
          const isCorrectOption = isSubmitted && gradeResult.correctAnswer?.toUpperCase() === letter
          const isWrongSelected = isSubmitted && isSelected && !gradeResult.isCorrect

          return (
            <button
              key={i}
              onClick={() => !isSubmitted && onAnswer(letter)}
              disabled={isSubmitted}
              className="flex w-full items-start gap-2.5 rounded-xl border p-3 text-left text-sm transition-all"
              style={
                isCorrectOption
                  ? { backgroundColor: '#F0FDF4', borderColor: '#86EFAC' }
                  : isWrongSelected
                  ? { backgroundColor: '#FFF5F5', borderColor: '#FCA5A5' }
                  : isSelected
                  ? { backgroundColor: '#EEF4FF', borderColor: '#BFDBFE' }
                  : { backgroundColor: 'white', borderColor: '#E5E7EB' }
              }
            >
              <span
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                style={
                  isCorrectOption
                    ? { backgroundColor: '#1FAF54', color: 'white' }
                    : isWrongSelected
                    ? { backgroundColor: '#D92916', color: 'white' }
                    : isSelected
                    ? { backgroundColor: '#1865F2', color: 'white' }
                    : { backgroundColor: '#F3F4F6', color: '#6B7280' }
                }
              >
                {letter}
              </span>
              <span className="text-gray-700">{opt}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── 빈칸 채우기 복습 ───────────────────────────────────────────────────────────

function FillBlankReview({
  content,
  answer,
  onAnswer,
  gradeResult,
}: {
  content: WrongAnswerItem['content']
  answer: string
  onAnswer: (v: string) => void
  gradeResult: GradeResult | null
}) {
  const isSubmitted = gradeResult !== null

  return (
    <div>
      <p className="mb-3 text-sm leading-relaxed text-gray-900">{content.question_text}</p>
      <input
        type="text"
        value={answer}
        onChange={(e) => !isSubmitted && onAnswer(e.target.value)}
        disabled={isSubmitted}
        placeholder="답을 입력하세요"
        className="h-11 w-full rounded-xl border border-gray-200 bg-white px-4 text-sm text-gray-900 outline-none transition-all focus:border-[#D92916] focus:ring-2 focus:ring-[#D92916]/20 disabled:bg-gray-50"
      />
    </div>
  )
}
