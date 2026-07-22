'use client'

import { useState, useEffect, useRef, useCallback, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, ArrowRight, RotateCcw, Lightbulb, SkipForward, Volume2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { LoadingOverlay } from '@/components/shared/loading-overlay'
import { checkSpell, recordProgress } from '@/app/(dashboard)/student/words/_actions'

// ─── 타입 ─────────────────────────────────────────────────────────────────────

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

type Phase = 'quizzing' | 'round-done'
type AnswerState = 'idle' | 'correct' | 'nearly' | 'wrong'

interface Props {
  setId: string
  initialCards: WordCard[]
}

// ─── 발음 재생 ────────────────────────────────────────────────────────────────

function playAudio(term: string, audioUrl: string | null) {
  if (audioUrl) {
    new Audio(audioUrl).play().catch(() => null)
    return
  }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    const utter = new SpeechSynthesisUtterance(term)
    utter.lang = 'en-US'
    window.speechSynthesis.speak(utter)
  }
}

// ─── 글자 수 힌트 ("○ ○ ○") ──────────────────────────────────────────────────

function LetterHint({ term }: { term: string }) {
  return (
    <div className="flex items-center justify-center gap-1 flex-wrap">
      {term.split('').map((char, i) => (
        <span
          key={i}
          className={`inline-flex items-center justify-center text-lg font-semibold ${
            char === ' ' ? 'w-4' : 'w-7 h-7 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-400'
          }`}
        >
          {char === ' ' ? '' : '○'}
        </span>
      ))}
    </div>
  )
}

// ─── 오답 비교 (틀린 글자 빨강) ───────────────────────────────────────────────

function DiffView({ correct, userAnswer }: { correct: string; userAnswer: string }) {
  const corrLower = correct.toLowerCase()
  const userLower = userAnswer.toLowerCase()

  return (
    <div className="flex flex-col gap-1 text-sm">
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-400 w-8 shrink-0">내 답</span>
        <span className="font-mono tracking-widest">
          {userAnswer.split('').map((ch, i) => {
            const isWrong = corrLower[i] !== ch.toLowerCase()
            return (
              <span key={i} className={isWrong ? 'text-[#D92916] font-bold' : 'text-gray-600 dark:text-gray-300'}>
                {ch}
              </span>
            )
          })}
          {userAnswer.length < correct.length && (
            <span className="text-[#D92916] font-bold">{'_'.repeat(correct.length - userAnswer.length)}</span>
          )}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-400 w-8 shrink-0">정답</span>
        <span className="font-mono tracking-widest font-semibold text-gray-900 dark:text-white">{correct}</span>
      </div>
    </div>
  )
}

// ─── 예문 빈칸 ────────────────────────────────────────────────────────────────

