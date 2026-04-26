'use client'

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useTransition,
  TouchEvent,
  useReducer,
} from 'react'
import Image from 'next/image'
import { ChevronLeft, ChevronRight, Clock, Save, AlertTriangle, Volume2 } from 'lucide-react'
import type { QuestionForTest, SessionForTest, TestForTest, InitialAnswers } from '../page'
import type { QuestionContentJson } from '@/components/shared/question-bank-client'

// ── 상수 ─────────────────────────────────────────────────────────────────────

const DOMAIN_COLOR: Record<string, string> = {
  GRAMMAR: '#1865F2',
  VOCABULARY: '#7854F7',
  READING: '#0FBFAD',
  LISTENING: '#E91E8A',
  WRITING: '#E35C20',
}

const DOMAIN_LABEL: Record<string, string> = {
  GRAMMAR: '문법',
  VOCABULARY: '어휘',
  READING: '읽기',
  LISTENING: '듣기',
  WRITING: '쓰기',
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
      try {
        await onSubmit(session.id, allAnswers)
      } catch (err) {
        console.error('[handleAutoSubmit] 제출 오류:', err)
        setIsSubmitting(false)
      }
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
    try {
      const result = await onSaveResponses(session.id, batch, saveIdxRef.current)
      setSaveStatus(result.error ? 'error' : 'saved')
      if (!result.error) {
        setTimeout(() => setSaveStatus('idle'), 3000)
      }
    } catch (err) {
      console.error('[flushSave] 자동저장 오류:', err)
      setSaveStatus('error')
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
      try {
        await onSubmit(session.id, allAnswers)
      } catch (err) {
        console.error('[handleConfirmSubmit] 제출 오류:', err)
        setIsSubmitting(false)
      }
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

// ── 문제 이미지 ───────────────────────────────────────────────────────────────

function QuestionImage({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="my-3">
      <Image
        src={src}
        alt={alt}
        width={480}
        height={300}
        unoptimized
        className="rounded-xl border border-gray-200 object-contain max-h-64 w-auto"
      />
    </div>
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
    // play_count 필드 기반으로 최대 재생 횟수 결정 (기본 2회)
    const maxPlayCount = typeof content.play_count === 'number' ? content.play_count : 2
    return (
      <ListeningQuestion
        content={content}
        answer={answer}
        onAnswer={onAnswer}
        maxPlayCount={maxPlayCount}
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

  if (content.type === 'word_bank') {
    return <WordBankQuestion content={content} answer={answer} onAnswer={onAnswer} />
  }

  if (content.type === 'sentence_order') {
    return <SentenceOrderQuestion content={content} answer={answer} onAnswer={onAnswer} />
  }

  if (content.type === 'question_set') {
    return <QuestionSetQuestion content={content} answer={answer} onAnswer={onAnswer} />
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
      <p className="mb-4 text-base leading-relaxed text-gray-900">{content.question_text}</p>
      {content.question_image_url && (
        <QuestionImage src={content.question_image_url} alt="문제 이미지" />
      )}
      {content.question_text_ko && (
        <p className="mb-6 text-sm leading-relaxed text-gray-500">{content.question_text_ko}</p>
      )}

      <div className="space-y-3">
        {options.map((opt, i) => {
          const letter = LETTERS[i] ?? String(i + 1)
          const isSelected = answer === letter
          const optionImg = content.option_images?.[i]
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
              <span className={`mt-0.5 flex-1 text-sm leading-relaxed ${isSelected ? 'text-[#1865F2] font-medium' : 'text-gray-700'}`}>
                {optionImg && (
                  <Image
                    src={optionImg}
                    alt={`선택지 ${letter} 이미지`}
                    width={240}
                    height={150}
                    unoptimized
                    className="mb-1.5 rounded-lg border border-gray-200 object-contain max-h-36 w-auto"
                  />
                )}
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
      <p className="mb-4 text-base leading-relaxed text-gray-900">{content.question_text}</p>
      {content.question_image_url && (
        <QuestionImage src={content.question_image_url} alt="문제 이미지" />
      )}
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

// ── 단어박스형 문제 ────────────────────────────────────────────────────────────

function WordBankQuestion({
  content,
  answer,
  onAnswer,
}: {
  content: QuestionContentJson
  answer: string
  onAnswer: (v: string) => void
}) {
  // answer는 JSON 문자열: {"a":"brushing","b":"eating",...}
  const parsed: Record<string, string> = (() => {
    try { return answer ? JSON.parse(answer) : {} } catch { return {} }
  })()

  const sentences = content.sentences ?? []
  const wordBank = content.word_bank ?? []

  function updateAnswer(label: string, val: string) {
    const next = { ...parsed, [label]: val }
    onAnswer(JSON.stringify(next))
  }

  return (
    <div>
      <p className="mb-4 text-base font-semibold leading-relaxed text-gray-900">{content.question_text}</p>
      {content.question_text_ko && (
        <p className="mb-4 text-sm leading-relaxed text-gray-500">{content.question_text_ko}</p>
      )}

      {/* 단어 박스 */}
      {wordBank.length > 0 && (
        <div className="mb-6 rounded-xl border-2 border-gray-200 p-4">
          <div className="flex flex-wrap gap-3 justify-center">
            {wordBank.map((word, i) => (
              <span
                key={i}
                className="px-3 py-1 text-sm font-semibold text-gray-700 border-b-2 border-gray-400"
              >
                {word}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 문장 목록 */}
      <div className="space-y-5">
        {sentences.map((s) => {
          const parts = s.text.split('____')
          return (
            <div key={s.label} className="space-y-2">
              {/* 힌트 이미지 (있는 경우) */}
              {s.image_url && (
                <div className="pl-5">
                  <Image
                    src={s.image_url}
                    alt={`${s.label}번 힌트 이미지`}
                    width={280}
                    height={160}
                    unoptimized
                    className="rounded-xl border border-gray-200 object-contain max-h-40 w-auto"
                  />
                </div>
              )}
              {/* 문장 + 빈칸 입력 */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-bold text-gray-700 shrink-0">{s.label}.</span>
                <span className="text-sm text-gray-900">{parts[0]}</span>
                <input
                  type="text"
                  value={parsed[s.label] ?? ''}
                  onChange={(e) => updateAnswer(s.label, e.target.value)}
                  placeholder="____________"
                  className="h-9 min-w-[120px] w-36 rounded-lg border-b-2 border-gray-400 bg-transparent px-2 text-sm text-gray-900 outline-none transition-all focus:border-[#1865F2] text-center"
                />
                {parts[1] && <span className="text-sm text-gray-900">{parts[1]}</span>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── 문장 순서 맞추기 (드래그 앤 드롭) ────────────────────────────────────────

function SentenceOrderQuestion({
  content,
  answer,
  onAnswer,
}: {
  content: QuestionContentJson
  answer: string
  onAnswer: (v: string) => void
}) {
  // answer: JSON {"A": "Are those melons", "B": "..."}
  const parsed: Record<string, string> = (() => {
    try { return answer ? JSON.parse(answer) : {} } catch { return {} }
  })()

  const items = content.order_sentences ?? []

  // 각 문장별 placed 단어 목록 (슬롯에 놓인 것)
  const [placed, setPlaced] = useState<Record<string, string[]>>(() => {
    const init: Record<string, string[]> = {}
    items.forEach((item) => {
      if (parsed[item.label]) {
        init[item.label] = parsed[item.label].split(' ').filter(Boolean)
      } else {
        init[item.label] = []
      }
    })
    return init
  })

  // 각 문장별 bank에 남은 단어 목록
  const [bank, setBank] = useState<Record<string, string[]>>(() => {
    const init: Record<string, string[]> = {}
    items.forEach((item) => {
      const alreadyPlaced = parsed[item.label]
        ? parsed[item.label].split(' ').filter(Boolean)
        : []
      const available = [...item.words]
      alreadyPlaced.forEach((w) => {
        const idx = available.indexOf(w)
        if (idx !== -1) available.splice(idx, 1)
      })
      init[item.label] = available
    })
    return init
  })

  // 선택된 단어 (탭/클릭 방식 지원)
  const [selected, setSelected] = useState<{ label: string; from: 'bank' | 'placed'; index: number } | null>(null)

  // 드래그 소스
  const dragSource = useRef<{ label: string; from: 'bank' | 'placed'; index: number } | null>(null)

  function saveAnswer(newPlaced: Record<string, string[]>) {
    const result: Record<string, string> = {}
    items.forEach((item) => {
      result[item.label] = (newPlaced[item.label] ?? []).join(' ')
    })
    onAnswer(JSON.stringify(result))
  }

  // 단어 클릭: bank → 슬롯 끝에 추가 / placed → bank로 반환
  function handleBankWordClick(label: string, idx: number) {
    if (selected?.label === label && selected.from === 'bank' && selected.index === idx) {
      setSelected(null)
      return
    }
    const wordCount = items.find((i) => i.label === label)?.words.length ?? 0
    // 슬롯이 꽉 찬 경우 선택만 유지
    if (placed[label]?.length >= wordCount) {
      setSelected({ label, from: 'bank', index: idx })
      return
    }
    const word = bank[label][idx]
    const newBank = { ...bank, [label]: bank[label].filter((_, i) => i !== idx) }
    const newPlaced = { ...placed, [label]: [...(placed[label] ?? []), word] }
    setBank(newBank)
    setPlaced(newPlaced)
    setSelected(null)
    saveAnswer(newPlaced)
  }

  function handleSlotClick(label: string, slotIdx: number) {
    // selected가 bank 단어면 → 해당 슬롯에 삽입
    if (selected?.label === label && selected.from === 'bank') {
      const word = bank[label][selected.index]
      const newBank = { ...bank, [label]: bank[label].filter((_, i) => i !== selected.index) }
      const newPlaced = { ...placed }
      const arr = [...(newPlaced[label] ?? [])]
      arr.splice(slotIdx, 0, word)
      newPlaced[label] = arr
      setBank(newBank)
      setPlaced(newPlaced)
      setSelected(null)
      saveAnswer(newPlaced)
      return
    }
    // 슬롯에 단어가 있으면 bank로 반환
    if (placed[label]?.[slotIdx] !== undefined) {
      const word = placed[label][slotIdx]
      const newPlaced = { ...placed, [label]: placed[label].filter((_, i) => i !== slotIdx) }
      const newBank = { ...bank, [label]: [...bank[label], word] }
      setPlaced(newPlaced)
      setBank(newBank)
      setSelected(null)
      saveAnswer(newPlaced)
    }
  }

  // HTML5 DnD
  function handleDragStart(label: string, from: 'bank' | 'placed', index: number) {
    dragSource.current = { label, from, index }
  }

  function handleDropOnSlot(e: React.DragEvent, label: string, slotIdx: number) {
    e.preventDefault()
    const src = dragSource.current
    if (!src || src.label !== label) return
    const newBank = { ...bank }
    const newPlaced = { ...placed }

    let word: string
    if (src.from === 'bank') {
      word = newBank[label][src.index]
      newBank[label] = newBank[label].filter((_, i) => i !== src.index)
    } else {
      word = newPlaced[label][src.index]
      newPlaced[label] = newPlaced[label].filter((_, i) => i !== src.index)
    }
    const arr = [...(newPlaced[label] ?? [])]
    arr.splice(slotIdx, 0, word)
    newPlaced[label] = arr

    setBank(newBank)
    setPlaced(newPlaced)
    dragSource.current = null
    saveAnswer(newPlaced)
  }

  function handleDropOnBank(e: React.DragEvent, label: string) {
    e.preventDefault()
    const src = dragSource.current
    if (!src || src.label !== label || src.from === 'bank') return
    const word = placed[label][src.index]
    const newPlaced = { ...placed, [label]: placed[label].filter((_, i) => i !== src.index) }
    const newBank = { ...bank, [label]: [...bank[label], word] }
    setPlaced(newPlaced)
    setBank(newBank)
    dragSource.current = null
    saveAnswer(newPlaced)
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
  }

  return (
    <div>
      <p className="mb-4 text-base font-semibold leading-relaxed text-gray-900">{content.question_text}</p>
      {content.question_text_ko && (
        <p className="mb-4 text-sm leading-relaxed text-gray-500">{content.question_text_ko}</p>
      )}

      <div className="space-y-8">
        {items.map((item) => {
          const wordCount = item.words.length
          const slots = Array.from({ length: wordCount })

          return (
            <div key={item.label} className="space-y-4">
              {/* 힌트 이미지 */}
              {item.image_url && (
                <Image
                  src={item.image_url}
                  alt={`${item.label} 힌트 이미지`}
                  width={420}
                  height={260}
                  unoptimized
                  className="rounded-xl border border-gray-200 object-contain max-h-56 w-auto"
                />
              )}

              {/* 표시 문장 */}
              <p className="text-sm leading-relaxed text-gray-700 whitespace-pre-line">{item.display_text}</p>

              {/* 단어 박스 (남은 단어) */}
              <div
                className="min-h-[56px] rounded-xl border-2 border-gray-200 bg-gray-50 p-3"
                onDragOver={handleDragOver}
                onDrop={(e) => handleDropOnBank(e, item.label)}
              >
                <div className="flex flex-wrap gap-2 justify-center">
                  {bank[item.label]?.length === 0 ? (
                    <span className="text-xs text-gray-400 self-center">단어를 모두 배치했습니다</span>
                  ) : (
                    bank[item.label]?.map((word, wi) => {
                      const isSelectedWord =
                        selected?.label === item.label && selected.from === 'bank' && selected.index === wi
                      return (
                        <button
                          key={wi}
                          draggable
                          onDragStart={() => handleDragStart(item.label, 'bank', wi)}
                          onClick={() => handleBankWordClick(item.label, wi)}
                          className={`px-4 py-2 rounded-lg border-2 text-sm font-semibold transition-all cursor-grab active:cursor-grabbing ${
                            isSelectedWord
                              ? 'border-[#1865F2] bg-[#EEF4FF] text-[#1865F2]'
                              : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                          }`}
                        >
                          {word}
                        </button>
                      )
                    })
                  )}
                </div>
              </div>

              {/* 드롭 슬롯 */}
              <div className="rounded-xl border-2 border-dashed border-[#1865F2]/30 bg-[#F5F8FF] p-4">
                <div className="flex flex-wrap gap-2 justify-center">
                  {slots.map((_, slotIdx) => {
                    const word = placed[item.label]?.[slotIdx]
                    return (
                      <div
                        key={slotIdx}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDropOnSlot(e, item.label, slotIdx)}
                        onClick={() => handleSlotClick(item.label, slotIdx)}
                        className={`h-11 min-w-[70px] rounded-lg border-2 flex items-center justify-center transition-all ${
                          word
                            ? 'border-[#1865F2] bg-white cursor-pointer hover:border-red-300'
                            : 'border-dashed border-[#1865F2]/40 bg-transparent'
                        }`}
                      >
                        {word ? (
                          <span className="px-3 text-sm font-semibold text-[#1865F2]">{word}</span>
                        ) : (
                          <span className="text-xs text-[#1865F2]/30">___</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── 복합 문제 (공유 오디오/지문 + 소문제들) ──────────────────────────────────

function QuestionSetQuestion({
  content,
  answer,
  onAnswer,
}: {
  content: QuestionContentJson
  answer: string
  onAnswer: (v: string) => void
}) {
  // answer는 JSON: {"1":"C","2":"A","3":"B","4":"B"}
  const parsed: Record<string, string> = (() => {
    try { return answer ? JSON.parse(answer) : {} } catch { return {} }
  })()

  const subQuestions = content.sub_questions ?? []

  function updateAnswer(label: string, val: string) {
    const next = { ...parsed, [label]: val }
    onAnswer(JSON.stringify(next))
  }

  const answeredCount = subQuestions.filter((sq) => parsed[sq.label]).length

  return (
    <div className="space-y-6">
      {/* 지시문 */}
      <p className="text-base font-semibold leading-relaxed text-gray-900">{content.question_text}</p>
      {content.question_text_ko && (
        <p className="text-sm leading-relaxed text-gray-500">{content.question_text_ko}</p>
      )}

      {/* 공유 오디오 (듣기 기반) */}
      {content.audio_url && (
        <QuestionSetAudioPlayer audioUrl={content.audio_url} />
      )}

      {/* 공유 지문 (읽기 기반) */}
      {content.passage && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">지문</p>
          {content.passage_image_url && (
            <QuestionImage src={content.passage_image_url} alt="지문 이미지" />
          )}
          <p className="text-sm leading-relaxed text-gray-700 whitespace-pre-wrap">{content.passage}</p>
        </div>
      )}

      {/* 진행 표시 */}
      {subQuestions.length > 0 && (
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {subQuestions.map((sq) => (
              <span
                key={sq.label}
                className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center transition-all ${
                  parsed[sq.label]
                    ? 'bg-[#1865F2] text-white'
                    : 'bg-gray-100 text-gray-400'
                }`}
              >
                {sq.label}
              </span>
            ))}
          </div>
          <span className="text-xs text-gray-400">{answeredCount}/{subQuestions.length} 완료</span>
        </div>
      )}

      {/* 소문제 목록 */}
      <div className="space-y-6">
        {subQuestions.map((sq) => {
          const selectedAnswer = parsed[sq.label] ?? ''
          const letters = ['A', 'B', 'C', 'D', 'E']
          return (
            <div key={sq.label} className="space-y-3">
              <p className="text-sm font-semibold text-gray-800">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#EEF4FF] text-[#1865F2] text-xs font-bold mr-2">
                  {sq.label}
                </span>
                {sq.question_text}
              </p>
              <div className={`grid gap-3 ${sq.option_images?.some(Boolean) ? 'grid-cols-3' : 'grid-cols-1'}`}>
                {sq.options.map((opt, oi) => {
                  const letter = letters[oi] ?? String(oi + 1)
                  const isSelected = selectedAnswer === letter
                  const optImg = sq.option_images?.[oi]
                  return (
                    <button
                      key={oi}
                      onClick={() => updateAnswer(sq.label, letter)}
                      className={`flex flex-col items-center gap-2 rounded-xl border p-3 transition-all ${
                        isSelected
                          ? 'border-[#1865F2] bg-[#EEF4FF] ring-1 ring-[#1865F2]'
                          : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {optImg && (
                        <Image
                          src={optImg}
                          alt={`선택지 ${letter}`}
                          width={120}
                          height={80}
                          unoptimized
                          className="rounded-lg object-contain max-h-24 w-auto"
                        />
                      )}
                      <span
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                          isSelected ? 'bg-[#1865F2] text-white' : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {letter}
                      </span>
                      {opt && (
                        <span className={`text-xs text-center leading-relaxed ${isSelected ? 'text-[#1865F2] font-medium' : 'text-gray-600'}`}>
                          {opt}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── 복합 문제 오디오 플레이어 ─────────────────────────────────────────────────

function QuestionSetAudioPlayer({ audioUrl }: { audioUrl: string }) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playCount, setPlayCount] = useState(0)
  const MAX_PLAY = 3

  const handlePlay = () => {
    if (playCount >= MAX_PLAY) return
    audioRef.current?.play()
    setPlayCount((c) => c + 1)
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border border-[#E91E8A]/30 bg-[#FDE7F3] p-4">
      <div className="w-10 h-10 rounded-full bg-[#E91E8A] flex items-center justify-center shrink-0">
        <Volume2 size={18} className="text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-[#E91E8A] mb-1">음성 듣기</p>
        <audio ref={audioRef} src={audioUrl} className="hidden" />
        <button
          onClick={handlePlay}
          disabled={playCount >= MAX_PLAY}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#E91E8A] text-white text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-pink-700 transition-colors"
        >
          <Volume2 size={14} />
          {playCount >= MAX_PLAY ? '재생 불가' : '▶ 재생'}
        </button>
      </div>
      <span className="text-xs text-[#E91E8A] font-medium shrink-0">
        {Math.max(0, MAX_PLAY - playCount)}회 남음
      </span>
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
            {content.passage_image_url && (
              <QuestionImage src={content.passage_image_url} alt="지문 이미지" />
            )}
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
        <div className="mb-4 max-h-64 overflow-y-auto rounded-xl border border-gray-200 bg-gray-50 p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">지문</p>
          {content.passage_image_url && (
            <QuestionImage src={content.passage_image_url} alt="지문 이미지" />
          )}
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
      {content.question_image_url && (
        <QuestionImage src={content.question_image_url} alt="문제 이미지" />
      )}
      {content.question_text_ko && (
        <p className="mb-4 text-sm leading-relaxed text-gray-500">{content.question_text_ko}</p>
      )}
      <div className="space-y-3">
        {options.map((opt, i) => {
          const letter = LETTERS[i] ?? String(i + 1)
          const isSelected = answer === letter
          const optionImg = content.option_images?.[i]
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
              <span className={`mt-0.5 flex-1 text-sm leading-relaxed ${isSelected ? 'text-[#1865F2] font-medium' : 'text-gray-700'}`}>
                {optionImg && (
                  <Image
                    src={optionImg}
                    alt={`선택지 ${letter} 이미지`}
                    width={240}
                    height={150}
                    unoptimized
                    className="mb-1.5 rounded-lg border border-gray-200 object-contain max-h-36 w-auto"
                  />
                )}
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

const LISTENING_COLOR = '#E91E8A'
const LISTENING_BG = '#FDE7F3'
const LISTENING_BORDER = '#F9A8D4'

function ListeningQuestion({
  content,
  answer,
  onAnswer,
  maxPlayCount = 2,
  unlimitedPlay = false,
}: {
  content: QuestionContentJson
  answer: string
  onAnswer: (v: string) => void
  maxPlayCount?: number
  unlimitedPlay?: boolean
}) {
  const [playCount, setPlayCount] = useState(0)
  const audioRef = useRef<HTMLAudioElement>(null)
  const options = content.options ?? []

  const remaining = unlimitedPlay ? Infinity : maxPlayCount - playCount
  const isExhausted = !unlimitedPlay && remaining <= 0

  function handlePlay() {
    if (isExhausted) return
    setPlayCount((prev) => prev + 1)
  }

  return (
    <div>
      {/* 오디오 플레이어 */}
      <div
        className="mb-6 rounded-xl border p-4"
        style={{ borderColor: LISTENING_BORDER, backgroundColor: LISTENING_BG }}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
              style={{ backgroundColor: LISTENING_COLOR }}
            >
              <Volume2 size={14} className="text-white" />
            </div>
            <span className="text-sm font-semibold" style={{ color: LISTENING_COLOR }}>
              음성을 들어보세요
            </span>
          </div>
          {/* 재생 횟수 표시 */}
          {!unlimitedPlay && (
            <span
              className="text-xs font-semibold px-2 py-0.5 rounded-full"
              style={{
                backgroundColor: isExhausted
                  ? '#FEE2E2'
                  : remaining <= 1
                    ? '#FFF8E6'
                    : `${LISTENING_COLOR}15`,
                color: isExhausted ? '#D92916' : remaining <= 1 ? '#FFB100' : LISTENING_COLOR,
              }}
            >
              재생 {playCount}/{maxPlayCount}회
            </span>
          )}
        </div>

        {isExhausted ? (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600 font-medium text-center">
            재생 횟수를 모두 사용했습니다
          </div>
        ) : (
          <audio
            ref={audioRef}
            controls
            className="w-full"
            controlsList="nodownload"
            onPlay={handlePlay}
          >
            <source src={content.audio_url} />
            브라우저가 오디오를 지원하지 않습니다.
          </audio>
        )}

        {!unlimitedPlay && !isExhausted && (
          <p className="text-xs mt-2" style={{ color: `${LISTENING_COLOR}99` }}>
            {remaining === 1 ? '⚠️ 재생 횟수가 1회 남았습니다' : `재생 가능 횟수: ${remaining}회`}
          </p>
        )}
      </div>

      {/* 문제 */}
      <p className="mb-4 text-base leading-relaxed text-gray-900">{content.question_text}</p>
      {content.question_image_url && (
        <QuestionImage src={content.question_image_url} alt="문제 이미지" />
      )}
      {content.question_text_ko && (
        <p className="mb-4 text-sm leading-relaxed text-gray-500">{content.question_text_ko}</p>
      )}

      {/* 객관식 선택지 */}
      {content.type === 'multiple_choice' && options.length > 0 && (
        <div className="space-y-3">
          {options.map((opt, i) => {
            const letter = LETTERS[i] ?? String(i + 1)
            const isSelected = answer === letter
            const optionImg = content.option_images?.[i]
            return (
              <button
                key={i}
                onClick={() => onAnswer(letter)}
                className={`flex w-full items-start gap-3 rounded-xl border p-4 text-left transition-all ${
                  isSelected
                    ? 'ring-1'
                    : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                }`}
                style={isSelected ? {
                  borderColor: LISTENING_COLOR,
                  backgroundColor: LISTENING_BG,
                  outlineColor: LISTENING_COLOR,
                } : {}}
              >
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold`}
                  style={isSelected ? { backgroundColor: LISTENING_COLOR, color: 'white' } : { backgroundColor: '#F0F1F3', color: '#3B3E48' }}
                >
                  {letter}
                </span>
                <span
                  className={`mt-0.5 flex-1 text-sm leading-relaxed`}
                  style={isSelected ? { color: LISTENING_COLOR, fontWeight: 500 } : { color: '#3B3E48' }}
                >
                  {optionImg && (
                    <Image
                      src={optionImg}
                      alt={`선택지 ${letter} 이미지`}
                      width={240}
                      height={150}
                      unoptimized
                      className="mb-1.5 rounded-lg border border-gray-200 object-contain max-h-36 w-auto"
                    />
                  )}
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
            className="h-11 w-full rounded-xl border border-gray-200 px-4 text-sm text-gray-900 outline-none transition-all"
            style={{ ['--tw-ring-color' as string]: LISTENING_COLOR }}
            onFocus={(e) => { e.currentTarget.style.borderColor = LISTENING_COLOR }}
            onBlur={(e) => { e.currentTarget.style.borderColor = '#E3E5EA' }}
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
      {content.question_image_url && (
        <QuestionImage src={content.question_image_url} alt="문제 이미지" />
      )}
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
