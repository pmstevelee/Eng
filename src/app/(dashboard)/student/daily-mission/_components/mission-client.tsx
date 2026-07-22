'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, XCircle, ChevronRight, ChevronLeft, Zap, Target, Volume2, Flag, HelpCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  submitMissionAnswers,
  revalidateMissionDashboard,
  type MissionAnswerResult,
} from '@/app/(dashboard)/student/_actions/gamification'
import { reportQuestion } from '@/lib/questions/report-actions'
import type { QuestionReportType } from '@/generated/prisma'

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
  const [result, setResult] = useState<{
    score: number
    newBadges: string[]
    results: MissionAnswerResult[]
    xpEarned: number
  } | null>(null)
  const [loading, setLoading] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [showReportModal, setShowReportModal] = useState(false)
  const [reportSubmitting, setReportSubmitting] = useState(false)
  const [reportDone, setReportDone] = useState(false)

  const currentQ = questions[currentIdx]
  const content = currentQ?.contentJson as ContentJson
  const total = questions.length
  const answeredCount = Object.keys(answers).length
  const progress = (answeredCount / total) * 100
  const isCurrentAnswered = currentQ.id in answers

  const handleAnswer = (questionId: string, answer: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: answer }))
  }

  const handleDontKnow = () => {
    setAnswers((prev) => ({ ...prev, [currentQ.id]: '' }))
    if (currentIdx < total - 1) {
      setCurrentIdx((i) => i + 1)
    }
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
    setResult({
      score: res.score ?? 0,
      newBadges: res.newBadges ?? [],
      results: res.results ?? [],
      xpEarned: res.xpEarned ?? 0,
    })
    setSubmitted(true)
  }

  const handleComplete = async () => {
    await revalidateMissionDashboard()
    router.push('/student')
  }

  if (submitted && result) {
    return (
      <MissionResult
        score={result.score}
        newBadges={result.newBadges}
        xpEarned={result.xpEarned}
        results={result.results}
        questions={questions}
        answers={answers}
        total={total}
        correct={Math.round((result.score / 100) * total)}
        onComplete={handleComplete}
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
        {/* Domain badge + 오류 신고 */}
        <div className="flex items-center justify-between gap-2">
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${DOMAIN_COLORS[currentQ.domain] ?? ''}`}
          >
            {DOMAIN_LABELS[currentQ.domain]}
          </span>
          <button
            onClick={() => {
              setShowReportModal(true)
              setReportDone(false)
            }}
            className="flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1 text-xs text-gray-400 transition-colors hover:border-orange-300 hover:text-orange-500"
            title="오류 신고"
          >
            <Flag className="h-3 w-3" />
            오류 신고
          </button>
        </div>

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

        {/* 정답을 모를 때 */}
        <button
          onClick={handleDontKnow}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-gray-300 py-2.5 text-sm font-medium text-gray-500 transition-colors hover:border-gray-400 hover:bg-gray-50"
        >
          <HelpCircle size={15} />
          모르겠어요
        </button>
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
            disabled={!isCurrentAnswered}
            className="min-h-[44px] bg-[#1865F2] hover:bg-[#1558d6]"
          >
            다음
            <ChevronRight size={16} className="ml-1" />
          </Button>
        ) : (
          <Button
            onClick={handleSubmit}
            disabled={answeredCount < total || loading}
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
        {answeredCount}/{total}문제 답변 완료
      </p>

      {/* 오류 신고 모달 */}
      {showReportModal && (
        <ReportModal
          onClose={() => setShowReportModal(false)}
          isSubmitting={reportSubmitting}
          isDone={reportDone}
          onSubmit={async (type, desc) => {
            setReportSubmitting(true)
            const res = await reportQuestion({ questionId: currentQ.id, reportType: type, description: desc })
            setReportSubmitting(false)
            if (!res.error) setReportDone(true)
            return res
          }}
        />
      )}
    </div>
  )
}

// ─── Result screen ────────────────────────────────────────────────────────────

const LETTERS = ['A', 'B', 'C', 'D']

function optionText(content: ContentJson, letter: string): string | null {
  const idx = LETTERS.indexOf(letter)
  if (idx === -1) return null
  return content.options?.[idx] ?? null
}

function MissionResult({
  score,
  newBadges,
  xpEarned,
  results,
  questions,
  answers,
  total,
  correct,
  onComplete,
  onViewBadges,
}: {
  score: number
  newBadges: string[]
  xpEarned: number
  results: MissionAnswerResult[]
  questions: Question[]
  answers: Record<string, string>
  total: number
  correct: number
  onComplete: () => void
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
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-8 space-y-6 text-center">
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

        {xpEarned > 0 && (
          <div className="inline-flex items-center gap-1.5 rounded-full bg-[#1865F2]/10 px-3 py-1.5 text-sm font-bold text-[#1865F2]">
            <Zap size={14} />+{xpEarned} XP 획득!
          </div>
        )}

        {/* New badges */}
        {newBadges.length > 0 && (
          <div className="bg-[#FFB100]/10 rounded-xl p-4 border border-[#FFB100]/30">
            <div className="flex items-center gap-2 mb-2 justify-center">
              <Zap size={16} className="text-[#FFB100]" />
              <span className="text-sm font-bold text-gray-800">새 배지 획득!</span>
            </div>
            <p className="text-xs text-gray-600">{newBadges.length}개의 새로운 배지를 받았어요</p>
          </div>
        )}
      </div>

      {/* 문제별 정답 여부 */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-gray-900 px-1">문제별 결과</h3>
        {questions.map((q, idx) => {
          const content = q.contentJson as ContentJson
          const r = results.find((res) => res.questionId === q.id)
          const isEssay = content.type === 'essay'
          const studentAnswer = answers[q.id] ?? r?.studentAnswer ?? ''
          const isCorrect = r?.isCorrect ?? false

          return (
            <div
              key={q.id}
              className={`rounded-xl border p-4 space-y-2 ${
                isEssay
                  ? 'border-gray-200 bg-white'
                  : isCorrect
                    ? 'border-[#1FAF54]/30 bg-[#F0FBF4]'
                    : 'border-[#D92916]/20 bg-red-50'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-400">문제 {idx + 1}</span>
                {!isEssay &&
                  (isCorrect ? (
                    <span className="flex items-center gap-1 text-xs font-semibold text-[#1FAF54]">
                      <CheckCircle2 size={14} />
                      정답
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs font-semibold text-[#D92916]">
                      <XCircle size={14} />
                      오답
                    </span>
                  ))}
              </div>

              <p className="text-sm text-gray-900 whitespace-pre-line">{content.question_text}</p>

              {isEssay ? (
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                  <p className="mb-1 text-xs font-medium text-gray-400">내 답안</p>
                  <p className="whitespace-pre-wrap text-sm text-gray-700">
                    {studentAnswer || '(미응답)'}
                  </p>
                </div>
              ) : (
                <div className="rounded-lg bg-white/70 p-3 space-y-1 text-sm">
                  <div>
                    <span className="font-semibold text-gray-500">내 답: </span>
                    <span className={`font-bold ${isCorrect ? 'text-[#1FAF54]' : 'text-[#D92916]'}`}>
                      {studentAnswer || '(미응답)'}
                      {optionText(content, studentAnswer) ? ` — ${optionText(content, studentAnswer)}` : ''}
                    </span>
                  </div>
                  {!isCorrect && r?.correctAnswer && (
                    <div>
                      <span className="font-semibold text-gray-500">정답: </span>
                      <span className="font-bold text-[#1FAF54]">
                        {r.correctAnswer}
                        {optionText(content, r.correctAnswer) ? ` — ${optionText(content, r.correctAnswer)}` : ''}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {r?.explanation && (
                <div className="rounded-lg border border-[#1865F2]/20 bg-[#1865F2]/5 p-3">
                  <p className="mb-1 text-xs font-semibold text-[#1865F2]">해설</p>
                  <p className="text-sm text-[#1865F2]/80">{r.explanation}</p>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="flex gap-3">
        <Button onClick={onComplete} className="flex-1 min-h-[44px] bg-[#1865F2] hover:bg-[#1558d6]">
          완료
        </Button>
        {newBadges.length > 0 && (
          <Button variant="outline" onClick={onViewBadges} className="flex-1 min-h-[44px]">
            배지 확인
          </Button>
        )}
      </div>
    </div>
  )
}

// ─── 오류 신고 모달 ────────────────────────────────────────────────────────────

const REPORT_TYPES: { value: QuestionReportType; label: string }[] = [
  { value: 'WRONG_ANSWER', label: '정답 오류' },
  { value: 'TYPO', label: '오탈자' },
  { value: 'UNCLEAR', label: '문제 불명확' },
  { value: 'AUDIO_ERROR', label: '음원 오류' },
  { value: 'OTHER', label: '기타' },
]

function ReportModal({
  onClose,
  isSubmitting,
  isDone,
  onSubmit,
}: {
  onClose: () => void
  isSubmitting: boolean
  isDone: boolean
  onSubmit: (type: QuestionReportType, desc: string) => Promise<{ error?: string }>
}) {
  const [selectedType, setSelectedType] = useState<QuestionReportType>('WRONG_ANSWER')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')

  async function handleSubmit() {
    setError('')
    const res = await onSubmit(selectedType, description)
    if (res.error) setError(res.error)
  }

  if (isDone) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
        <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-sm text-center">
          <div className="mb-4 mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-50">
            <Flag className="h-6 w-6 text-[#1FAF54]" />
          </div>
          <h3 className="text-base font-bold text-gray-900 mb-2">신고가 접수되었습니다</h3>
          <p className="text-sm text-gray-500 mb-6">검토 후 반영하겠습니다. 감사합니다.</p>
          <button
            onClick={onClose}
            className="w-full rounded-xl bg-[#1865F2] py-3 text-sm font-semibold text-white"
          >
            닫기
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-50">
            <Flag className="h-5 w-5 text-orange-500" />
          </div>
          <h3 className="text-base font-bold text-gray-900">문제 오류 신고</h3>
        </div>

        <p className="text-xs text-gray-500 mb-4">오류 유형을 선택하고 내용을 입력해 주세요.</p>

        {/* 신고 유형 */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          {REPORT_TYPES.map((t) => (
            <button
              key={t.value}
              onClick={() => setSelectedType(t.value)}
              className={`rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${
                selectedType === t.value
                  ? 'border-orange-400 bg-orange-50 text-orange-600'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* 설명 */}
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="오류 내용을 자세히 설명해 주세요. (선택)"
          rows={3}
          maxLength={500}
          className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm resize-none outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400"
        />

        {error && <p className="mt-2 text-xs text-[#D92916]">{error}</p>}

        <div className="mt-4 flex gap-3">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="flex-1 rounded-xl border border-gray-200 py-3 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-60"
          >
            취소
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex-1 rounded-xl bg-orange-500 py-3 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-60"
          >
            {isSubmitting ? '신고 중...' : '신고하기'}
          </button>
        </div>
      </div>
    </div>
  )
}
