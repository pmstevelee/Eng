'use client'

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useTransition,
  TouchEvent,
} from 'react'
import { ChevronLeft, ChevronRight, Clock, Save, AlertTriangle, Volume2 } from 'lucide-react'
import type { QuestionForTest, SessionForTest, TestForTest, InitialAnswers } from '../page'
import type { QuestionContentJson } from '@/components/shared/question-bank-client'

// ── 상수 ─────────────────────────────────────────────────────────────────────

const DOMAIN_COLOR: Record<string, string> = {
  GRAMMAR: '#1865F2',
  VOCABULARY: '#7854F7',
  READING: '#0FBFAD',
  WRITING: '#E35C20',
  LISTENING: '#0EA5E9',
}

const DOMAIN_LABEL: Record<string, string> = {
  GRAMMAR: '문법',
  VOCABULARY: '어휘',
  READING: '읽기',
  WRITING: '쓰기',
  LISTENING: '듣기',
}

const LETTERS = ['A', 'B', 'C', 'D']

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'
type ReadingTab = 'passage' | 'question'

// ── 타입 ──────────────────────────────────────────────────────────────────────

type Props = {
  session: SessionForTest
  test: TestForTest
  questions: QuestionForTest[]
  initialAnswers: InitialAnswers
  onSaveResponses: (
    sessionId: string,
    responses: { questionId: string; answer: string }[],
    currentQuestionIdx: number,
  ) => Promise<{ error?: string }>
  onSubmit: (
    sessionId: string,
    allAnswers: { questionId: string; answer: string }[],
  ) => Promise<{ error?: string }>
}

// ── 메인 컴포넌트 ──────────────────────────────────────────────────────────────

