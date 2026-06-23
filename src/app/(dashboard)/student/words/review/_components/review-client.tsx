'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CheckCircle2,
  XCircle,
  ArrowRight,
  Lightbulb,
  SkipForward,
  Volume2,
  Zap,
  Flame,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  getRecallOptions,
  recordProgress,
  checkSpell,
  completeReviewSession,
} from '@/app/(dashboard)/student/words/_actions'

// ─── 타입 ─────────────────────────────────────────────────────────────────────

interface ReviewCard {
  progressId: string
  wordId: string
  correctCount: number
  stage: string
  word: {
    id: string
    term: string
    meaning: string | null
    partOfSpeech: string | null
    definition: string | null
    example: string | null
    audioUrl: string | null
    cefrLevel: number
  }
}

interface RecallOption {
  id: string
  term: string
  meaning: string
  partOfSpeech: string | null
}

type CardMode = 'RECALL' | 'SPELL'
type Phase = 'quizzing' | 'done'
type SpellAnswerState = 'idle' | 'correct' | 'nearly' | 'wrong'

interface Props {
  cards: ReviewCard[]
}

function modeForCard(card: ReviewCard): CardMode {
  return card.correctCount < 3 ? 'RECALL' : 'SPELL'
}

function playAudio(term: string, audioUrl: string | null) {
  if (audioUrl) {
    new Audio(audioUrl).play().catch(() => null)
    return
  }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    const u = new SpeechSynthesisUtterance(term)
    u.lang = 'en-US'
    window.speechSynthesis.speak(u)
  }
}

// ─── 진행바 ───────────────────────────────────────────────────────────────────

