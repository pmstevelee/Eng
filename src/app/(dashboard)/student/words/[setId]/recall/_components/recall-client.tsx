'use client'

import { useState, useEffect, useCallback, useRef, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, XCircle, ArrowRight, RotateCcw, Target } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { LoadingOverlay } from '@/components/shared/loading-overlay'
import { getRecallOptions, recordProgress } from '@/app/(dashboard)/student/words/_actions'

// ─── 타입 ─────────────────────────────────────────────────────────────────────

type Mode = 'EN_TO_KO' | 'KO_TO_EN' | 'MIXED'
type Phase = 'mode-select' | 'quizzing' | 'round-done' | 'session-done'

interface WordCard {
  word: {
    id: string
    term: string
    meaning: string
    partOfSpeech: string | null
    definition: string | null
    example: string | null
    audioUrl: string | null
    cefrLevel: number
  }
  progress: { id: string; stage: string }
  order: number
}

interface Option {
  id: string
  term: string
  meaning: string
  partOfSpeech: string | null
}

interface LoadedQuestion {
  card: WordCard
  options: Option[]
  correctId: string
  direction: 'EN_TO_KO' | 'KO_TO_EN'
}

interface Props {
  setId: string
  initialCards: WordCard[]
}

// ─── 모드 선택 화면 ──────────────────────────────────────────────────────────

function ModeSelect({ onSelect }: { onSelect: (m: Mode) => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-8 px-4">
      <div className="text-center">
        <div className="w-16 h-16 rounded-full bg-[#1865F2]/10 flex items-center justify-center mx-auto mb-4">
          <Target className="w-8 h-8 text-[#1865F2]" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">리콜 모드 선택</h2>
        <p className="text-sm text-gray-500">문제 방향을 선택하세요</p>
      </div>
      <div className="flex flex-col gap-3 w-full max-w-xs">
        <Button
          onClick={() => onSelect('EN_TO_KO')}
          className="h-14 rounded-xl bg-[#1865F2] hover:bg-[#1865F2]/90 text-white font-semibold text-base"
        >
          영어 → 한국어
        </Button>
        <Button
          onClick={() => onSelect('KO_TO_EN')}
          variant="outline"
          className="h-14 rounded-xl border-2 border-[#1865F2] text-[#1865F2] hover:bg-[#1865F2]/5 font-semibold text-base"
        >
          한국어 → 영어
        </Button>
        <Button
          onClick={() => onSelect('MIXED')}
          variant="outline"
          className="h-14 rounded-xl border-2 font-semibold text-base"
        >
          혼합 (무작위)
        </Button>
      </div>
    </div>
  )
}

// ─── 퀴즈 화면 ───────────────────────────────────────────────────────────────

