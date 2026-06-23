'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, XCircle, ArrowRight, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { submitWordTest } from '@/app/(dashboard)/student/words/_actions'
import type { WordTestQuestion } from '@/lib/words/test-grader'

interface AssignmentMeta {
  id: string
  title: string
  mode: string
  timePerQuestion: number
  numQuestions: number
  passingScore: number
}

interface Props {
  assignment: AssignmentMeta
  questions: WordTestQuestion[]
}

// ─── 원형 타이머 ──────────────────────────────────────────────────────────────

function CircularProgress({ remaining, total }: { remaining: number; total: number }) {
  const r = 22
  const circumference = 2 * Math.PI * r
  const progress = remaining / total
  const dashOffset = circumference * (1 - progress)
  const color = progress > 0.5 ? '#1865F2' : progress > 0.25 ? '#FFB100' : '#D92916'

  return (
    <div className="relative w-14 h-14 flex items-center justify-center">
      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 56 56" width={56} height={56}>
        <circle cx={28} cy={28} r={r} fill="none" stroke="#f3f4f6" strokeWidth={4} />
        <circle
          cx={28}
          cy={28}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={4}
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s' }}
        />
      </svg>
      <span className="text-sm font-bold" style={{ color }}>{remaining}</span>
    </div>
  )
}

// ─── 객관식 문항 ─────────────────────────────────────────────────────────────