export function TestTakingClient({
  session,
  test,
  questions,
  initialAnswers,
  onSaveResponses,
  onSubmit,
}: Props) {
  const [isPending, startTransition] = useTransition()

  // 현재 문제 인덱스
  const [currentIdx, setCurrentIdx] = useState(session.currentQuestionIdx)
  // 응답 상태: questionId → answer string
  const [answers, setAnswers] = useState<Record<string, string>>(initialAnswers)
  // 자동 저장 상태
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  // 제출 다이얼로그
  const [showSubmitDialog, setShowSubmitDialog] = useState(false)
  // 채점 중 오버레이 (제출 확인 후 표시)
  const [isSubmitting, setIsSubmitting] = useState(false)
  // 타이머 (남은 초)
  const [remainingSec, setRemainingSec] = useState<number | null>(null)
  // 읽기 문제 탭 상태
  const [readingTab, setReadingTab] = useState<ReadingTab>('passage')

  // debounce 관련
  const pendingAnswersRef = useRef<Map<string, string>>(new Map())
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveIdxRef = useRef(currentIdx)

  // 항상 최신 answers를 참조하기 위한 ref (타이머 stale closure 방지)
  const answersRef = useRef(answers)
  useEffect(() => { answersRef.current = answers }, [answers])

  // 터치 스와이프
  const touchStartXRef = useRef<number | null>(null)

  // 탭 전환 감지
  const tabWarningShownRef = useRef(false)

  const currentQuestion = questions[currentIdx]

  // ── 자동 제출 (ref 기반으로 stale closure 없이) ──────────────────────────────

  const handleAutoSubmit = useCallback(() => {
    const allAnswers = Object.entries(answersRef.current).map(([questionId, answer]) => ({
      questionId,
      answer,
    }))
    setIsSubmitting(true)
    startTransition(async () => {
      await onSubmit(session.id, allAnswers)
    })
  }, [onSubmit, session.id])

  // ── 타이머 ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!session.timeLimitMin) return

    const endTime = new Date(session.startedAt).getTime() + session.timeLimitMin * 60 * 1000
    let submitted = false

    function tick() {
      const now = Date.now()
      const remaining = Math.max(0, Math.round((endTime - now) / 1000))
      setRemainingSec(remaining)
      if (remaining <= 0 && !submitted) {
        submitted = true
        handleAutoSubmit()
      }
    }

    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [session.startedAt, session.timeLimitMin, handleAutoSubmit])

  // ── 부정행위 방지 ────────────────────────────────────────────────────────────

  useEffect(() => {
    function handleVisibilityChange() {
      if (document.hidden && !tabWarningShownRef.current) {
        tabWarningShownRef.current = true
        setTimeout(() => {
          tabWarningShownRef.current = false
        }, 5000)
      }
    }

    function handleBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault()
      e.returnValue = ''
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [])

  // ── 자동 저장 ────────────────────────────────────────────────────────────────

  const flushSave = useCallback(async () => {
    if (pendingAnswersRef.current.size === 0) return
    const batch = Array.from(pendingAnswersRef.current.entries()).map(([questionId, answer]) => ({
      questionId,
      answer,
    }))
    pendingAnswersRef.current.clear()
    setSaveStatus('saving')
    const result = await onSaveResponses(session.id, batch, saveIdxRef.current)
    setSaveStatus(result.error ? 'error' : 'saved')
    if (!result.error) {
      setTimeout(() => setSaveStatus('idle'), 3000)
    }
  }, [onSaveResponses, session.id])

  const scheduleAutoSave = useCallback(
    (questionId: string, answer: string) => {
      pendingAnswersRef.current.set(questionId, answer)
      saveIdxRef.current = currentIdx
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = setTimeout(() => {
        flushSave()
      }, 30_000)
    },
    [currentIdx, flushSave],
  )

  // 언마운트 시 저장
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    }
  }, [])

  // ── 응답 핸들러 ──────────────────────────────────────────────────────────────

  function handleAnswer(questionId: string, value: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: value }))
    scheduleAutoSave(questionId, value)
  }

  // ── 네비게이션 ────────────────────────────────────────────────────────────────

  function goTo(idx: number) {
    if (idx < 0 || idx >= questions.length) return
    setCurrentIdx(idx)
    saveIdxRef.current = idx
    setReadingTab('passage')
  }

  function goPrev() {
    goTo(currentIdx - 1)
  }

  function goNext() {
    goTo(currentIdx + 1)
  }

  // ── 스와이프 ─────────────────────────────────────────────────────────────────

  function handleTouchStart(e: TouchEvent<HTMLDivElement>) {
    touchStartXRef.current = e.touches[0].clientX
  }

  function handleTouchEnd(e: TouchEvent<HTMLDivElement>) {
    if (touchStartXRef.current === null) return
    const delta = touchStartXRef.current - e.changedTouches[0].clientX
    if (Math.abs(delta) > 50) {
      if (delta > 0) goNext()
      else goPrev()
    }
    touchStartXRef.current = null
  }

  // ── 제출 ─────────────────────────────────────────────────────────────────────

  function handleSubmitClick() {
    setShowSubmitDialog(true)
  }

  function handleConfirmSubmit() {
    if (isPending) return
    setShowSubmitDialog(false)
    setIsSubmitting(true)
    // Flush pending saves first, then submit
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    const allAnswers = Object.entries(answers).map(([questionId, answer]) => ({
      questionId,
      answer,
    }))
    startTransition(async () => {
      await onSubmit(session.id, allAnswers)
    })
  }

  // ── 타이머 포맷 ───────────────────────────────────────────────────────────────

  function formatTime(sec: number) {
    const m = Math.floor(sec / 60)
    const s = sec % 60
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  // ── 통계 ─────────────────────────────────────────────────────────────────────

  const answeredCount = questions.filter((q) => !!answers[q.id]).length
  const unansweredCount = questions.length - answeredCount

  // ── 렌더 ─────────────────────────────────────────────────────────────────────

  if (!currentQuestion) return null

  return (
    <div className="flex h-full flex-col">
      {/* ── 상단 바 ── */}
      <div className="shrink-0 border-b border-gray-200 bg-white px-4 py-3">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
          {/* 테스트 제목 */}
          <h1 className="truncate text-sm font-semibold text-gray-900 sm:text-base">
            {test.title}
          </h1>

          <div className="flex shrink-0 items-center gap-3">
            {/* 자동 저장 상태 */}
            <SaveIndicator status={saveStatus} />

            {/* 타이머 */}
            {remainingSec !== null && (
              <div
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold tabular-nums ${
                  remainingSec <= 300
                    ? 'bg-red-50 text-[#D92916]'
                    : 'bg-gray-100 text-gray-700'
                }`}
              >
                <Clock className="h-4 w-4" />
                <span>{formatTime(remainingSec)}</span>
              </div>
            )}

            {/* 진행률 */}
            <span className="rounded-lg bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-600">
              {currentIdx + 1} / {questions.length}
            </span>
          </div>
        </div>
      </div>

      {/* ── 문제 번호 네비게이션 ── */}
      <div className="shrink-0 border-b border-gray-200 bg-white px-4 py-2">
        <div className="mx-auto max-w-3xl">
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {questions.map((q, i) => {
              const isAnswered = !!answers[q.id]
              const isCurrent = i === currentIdx
              return (
                <button
                  key={q.id}
                  onClick={() => goTo(i)}
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-semibold transition-all ${
                    isCurrent
                      ? 'ring-2 ring-[#E35C20] ring-offset-1'
                      : ''
                  } ${
                    isAnswered
                      ? 'bg-[#1865F2] text-white'
                      : 'border border-gray-300 bg-white text-gray-500 hover:border-gray-400'
                  }`}
                  aria-label={`문제 ${i + 1}${isAnswered ? ' (응답 완료)' : ''}`}
                >
                  {i + 1}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── 문제 영역 ── */}
      <div
        className="flex-1 overflow-y-auto"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div className="mx-auto max-w-3xl px-4 py-6">
          {/* 도메인 배지 */}
          <div className="mb-4 flex items-center gap-2">
            <span
              className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium text-white"
              style={{ backgroundColor: DOMAIN_COLOR[currentQuestion.domain] }}
            >
              {DOMAIN_LABEL[currentQuestion.domain]}
            </span>
            <span className="text-xs text-gray-400">문제 {currentIdx + 1}</span>
          </div>

          {/* 문제 유형별 렌더링 */}
          <QuestionRenderer
            question={currentQuestion}
            answer={answers[currentQuestion.id] ?? ''}
            onAnswer={(val) => handleAnswer(currentQuestion.id, val)}
            readingTab={readingTab}
            onReadingTabChange={setReadingTab}
          />
        </div>
      </div>

      {/* ── 하단 버튼 ── */}
      <div className="shrink-0 border-t border-gray-200 bg-white px-4 py-3">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <button
            onClick={goPrev}
            disabled={currentIdx === 0}
            className="flex h-11 items-center gap-1.5 rounded-xl border border-gray-200 px-4 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
            이전
          </button>

          {currentIdx < questions.length - 1 ? (
            <button
              onClick={goNext}
              className="flex h-11 items-center gap-1.5 rounded-xl bg-[#1865F2] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#1558d6]"
            >
              다음
              <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={handleSubmitClick}
              disabled={isPending}
              className="flex h-11 items-center gap-1.5 rounded-xl bg-[#1FAF54] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#18a049] disabled:opacity-60"
            >
              제출하기
            </button>
          )}
        </div>
      </div>

      {/* ── 제출 확인 다이얼로그 ── */}
      {showSubmitDialog && (
        <SubmitDialog
          unansweredCount={unansweredCount}
          totalCount={questions.length}
          isPending={isPending}
          onConfirm={handleConfirmSubmit}
          onCancel={() => setShowSubmitDialog(false)}
        />
      )}

      {/* ── 채점 중 오버레이 ── */}
      {isSubmitting && <GradingOverlay />}
    </div>
  )
}