function ExampleWithBlank({ example, term }: { example: string; term: string }) {
  const regex = new RegExp(`\\b${term}\\b`, 'gi')
  const parts = example.split(regex)
  return (
    <p className="text-sm text-gray-500 dark:text-gray-400 italic text-center leading-relaxed">
      {parts.map((part, i) => (
        <span key={i}>
          {part}
          {i < parts.length - 1 && (
            <span className="inline-block border-b-2 border-gray-400 w-16 mx-1 align-bottom" />
          )}
        </span>
      ))}
    </p>
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
  const mastered = accuracy >= 90
  const canRetry = wrongCount > 0 && retryCount < 2

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center px-4">
      <LoadingOverlay show={isPending} />
      <div
        className={`w-20 h-20 rounded-full flex items-center justify-center text-3xl font-black ${
          mastered ? 'bg-[#1FAF54]/10 text-[#1FAF54]' : 'bg-[#D92916]/10 text-[#D92916]'
        }`}
      >
        {accuracy}%
      </div>
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
          {mastered ? '완벽해요! 마스터 승격!' : canRetry ? '조금 더 연습해요' : '수고했어요!'}
        </h2>
        <p className="text-sm text-gray-500">
          {totalAnswered}문제 중 {correctCount}개 정답
        </p>
      </div>

      <div className="flex flex-col gap-3 w-full max-w-xs">
        {canRetry && !mastered ? (
          <Button
            onClick={onRetry}
            disabled={isPending}
            className="h-14 bg-[#1865F2] hover:bg-[#1865F2]/90 text-white rounded-xl font-semibold text-base"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            다시 도전 ({wrongCount}개 재출제)
          </Button>
        ) : (
          <Button
            onClick={() => startTransition(() => router.push('/student/words'))}
            disabled={isPending}
            className="h-14 bg-[#1FAF54] hover:bg-[#1FAF54]/90 text-white rounded-xl font-semibold text-base"
          >
            단어 허브로
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

export function SpellClient({ setId, initialCards }: Props) {
  const [phase, setPhase] = useState<Phase>('quizzing')
  const [deck, setDeck] = useState<WordCard[]>(initialCards)
  const [qIndex, setQIndex] = useState(0)
  const [input, setInput] = useState('')
  const [answerState, setAnswerState] = useState<AnswerState>('idle')
  const [correctTerm, setCorrectTerm] = useState('')
  const [usedHint, setUsedHint] = useState(false)
  const [showHint, setShowHint] = useState(false)
  const [isGrading, setIsGrading] = useState(false)

  const [correctCount, setCorrectCount] = useState(0)
  const [totalAnswered, setTotalAnswered] = useState(0)
  const [wrongCards, setWrongCards] = useState<WordCard[]>([])
  const [retryCount, setRetryCount] = useState(0)

  const inputRef = useRef<HTMLInputElement>(null)
  const isSubmittingRef = useRef(false)
  // 현재 문제가 이미 처리됐는지 추적 (handleSubmit + handleSkip 중복 실행 방지)
  const isAnsweredRef = useRef(false)

  const currentCard = deck[qIndex]

  // autoFocus on question change
  useEffect(() => {
    if (phase === 'quizzing' && answerState === 'idle') {
      inputRef.current?.focus()
    }
  }, [qIndex, phase, answerState])

  const advance = useCallback(() => {
    const nextIndex = qIndex + 1
    if (nextIndex >= deck.length) {
      setPhase('round-done')
    } else {
      setQIndex(nextIndex)
      setInput('')
      setAnswerState('idle')
      setUsedHint(false)
      setShowHint(false)
      isAnsweredRef.current = false
    }
  }, [qIndex, deck.length])

  async function handleSubmit() {
    if (!currentCard || answerState !== 'idle' || input.trim() === '') return
    if (isSubmittingRef.current) return
    if (isAnsweredRef.current) return
    isSubmittingRef.current = true
    setIsGrading(true)

    const minDelay = new Promise((resolve) => setTimeout(resolve, 600))
    const [res] = await Promise.all([
      checkSpell({
        wordId: currentCard.word.id,
        userAnswer: input,
        usedHint,
      }),
      minDelay,
    ])

    isSubmittingRef.current = false
    setIsGrading(false)

    if (!res.ok) return

    // handleSkip이 await 중 먼저 실행됐으면 중단
    if (isAnsweredRef.current) return

    isAnsweredRef.current = true

    const { correct, nearlyCorrect, quality, correctTerm: ct } = res.data as {
      correct: boolean
      nearlyCorrect: boolean
      quality: number
      correctTerm: string
    }

    setCorrectTerm(ct)
    setTotalAnswered((n) => n + 1)

    let state: AnswerState
    if (correct || nearlyCorrect) {
      state = correct ? 'correct' : 'nearly'
      setCorrectCount((n) => n + 1)
      playAudio(ct, currentCard.word.audioUrl)
    } else {
      state = 'wrong'
      setWrongCards((prev) => [...prev, currentCard])
    }
    setAnswerState(state)

    recordProgress({
      wordId: currentCard.word.id,
      stage: 'SPELL',
      quality: quality as 0 | 1 | 2 | 3 | 4 | 5,
      isCorrect: correct || nearlyCorrect,
      userAnswer: input,
    })
  }

  function handleSkip() {
    // handleSubmit 비동기 처리 중이거나 이미 답변 처리된 경우 무시
    if (isSubmittingRef.current || isAnsweredRef.current || answerState !== 'idle' || !currentCard) return
    isAnsweredRef.current = true
    setTotalAnswered((n) => n + 1)
    setWrongCards((prev) => [...prev, currentCard])
    setAnswerState('wrong')
    setCorrectTerm(currentCard.word.term)
    recordProgress({
      wordId: currentCard.word.id,
      stage: 'SPELL',
      quality: 2,
      isCorrect: false,
      userAnswer: '',
    })
  }

  function handleHint() {
    setUsedHint(true)
    setShowHint(true)
  }

  // Enter 키
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (phase !== 'quizzing') return
      if (e.key === 'Enter') {
        e.preventDefault()
        if (answerState !== 'idle') {
          advance()
        } else {
          handleSubmit()
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, answerState, input, advance])

  function handleRetry() {
    isAnsweredRef.current = false
    isSubmittingRef.current = false
    const newDeck = [...wrongCards]
    setDeck(newDeck)
    setQIndex(0)
    setWrongCards([])
    setCorrectCount(0)
    setTotalAnswered(0)
    setInput('')
    setAnswerState('idle')
    setUsedHint(false)
    setShowHint(false)
    setRetryCount((n) => n + 1)
    setPhase('quizzing')
  }

  if (initialCards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
        <p className="text-gray-500">학습할 단어가 없습니다.</p>
        <p className="text-xs text-gray-400">리콜 단계를 먼저 완료해 주세요.</p>
      </div>
    )
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

  const card = currentCard
  const accuracy = totalAnswered > 0 ? Math.round((correctCount / totalAnswered) * 100) : null
  const isAnswered = answerState !== 'idle'
  const isCorrectish = answerState === 'correct' || answerState === 'nearly'

  return (
    <div className="flex flex-col" style={{ minHeight: 'calc(100dvh - 120px)' }}>
      {/* 진행바 */}
      <div className="mb-6 shrink-0">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-[#0C2340] dark:text-white">
            {qIndex + 1} / {deck.length}
          </span>
          {accuracy !== null && (
            <span
              className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                accuracy >= 80
                  ? 'bg-[#1FAF54]/10 text-[#1FAF54]'
                  : 'bg-[#D92916]/10 text-[#D92916]'
              }`}
            >
              정답률 {accuracy}%
            </span>
          )}
        </div>
        <div className="w-full h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-[#7854F7] rounded-full"
            initial={false}
            animate={{ width: `${((qIndex + 1) / deck.length) * 100}%` }}
            transition={{ ease: 'easeOut', duration: 0.3 }}
          />
        </div>
      </div>

      {/* 문제 영역 */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`${qIndex}-${card.word.id}`}
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -40 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="flex flex-col flex-1"
        >
          {/* 한글 뜻 + 예문 */}
          <div className="text-center mb-8 px-2">
            <p className="text-xs text-gray-400 mb-2 uppercase tracking-wide">영어 단어를 입력하세요</p>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white leading-snug break-keep mb-1">
              {card.word.meaning}
            </h2>
            {card.word.partOfSpeech && (
              <span className="inline-block mt-1 text-xs font-medium text-[#7854F7] bg-[#7854F7]/10 px-3 py-1 rounded-full">
                {card.word.partOfSpeech}
              </span>
            )}
            {card.word.example && (
              <div className="mt-3">
                <ExampleWithBlank example={card.word.example} term={card.word.term} />
              </div>
            )}
          </div>

          {/* 글자 수 힌트 */}
          <div className="mb-4 flex flex-col items-center gap-2">
            <LetterHint term={card.word.term} />
            {showHint && (
              <motion.p
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-sm font-semibold text-[#FFB100] mt-1"
              >
                힌트: {card.word.term[0]}...
              </motion.p>
            )}
          </div>

          {/* 입력창 */}
          <div className="relative mb-3">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => {
                if (!isAnswered && !isGrading) setInput(e.target.value)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  if (isAnswered) {
                    advance()
                  } else if (!isGrading) {
                    handleSubmit()
                  }
                }
              }}
              autoFocus
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              inputMode="text"
              placeholder="영어 단어 입력..."
              disabled={isAnswered || isGrading}
              className={`w-full h-14 rounded-xl border-2 px-4 text-lg font-mono tracking-widest text-center transition-colors outline-none
                ${
                  isAnswered
                    ? isCorrectish
                      ? 'border-[#1FAF54] bg-[#1FAF54]/5 text-[#1FAF54] dark:bg-[#1FAF54]/10'
                      : 'border-[#D92916] bg-[#D92916]/5 text-gray-900 dark:bg-[#D92916]/10 dark:text-white'
                    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:border-[#7854F7]'
                }`}
            />
            {isAnswered && isCorrectish && (
              <CheckCircle2 className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#1FAF54]" />
            )}
          </div>

          {/* 피드백 */}
          <AnimatePresence>
            {isAnswered && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="mb-3"
              >
                {isCorrectish ? (
                  <div className="rounded-xl bg-[#1FAF54]/10 border border-[#1FAF54]/20 px-4 py-3 flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-[#1FAF54] shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-[#1FAF54]">
                        {answerState === 'nearly' ? '거의 맞았어요! (오타 1개)' : '정답이에요!'}
                      </p>
                      <button
                        onClick={() => playAudio(correctTerm, card.word.audioUrl)}
                        className="flex items-center gap-1 text-xs text-[#1FAF54]/70 mt-0.5 hover:text-[#1FAF54] transition-colors"
                      >
                        <Volume2 className="w-3 h-3" />
                        발음 듣기
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl bg-[#D92916]/5 border border-[#D92916]/20 px-4 py-3">
                    <p className="text-xs text-[#D92916] font-medium mb-2">오답</p>
                    <DiffView correct={correctTerm} userAnswer={input || '(건너뜀)'} />
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* 버튼 영역 */}
          <div className="mt-auto flex flex-col gap-2 shrink-0">
            {!isAnswered ? (
              <>
                <Button
                  onClick={handleSubmit}
                  disabled={input.trim() === '' || isGrading}
                  className="h-14 rounded-xl bg-[#7854F7] hover:bg-[#7854F7]/90 text-white font-semibold text-base disabled:opacity-40"
                >
                  {isGrading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      채점 중...
                    </>
                  ) : (
                    <>
                      확인
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
                <div className="flex gap-2">
                  <Button
                    onClick={handleHint}
                    disabled={showHint || isGrading}
                    variant="outline"
                    className="flex-1 h-11 rounded-xl border-2 text-[#FFB100] border-[#FFB100]/30 hover:bg-[#FFB100]/5 disabled:opacity-30 font-medium"
                  >
                    <Lightbulb className="w-4 h-4 mr-1.5" />
                    힌트
                  </Button>
                  <Button
                    onClick={handleSkip}
                    disabled={isGrading}
                    variant="outline"
                    className="flex-1 h-11 rounded-xl border-2 text-gray-500 border-gray-200 hover:bg-gray-50 dark:border-gray-700 font-medium disabled:opacity-30"
                  >
                    <SkipForward className="w-4 h-4 mr-1.5" />
                    건너뛰기
                  </Button>
                </div>
              </>
            ) : (
              <Button
                onClick={advance}
                className={`h-14 rounded-xl font-semibold text-base text-white ${
                  isCorrectish
                    ? 'bg-[#1FAF54] hover:bg-[#1FAF54]/90'
                    : 'bg-[#1865F2] hover:bg-[#1865F2]/90'
                }`}
              >
                {qIndex === deck.length - 1 ? '결과 보기' : '다음'}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