function MultipleChoiceQuestion({
  question,
  selected,
  onSelect,
  onNext,
  isLast,
  isAnswered,
}: {
  question: WordTestQuestion
  selected: string | null
  onSelect: (answer: string) => void
  onNext: () => void
  isLast: boolean
  isAnswered: boolean
}) {
  const { term, meaning, direction, options = [] } = question
  const prompt = direction === 'EN_TO_KO' ? term : meaning
  const getLabel = (opt: { term: string; meaning: string }) =>
    direction === 'EN_TO_KO' ? opt.meaning : opt.term
  const correctAnswer = direction === 'EN_TO_KO' ? meaning : term

  return (
    <div className="flex flex-col min-h-[70vh]">
      <div className="text-center my-8 px-2">
        <p className="text-xs text-gray-400 mb-3 uppercase tracking-wide">
          {direction === 'EN_TO_KO' ? '한국어 뜻은?' : '영어 단어는?'}
        </p>
        <h2 className="text-3xl font-bold text-gray-900 leading-tight break-keep">{prompt}</h2>
        {direction === 'EN_TO_KO' && question.partOfSpeech && (
          <span className="inline-block mt-2 text-xs font-medium text-[#1865F2] bg-[#1865F2]/10 px-3 py-1 rounded-full">
            {question.partOfSpeech}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-3 flex-1">
        {options.map((opt, i) => {
          const label = getLabel(opt)
          const isSelected = selected === label
          const isCorrect = label === correctAnswer
          let cls =
            'border-gray-200 bg-white hover:border-[#1865F2] hover:bg-[#1865F2]/5 cursor-pointer'
          if (isAnswered) {
            if (isCorrect) cls = 'border-[#1FAF54] bg-[#1FAF54]/10'
            else if (isSelected) cls = 'border-[#D92916] bg-[#D92916]/10'
            else cls = 'border-gray-200 bg-white opacity-40'
          }
          return (
            <button
              key={opt.id}
              onClick={() => !isAnswered && onSelect(label)}
              disabled={isAnswered}
              className={`w-full min-h-[56px] rounded-xl border-2 flex items-center gap-3 px-4 text-left transition-all duration-200 ${cls}`}
            >
              <span className="text-sm font-bold text-gray-400 w-6 shrink-0 text-center">{i + 1}</span>
              <span className="flex-1 text-base font-medium text-gray-900 py-1">{label}</span>
              {isAnswered && isCorrect && <CheckCircle2 className="w-5 h-5 text-[#1FAF54] shrink-0" />}
              {isAnswered && isSelected && !isCorrect && <XCircle className="w-5 h-5 text-[#D92916] shrink-0" />}
            </button>
          )
        })}
      </div>

      <AnimatePresence>
        {isAnswered && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-5"
          >
            {selected !== correctAnswer && (
              <div className="rounded-xl bg-[#D92916]/5 border border-[#D92916]/20 px-4 py-3 mb-3">
                <p className="text-xs text-[#D92916] font-medium mb-0.5">정답</p>
                <p className="text-sm font-semibold text-gray-900">{correctAnswer}</p>
              </div>
            )}
            <Button
              onClick={onNext}
              className="w-full h-14 rounded-xl bg-[#1865F2] hover:bg-[#1865F2]/90 text-white font-semibold"
            >
              {isLast ? '제출하기' : '다음'} <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── 스펠링 문항 ─────────────────────────────────────────────────────────────

function SpellQuestion({
  question,
  onAnswer,
  onNext,
  isLast,
  isAnswered,
  userAnswer,
  isCorrect,
}: {
  question: WordTestQuestion
  onAnswer: (answer: string) => void
  onNext: () => void
  isLast: boolean
  isAnswered: boolean
  userAnswer: string
  isCorrect: boolean | null
}) {
  const [input, setInput] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!isAnswered) inputRef.current?.focus()
  }, [isAnswered])

  function handleSubmit() {
    if (!input.trim()) return
    onAnswer(input.trim())
  }

  return (
    <div className="flex flex-col min-h-[70vh]">
      <div className="text-center my-8 px-2">
        <p className="text-xs text-gray-400 mb-3 uppercase tracking-wide">영어 스펠링을 입력하세요</p>
        <h2 className="text-3xl font-bold text-gray-900 leading-tight">{question.meaning}</h2>
        {question.partOfSpeech && (
          <span className="inline-block mt-2 text-xs font-medium text-[#1865F2] bg-[#1865F2]/10 px-3 py-1 rounded-full">
            {question.partOfSpeech}
          </span>
        )}
      </div>

      <div className="space-y-3 flex-1">
        <Input
          ref={inputRef}
          value={input}
          onChange={(e) => !isAnswered && setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !isAnswered) handleSubmit()
            else if (e.key === 'Enter' && isAnswered) onNext()
          }}
          readOnly={isAnswered}
          placeholder="영어 단어를 입력하세요..."
          className={`h-14 text-center text-lg font-semibold rounded-xl ${
            isAnswered
              ? isCorrect
                ? 'border-[#1FAF54] bg-[#1FAF54]/5'
                : 'border-[#D92916] bg-[#D92916]/5'
              : ''
          }`}
        />
        {!isAnswered && (
          <Button
            onClick={handleSubmit}
            disabled={!input.trim()}
            className="w-full h-12 bg-[#1865F2] hover:bg-[#1865F2]/90 text-white rounded-xl font-semibold"
          >
            확인
          </Button>
        )}
      </div>

      <AnimatePresence>
        {isAnswered && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mt-5 space-y-3">
            {!isCorrect && (
              <div className="rounded-xl bg-[#D92916]/5 border border-[#D92916]/20 px-4 py-3">
                <p className="text-xs text-[#D92916] font-medium mb-1">정답</p>
                <p className="text-lg font-bold font-mono text-gray-900">{question.term}</p>
              </div>
            )}
            <Button
              onClick={onNext}
              className="w-full h-14 rounded-xl bg-[#1865F2] hover:bg-[#1865F2]/90 text-white font-semibold"
            >
              {isLast ? '제출하기' : '다음'} <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── 메인 클라이언트 ─────────────────────────────────────────────────────────

export function WordTestClient({ assignment, questions }: Props) {
  const router = useRouter()
  const [qIndex, setQIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [currentAnswer, setCurrentAnswer] = useState<string | null>(null)
  const [spellIsCorrect, setSpellIsCorrect] = useState<boolean | null>(null)
  const [timeLeft, setTimeLeft] = useState(assignment.timePerQuestion)
  const [submitting, setSubmitting] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const q = questions[qIndex]
  const isAnswered = currentAnswer !== null
  const isLast = qIndex === questions.length - 1

  // 타이머 시작/리셋
  useEffect(() => {
    setTimeLeft(assignment.timePerQuestion)
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          // 시간 초과 → 빈 답 처리
          handleAutoSkip()
          return 0
        }
        return t - 1
      })
    }, 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qIndex])

  function stopTimer() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
  }

  const handleAutoSkip = useCallback(() => {
    stopTimer()
    if (currentAnswer !== null) return // 이미 답변함
    setAnswers((prev) => ({ ...prev, [q.wordId]: '' }))
    setCurrentAnswer('')
    setSpellIsCorrect(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentAnswer, q])

  function handleMultipleSelect(answer: string) {
    stopTimer()
    setCurrentAnswer(answer)
    setAnswers((prev) => ({ ...prev, [q.wordId]: answer }))
  }

  function handleSpellAnswer(answer: string) {
    stopTimer()
    const correctTerm = q.term.trim().toLowerCase()
    const isOk = answer.trim().toLowerCase() === correctTerm
    setCurrentAnswer(answer)
    setSpellIsCorrect(isOk)
    setAnswers((prev) => ({ ...prev, [q.wordId]: answer }))
  }

  async function handleNext() {
    if (isLast) {
      await handleSubmit()
      return
    }
    setQIndex((i) => i + 1)
    setCurrentAnswer(null)
    setSpellIsCorrect(null)
  }

  async function handleSubmit() {
    setSubmitting(true)
    const result = await submitWordTest(assignment.id, answers)
    if (result.ok) {
      router.push(`/student/words/test/${assignment.id}/result`)
    } else {
      alert(result.error.message)
      setSubmitting(false)
    }
  }

  if (submitting) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-10 h-10 border-4 border-[#1865F2] border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-500">채점 중...</p>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto px-4 py-6">
      {/* 헤더: 진행바 + 타이머 */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-sm font-semibold text-gray-700">
              {qIndex + 1} / {questions.length}
            </span>
          </div>
          <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-[#1865F2] rounded-full"
              animate={{ width: `${((qIndex + 1) / questions.length) * 100}%` }}
              transition={{ ease: 'easeOut', duration: 0.3 }}
            />
          </div>
        </div>
        <CircularProgress remaining={timeLeft} total={assignment.timePerQuestion} />
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={qIndex}
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -40 }}
          transition={{ duration: 0.2 }}
        >
          {q.isSpell ? (
            <SpellQuestion
              question={q}
              onAnswer={handleSpellAnswer}
              onNext={handleNext}
              isLast={isLast}
              isAnswered={isAnswered}
              userAnswer={currentAnswer ?? ''}
              isCorrect={spellIsCorrect}
            />
          ) : (
            <MultipleChoiceQuestion
              question={q}
              selected={currentAnswer}
              onSelect={handleMultipleSelect}
              onNext={handleNext}
              isLast={isLast}
              isAnswered={isAnswered}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