// ── 자동 저장 인디케이터 ──────────────────────────────────────────────────────

function SaveIndicator({ status }: { status: SaveStatus }) {
  if (status === 'idle') return null

  const config = {
    saving: { text: '저장 중...', className: 'text-gray-400' },
    saved: { text: '자동 저장됨 ✓', className: 'text-[#1FAF54]' },
    error: { text: '저장 실패, 재시도 중...', className: 'text-[#D92916]' },
  }[status]

  return (
    <span className={`flex items-center gap-1 text-xs ${config.className}`}>
      {status === 'saving' && <Save className="h-3 w-3 animate-pulse" />}
      {config.text}
    </span>
  )
}

// ── 문제 렌더러 ───────────────────────────────────────────────────────────────

type QuestionRendererProps = {
  question: QuestionForTest
  answer: string
  onAnswer: (val: string) => void
  readingTab: ReadingTab
  onReadingTabChange: (tab: ReadingTab) => void
}

function QuestionRenderer({
  question,
  answer,
  onAnswer,
  readingTab,
  onReadingTabChange,
}: QuestionRendererProps) {
  const content = question.contentJson

  if (content.type === 'essay') {
    return <EssayQuestion content={content} answer={answer} onAnswer={onAnswer} />
  }

  if (content.audio_url) {
    return (
      <ListeningQuestion
        content={content}
        answer={answer}
        onAnswer={onAnswer}
      />
    )
  }

  if (content.type === 'multiple_choice' && content.passage) {
    return (
      <ReadingQuestion
        content={content}
        answer={answer}
        onAnswer={onAnswer}
        readingTab={readingTab}
        onReadingTabChange={onReadingTabChange}
      />
    )
  }

  if (content.type === 'fill_blank' || content.type === 'short_answer') {
    return <FillBlankQuestion content={content} answer={answer} onAnswer={onAnswer} />
  }

  // default: multiple_choice
  return <MultipleChoiceQuestion content={content} answer={answer} onAnswer={onAnswer} />
}

