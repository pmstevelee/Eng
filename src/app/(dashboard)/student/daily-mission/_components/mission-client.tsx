'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, ChevronRight, ChevronLeft, Zap, Target, Volume2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { submitMissionAnswers } from '@/app/(dashboard)/student/_actions/gamification'

type ContentJson = {
  type: string
  question_text: string
  question_text_ko?: string
  options?: string[]
  correct_answer?: string
  explanation?: string
  passage?: string
  audio_url?: string
}

type Question = {
  id: string
  domain: string
  difficulty: number
  cefrLevel: string | null
  contentJson: unknown
}

type Mission = {
  id: string
  domainFocus: string | null
  isCompleted: boolean
}

const DOMAIN_LABELS: Record<string, string> = {
  GRAMMAR: 'Grammar',
  VOCABULARY: 'Vocabulary',
  READING: 'Reading',
  WRITING: 'Writing',
}

const DOMAIN_COLORS: Record<string, string> = {
  GRAMMAR: 'text-[#1865F2] bg-blue-50 border-blue-200',
  VOCABULARY: 'text-[#7854F7] bg-purple-50 border-purple-200',
  READING: 'text-[#0FBFAD] bg-teal-50 border-teal-200',
  WRITING: 'text-[#E35C20] bg-orange-50 border-orange-200',
}

interface Props {
  mission: Mission
  questions: Question[]
}