function ProgressBar({ index, total, correct, answered }: { index: number; total: number; correct: number; answered: number }) {
  const accuracy = answered > 0 ? Math.round((correct / answered) * 100) : null
  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-[#0C2340] dark:text-white">
          {index + 1} / {total}
        </span>
        {accuracy !== null && (
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
            accuracy >= 80 ? 'bg-[#1FAF54]/10 text-[#1FAF54]' : 'bg-[#D92916]/10 text-[#D92916]'
          }`}>
            정답률 {accuracy}%
          </span>
        )}
      </div>
      <div className="w-full h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-[#7854F7] rounded-full"
          initial={false}
          animate={{ width: `${((index + 1) / total) * 100}%` }}
          transition={{ ease: 'easeOut', duration: 0.3 }}
        />
      </div>
    </div>
  )
}

// ─── 리콜 카드 ────────────────────────────────────────────────────────────────

function RecallCard({
  card,
  onResult,
}: {
  card: ReviewCard
  onResult: (isCorrect: boolean) => void
}) {
  const [options, setOptions] = useState<RecallOption[]>([])
  const [correctId, setCorrectId] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setSelected(null)
    setLoading(true)
    getRecallOptions(card.word.id).then((res) => {
      if (res.ok) {
        const d = res.data as { correctId: string; options: RecallOption[] }
        setCorrectId(d.correctId)
        setOptions(d.options)
      }
      setLoading(false)
    })
  }, [card.word.id])

  function handleSelect(id: string) {
    if (selected !== null) return
    setSelected(id)
    const isCorrect = id === correctId
    recordProgress({ wordId: card.word.id, stage: 'RECALL', quality: isCorrect ? 4 : 1, isCorrect })
    setTimeout(() => onResult(isCorrect), 900)
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-3">
        <div className="h-8 bg-gray-100 rounded-xl w-48 mx-auto" />
        {[1,2,3,4].map((i) => <div key={i} className="h-14 rounded-xl bg-gray-100" />)}
      </div>
    )
  }

  const isAnswered = selected !== null

  return (
    <div>
      <div className="text-center mb-8 px-2">
        <p className="text-xs text-gray-400 mb-3 uppercase tracking-wide">한국어 뜻은?</p>
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white leading-tight break-keep">
          {card.word.term}
        </h2>
        {card.word.partOfSpeech && (
          <span className="inline-block mt-2 text-xs font-medium text-[#1865F2] bg-[#1865F2]/10 px-3 py-1 rounded-full">
            {card.word.partOfSpeech}
          </span>
        )}
      </div>
      <div className="flex flex-col gap-3">
        {options.map((opt, i) => {
          const isSelected = selected === opt.id
          const isCorrect = opt.id === correctId
          let cls = 'border-gray-200 bg-white dark:bg-gray-900 dark:border-gray-700 hover:border-[#7854F7] hover:bg-[#7854F7]/5'
          if (isAnswered) {
            if (isCorrect) cls = 'border-[#1FAF54] bg-[#1FAF54]/10'
            else if (isSelected) cls = 'border-[#D92916] bg-[#D92916]/10'
            else cls = 'border-gray-200 bg-white dark:bg-gray-900 opacity-40'
          }
          return (
            <button
              key={opt.id}
              onClick={() => handleSelect(opt.id)}
              disabled={isAnswered}
              className={`w-full min-h-[56px] rounded-xl border-2 flex items-center gap-3 px-4 text-left transition-all duration-200 ${cls}`}
            >
              <span className="text-sm font-bold text-gray-400 w-6 shrink-0 text-center">{i + 1}</span>
              <span className="flex-1 text-base font-medium text-gray-900 dark:text-white leading-snug py-1">
                {opt.meaning}
              </span>
              {isAnswered && isCorrect && <CheckCircle2 className="w-5 h-5 text-[#1FAF54] shrink-0" />}
              {isAnswered && isSelected && !isCorrect && <XCircle className="w-5 h-5 text-[#D92916] shrink-0" />}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── 스펠 카드 ────────────────────────────────────────────────────────────────

function SpellCard({
  card,
  onResult,
}: {
  card: ReviewCard
  onResult: (isCorrect: boolean) => void
}) {
  const [input, setInput] = useState('')
  const [answerState, setAnswerState] = useState<SpellAnswerState>('idle')
  const [correctTerm, setCorrectTerm] = useState('')
  const [showHint, setShowHint] = useState(false)
  const [usedHint, setUsedHint] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setInput('')
    setAnswerState('idle')
    setShowHint(false)
    setUsedHint(false)
    inputRef.current?.focus()
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [card.word.id])

  async function handleSubmit() {
    if (answerState !== 'idle' || input.trim() === '') return
    const res = await checkSpell({ wordId: card.word.id, userAnswer: input, usedHint })
    if (!res.ok) return
    const { correct, nearlyCorrect, quality, correctTerm: ct } = res.data as {
      correct: boolean; nearlyCorrect: boolean; quality: number; correctTerm: string
    }
    setCorrectTerm(ct)
    const isCorrectish = correct || nearlyCorrect
    setAnswerState(correct ? 'correct' : nearlyCorrect ? 'nearly' : 'wrong')
    if (isCorrectish) playAudio(ct, card.word.audioUrl)
    recordProgress({ wordId: card.word.id, stage: 'SPELL', quality: quality as 0|1|2|3|4|5, isCorrect: isCorrectish, userAnswer: input })
    timerRef.current = setTimeout(() => onResult(isCorrectish), 1200)
  }

  function handleSkip() {
    if (answerState !== 'idle') return
    setCorrectTerm(card.word.term)
    setAnswerState('wrong')
    recordProgress({ wordId: card.word.id, stage: 'SPELL', quality: 2, isCorrect: false, userAnswer: '' })
    timerRef.current = setTimeout(() => onResult(false), 1200)
  }

  const isAnswered = answerState !== 'idle'
  const isCorrectish = answerState === 'correct' || answerState === 'nearly'

  return (
    <div>
      <div className="text-center mb-6 px-2">
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
          <p className="mt-2 text-sm text-gray-400 italic">{card.word.example.replace(new RegExp(`\\b${card.word.term}\\b`, 'gi'), '___')}</p>
        )}
      </div>

      {/* 글자 수 힌트 */}
      <div className="flex items-center justify-center gap-1 flex-wrap mb-4">
        {card.word.term.split('').map((ch, i) => (
          <span key={i} className={`inline-flex items-center justify-center text-base font-semibold ${
            ch === ' ' ? 'w-3' : 'w-6 h-6 rounded bg-gray-100 dark:bg-gray-800 text-gray-400'
          }`}>
            {ch === ' ' ? '' : '○'}
          </span>
        ))}
      </div>
      {showHint && (
        <p className="text-center text-sm font-semibold text-[#FFB100] mb-3">힌트: {card.word.term[0]}...</p>
      )}

      <input
        ref={inputRef}
        type="text"
        value={input}
        onChange={(e) => { if (!isAnswered) setInput(e.target.value) }}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSubmit() } }}
        autoComplete="off" autoCapitalize="off" autoCorrect="off" spellCheck={false}
        disabled={isAnswered}
        placeholder="영어 단어 입력..."
        className={`w-full h-14 rounded-xl border-2 px-4 text-lg font-mono tracking-widest text-center transition-colors outline-none mb-3 ${
          isAnswered
            ? isCorrectish
              ? 'border-[#1FAF54] bg-[#1FAF54]/5 text-[#1FAF54]'
              : 'border-[#D92916] bg-[#D92916]/5 text-gray-900 dark:text-white'
            : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:border-[#7854F7]'
        }`}
      />

      <AnimatePresence>
        {isAnswered && (
          <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="mb-4"
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
                    className="flex items-center gap-1 text-xs text-[#1FAF54]/70 mt-0.5 hover:text-[#1FAF54]"
                  >
                    <Volume2 className="w-3 h-3" />발음 듣기
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-xl bg-[#D92916]/5 border border-[#D92916]/20 px-4 py-3">
                <p className="text-xs text-[#D92916] font-medium mb-1">오답 — 정답: <span className="font-bold">{correctTerm}</span></p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {!isAnswered && (
        <div className="flex flex-col gap-2">
          <Button
            onClick={handleSubmit}
            disabled={input.trim() === ''}
            className="h-14 rounded-xl bg-[#7854F7] hover:bg-[#7854F7]/90 text-white font-semibold text-base disabled:opacity-40"
          >
            확인<ArrowRight className="w-4 h-4 ml-2" />
          </Button>
          <div className="flex gap-2">
            <Button
              onClick={() => { setUsedHint(true); setShowHint(true) }}
              disabled={showHint}
              variant="outline"
              className="flex-1 h-11 rounded-xl border-2 text-[#FFB100] border-[#FFB100]/30 hover:bg-[#FFB100]/5 disabled:opacity-30 font-medium"
            >
              <Lightbulb className="w-4 h-4 mr-1.5" />힌트
            </Button>
            <Button
              onClick={handleSkip}
              variant="outline"
              className="flex-1 h-11 rounded-xl border-2 text-gray-500 border-gray-200 hover:bg-gray-50 dark:border-gray-700 font-medium"
            >
              <SkipForward className="w-4 h-4 mr-1.5" />건너뛰기
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── 완료 화면 ────────────────────────────────────────────────────────────────

function DoneScreen({
  total,
  correct,
  xpEarned,
  streak,
}: {
  total: number
  correct: number
  xpEarned: number
  streak: number
}) {
  const router = useRouter()
  const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0
  const perfect = accuracy === 100

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center px-4">
      <motion.div
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20 }}
        className={`w-24 h-24 rounded-full flex items-center justify-center text-4xl font-black ${
          perfect ? 'bg-[#1FAF54]/10 text-[#1FAF54]' : 'bg-[#7854F7]/10 text-[#7854F7]'
        }`}
      >
        {perfect ? '🎉' : `${accuracy}%`}
      </motion.div>

      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
          {perfect ? '완벽해요!' : '복습 완료!'}
        </h2>
        <p className="text-sm text-gray-500">
          {total}개 중 {correct}개 정답
        </p>
      </div>

      <div className="flex gap-4">
        <div className="flex flex-col items-center gap-1 px-5 py-3 rounded-xl bg-[#FFB100]/10 border border-[#FFB100]/20">
          <Zap className="w-5 h-5 text-[#FFB100]" />
          <span className="text-lg font-black text-[#FFB100]">+{xpEarned}</span>
          <span className="text-xs text-gray-500">XP</span>
        </div>
        <div className="flex flex-col items-center gap-1 px-5 py-3 rounded-xl bg-[#FF6B35]/10 border border-[#FF6B35]/20">
          <Flame className="w-5 h-5 text-[#FF6B35]" />
          <span className="text-lg font-black text-[#FF6B35]">{streak}일</span>
          <span className="text-xs text-gray-500">스트릭</span>
        </div>
      </div>

      <div className="flex flex-col gap-3 w-full max-w-xs">
        <Button
          onClick={() => router.push('/student/words')}
          className="h-14 bg-[#7854F7] hover:bg-[#7854F7]/90 text-white rounded-xl font-semibold text-base"
        >
          새 단어 시작하기<ArrowRight className="w-4 h-4 ml-2" />
        </Button>
        <Button
          variant="ghost"
          onClick={() => router.push('/student')}
          className="text-gray-500 h-10"
        >
          홈으로
        </Button>
      </div>
    </div>
  )
}

// ─── 메인 ─────────────────────────────────────────────────────────────────────

export function ReviewClient({ cards }: Props) {
  const [phase, setPhase] = useState<Phase>('quizzing')
  const [index, setIndex] = useState(0)
  const [correctCount, setCorrectCount] = useState(0)
  const [answeredCount, setAnsweredCount] = useState(0)
  const [doneStats, setDoneStats] = useState({ xpEarned: 0, streak: 0 })

  const currentCard = cards[index]
  const mode = currentCard ? modeForCard(currentCard) : 'RECALL'

  const handleResult = useCallback(
    async (isCorrect: boolean) => {
      const newAnswered = answeredCount + 1
      const newCorrect = correctCount + (isCorrect ? 1 : 0)
      setAnsweredCount(newAnswered)
      setCorrectCount(newCorrect)

      const nextIndex = index + 1
      if (nextIndex >= cards.length) {
        // 세션 완료 — 게이미피케이션 이벤트
        const res = await completeReviewSession({
          completedCount: newAnswered,
          correctCount: newCorrect,
        })
        setDoneStats({
          xpEarned: res.ok ? res.data.xpEarned : 0,
          streak: res.ok ? res.data.currentStreak : 0,
        })
        setPhase('done')
      } else {
        setIndex(nextIndex)
      }
    },
    [index, answeredCount, correctCount, cards.length],
  )

  if (phase === 'done') {
    return (
      <DoneScreen
        total={answeredCount}
        correct={correctCount}
        xpEarned={doneStats.xpEarned}
        streak={doneStats.streak}
      />
    )
  }

  if (!currentCard) return null

  return (
    <div>
      <ProgressBar index={index} total={cards.length} correct={correctCount} answered={answeredCount} />

      {/* 모드 배지 */}
      <div className="flex justify-center mb-4">
        <span className={`text-xs font-semibold px-3 py-1 rounded-full ${
          mode === 'RECALL'
            ? 'bg-[#1865F2]/10 text-[#1865F2]'
            : 'bg-[#7854F7]/10 text-[#7854F7]'
        }`}>
          {mode === 'RECALL' ? '4지선다 리콜' : '스펠 주관식'}
        </span>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={`${index}-${currentCard.wordId}`}
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -40 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
        >
          {mode === 'RECALL' ? (
            <RecallCard card={currentCard} onResult={handleResult} />
          ) : (
            <SpellCard card={currentCard} onResult={handleResult} />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