// ── 객관식 문제 ───────────────────────────────────────────────────────────────

function MultipleChoiceQuestion({
  content,
  answer,
  onAnswer,
}: {
  content: QuestionContentJson
  answer: string
  onAnswer: (v: string) => void
}) {
  const options = content.options ?? []

  return (
    <div>
      <p className="mb-6 text-base leading-relaxed text-gray-900">{content.question_text}</p>
      {content.question_text_ko && (
        <p className="mb-6 text-sm leading-relaxed text-gray-500">{content.question_text_ko}</p>
      )}

      <div className="space-y-3">
        {options.map((opt, i) => {
          const letter = LETTERS[i] ?? String(i + 1)
          const isSelected = answer === letter
          return (
            <button
              key={i}
              onClick={() => onAnswer(letter)}
              className={`flex w-full items-start gap-3 rounded-xl border p-4 text-left transition-all ${
                isSelected
                  ? 'border-[#1865F2] bg-[#EEF4FF] ring-1 ring-[#1865F2]'
                  : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                  isSelected ? 'bg-[#1865F2] text-white' : 'bg-gray-100 text-gray-600'
                }`}
              >
                {letter}
              </span>
              <span className={`mt-0.5 text-sm leading-relaxed ${isSelected ? 'text-[#1865F2] font-medium' : 'text-gray-700'}`}>
                {opt}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── 빈칸 채우기 문제 ──────────────────────────────────────────────────────────

function FillBlankQuestion({
  content,
  answer,
  onAnswer,
}: {
  content: QuestionContentJson
  answer: string
  onAnswer: (v: string) => void
}) {
  return (
    <div>
      <p className="mb-6 text-base leading-relaxed text-gray-900">{content.question_text}</p>
      {content.question_text_ko && (
        <p className="mb-4 text-sm leading-relaxed text-gray-500">{content.question_text_ko}</p>
      )}

      <div className="mt-4">
        <label className="mb-1.5 block text-sm font-medium text-gray-700">답변 입력</label>
        <input
          type="text"
          value={answer}
          onChange={(e) => onAnswer(e.target.value)}
          placeholder="답을 입력하세요"
          className="h-11 w-full rounded-xl border border-gray-200 px-4 text-sm text-gray-900 outline-none transition-all focus:border-[#1865F2] focus:ring-2 focus:ring-[#1865F2]/20"
        />
      </div>
    </div>
  )
}

// ── 읽기 문제 (지문 + 객관식) ─────────────────────────────────────────────────

function ReadingQuestion({
  content,
  answer,
  onAnswer,
  readingTab,
  onReadingTabChange,
}: {
  content: QuestionContentJson
  answer: string
  onAnswer: (v: string) => void
  readingTab: ReadingTab
  onReadingTabChange: (tab: ReadingTab) => void
}) {
  const options = content.options ?? []

  return (
    <div>
      {/* 모바일: 탭 전환 / 데스크탑: 분할 레이아웃 */}

      {/* 모바일 탭 버튼 (sm 이하에서만 보임) */}
      <div className="mb-4 flex rounded-xl border border-gray-200 p-1 sm:hidden">
        <button
          onClick={() => onReadingTabChange('passage')}
          className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
            readingTab === 'passage'
              ? 'bg-[#1865F2] text-white'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          지문
        </button>
        <button
          onClick={() => onReadingTabChange('question')}
          className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
            readingTab === 'question'
              ? 'bg-[#1865F2] text-white'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          문제
        </button>
      </div>

      {/* 모바일: 탭 콘텐츠 */}
      <div className="sm:hidden">
        {readingTab === 'passage' && (
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <p className="text-sm font-semibold text-gray-500 mb-3">지문</p>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-800">
              {content.passage}
            </p>
          </div>
        )}
        {readingTab === 'question' && (
          <QuestionAndOptions
            content={content}
            options={options}
            answer={answer}
            onAnswer={onAnswer}
          />
        )}
      </div>

      {/* 데스크탑: 상하 분할 */}
      <div className="hidden sm:block">
        <div className="mb-4 max-h-48 overflow-y-auto rounded-xl border border-gray-200 bg-gray-50 p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">지문</p>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-800">
            {content.passage}
          </p>
        </div>
        <QuestionAndOptions
          content={content}
          options={options}
          answer={answer}
          onAnswer={onAnswer}
        />
      </div>
    </div>
  )
}

function QuestionAndOptions({
  content,
  options,
  answer,
  onAnswer,
}: {
  content: QuestionContentJson
  options: string[]
  answer: string
  onAnswer: (v: string) => void
}) {
  return (
    <div>
      <p className="mb-4 text-base leading-relaxed text-gray-900">{content.question_text}</p>
      {content.question_text_ko && (
        <p className="mb-4 text-sm leading-relaxed text-gray-500">{content.question_text_ko}</p>
      )}
      <div className="space-y-3">
        {options.map((opt, i) => {
          const letter = LETTERS[i] ?? String(i + 1)
          const isSelected = answer === letter
          return (
            <button
              key={i}
              onClick={() => onAnswer(letter)}
              className={`flex w-full items-start gap-3 rounded-xl border p-4 text-left transition-all ${
                isSelected
                  ? 'border-[#1865F2] bg-[#EEF4FF] ring-1 ring-[#1865F2]'
                  : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                  isSelected ? 'bg-[#1865F2] text-white' : 'bg-gray-100 text-gray-600'
                }`}
              >
                {letter}
              </span>
              <span className={`mt-0.5 text-sm leading-relaxed ${isSelected ? 'text-[#1865F2] font-medium' : 'text-gray-700'}`}>
                {opt}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── 리스닝 문제 ───────────────────────────────────────────────────────────────

function ListeningQuestion({
  content,
  answer,
  onAnswer,
}: {
  content: QuestionContentJson
  answer: string
  onAnswer: (v: string) => void
}) {
  const options = content.options ?? []

  return (
    <div>
      {/* 오디오 플레이어 */}
      <div className="mb-6 rounded-xl border border-[#0EA5E9]/30 bg-[#E0F2FE] p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-full bg-[#0EA5E9] flex items-center justify-center shrink-0">
            <Volume2 size={14} className="text-white" />
          </div>
          <span className="text-sm font-semibold text-[#0EA5E9]">음성을 들어보세요</span>
        </div>
        <audio controls className="w-full" controlsList="nodownload">
          <source src={content.audio_url} />
          브라우저가 오디오를 지원하지 않습니다.
        </audio>
        <p className="text-xs text-[#0EA5E9]/70 mt-2">여러 번 들을 수 있습니다.</p>
      </div>

      {/* 문제 */}
      <p className="mb-4 text-base leading-relaxed text-gray-900">{content.question_text}</p>
      {content.question_text_ko && (
        <p className="mb-4 text-sm leading-relaxed text-gray-500">{content.question_text_ko}</p>
      )}

      {/* 객관식 선택지 */}
      {content.type === 'multiple_choice' && options.length > 0 && (
        <div className="space-y-3">
          {options.map((opt, i) => {
            const letter = LETTERS[i] ?? String(i + 1)
            const isSelected = answer === letter
            return (
              <button
                key={i}
                onClick={() => onAnswer(letter)}
                className={`flex w-full items-start gap-3 rounded-xl border p-4 text-left transition-all ${
                  isSelected
                    ? 'border-[#0EA5E9] bg-[#E0F2FE] ring-1 ring-[#0EA5E9]'
                    : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                    isSelected ? 'bg-[#0EA5E9] text-white' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {letter}
                </span>
                <span className={`mt-0.5 text-sm leading-relaxed ${isSelected ? 'text-[#0EA5E9] font-medium' : 'text-gray-700'}`}>
                  {opt}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {/* 단답형/빈칸 */}
      {(content.type === 'fill_blank' || content.type === 'short_answer') && (
        <div className="mt-4">
          <label className="mb-1.5 block text-sm font-medium text-gray-700">답변 입력</label>
          <input
            type="text"
            value={answer}
            onChange={(e) => onAnswer(e.target.value)}
            placeholder="답을 입력하세요"
            className="h-11 w-full rounded-xl border border-gray-200 px-4 text-sm text-gray-900 outline-none transition-all focus:border-[#0EA5E9] focus:ring-2 focus:ring-[#0EA5E9]/20"
          />
        </div>
      )}
    </div>
  )
}

// ── 에세이 문제 ───────────────────────────────────────────────────────────────

function EssayQuestion({
  content,
  answer,
  onAnswer,
}: {
  content: QuestionContentJson
  answer: string
  onAnswer: (v: string) => void
}) {
  const wordLimit = content.word_limit
  const charCount = answer.length
  const isOverLimit = wordLimit ? charCount > wordLimit : false

  return (
    <div>
      <p className="mb-2 text-base leading-relaxed text-gray-900">{content.question_text}</p>
      {content.question_text_ko && (
        <p className="mb-4 text-sm leading-relaxed text-gray-500">{content.question_text_ko}</p>
      )}

      {wordLimit && (
        <p className="mb-3 text-xs text-gray-500">
          최소 10자 이상, 최대 {wordLimit}자 이하로 작성해 주세요.
        </p>
      )}

      <div className="relative">
        <textarea
          value={answer}
          onChange={(e) => onAnswer(e.target.value)}
          placeholder="답변을 작성하세요..."
          rows={8}
          className={`w-full rounded-xl border px-4 py-3 text-sm leading-relaxed text-gray-900 outline-none transition-all resize-none focus:ring-2 focus:ring-[#1865F2]/20 ${
            isOverLimit
              ? 'border-[#D92916] focus:border-[#D92916]'
              : 'border-gray-200 focus:border-[#1865F2]'
          }`}
        />
        <div
          className={`mt-1.5 text-right text-xs ${
            isOverLimit ? 'text-[#D92916]' : 'text-gray-400'
          }`}
        >
          {charCount.toLocaleString()}{wordLimit ? ` / ${wordLimit.toLocaleString()}자` : '자'}
          {isOverLimit && <span className="ml-1 font-medium">최대 글자수 초과</span>}
        </div>
      </div>
    </div>
  )
}

// ── 채점 중 오버레이 ──────────────────────────────────────────────────────────

function GradingOverlay() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white/95">
      <div className="flex flex-col items-center gap-6">
        {/* 스피너 */}
        <div className="relative h-16 w-16">
          <div className="absolute inset-0 rounded-full border-4 border-gray-100" />
          <div className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-[#1865F2]" />
        </div>
        {/* 텍스트 */}
        <div className="text-center">
          <p className="text-lg font-bold text-gray-900">채점 중...</p>
          <p className="mt-1 text-sm text-gray-500">잠시만 기다려 주세요.</p>
        </div>
        {/* 진행 애니메이션 바 */}
        <div className="h-1.5 w-48 overflow-hidden rounded-full bg-gray-100">
          <div className="h-full w-1/2 animate-progress rounded-full bg-[#1865F2]" />
        </div>
      </div>
    </div>
  )
}

// ── 제출 확인 다이얼로그 ──────────────────────────────────────────────────────

function SubmitDialog({
  unansweredCount,
  totalCount,
  isPending,
  onConfirm,
  onCancel,
}: {
  unansweredCount: number
  totalCount: number
  isPending: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-50">
            <AlertTriangle className="h-5 w-5 text-[#FFB100]" />
          </div>
          <h3 className="text-base font-bold text-gray-900">테스트 제출</h3>
        </div>

        {unansweredCount > 0 ? (
          <p className="mb-6 text-sm leading-relaxed text-gray-600">
            <span className="font-semibold text-[#D92916]">미응답 {unansweredCount}문제</span>가
            있습니다. (응답 완료: {totalCount - unansweredCount}/{totalCount}문제)
            <br />
            <br />
            제출하면 취소할 수 없습니다. 정말 제출하시겠습니까?
          </p>
        ) : (
          <p className="mb-6 text-sm leading-relaxed text-gray-600">
            모든 문제({totalCount}문제)에 응답했습니다.
            <br />
            <br />
            제출하면 취소할 수 없습니다. 정말 제출하시겠습니까?
          </p>
        )}

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={isPending}
            className="flex-1 rounded-xl border border-gray-200 py-3 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-60"
          >
            계속 풀기
          </button>
          <button
            onClick={onConfirm}
            disabled={isPending}
            className="flex-1 rounded-xl bg-[#1FAF54] py-3 text-sm font-semibold text-white transition-colors hover:bg-[#18a049] disabled:opacity-60"
          >
            {isPending ? '제출 중...' : '제출하기'}
          </button>
        </div>
      </div>
    </div>
  )
}