export function MissionClient({ mission, questions }: Props) {
  const router = useRouter()
  const [currentIdx, setCurrentIdx] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [submitted, setSubmitted] = useState(false)
  const [result, setResult] = useState<{ score: number; newBadges: string[] } | null>(null)
  const [loading, setLoading] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const currentQ = questions[currentIdx]
  const content = currentQ?.contentJson as ContentJson
  const total = questions.length
  const progress = (Object.keys(answers).length / total) * 100

  const handleAnswer = (questionId: string, answer: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: answer }))
  }

  const handleSubmit = async () => {
    setLoading(true)
    const answerList = Object.entries(answers).map(([questionId, answer]) => ({
      questionId,
      answer,
    }))
    const res = await submitMissionAnswers(
      mission.id,
      answerList,
    )
    setLoading(false)
    if (res.error) {
      alert(res.error)
      return
    }
    setResult({ score: res.score ?? 0, newBadges: res.newBadges ?? [] })
    setSubmitted(true)
  }

  if (submitted && result) {
    return (
      <MissionResult
        score={result.score}
        newBadges={result.newBadges}
        total={total}
        correct={Math.round((result.score / 100) * total)}
        onGoHome={() => router.push('/student')}
        onViewBadges={() =>
          router.push(
            result.newBadges.length > 0
              ? `/student/badges?new=${result.newBadges[0]}`
              : '/student/badges',
          )
        }
      />
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#1865F2] flex items-center justify-center">
            <Target size={20} className="text-white" />
          </div>
          <div>
            <h2 className="font-bold text-gray-900">오늘의 미션</h2>
            <p className="text-sm text-gray-500">
              {DOMAIN_LABELS[mission.domainFocus ?? 'GRAMMAR']} 집중 학습 ·{' '}
              {total}문제
            </p>
          </div>
        </div>
        <span className="text-sm font-medium text-[#1865F2]">
          {currentIdx + 1} / {total}
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-gray-100 rounded-full h-2">
        <div
          className="h-2 rounded-full bg-[#1865F2] transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Question card */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-5">
        {/* Domain badge */}
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${DOMAIN_COLORS[currentQ.domain] ?? ''}`}
        >
          {DOMAIN_LABELS[currentQ.domain]}
        </span>

        {/* Audio player (listening) */}
        {content.audio_url && (
          <div className="bg-gray-50 rounded-lg p-3 border border-gray-200 flex items-center gap-3">
            <button
              onClick={() => {
                if (!audioRef.current) {
                  audioRef.current = new Audio(content.audio_url)
                }
                audioRef.current.currentTime = 0
                audioRef.current.play()
              }}
              className="w-10 h-10 rounded-full bg-[#1865F2] flex items-center justify-center flex-shrink-0 hover:bg-[#1558d6] transition-colors"
            >
              <Volume2 size={16} className="text-white" />
            </button>
            <span className="text-sm text-gray-600">음성을 듣고 답하세요</span>
          </div>
        )}

        {/* Passage (reading) */}
        {content.passage && (
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 max-h-48 overflow-y-auto">
            <p className="text-xs font-semibold text-gray-500 uppercase mb-2 tracking-wide">지문</p>
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{content.passage}</p>
          </div>
        )}

        {/* Question text */}
        <div className="space-y-1">
          <p className="text-base font-medium text-gray-900 whitespace-pre-line">
            {content.question_text}
          </p>
          {content.question_text_ko && (
            <p className="text-sm text-gray-500">{content.question_text_ko}</p>
          )}
        </div>

        {/* Answer input */}
        {content.type === 'multiple_choice' && content.options && (
          <div className="space-y-2">
            {content.options.map((opt, i) => {
              const letter = String.fromCharCode(65 + i) // A, B, C, D
              const selected = answers[currentQ.id] === letter
              return (
                <button
                  key={i}
                  onClick={() => handleAnswer(currentQ.id, letter)}
                  className={`w-full text-left px-4 py-3 rounded-xl border-2 text-sm transition-all ${
                    selected
                      ? 'border-[#1865F2] bg-blue-50 text-[#1865F2] font-medium'
                      : 'border-gray-200 hover:border-gray-300 text-gray-700'
                  }`}
                >
                  <span className="font-bold mr-2">{letter}.</span> {opt}
                </button>
              )
            })}
          </div>
        )}

        {(content.type === 'fill_blank' || content.type === 'short_answer') && (
          <div className="space-y-1">
            {content.type === 'short_answer' && (
              <p className="text-xs text-gray-500">단답형 — 짧게 영어로 답하세요</p>
            )}
            <input
              type="text"
              placeholder="답을 입력하세요..."
              value={answers[currentQ.id] ?? ''}
              onChange={(e) => handleAnswer(currentQ.id, e.target.value)}
              className="w-full min-h-[44px] px-4 py-2.5 rounded-xl border-2 border-gray-200 focus:border-[#1865F2] focus:outline-none text-sm transition-colors"
            />
          </div>
        )}

        {content.type === 'essay' && (
          <textarea
            placeholder="영어로 답변을 작성하세요..."
            value={answers[currentQ.id] ?? ''}
            onChange={(e) => handleAnswer(currentQ.id, e.target.value)}
            rows={4}
            className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-[#1865F2] focus:outline-none text-sm resize-none transition-colors"
          />
        )}

        {/* Fallback: unknown type — 기본 텍스트 입력 제공 */}
        {content.type !== 'multiple_choice' &&
          content.type !== 'fill_blank' &&
          content.type !== 'short_answer' &&
          content.type !== 'essay' && (
            <input
              type="text"
              placeholder="답을 입력하세요..."
              value={answers[currentQ.id] ?? ''}
              onChange={(e) => handleAnswer(currentQ.id, e.target.value)}
              className="w-full min-h-[44px] px-4 py-2.5 rounded-xl border-2 border-gray-200 focus:border-[#1865F2] focus:outline-none text-sm transition-colors"
            />
          )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
          disabled={currentIdx === 0}
          className="min-h-[44px]"
        >
          <ChevronLeft size={16} className="mr-1" />
          이전
        </Button>

        {currentIdx < total - 1 ? (
          <Button
            onClick={() => setCurrentIdx((i) => i + 1)}
            disabled={!answers[currentQ.id]}
            className="min-h-[44px] bg-[#1865F2] hover:bg-[#1558d6]"
          >
            다음
            <ChevronRight size={16} className="ml-1" />
          </Button>
        ) : (
          <Button
            onClick={handleSubmit}
            disabled={Object.keys(answers).length < total || loading}
            className="min-h-[44px] bg-[#1FAF54] hover:bg-[#189944] text-white"
          >
            {loading ? (
              '제출 중...'
            ) : (
              <>
                <CheckCircle2 size={16} className="mr-1.5" />
                미션 완료!
              </>
            )}
          </Button>
        )}
      </div>

      {/* Answer count indicator */}
      <p className="text-center text-xs text-gray-400">
        {Object.keys(answers).length}/{total}문제 답변 완료
      </p>
    </div>
  )
}

// ─── Result screen ────────────────────────────────────────────────────────────

function MissionResult({
  score,
  newBadges,
  total,
  correct,
  onGoHome,
  onViewBadges,
}: {
  score: number
  newBadges: string[]
  total: number
  correct: number
  onGoHome: () => void
  onViewBadges: () => void
}) {
  const emoji = score >= 80 ? '🎉' : score >= 60 ? '👍' : '💪'
  const message =
    score >= 80
      ? '훌륭해요! 오늘 미션 완료!'
      : score >= 60
        ? '잘 했어요! 계속 연습하면 더 잘할 수 있어요!'
        : '아직 배울 게 있어요. 매일 연습해봐요!'

  return (
    <div className="max-w-md mx-auto text-center space-y-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-8 space-y-6">
        <div className="text-6xl">{emoji}</div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-1">미션 완료!</h2>
          <p className="text-gray-500">{message}</p>
        </div>

        {/* Score ring */}
        <div className="flex items-center justify-center">
          <div className="relative w-28 h-28">
            <svg className="w-28 h-28 -rotate-90" viewBox="0 0 112 112">
              <circle cx="56" cy="56" r="48" fill="none" stroke="#F0F0F0" strokeWidth="8" />
              <circle
                cx="56"
                cy="56"
                r="48"
                fill="none"
                stroke={score >= 80 ? '#1FAF54' : score >= 60 ? '#FFB100' : '#1865F2'}
                strokeWidth="8"
                strokeDasharray={`${(score / 100) * 301.6} 301.6`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold text-gray-900">{score}</span>
              <span className="text-xs text-gray-500">점</span>
            </div>
          </div>
        </div>

        <p className="text-sm text-gray-600">
          {total}문제 중 <strong>{correct}문제</strong> 정답
        </p>

        {/* New badges */}
        {newBadges.length > 0 && (
          <div className="bg-[#FFB100]/10 rounded-xl p-4 border border-[#FFB100]/30">
            <div className="flex items-center gap-2 mb-2">
              <Zap size={16} className="text-[#FFB100]" />
              <span className="text-sm font-bold text-gray-800">새 배지 획득!</span>
            </div>
            <p className="text-xs text-gray-600">{newBadges.length}개의 새로운 배지를 받았어요</p>
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <Button
          variant="outline"
          onClick={onGoHome}
          className="flex-1 min-h-[44px]"
        >
          홈으로
        </Button>
        {newBadges.length > 0 && (
          <Button
            onClick={onViewBadges}
            className="flex-1 min-h-[44px] bg-[#1865F2] hover:bg-[#1558d6]"
          >
            배지 확인
          </Button>
        )}
      </div>
    </div>
  )
}
