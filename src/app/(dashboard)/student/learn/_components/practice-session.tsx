'use client'

import { useState, useTransition } from 'react'
import { ChevronLeft, ChevronRight, CheckCircle2, XCircle, RotateCcw } from 'lucide-react'
import type { PracticeQuestion, GradeResult } from '../actions'

// ── 상수 ──────────────────────────────────────────────────────────────────────

const LETTERS = ['A', 'B', 'C', 'D'] as const

const DOMAIN_COLOR: Record<string, string> = {
  GRAMMAR: '#1865F2',
  VOCABULARY: '#7854F7',
  READING: '#0FBFAD',
  WRITING: '#E35C20',
}

const DOMAIN_LABEL: Record<string, string> = {
  GRAMMAR: '문법',
  VOCABULARY: '어휘',
  READING: '독해',
  WRITING: '쓰기',
}

// ── 타입 ──────────────────────────────────────────────────────────────────────

type PracticeResult = {
  questionId: string
  domain: string
  isCorrect: boolean
}

type Phase = 'answering' | 'feedback' | 'complete'

type Props = {
  questions: PracticeQuestion[]
  onGrade: (questionId: string, answer: string) => Promise<GradeResult>
  onLoadMore?: (excludeIds: string[]) => Promise<PracticeQuestion[]>
  onComplete?: (results: PracticeResult[]) => void
  headerSlot?: React.ReactNode
}

// ── 메인 컴포넌트 ──────────────────────────────────────────────────────────────

