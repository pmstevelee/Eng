'use client'

import { useState, useCallback, useTransition, useRef } from 'react'
import { ChevronRight, Loader2, BookOpen, PenLine, AlertCircle } from 'lucide-react'
import type { QuestionContentJson } from '@/components/shared/question-bank-client'
import {
  startAdaptiveSession,
  submitAdaptiveAnswer,
  submitWritingAnswer,
} from '../adaptive-actions'
import type { AdaptiveNextResult } from '../adaptive-actions'
import type { AdaptiveDomain, QuestionHistoryItem } from '@/lib/assessment/adaptive-test-engine'
import { useRouter } from 'next/navigation'

// ─── 상수 ─────────────────────────────────────────────────────────────────────

const DOMAIN_COLOR: Record<AdaptiveDomain, string> = {
  GRAMMAR: '#1865F2',
  VOCABULARY: '#7854F7',
  READING: '#0FBFAD',
  WRITING: '#E35C20',
}

const DOMAIN_LABEL: Record<AdaptiveDomain, string> = {
  GRAMMAR: '문법',
  VOCABULARY: '어휘',
  READING: '읽기',
  WRITING: '쓰기',
}

const DOMAIN_ORDER: AdaptiveDomain[] = ['GRAMMAR', 'VOCABULARY', 'READING', 'WRITING']

const LETTERS = ['A', 'B', 'C', 'D', 'E']

// ─── 타입 ─────────────────────────────────────────────────────────────────────

type Props = {
  sessionId: string
  studentName: string
  testTitle: string
}

type Phase = 'intro' | 'loading' | 'question' | 'writing' | 'complete' | 'error'

type CurrentQuestion = {
  questionId: string
  domain: AdaptiveDomain
  difficulty: number
  contentJson: QuestionContentJson
  domainQuestionIndex: number
  domainTotalEstimate: number
  domainOrder: AdaptiveDomain[]
  estimatedLevel: number
}

type WritingState = {
  promptText: string
  wordRange: string
  questionIndex: number
  isLastQuestion: boolean
  estimatedLevel: number
}

// ─── 난이도 별 표시 ────────────────────────────────────────────────────────────

function DifficultyStars({ n, max = 10 }: { n: number; max?: number }) {
  return (
    <span className="text-xs text-amber-400 tracking-tight">
      {'★'.repeat(Math.min(n, max))}
      {'☆'.repeat(Math.max(0, max - n))}
    </span>
  )
}

// ─── 영역 진행 표시 ────────────────────────────────────────────────────────────