function QuizScreen({
  question,
  qIndex,
  total,
  correctCount,
  totalAnswered,
  selected,
  onSelect,
  onNext,
  isLast,
}: {
  question: LoadedQuestion
  qIndex: number
  total: number
  correctCount: number
  totalAnswered: number
  selected: string | null
  onSelect: (id: string) => void
  onNext: () => void
  isLast: boolean
}) {
  const { card, options, correctId, direction } = question
  const prompt = direction === 'EN_TO_KO' ? card.word.term : card.word.meaning
  const getLabel = (opt: Option) => direction === 'EN_TO_KO' ? opt.meaning : opt.term
  const accuracy = totalAnswered > 0 ? Math.round((correctCount / totalAnswered) * 100) : null
  const isAnswered = selected !== null

  return (
    <div className="flex flex-col min-h-[80vh]">
      {/* 진행바 + 정답률 */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-[#0C2340] dark:text-white">
            {qIndex + 1} / {total}
          </span>
          {accuracy !== null && (
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
              accuracy >= 80
                ? 'bg-[#1FAF54]/10 text-[#1FAF54]'
                : 'bg-[#D92916]/10 text-[#D92916]'
            }`}>
              정답률 {accuracy}%
            </span>
          )}
        </div>
        <div className="w-full h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-[#1865F2] rounded-full"
            initial={false}
            animate={{ width: `${((qIndex + 1) / total) * 100}%` }}
            transition={{ ease: 'easeOut', duration: 0.3 }}
          />
        </div>
      </div>

      {/* 질문 */}
      <div className="text-center my-8 px-2">
        <p className="text-xs text-gray-400 mb-3 uppercase tracking-wide">
          {direction === 'EN_TO_KO' ? '한국어 뜻은?' : '영어 단어는?'}
        </p>
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white leading-tight break-keep">
          {prompt}
        </h2>
        {direction === 'EN_TO_KO' && card.word.partOfSpeech && (
          <span className="inline-block mt-2 text-xs font-medium text-[#1865F2] bg-[#1865F2]/10 px-3 py-1 rounded-full">
            {card.word.partOfSpeech}
          </span>
        )}
      </div>

      {/* 보기 */}
      <div className="flex flex-col gap-3 flex-1">
        {options.map((opt, i) => {
          const isSelected = selected === opt.id
          const isCorrect = opt.id === correctId
          let cls = 'border-gray-200 bg-white dark:bg-gray-900 dark:border-gray-700 hover:border-[#1865F2] hover:bg-[#1865F2]/5'
          if (isAnswered) {
            if (isCorrect) cls = 'border-[#1FAF54] bg-[#1FAF54]/10 dark:bg-[#1FAF54]/10'
            else if (isSelected) cls = 'border-[#D92916] bg-[#D92916]/10 dark:bg-[#D92916]/10'
            else cls = 'border-gray-200 bg-white dark:bg-gray-900 dark:border-gray-700 opacity-40'
          }

          return (
            <button
              key={opt.id}
              onClick={() => !isAnswered && onSelect(opt.id)}
              disabled={isAnswered}
              className={`w-full min-h-[56px] rounded-xl border-2 flex items-center gap-3 px-4 text-left transition-all duration-200 ${cls}`}
            >
              <span className="text-sm font-bold text-gray-400 w-6 shrink-0 text-center">
                {i + 1}
              </span>
              <span className="flex-1 text-base font-medium text-gray-900 dark:text-white leading-snug py-1">
                {getLabel(opt)}
              </span>
              {isAnswered && isCorrect && (
                <CheckCircle2 className="w-5 h-5 text-[#1FAF54] shrink-0" />
              )}
              {isAnswered && isSelected && !isCorrect && (
                <XCircle className="w-5 h-5 text-[#D92916] shrink-0" />
              )}
            </button>
          )
        })}
      </div>

      {/* 정답/오답 피드백 + 다음 버튼 */}
      <AnimatePresence>
        {isAnswered && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="mt-5 flex flex-col gap-3"
          >
            {selected !== correctId && (
              <div className="rounded-xl bg-[#D92916]/5 border border-[#D92916]/20 px-4 py-3">
                <p className="text-xs text-[#D92916] font-medium mb-0.5">정답</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  {direction === 'EN_TO_KO'
                    ? options.find((o) => o.id === correctId)?.meaning
                    : options.find((o) => o.id === correctId)?.term}
                </p>
              </div>
            )}
            <Button
              onClick={onNext}
              className="h-14 rounded-xl bg-[#1865F2] hover:bg-[#1865F2]/90 text-white font-semibold text-base"
            >
              {isLast ? '결과 보기' : selected === correctId ? '다음' : '확인'}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      <p className="text-center text-xs text-gray-400 mt-3">
        단축키: 1 · 2 · 3 · 4
      </p>
    </div>
  )
}

// ─── 로딩 스켈레톤 ────────────────────────────────────────────────────────────

function QuizLoading() {
  return (
    <div className="flex flex-col min-h-[80vh] animate-pulse">
      <div className="mb-6">
        <div className="h-4 bg-gray-100 rounded-full w-full" />
      </div>
      <div className="text-center my-8 flex flex-col items-center gap-3">
        <div className="h-4 w-24 bg-gray-100 rounded-full" />
        <div className="h-9 w-48 bg-gray-200 rounded-xl" />
      </div>
      <div className="flex flex-col gap-3 flex-1">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-14 rounded-xl bg-gray-100" />
        ))}
      </div>
    </div>
  )
}

// ─── 라운드 종료 화면 ─────────────────────────────────────────────────────────

function RoundDone({
  correctCount,
  totalAnswered,
  wrongCount,
  retryCount,
  setId,
  onRetry,
}: {
  correctCount: number
  totalAnswered: number
  wrongCount: number
  retryCount: number
  setId: string
  onRetry: () => void
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const accuracy = totalAnswered > 0 ? Math.round((correctCount / totalAnswered) * 100) : 0
  const passed = accuracy >= 80
  const canRetry = wrongCount > 0 && retryCount < 2

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center px-4">
      <LoadingOverlay show={isPending} />
      <div
        className={`w-20 h-20 rounded-full flex items-center justify-center text-3xl font-black ${
          passed ? 'bg-[#1FAF54]/10 text-[#1FAF54]' : 'bg-[#D92916]/10 text-[#D92916]'
        }`}
      >
        {accuracy}%
      </div>
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
          {passed ? '잘 했어요!' : '조금 더 연습해요'}
        </h2>
        <p className="text-sm text-gray-500">
          {totalAnswered}문제 중 {correctCount}개 정답
        </p>
      </div>

      <div className="flex flex-col gap-3 w-full max-w-xs">
        {passed ? (
          <Button
            onClick={() => startTransition(() => router.push(`/student/words/${setId}/spell`))}
            disabled={isPending}
            className="h-14 bg-[#1FAF54] hover:bg-[#1FAF54]/90 text-white rounded-xl font-semibold text-base"
          >
            스펠 단계로
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        ) : canRetry ? (
          <Button
            onClick={onRetry}
            disabled={isPending}
            className="h-14 bg-[#1865F2] hover:bg-[#1865F2]/90 text-white rounded-xl font-semibold text-base"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            한 번 더 ({wrongCount}개 재출제)
          </Button>
        ) : (
          <Button
            onClick={() => startTransition(() => router.push(`/student/words/${setId}/spell`))}
            disabled={isPending}
            className="h-14 bg-[#1865F2] hover:bg-[#1865F2]/90 text-white rounded-xl font-semibold text-base"
          >
            스펠 단계로
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        )}
        <Button
          variant="ghost"
          onClick={() => startTransition(() => router.push('/student/words'))}
          disabled={isPending}
          className="text-gray-500 h-10"
        >
          단어 허브로 돌아가기
        </Button>
      </div>
    </div>
  )
}

// ─── 메인 클라이언트 컴포넌트 ─────────────────────────────────────────────────

export function RecallClient({ setId, initialCards }: Props) {
  const [phase, setPhase] = useState<Phase>('mode-select')
  const [mode, setMode] = useState<Mode>('EN_TO_KO')
  const [deck, setDeck] = useState<WordCard[]>(initialCards)
  const [qIndex, setQIndex] = useState(0)
  const [question, setQuestion] = useState<LoadedQuestion | null>(null)
  const [loadingQuestion, setLoadingQuestion] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)

  // 라운드별 통계
  const [correctCount, setCorrectCount] = useState(0)
  const [totalAnswered, setTotalAnswered] = useState(0)
  const [wrongCards, setWrongCards] = useState<WordCard[]>([])
  const [retryCount, setRetryCount] = useState(0)

  const nextFetchRef = useRef<Promise<LoadedQuestion | null> | null>(null)

  // ─── 옵션 로드 ──────────────────────────────────────────────────────────────

  async function loadQuestion(card: WordCard, currentMode: Mode): Promise<LoadedQuestion | null> {
    const res = await getRecallOptions(card.word.id)
    if (!res.ok) return null
    const { correctId, options } = res.data as { correctId: string; options: Option[] }
    const direction: 'EN_TO_KO' | 'KO_TO_EN' =
      currentMode === 'MIXED'
        ? Math.random() < 0.5 ? 'EN_TO_KO' : 'KO_TO_EN'
        : currentMode
    return { card, options, correctId, direction }
  }

  // ─── 모드 선택 후 시작 ──────────────────────────────────────────────────────

  async function handleModeSelect(m: Mode) {
    setMode(m)
    setPhase('quizzing')
    setLoadingQuestion(true)
    const q = await loadQuestion(deck[0], m)
    setQuestion(q)
    setLoadingQuestion(false)
    // 다음 문제 미리 로드
    if (deck[1]) {
      nextFetchRef.current = loadQuestion(deck[1], m)
    }
  }

  // ─── 선택 처리 ──────────────────────────────────────────────────────────────

  async function handleSelect(id: string) {
    if (selected !== null || !question) return
    setSelected(id)

    const isCorrect = id === question.correctId
    setTotalAnswered((n) => n + 1)
    if (isCorrect) {
      setCorrectCount((n) => n + 1)
    } else {
      setWrongCards((prev) => [...prev, question.card])
    }

    // 비동기 기록 (결과 기다리지 않음)
    recordProgress({
      wordId: question.card.word.id,
      stage: 'RECALL',
      quality: isCorrect ? 4 : 1,
      isCorrect,
    })
  }

  // ─── 다음 문제 ──────────────────────────────────────────────────────────────

  async function handleNext() {
    const nextIndex = qIndex + 1
    if (nextIndex >= deck.length) {
      // 라운드 종료
      setPhase('round-done')
      return
    }

    setQIndex(nextIndex)
    setSelected(null)
    setLoadingQuestion(true)

    // 이미 미리 로드된 것 사용
    let nextQ: LoadedQuestion | null = null
    if (nextFetchRef.current) {
      nextQ = await nextFetchRef.current
      nextFetchRef.current = null
    } else {
      nextQ = await loadQuestion(deck[nextIndex], mode)
    }
    setQuestion(nextQ)
    setLoadingQuestion(false)

    // 그 다음 미리 로드
    const afterNext = nextIndex + 1
    if (afterNext < deck.length) {
      nextFetchRef.current = loadQuestion(deck[afterNext], mode)
    }
  }

  // ─── 재출제 ─────────────────────────────────────────────────────────────────

  async function handleRetry() {
    const newDeck = [...wrongCards]
    setDeck(newDeck)
    setQIndex(0)
    setWrongCards([])
    setCorrectCount(0)
    setTotalAnswered(0)
    setSelected(null)
    setRetryCount((n) => n + 1)
    setPhase('quizzing')
    setLoadingQuestion(true)
    const q = await loadQuestion(newDeck[0], mode)
    setQuestion(q)
    setLoadingQuestion(false)
    if (newDeck[1]) {
      nextFetchRef.current = loadQuestion(newDeck[1], mode)
    }
  }

  // ─── 키보드 단축키 ──────────────────────────────────────────────────────────

  const handleSelectByIndex = useCallback(
    (i: number) => {
      if (!question || selected !== null || phase !== 'quizzing') return
      const opt = question.options[i]
      if (opt) handleSelect(opt.id)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [question, selected, phase],
  )

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (phase !== 'quizzing') return
      if (e.key === '1') handleSelectByIndex(0)
      else if (e.key === '2') handleSelectByIndex(1)
      else if (e.key === '3') handleSelectByIndex(2)
      else if (e.key === '4') handleSelectByIndex(3)
      else if ((e.key === 'Enter' || e.key === ' ') && selected !== null) {
        e.preventDefault()
        handleNext()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, selected, handleSelectByIndex])

  // ─── 렌더 ────────────────────────────────────────────────────────────────────

  if (initialCards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
        <p className="text-gray-500">학습할 단어가 없습니다.</p>
        <p className="text-xs text-gray-400">플래시카드 단계를 먼저 완료해 주세요.</p>
      </div>
    )
  }

  if (phase === 'mode-select') {
    return <ModeSelect onSelect={handleModeSelect} />
  }

  if (phase === 'round-done') {
    return (
      <RoundDone
        correctCount={correctCount}
        totalAnswered={totalAnswered}
        wrongCount={wrongCards.length}
        retryCount={retryCount}
        setId={setId}
        onRetry={handleRetry}
      />
    )
  }

  // quizzing
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={`${qIndex}-${question?.card.word.id}`}
        initial={{ opacity: 0, x: 40 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -40 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
      >
        {loadingQuestion || !question ? (
          <QuizLoading />
        ) : (
          <QuizScreen
            question={question}
            qIndex={qIndex}
            total={deck.length}
            correctCount={correctCount}
            totalAnswered={totalAnswered}
            selected={selected}
            onSelect={handleSelect}
            onNext={handleNext}
            isLast={qIndex === deck.length - 1}
          />
        )}
      </motion.div>
    </AnimatePresence>
  )
}