export function PracticeSession({ questions: initialQuestions, onGrade, onLoadMore, onComplete, headerSlot }: Props) {
  const [questions, setQuestions] = useState(initialQuestions)
  const [currentIdx, setCurrentIdx] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState('')
  const [gradeResult, setGradeResult] = useState<GradeResult | null>(null)
  const [results, setResults] = useState<PracticeResult[]>([])
  const [phase, setPhase] = useState<Phase>('answering')
  const [isPending, startTransition] = useTransition()
  const [readingTab, setReadingTab] = useState<'passage' | 'question'>('passage')

  const currentQuestion = questions[currentIdx]

  function handleSubmit() {
    if (!selectedAnswer || isPending) return
    startTransition(async () => {
      const result = await onGrade(currentQuestion.id, selectedAnswer)
      setGradeResult(result)
      setResults((prev) => [
        ...prev,
        { questionId: currentQuestion.id, domain: currentQuestion.domain, isCorrect: result.isCorrect },
      ])
      setPhase('feedback')
    })
  }

  function handleNext() {
    if (currentIdx < questions.length - 1) {
      setCurrentIdx((i) => i + 1)
      setSelectedAnswer('')
      setGradeResult(null)
      setPhase('answering')
      setReadingTab('passage')
    } else {
      setPhase('complete')
      onComplete?.(results)
    }
  }

  function handleLoadMore() {
    if (!onLoadMore) return
    startTransition(async () => {
      const usedIds = questions.map((q) => q.id)
      const newQuestions = await onLoadMore(usedIds)
      setQuestions(newQuestions)
      setCurrentIdx(0)
      setSelectedAnswer('')
      setGradeResult(null)
      setPhase('answering')
      setResults([])
      setReadingTab('passage')
    })
  }

  function handleRestart() {
    setCurrentIdx(0)
    setSelectedAnswer('')
    setGradeResult(null)
    setResults([])
    setPhase('answering')
    setReadingTab('passage')
  }

  if (questions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="mb-3 text-4xl">📚</div>
        <p className="text-sm font-medium text-gray-600">문제가 없습니다</p>
        <p className="mt-1 text-xs text-gray-400">현재 이 영역의 문제가 준비 중입니다.</p>
      </div>
    )
  }

  // ── 완료 화면 ──────────────────────────────────────────────────────────────
  if (phase === 'complete') {
    const correct = results.filter((r) => r.isCorrect).length
    const total = results.length
    const accuracy = Math.round((correct / total) * 100)

    // 영역별 집계
    const domainMap: Record<string, { correct: number; total: number }> = {}
    for (const r of results) {
      if (!domainMap[r.domain]) domainMap[r.domain] = { correct: 0, total: 0 }
      domainMap[r.domain].total++
      if (r.isCorrect) domainMap[r.domain].correct++
    }

    return (
      <div className="mx-auto max-w-md space-y-6 py-6">
        {/* 결과 요약 */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 text-center">
          <div className="mb-3 text-4xl">
            {accuracy >= 80 ? '🎉' : accuracy >= 60 ? '😊' : '💪'}
          </div>
          <h2 className="text-xl font-bold text-gray-900">학습 완료!</h2>
          <p
            className="mt-2 text-4xl font-black"
            style={{ color: accuracy >= 70 ? '#1FAF54' : '#D92916' }}
          >
            {correct} / {total}
          </p>
          <p className="mt-0.5 text-sm text-gray-500">정답 ({accuracy}%)</p>

          {/* 점수 바 */}
          <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-2 rounded-full transition-all"
              style={{
                width: `${accuracy}%`,
                backgroundColor: accuracy >= 70 ? '#1FAF54' : '#D92916',
              }}
            />
          </div>
        </div>

        {/* 영역별 결과 */}
        {Object.entries(domainMap).length > 0 && (
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h3 className="mb-3 text-sm font-semibold text-gray-700">영역별 결과</h3>
            <div className="space-y-2.5">
              {Object.entries(domainMap).map(([domain, stat]) => {
                const pct = Math.round((stat.correct / stat.total) * 100)
                const color = DOMAIN_COLOR[domain] ?? '#1865F2'
                return (
                  <div key={domain}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-gray-600">
                        {DOMAIN_LABEL[domain] ?? domain}
                      </span>
                      <span className="text-xs font-bold" style={{ color }}>
                        {stat.correct}/{stat.total} ({pct}%)
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                      <div
                        className="h-1.5 rounded-full"
                        style={{ width: `${pct}%`, backgroundColor: color }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* 액션 버튼 */}
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            onClick={handleRestart}
            className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
          >
            <RotateCcw className="h-4 w-4" />
            다시 풀기
          </button>
          {onLoadMore && (
            <button
              onClick={handleLoadMore}
              disabled={isPending}
              className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#1865F2] text-sm font-semibold text-white transition-colors hover:bg-[#1558d6] disabled:opacity-60"
            >
              {isPending ? '불러오는 중...' : '더 풀기'}
              <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    )
  }

  // ── 문제 풀이 화면 ──────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* 헤더 슬롯 (난이도 선택 등) */}
      {headerSlot}

      {/* 진행률 바 */}
      <div>
        <div className="mb-1 flex items-center justify-between text-xs text-gray-400">
          <span>진행</span>
          <span>
            {currentIdx + 1} / {questions.length}
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
          <div
            className="h-1.5 rounded-full bg-[#1865F2] transition-all"
            style={{ width: `${((currentIdx + 1) / questions.length) * 100}%` }}
          />
        </div>
      </div>

      {/* 문제 카드 */}
      <div className="rounded-xl border border-gray-200 bg-white">
        {/* 도메인 배지 + 문제 번호 */}
        <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-3">
          <span
            className="rounded-full px-2.5 py-0.5 text-xs font-semibold text-white"
            style={{ backgroundColor: DOMAIN_COLOR[currentQuestion.domain] ?? '#1865F2' }}
          >
            {DOMAIN_LABEL[currentQuestion.domain] ?? currentQuestion.domain}
          </span>
          <span className="text-xs text-gray-400">문제 {currentIdx + 1}</span>
          {'•'.repeat(Math.min(currentQuestion.difficulty, 3)).split('').map((_, i) => (
            <span key={i} className="text-xs" style={{ color: DOMAIN_COLOR[currentQuestion.domain] ?? '#1865F2' }}>
              ●
            </span>
          ))}
        </div>

        <div className="px-5 py-5">
          {/* 문제 렌더링 */}
          {currentQuestion.content.type === 'multiple_choice' && currentQuestion.content.passage ? (
            <ReadingQuestion
              content={currentQuestion.content}
              answer={selectedAnswer}
              onAnswer={setSelectedAnswer}
              readingTab={readingTab}
              onReadingTabChange={setReadingTab}
              gradeResult={gradeResult}
            />
          ) : currentQuestion.content.type === 'fill_blank' ||
            currentQuestion.content.type === 'short_answer' ? (
            <FillBlankQuestion
              content={currentQuestion.content}
              answer={selectedAnswer}
              onAnswer={setSelectedAnswer}
              gradeResult={gradeResult}
            />
          ) : currentQuestion.content.type === 'essay' ? (
            <EssayQuestion
              content={currentQuestion.content}
              answer={selectedAnswer}
              onAnswer={setSelectedAnswer}
              gradeResult={gradeResult}
            />
          ) : (
            <MultipleChoiceQuestion
              content={currentQuestion.content}
              answer={selectedAnswer}
              onAnswer={setSelectedAnswer}
              gradeResult={gradeResult}
            />
          )}

          {/* 즉시 피드백 패널 */}
          {phase === 'feedback' && gradeResult && (
            <FeedbackPanel result={gradeResult} />
          )}
        </div>

        {/* 하단 버튼 */}
        <div className="border-t border-gray-100 px-5 py-4">
          {phase === 'answering' ? (
            <button
              onClick={handleSubmit}
              disabled={!selectedAnswer || isPending}
              className="h-11 w-full rounded-xl bg-[#1865F2] text-sm font-semibold text-white transition-colors hover:bg-[#1558d6] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isPending ? '채점 중...' : '답변 제출'}
            </button>
          ) : (
            <div className="flex items-center justify-between gap-3">
              {currentIdx > 0 && (
                <button
                  onClick={() => {
                    setCurrentIdx((i) => i - 1)
                    setSelectedAnswer('')
                    setGradeResult(null)
                    setPhase('answering')
                  }}
                  className="flex h-11 items-center gap-1 rounded-xl border border-gray-200 px-4 text-sm font-medium text-gray-600 hover:bg-gray-50"
                >
                  <ChevronLeft className="h-4 w-4" />
                  이전
                </button>
              )}
              <button
                onClick={handleNext}
                className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#1865F2] text-sm font-semibold text-white transition-colors hover:bg-[#1558d6]"
              >
                {currentIdx < questions.length - 1 ? (
                  <>
                    다음 문제
                    <ChevronRight className="h-4 w-4" />
                  </>
                ) : (
                  '결과 보기'
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── 피드백 패널 ────────────────────────────────────────────────────────────────

function FeedbackPanel({ result }: { result: GradeResult }) {
  return (
    <div
      className="mt-4 rounded-xl border p-4"
      style={{
        backgroundColor: result.isCorrect ? '#F0FDF4' : '#FFF5F5',
        borderColor: result.isCorrect ? '#86EFAC' : '#FCA5A5',
      }}
    >
      <div className="flex items-start gap-2">
        {result.isCorrect ? (
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#1FAF54]" />
        ) : (
          <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#D92916]" />
        )}
        <div className="flex-1 min-w-0">
          <p
            className="text-sm font-bold"
            style={{ color: result.isCorrect ? '#1FAF54' : '#D92916' }}
          >
            {result.isCorrect ? '정답입니다!' : '오답입니다'}
          </p>
          {!result.isCorrect && result.correctAnswer && (
            <p className="mt-1 text-sm text-gray-700">
              정답:{' '}
              <span className="font-semibold text-[#1FAF54]">{result.correctAnswer}</span>
            </p>
          )}
          {result.explanation && (
            <p className="mt-1.5 text-sm leading-relaxed text-gray-600">
              {result.explanation}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

// ── 객관식 문제 ────────────────────────────────────────────────────────────────

function MultipleChoiceQuestion({
  content,
  answer,
  onAnswer,
  gradeResult,
}: {
  content: PracticeQuestion['content']
  answer: string
  onAnswer: (v: string) => void
  gradeResult: GradeResult | null
}) {
  const options = content.options ?? []
  const isSubmitted = gradeResult !== null

  return (
    <div>
      <p className="mb-5 text-base leading-relaxed text-gray-900">{content.question_text}</p>
      {content.question_text_ko && (
        <p className="mb-4 text-sm leading-relaxed text-gray-500">{content.question_text_ko}</p>
      )}
      <div className="space-y-2.5">
        {options.map((opt, i) => {
          const letter = LETTERS[i] ?? String(i + 1)
          const isSelected = answer === letter
          const isCorrectOption = isSubmitted && gradeResult.correctAnswer === letter
          const isWrongSelected = isSubmitted && isSelected && !gradeResult.isCorrect

          let className =
            'flex w-full items-start gap-3 rounded-xl border p-3.5 text-left transition-all'
          let style: React.CSSProperties = {}

          if (isCorrectOption) {
            className += ' border-[#1FAF54] bg-[#F0FDF4]'
          } else if (isWrongSelected) {
            className += ' border-[#D92916] bg-[#FFF5F5]'
          } else if (isSelected) {
            className += ' border-[#1865F2] bg-[#EEF4FF]'
          } else {
            className += ' border-gray-200 bg-white'
            if (!isSubmitted) {
              className += ' hover:border-gray-300 hover:bg-gray-50'
            }
          }

          return (
            <button
              key={i}
              onClick={() => !isSubmitted && onAnswer(letter)}
              disabled={isSubmitted}
              className={className}
              style={style}
            >
              <span
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold"
                style={
                  isCorrectOption
                    ? { backgroundColor: '#1FAF54', color: 'white' }
                    : isWrongSelected
                    ? { backgroundColor: '#D92916', color: 'white' }
                    : isSelected
                    ? { backgroundColor: '#1865F2', color: 'white' }
                    : { backgroundColor: '#F3F4F6', color: '#4B5563' }
                }
              >
                {letter}
              </span>
              <span
                className="mt-0.5 text-sm leading-relaxed"
                style={
                  isCorrectOption
                    ? { color: '#15803D', fontWeight: 500 }
                    : isWrongSelected
                    ? { color: '#D92916', fontWeight: 500 }
                    : isSelected
                    ? { color: '#1865F2', fontWeight: 500 }
                    : { color: '#374151' }
                }
              >
                {opt}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── 빈칸 채우기 문제 ───────────────────────────────────────────────────────────

function FillBlankQuestion({
  content,
  answer,
  onAnswer,
  gradeResult,
}: {
  content: PracticeQuestion['content']
  answer: string
  onAnswer: (v: string) => void
  gradeResult: GradeResult | null
}) {
  const isSubmitted = gradeResult !== null

  return (
    <div>
      <p className="mb-4 text-base leading-relaxed text-gray-900">{content.question_text}</p>
      {content.question_text_ko && (
        <p className="mb-4 text-sm leading-relaxed text-gray-500">{content.question_text_ko}</p>
      )}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-700">답변 입력</label>
        <input
          type="text"
          value={answer}
          onChange={(e) => !isSubmitted && onAnswer(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !isSubmitted && onAnswer(answer)}
          disabled={isSubmitted}
          placeholder="답을 입력하세요"
          className="h-11 w-full rounded-xl border border-gray-200 px-4 text-sm text-gray-900 outline-none transition-all focus:border-[#1865F2] focus:ring-2 focus:ring-[#1865F2]/20 disabled:bg-gray-50"
        />
      </div>
    </div>
  )
}

// ── 읽기 문제 ──────────────────────────────────────────────────────────────────

function ReadingQuestion({
  content,
  answer,
  onAnswer,
  gradeResult,
  readingTab,
  onReadingTabChange,
}: {
  content: PracticeQuestion['content']
  answer: string
  onAnswer: (v: string) => void
  gradeResult: GradeResult | null
  readingTab: 'passage' | 'question'
  onReadingTabChange: (tab: 'passage' | 'question') => void
}) {
  return (
    <div>
      {/* 모바일 탭 */}
      <div className="mb-4 flex rounded-xl border border-gray-200 p-1 sm:hidden">
        {(['passage', 'question'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => onReadingTabChange(tab)}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
              readingTab === tab
                ? 'bg-[#0FBFAD] text-white'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab === 'passage' ? '지문' : '문제'}
          </button>
        ))}
      </div>

      {/* 모바일 콘텐츠 */}
      <div className="sm:hidden">
        {readingTab === 'passage' && (
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
              지문
            </p>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-800">
              {content.passage}
            </p>
          </div>
        )}
        {readingTab === 'question' && (
          <MultipleChoiceQuestion
            content={content}
            answer={answer}
            onAnswer={onAnswer}
            gradeResult={gradeResult}
          />
        )}
      </div>

      {/* 데스크탑 분할 */}
      <div className="hidden sm:block">
        <div className="mb-4 max-h-52 overflow-y-auto rounded-xl border border-gray-200 bg-gray-50 p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">지문</p>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-800">
            {content.passage}
          </p>
        </div>
        <MultipleChoiceQuestion
          content={content}
          answer={answer}
          onAnswer={onAnswer}
          gradeResult={gradeResult}
        />
      </div>
    </div>
  )
}

// ── 에세이 문제 ────────────────────────────────────────────────────────────────

function EssayQuestion({
  content,
  answer,
  onAnswer,
  gradeResult,
}: {
  content: PracticeQuestion['content']
  answer: string
  onAnswer: (v: string) => void
  gradeResult: GradeResult | null
}) {
  const wordLimit = content.word_limit
  const charCount = answer.length
  const isOverLimit = wordLimit ? charCount > wordLimit : false
  const isSubmitted = gradeResult !== null

  return (
    <div>
      <p className="mb-2 text-base leading-relaxed text-gray-900">{content.question_text}</p>
      {content.question_text_ko && (
        <p className="mb-4 text-sm leading-relaxed text-gray-500">{content.question_text_ko}</p>
      )}
      {wordLimit && (
        <p className="mb-3 text-xs text-gray-500">최대 {wordLimit.toLocaleString()}자 이하로 작성하세요.</p>
      )}
      <div>
        <textarea
          value={answer}
          onChange={(e) => !isSubmitted && onAnswer(e.target.value)}
          disabled={isSubmitted}
          placeholder="답변을 작성하세요..."
          rows={6}
          className={`w-full resize-none rounded-xl border px-4 py-3 text-sm leading-relaxed text-gray-900 outline-none transition-all focus:ring-2 focus:ring-[#1865F2]/20 disabled:bg-gray-50 ${
            isOverLimit
              ? 'border-[#D92916] focus:border-[#D92916]'
              : 'border-gray-200 focus:border-[#1865F2]'
          }`}
        />
        <div className={`mt-1 text-right text-xs ${isOverLimit ? 'text-[#D92916]' : 'text-gray-400'}`}>
          {charCount.toLocaleString()}{wordLimit ? ` / ${wordLimit.toLocaleString()}자` : '자'}
        </div>
      </div>
    </div>
  )
}