function DomainProgressBar({
  currentDomain,
  domainOrder,
  history,
}: {
  currentDomain: AdaptiveDomain
  domainOrder: AdaptiveDomain[]
  history: QuestionHistoryItem[]
}) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto">
      {domainOrder.map((domain, idx) => {
        const domainHistory = history.filter((h) => h.domain === domain)
        const isDone = domainOrder.indexOf(currentDomain) > idx
        const isCurrent = domain === currentDomain
        const color = DOMAIN_COLOR[domain]

        return (
          <div key={domain} className="flex items-center gap-1">
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap"
              style={
                isCurrent
                  ? { backgroundColor: color, color: 'white' }
                  : isDone
                    ? { backgroundColor: `${color}20`, color }
                    : { backgroundColor: '#F3F4F6', color: '#9CA3AF' }
              }
            >
              {isDone && <span>✓</span>}
              {DOMAIN_LABEL[domain]}
              {isCurrent && domainHistory.length > 0 && (
                <span className="opacity-75">
                  {domainHistory.length}
                </span>
              )}
            </div>
            {idx < domainOrder.length - 1 && (
              <ChevronRight className="h-3 w-3 text-gray-300 shrink-0" />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── 객관식 렌더러 ─────────────────────────────────────────────────────────────

function MultipleChoiceQuestion({
  content,
  selectedAnswer,
  onSelect,
}: {
  content: QuestionContentJson
  selectedAnswer: string
  onSelect: (v: string) => void
}) {
  if (content.type !== 'multiple_choice' || !content.options) return null

  return (
    <div className="space-y-2.5">
      {content.options.map((opt, i) => {
        const letter = LETTERS[i]
        const isSelected = selectedAnswer === letter || selectedAnswer === opt
        return (
          <button
            key={i}
            onClick={() => onSelect(letter)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-sm text-left transition-all min-h-[44px] ${
              isSelected
                ? 'border-[#1865F2] bg-[#1865F2]/5 text-[#1865F2] font-medium'
                : 'border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50'
            }`}
          >
            <span
              className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border ${
                isSelected
                  ? 'bg-[#1865F2] text-white border-[#1865F2]'
                  : 'border-gray-300 text-gray-500'
              }`}
            >
              {letter}
            </span>
            <span>{opt}</span>
          </button>
        )
      })}
    </div>
  )
}

// ─── 빈칸/단답형 렌더러 ────────────────────────────────────────────────────────

function ShortAnswerQuestion({
  content,
  answer,
  onChange,
}: {
  content: QuestionContentJson
  answer: string
  onChange: (v: string) => void
}) {
  return (
    <input
      type="text"
      value={answer}
      onChange={(e) => onChange(e.target.value)}
      placeholder="정답을 입력하세요"
      className="w-full h-11 px-4 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1865F2]/30 focus:border-[#1865F2]"
      autoFocus
    />
  )
}

// ─── 메인 컴포넌트 ─────────────────────────────────────────────────────────────

export function AdaptiveTestClient({ sessionId, studentName, testTitle }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [phase, setPhase] = useState<Phase>('intro')
  const [currentQuestion, setCurrentQuestion] = useState<CurrentQuestion | null>(null)
  const [writingState, setWritingState] = useState<WritingState | null>(null)
  const [history, setHistory] = useState<QuestionHistoryItem[]>([])
  const [answer, setAnswer] = useState('')
  const [writingAnswer, setWritingAnswer] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [loadingMsg, setLoadingMsg] = useState('')

  const totalQuestionsRef = useRef(0)

  // ── 채점 헬퍼 ────────────────────────────────────────────────────────────────
  function checkAnswer(content: QuestionContentJson, userAnswer: string): boolean {
    if (!content.correct_answer || !userAnswer) return false
    return userAnswer.toLowerCase().trim() === content.correct_answer.toLowerCase().trim()
  }

  // ── 결과 처리 ────────────────────────────────────────────────────────────────
  function handleNextResult(result: AdaptiveNextResult) {
    if (result.type === 'error') {
      setErrorMsg(result.error)
      setPhase('error')
      return
    }

    if (result.type === 'complete') {
      setPhase('complete')
      setTimeout(() => {
        router.push(`/student/tests/${sessionId}/result`)
      }, 1500)
      return
    }

    if (result.type === 'writing_prompt') {
      setWritingAnswer('')
      setWritingState({
        promptText: result.promptText,
        wordRange: result.wordRange,
        questionIndex: result.questionIndex,
        isLastQuestion: result.isLastQuestion,
        estimatedLevel: currentQuestion?.estimatedLevel ?? 5,
      })
      setPhase('writing')
      return
    }

    // question
    setAnswer('')
    setCurrentQuestion({
      questionId: result.questionId,
      domain: result.domain,
      difficulty: result.difficulty,
      contentJson: result.contentJson,
      domainQuestionIndex: result.domainQuestionIndex,
      domainTotalEstimate: result.domainTotalEstimate,
      domainOrder: result.domainOrder,
      estimatedLevel: result.estimatedLevel,
    })
    setPhase('question')
  }

  // ── 시작 ─────────────────────────────────────────────────────────────────────
  function handleStart() {
    setPhase('loading')
    setLoadingMsg('첫 번째 문제를 준비하고 있습니다...')
    startTransition(async () => {
      const result = await startAdaptiveSession(sessionId)
      handleNextResult(result)
    })
  }

  // ── 객관식/단답형 제출 ─────────────────────────────────────────────────────────
  function handleSubmitAnswer() {
    if (!currentQuestion || !answer.trim()) return

    const isCorrect = checkAnswer(currentQuestion.contentJson, answer)
    const historyItem: QuestionHistoryItem = {
      questionId: currentQuestion.questionId,
      difficulty: currentQuestion.difficulty,
      isCorrect,
      domain: currentQuestion.domain,
    }
    const newHistory = [...history, historyItem]
    setHistory(newHistory)
    totalQuestionsRef.current++

    setPhase('loading')
    setLoadingMsg('다음 문제를 준비하고 있습니다...')

    startTransition(async () => {
      const result = await submitAdaptiveAnswer(
        sessionId,
        currentQuestion.questionId,
        answer,
        isCorrect,
        currentQuestion.domain,
        newHistory,
      )
      handleNextResult(result)
    })
  }

  // ── 쓰기 제출 ─────────────────────────────────────────────────────────────────
  function handleSubmitWriting() {
    if (!writingState || !writingAnswer.trim()) return

    setPhase('loading')
    setLoadingMsg('쓰기 답안을 저장하고 있습니다...')

    startTransition(async () => {
      const result = await submitWritingAnswer(
        sessionId,
        writingAnswer,
        writingState.questionIndex,
        writingState.estimatedLevel,
        history,
      )
      handleNextResult(result)
    })
  }

  // ── 진행률 계산 ──────────────────────────────────────────────────────────────
  const currentDomain = currentQuestion?.domain ?? 'GRAMMAR'
  const totalDomains = 4
  const completedDomains = currentQuestion
    ? DOMAIN_ORDER.indexOf(currentDomain)
    : phase === 'writing'
      ? 3
      : 0
  const progressPercent = Math.round((completedDomains / totalDomains) * 100)

  // ─── Phase: intro ──────────────────────────────────────────────────────────
  if (phase === 'intro') {
    return (
      <div className="mx-auto max-w-xl px-4 py-12 space-y-8">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full bg-[#7854F7]/10 px-4 py-1.5 text-sm font-semibold text-[#7854F7]">
            <BookOpen className="h-4 w-4" />
            적응형 배치 시험
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{testTitle}</h1>
          <p className="text-gray-500 text-sm">
            {studentName} 학생의 정확한 영어 레벨을 측정합니다
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">시험 안내</h2>
          <ul className="space-y-3 text-sm text-gray-600">
            {[
              '총 약 30~35문제로 구성됩니다 (개인마다 다를 수 있음)',
              '문법·어휘·읽기·쓰기 4개 영역을 순서대로 진행합니다',
              '이전 문제로 돌아갈 수 없습니다 — 신중하게 답하세요',
              '맞으면 어려운 문제, 틀리면 쉬운 문제가 나옵니다',
              '정답/해설은 시험 중에 표시되지 않습니다',
              '쓰기 영역은 단답형 에세이 2문제입니다',
            ].map((item, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="mt-0.5 flex-shrink-0 h-4 w-4 rounded-full bg-[#7854F7]/10 text-[#7854F7] text-[10px] font-bold flex items-center justify-center">
                  {i + 1}
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col items-center gap-3">
          <button
            onClick={handleStart}
            className="w-full max-w-xs min-h-[48px] rounded-xl bg-[#7854F7] text-white font-semibold text-base hover:bg-[#6b48e8] transition-colors"
          >
            시험 시작하기
          </button>
          <p className="text-xs text-gray-400">시작하면 취소할 수 없습니다</p>
        </div>
      </div>
    )
  }

  // ─── Phase: loading ────────────────────────────────────────────────────────
  if (phase === 'loading') {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 flex flex-col items-center gap-4">
        <Loader2 className="h-10 w-10 text-[#7854F7] animate-spin" />
        <p className="text-sm text-gray-500">{loadingMsg}</p>
      </div>
    )
  }

  // ─── Phase: complete ───────────────────────────────────────────────────────
  if (phase === 'complete') {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 flex flex-col items-center gap-4 text-center">
        <div className="h-16 w-16 rounded-full bg-[#1FAF54]/10 flex items-center justify-center text-3xl">
          🎉
        </div>
        <h2 className="text-xl font-bold text-gray-900">시험 완료!</h2>
        <p className="text-sm text-gray-500">결과 페이지로 이동하고 있습니다...</p>
        <Loader2 className="h-5 w-5 text-gray-400 animate-spin" />
      </div>
    )
  }

  // ─── Phase: error ──────────────────────────────────────────────────────────
  if (phase === 'error') {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 flex flex-col items-center gap-4 text-center">
        <AlertCircle className="h-12 w-12 text-[#D92916]" />
        <h2 className="text-lg font-bold text-gray-900">오류가 발생했습니다</h2>
        <p className="text-sm text-gray-500">{errorMsg}</p>
        <button
          onClick={() => router.push('/student/tests')}
          className="mt-2 px-6 py-2.5 rounded-xl bg-gray-100 text-sm font-medium text-gray-700 hover:bg-gray-200"
        >
          테스트 목록으로
        </button>
      </div>
    )
  }

  // ─── Phase: writing ────────────────────────────────────────────────────────
  if (phase === 'writing' && writingState) {
    const wordCount = writingAnswer.trim().split(/\s+/).filter(Boolean).length

    return (
      <div className="mx-auto max-w-2xl px-4 py-8 space-y-5">
        {/* 헤더 */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <DomainProgressBar
              currentDomain="WRITING"
              domainOrder={DOMAIN_ORDER}
              history={history}
            />
          </div>

          {/* 진행 바 */}
          <div className="h-1.5 w-full rounded-full bg-gray-100">
            <div
              className="h-1.5 rounded-full transition-all"
              style={{ width: '85%', backgroundColor: DOMAIN_COLOR.WRITING }}
            />
          </div>
        </div>

        {/* 문제 카드 */}
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          {/* 도메인 헤더 */}
          <div className="px-5 py-3 flex items-center gap-2" style={{ backgroundColor: `${DOMAIN_COLOR.WRITING}10` }}>
            <PenLine className="h-4 w-4" style={{ color: DOMAIN_COLOR.WRITING }} />
            <span className="text-sm font-semibold" style={{ color: DOMAIN_COLOR.WRITING }}>
              쓰기 — {writingState.questionIndex}/2
            </span>
          </div>

          <div className="p-5 space-y-4">
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-4">
              <p className="text-sm font-medium text-amber-800 mb-1">글쓰기 주제</p>
              <p className="text-sm text-gray-800 leading-relaxed">{writingState.promptText}</p>
              <p className="text-xs text-amber-600 mt-2">권장 분량: {writingState.wordRange}</p>
            </div>

            <textarea
              value={writingAnswer}
              onChange={(e) => setWritingAnswer(e.target.value)}
              placeholder="여기에 답안을 작성하세요..."
              rows={8}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#E35C20]/30 focus:border-[#E35C20] leading-relaxed"
            />

            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">
                {wordCount}단어 작성됨
              </span>
              <button
                onClick={handleSubmitWriting}
                disabled={!writingAnswer.trim() || isPending}
                className="min-h-[44px] px-6 rounded-xl bg-[#E35C20] text-white text-sm font-semibold hover:bg-[#d4531b] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : writingState.isLastQuestion ? (
                  '제출하고 완료하기'
                ) : (
                  '다음 문제'
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ─── Phase: question ───────────────────────────────────────────────────────
  if (phase === 'question' && currentQuestion) {
    const { contentJson, domain, difficulty, domainQuestionIndex, domainTotalEstimate, domainOrder } = currentQuestion
    const color = DOMAIN_COLOR[domain]
    const canSubmit = answer.trim().length > 0

    return (
      <div className="mx-auto max-w-2xl px-4 py-8 space-y-5">
        {/* 진행 헤더 */}
        <div className="space-y-3">
          <DomainProgressBar
            currentDomain={domain}
            domainOrder={domainOrder as AdaptiveDomain[]}
            history={history}
          />

          {/* 영역 내 진행 바 */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-1.5 rounded-full bg-gray-100">
              <div
                className="h-1.5 rounded-full transition-all"
                style={{
                  width: `${(domainQuestionIndex / domainTotalEstimate) * 100}%`,
                  backgroundColor: color,
                }}
              />
            </div>
            <span className="text-xs text-gray-400 whitespace-nowrap">
              {domainQuestionIndex}/{domainTotalEstimate}
            </span>
          </div>
        </div>

        {/* 문제 카드 */}
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          {/* 도메인 헤더 */}
          <div
            className="px-5 py-3 flex items-center justify-between"
            style={{ backgroundColor: `${color}10` }}
          >
            <div className="flex items-center gap-2">
              <span
                className="text-xs font-bold px-2 py-0.5 rounded-full text-white"
                style={{ backgroundColor: color }}
              >
                {DOMAIN_LABEL[domain]}
              </span>
              <span className="text-xs text-gray-400">Q{totalQuestionsRef.current + 1}</span>
            </div>
            <DifficultyStars n={difficulty} />
          </div>

          <div className="p-5 space-y-4">
            {/* 지문 (읽기) */}
            {contentJson.passage && (
              <div className="rounded-lg bg-gray-50 border border-gray-200 p-4">
                <p className="text-xs font-medium text-gray-400 mb-2">지문</p>
                <p className="text-sm leading-relaxed text-gray-700">{contentJson.passage}</p>
              </div>
            )}

            {/* 문제 텍스트 */}
            <p className="text-base font-medium text-gray-900 leading-relaxed">
              {contentJson.question_text}
            </p>

            {/* 선택지 / 답변 입력 */}
            {contentJson.type === 'multiple_choice' ? (
              <MultipleChoiceQuestion
                content={contentJson}
                selectedAnswer={answer}
                onSelect={setAnswer}
              />
            ) : (
              <ShortAnswerQuestion
                content={contentJson}
                answer={answer}
                onChange={setAnswer}
              />
            )}

            {/* 제출 버튼 */}
            <div className="flex justify-end pt-2">
              <button
                onClick={handleSubmitAnswer}
                disabled={!canSubmit || isPending}
                className="min-h-[44px] px-6 rounded-xl text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                style={{ backgroundColor: canSubmit && !isPending ? color : '#D1D5DB' }}
              >
                {isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    처리 중...
                  </>
                ) : (
                  <>
                    다음
                    <ChevronRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* 하단 안내 */}
        <p className="text-center text-xs text-gray-400">
          답을 선택하면 다음 버튼이 활성화됩니다 · 이전 문제로 돌아갈 수 없습니다
        </p>
      </div>
    )
  }

  return null
}
