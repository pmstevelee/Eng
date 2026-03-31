'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronRight, Home, Zap, Trophy, Target } from 'lucide-react'
import {
  submitMissionAnswer,
  completeMission,
} from '@/app/(dashboard)/student/missions/[id]/actions'
import type { QuestionContentJson } from '@/components/shared/question-bank-client'

// ── 상수 ─────────────────────────────────────────────────────────────────────

const LETTERS = ['A', 'B', 'C', 'D']

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

const MISSION_TYPE_CONFIG: Record<
  string,
  { label: string; badgeBg: string; badgeText: string; emoji: string }
> = {
  WEAKNESS_DRILL: {
    label: '약점 보강',
    badgeBg: 'bg-red-50',
    badgeText: 'text-[#D92916]',
    emoji: '🎯',
  },
  CHALLENGE: {
    label: '도전 문제',
    badgeBg: 'bg-amber-50',
    badgeText: 'text-[#FFB100]',
    emoji: '⭐',
  },
  VOCAB_QUIZ: {
    label: '단어 퀴즈',
    badgeBg: 'bg-purple-50',
    badgeText: 'text-[#7854F7]',
    emoji: '📖',
  },
  REVIEW_MISSION: {
    label: '오답 복습',
    badgeBg: 'bg-teal-50',
    badgeText: 'text-[#0FBFAD]',
    emoji: '🔄',
  },
  BALANCE_PRACTICE: {
    label: '균형 연습',
    badgeBg: 'bg-blue-50',
    badgeText: 'text-[#1865F2]',
    emoji: '⚖️',
  },
  MINI_WRITING: {
    label: '쓰기 연습',
    badgeBg: 'bg-orange-50',
    badgeText: 'text-[#E35C20]',
    emoji: '✍️',
  },
}

// ── Props ────────────────────────────────────────────────────────────────────

type MissionInfo = {
  type: string
  title: string
  reason: string
  xpReward: number
  questionCount: number
  domain: string | null
  subCategory: string | null
}

type QuestionData = {
  id: string
  domain: string
  subCategory: string | null
  difficulty: number
  cefrLevel: string | null
  contentJson: QuestionContentJson
}

type FeedbackState = {
  isCorrect: boolean
  correctAnswer: string
  explanation?: string
  xpEarned: number
  categoryAccuracy: number | null
  prevCategoryAccuracy: number | null
  domainLabel?: string
  isChallenge: boolean
}

type MissionResult = {
  correctCount: number
  totalCount: number
  xpEarned: number
  categoryAccuracy: number | null
  prevCategoryAccuracy: number | null
  nextMission: { index: number; title: string } | null
  streakBonusXp: number
  newBadges: string[]
  isAllComplete: boolean
}

type Props = {
  mission: MissionInfo
  questions: QuestionData[]
  existingResponses: Record<string, string>
  dailyMissionId: string
  missionIndex: number
}

// ── 메인 컴포넌트 ──────────────────────────────────────────────────────────────

export function MissionPlayer({
  mission,
  questions,
  existingResponses,
  dailyMissionId,
  missionIndex,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // 첫 번째 미응답 문제 인덱스
  const initialIdx = Math.max(
    0,
    questions.findIndex((q) => !existingResponses[q.id]),
  )

  const [currentIdx, setCurrentIdx] = useState(initialIdx)
  const [answer, setAnswer] = useState<string>('')
  const [feedback, setFeedback] = useState<FeedbackState | null>(null)
  const [missionResult, setMissionResult] = useState<MissionResult | null>(null)

  // 누적 XP (기존 응답에서 계산 + 새로 획득한 XP)
  const [accumulatedXP, setAccumulatedXP] = useState<number>(() => {
    // 이미 answeredQuestions에 있는 xpEarned 합산은 page에서 처리 불가하므로 0 시작
    return 0
  })

  // 처음 카테고리 정확도 (첫 번째 submitMissionAnswer 응답에서 캡처)
  const [initialCategoryAccuracy, setInitialCategoryAccuracy] = useState<number | null>(null)

  const currentQuestion = questions[currentIdx]
  const isLastQuestion = currentIdx === questions.length - 1
  const typeConfig = MISSION_TYPE_CONFIG[mission.type] ?? MISSION_TYPE_CONFIG['BALANCE_PRACTICE']

  // ── 읽기 문제 탭 상태 ─────────────────────────────────────────────────────
  const [readingTab, setReadingTab] = useState<'passage' | 'question'>('passage')

  // ── 확인 버튼 ─────────────────────────────────────────────────────────────

  function handleConfirm() {
    if (!answer || isPending) return

    startTransition(async () => {
      const result = await submitMissionAnswer(
        dailyMissionId,
        missionIndex,
        currentQuestion.id,
        answer,
      )

      if (result.error) {
        // 이미 답변한 경우 등 → 다음으로
        handleNext()
        return
      }

      const xpEarned = result.xpEarned ?? 0
      setAccumulatedXP((prev) => prev + xpEarned)

      // 첫 번째 답 제출 시 초기 정확도 저장
      if (initialCategoryAccuracy === null && result.prevCategoryAccuracy != null) {
        setInitialCategoryAccuracy(result.prevCategoryAccuracy)
      }

      setFeedback({
        isCorrect: result.isCorrect ?? false,
        correctAnswer: result.correctAnswer ?? '',
        explanation: result.explanation,
        xpEarned,
        categoryAccuracy: result.categoryAccuracy ?? null,
        prevCategoryAccuracy: result.prevCategoryAccuracy ?? null,
        domainLabel: result.domainLabel,
        isChallenge: mission.type === 'CHALLENGE',
      })
    })
  }

  // ── 다음 문제 ─────────────────────────────────────────────────────────────

  function handleNext() {
    setFeedback(null)
    setAnswer('')
    setReadingTab('passage')

    if (isLastQuestion) {
      // 마지막 문제 → 미션 완료 처리
      startTransition(async () => {
        const result = await completeMission(dailyMissionId, missionIndex)

        if (result.error) {
          router.push('/student')
          return
        }

        setMissionResult({
          correctCount: result.correctCount ?? 0,
          totalCount: result.totalCount ?? questions.length,
          xpEarned: accumulatedXP,
          categoryAccuracy: result.categoryAccuracy ?? null,
          prevCategoryAccuracy: initialCategoryAccuracy,
          nextMission: result.nextMission ?? null,
          streakBonusXp: result.streakBonusXp ?? 0,
          newBadges: result.newBadges ?? [],
          isAllComplete: result.isAllComplete ?? false,
        })
      })
    } else {
      setCurrentIdx((prev) => prev + 1)
    }
  }

  // ── 미션 완료 화면 ────────────────────────────────────────────────────────

  if (missionResult) {
    return (
      <MissionCompleteScreen
        mission={mission}
        result={missionResult}
        dailyMissionId={dailyMissionId}
        typeConfig={typeConfig}
        onNextMission={(idx) =>
          router.push(`/student/missions/${dailyMissionId}?m=${idx}`)
        }
        onHome={() => router.push('/student')}
      />
    )
  }

  if (!currentQuestion) return null

  const content = currentQuestion.contentJson
  const isAnswerSelected = answer.trim().length > 0

  return (
    <div className="flex h-full flex-col">
      {/* ── 상단 바 ── */}
      <div className="shrink-0 border-b border-gray-200 bg-white px-4 py-3">
        <div className="mx-auto max-w-3xl space-y-2">
          {/* 미션 제목 + 배지 */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold text-gray-900 truncate">{mission.title}</span>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${typeConfig.badgeBg} ${typeConfig.badgeText}`}
            >
              {typeConfig.emoji} {typeConfig.label}
            </span>
          </div>

          {/* 추천 이유 */}
          {mission.reason && (
            <p className="text-xs text-gray-500 truncate">{mission.reason}</p>
          )}

          {/* 진행률 + 누적 XP */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5">
              {questions.map((_, i) => (
                <div
                  key={i}
                  className={`h-2 rounded-full transition-all ${
                    i < currentIdx
                      ? 'bg-[#1FAF54] w-6'
                      : i === currentIdx
                      ? 'bg-[#1865F2] w-6'
                      : 'bg-gray-200 w-4'
                  }`}
                />
              ))}
              <span className="ml-1 text-xs font-medium text-gray-500">
                {currentIdx + 1} / {questions.length}
              </span>
            </div>

            {accumulatedXP > 0 && (
              <span className="flex items-center gap-1 text-xs font-semibold text-[#FFB100]">
                <Zap className="h-3.5 w-3.5" />
                +{accumulatedXP} XP
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── 문제 영역 ── */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-4 py-6">
          {/* 도메인 배지 */}
          <div className="mb-4 flex items-center gap-2">
            <span
              className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium text-white"
              style={{ backgroundColor: DOMAIN_COLOR[currentQuestion.domain] ?? '#1865F2' }}
            >
              {DOMAIN_LABEL[currentQuestion.domain] ?? currentQuestion.domain}
            </span>
            <span className="text-xs text-gray-400">문제 {currentIdx + 1}</span>
          </div>

          {/* 피드백 영역 or 문제 렌더링 */}
          {feedback ? (
            <FeedbackPanel feedback={feedback} />
          ) : (
            <QuestionRenderer
              question={currentQuestion}
              content={content}
              answer={answer}
              onAnswer={setAnswer}
              readingTab={readingTab}
              onReadingTabChange={setReadingTab}
            />
          )}
        </div>
      </div>

      {/* ── 하단 버튼 ── */}
      <div className="shrink-0 border-t border-gray-200 bg-white px-4 py-3">
        <div className="mx-auto max-w-3xl">
          {feedback ? (
            <button
              onClick={handleNext}
              disabled={isPending}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#1865F2] text-sm font-semibold text-white transition-colors hover:bg-[#1558d6] disabled:opacity-60"
            >
              {isPending ? (
                '처리 중...'
              ) : isLastQuestion ? (
                <>미션 완료</>
              ) : (
                <>
                  다음 문제
                  <ChevronRight className="h-4 w-4" />
                </>
              )}
            </button>
          ) : (
            <button
              onClick={handleConfirm}
              disabled={!isAnswerSelected || isPending}
              className="flex h-12 w-full items-center justify-center rounded-xl bg-[#1865F2] text-sm font-semibold text-white transition-colors hover:bg-[#1558d6] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isPending ? '확인 중...' : '확인'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── 문제 렌더러 ───────────────────────────────────────────────────────────────

function QuestionRenderer({
  question,
  content,
  answer,
  onAnswer,
  readingTab,
  onReadingTabChange,
}: {
  question: QuestionData
  content: QuestionContentJson
  answer: string
  onAnswer: (v: string) => void
  readingTab: 'passage' | 'question'
  onReadingTabChange: (tab: 'passage' | 'question') => void
}) {
  if (content.type === 'essay') {
    return <EssayQuestion content={content} answer={answer} onAnswer={onAnswer} />
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
              <span
                className={`mt-0.5 text-sm leading-relaxed ${
                  isSelected ? 'font-medium text-[#1865F2]' : 'text-gray-700'
                }`}
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

// ── 빈칸 채우기 ───────────────────────────────────────────────────────────────

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

// ── 읽기 문제 ─────────────────────────────────────────────────────────────────

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
  readingTab: 'passage' | 'question'
  onReadingTabChange: (tab: 'passage' | 'question') => void
}) {
  const options = content.options ?? []

  return (
    <div>
      {/* 모바일 탭 */}
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

      {/* 모바일 콘텐츠 */}
      <div className="sm:hidden">
        {readingTab === 'passage' && (
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <p className="mb-3 text-sm font-semibold text-gray-500">지문</p>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-800">
              {content.passage}
            </p>
          </div>
        )}
        {readingTab === 'question' && (
          <QuestionOptions
            content={content}
            options={options}
            answer={answer}
            onAnswer={onAnswer}
          />
        )}
      </div>

      {/* 데스크탑 분할 */}
      <div className="hidden sm:block">
        <div className="mb-4 max-h-48 overflow-y-auto rounded-xl border border-gray-200 bg-gray-50 p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">지문</p>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-800">
            {content.passage}
          </p>
        </div>
        <QuestionOptions
          content={content}
          options={options}
          answer={answer}
          onAnswer={onAnswer}
        />
      </div>
    </div>
  )
}

function QuestionOptions({
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
              <span
                className={`mt-0.5 text-sm leading-relaxed ${
                  isSelected ? 'font-medium text-[#1865F2]' : 'text-gray-700'
                }`}
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
  const isOverLimit = wordLimit ? answer.length > wordLimit : false

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
          rows={7}
          className={`w-full resize-none rounded-xl border px-4 py-3 text-sm leading-relaxed text-gray-900 outline-none transition-all focus:ring-2 focus:ring-[#1865F2]/20 ${
            isOverLimit
              ? 'border-[#D92916] focus:border-[#D92916]'
              : 'border-gray-200 focus:border-[#1865F2]'
          }`}
        />
        <div
          className={`mt-1.5 text-right text-xs ${isOverLimit ? 'text-[#D92916]' : 'text-gray-400'}`}
        >
          {answer.length.toLocaleString()}
          {wordLimit ? ` / ${wordLimit.toLocaleString()}자` : '자'}
          {isOverLimit && <span className="ml-1 font-medium">최대 글자수 초과</span>}
        </div>
      </div>
    </div>
  )
}

// ── 피드백 패널 ───────────────────────────────────────────────────────────────

function FeedbackPanel({ feedback }: { feedback: FeedbackState }) {
  const { isCorrect, correctAnswer, explanation, xpEarned, categoryAccuracy, prevCategoryAccuracy, domainLabel, isChallenge } =
    feedback

  // 도전 문제 오답
  if (!isCorrect && isChallenge) {
    return (
      <div className="rounded-xl border border-[#FFB100]/30 bg-amber-50 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">⭐</span>
            <span className="font-bold text-[#FFB100]">도전 문제 — 아직 어려울 수 있어요!</span>
          </div>
          {xpEarned > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-[#FFB100]/10 px-3 py-1 text-sm font-bold text-[#FFB100]">
              <Zap className="h-3.5 w-3.5" />
              +{xpEarned} XP
            </span>
          )}
        </div>
        <p className="text-sm text-[#FFB100]/80">도전한 것만으로도 경험치 획득!</p>
        {correctAnswer && (
          <div className="rounded-lg bg-white/60 p-3 text-sm">
            <span className="font-semibold text-gray-600">정답: </span>
            <span className="font-bold text-gray-900">{correctAnswer}</span>
          </div>
        )}
        {explanation && (
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">해설</p>
            <p className="text-sm leading-relaxed text-gray-700">{explanation}</p>
          </div>
        )}
        <p className="text-xs text-gray-500">이 유형은 다음 레벨에서 본격적으로 다뤄요.</p>
      </div>
    )
  }

  // 정답
  if (isCorrect) {
    return (
      <div className="rounded-xl border border-[#1FAF54]/30 bg-[#F0FBF4] p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">✅</span>
            <span className="font-bold text-[#1FAF54]">정답이에요!</span>
          </div>
          {xpEarned > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-[#1FAF54]/10 px-3 py-1 text-sm font-bold text-[#1FAF54]">
              <Zap className="h-3.5 w-3.5" />
              +{xpEarned} XP
            </span>
          )}
        </div>

        {explanation && (
          <div className="rounded-lg bg-white/60 p-4 space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">해설</p>
            <p className="text-sm leading-relaxed text-gray-700">{explanation}</p>
          </div>
        )}

        {categoryAccuracy !== null && prevCategoryAccuracy !== null && domainLabel && (
          <p className="text-sm font-medium text-[#1FAF54]">
            📊 {domainLabel} 정답률:{' '}
            <span className="font-bold">
              {prevCategoryAccuracy}% → {categoryAccuracy}%
            </span>{' '}
            {categoryAccuracy > prevCategoryAccuracy ? '↑' : categoryAccuracy < prevCategoryAccuracy ? '↓' : ''}
          </p>
        )}
      </div>
    )
  }

  // 오답
  return (
    <div className="rounded-xl border border-[#D92916]/20 bg-red-50 p-6 space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-xl">❌</span>
        <span className="font-bold text-[#D92916]">아쉬워요!</span>
      </div>

      {correctAnswer && (
        <div className="rounded-lg bg-white/70 p-4 space-y-2 text-sm">
          <div>
            <span className="font-semibold text-gray-500">정답: </span>
            <span className="font-bold text-[#D92916]">{correctAnswer}</span>
          </div>
        </div>
      )}

      {explanation && (
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">해설</p>
          <p className="text-sm leading-relaxed text-gray-700">{explanation}</p>
        </div>
      )}

      <p className="text-xs text-gray-500">
        📝 이 문제는 내일 오답 복습에 나와요
      </p>
    </div>
  )
}

// ── 미션 완료 화면 ────────────────────────────────────────────────────────────

function MissionCompleteScreen({
  mission,
  result,
  dailyMissionId,
  typeConfig,
  onNextMission,
  onHome,
}: {
  mission: MissionInfo
  result: MissionResult
  dailyMissionId: string
  typeConfig: (typeof MISSION_TYPE_CONFIG)[string]
  onNextMission: (idx: number) => void
  onHome: () => void
}) {
  const scorePercent =
    result.totalCount > 0 ? Math.round((result.correctCount / result.totalCount) * 100) : 0

  const hasAccuracyChange =
    result.categoryAccuracy !== null &&
    result.prevCategoryAccuracy !== null &&
    mission.domain !== null

  return (
    <div className="mx-auto max-w-md px-4 py-10 space-y-6">
      {/* 헤더 */}
      <div className="text-center space-y-2">
        <div className="flex h-16 w-16 mx-auto items-center justify-center rounded-2xl bg-[#1865F2]/10">
          <Target className="h-8 w-8 text-[#1865F2]" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900">미션 완료!</h2>
        <p className="text-sm text-gray-500">{mission.title}</p>
      </div>

      {/* 점수 카드 */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-4">
        {/* 정답률 */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">정답</span>
          <span className="text-lg font-bold text-gray-900">
            {result.correctCount}/{result.totalCount}
            <span className="ml-2 text-sm font-medium text-gray-400">({scorePercent}%)</span>
          </span>
        </div>

        {/* XP */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">획득 XP</span>
          <span className="flex items-center gap-1 font-bold text-[#FFB100]">
            <Zap className="h-4 w-4" />
            +{result.xpEarned} XP
          </span>
        </div>

        {/* 스트릭 보너스 */}
        {result.streakBonusXp > 0 && (
          <div className="flex items-center justify-between rounded-lg bg-amber-50 px-3 py-2">
            <span className="text-sm font-medium text-[#FFB100]">🔥 스트릭 보너스</span>
            <span className="font-bold text-[#FFB100]">+{result.streakBonusXp} XP</span>
          </div>
        )}

        {/* 카테고리 정확도 */}
        {hasAccuracyChange && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">
              {DOMAIN_LABEL[mission.domain!] ?? mission.domain} 정답률
            </span>
            <span
              className={`text-sm font-bold ${
                result.categoryAccuracy! > result.prevCategoryAccuracy!
                  ? 'text-[#1FAF54]'
                  : 'text-[#D92916]'
              }`}
            >
              {result.prevCategoryAccuracy}% → {result.categoryAccuracy}%{' '}
              {result.categoryAccuracy! > result.prevCategoryAccuracy! ? '↑' : '↓'}
            </span>
          </div>
        )}
      </div>

      {/* 신규 배지 */}
      {result.newBadges.length > 0 && (
        <div className="rounded-xl border border-[#FFB100]/30 bg-amber-50 p-4 text-center space-y-1">
          <p className="text-sm font-bold text-[#FFB100]">🏅 새 배지 획득!</p>
          <p className="text-xs text-gray-500">{result.newBadges.join(', ')}</p>
        </div>
      )}

      {/* 전체 완료 축하 */}
      {result.isAllComplete && (
        <div className="rounded-xl border border-[#1FAF54]/30 bg-[#F0FBF4] p-4 text-center space-y-1">
          <p className="text-base font-bold text-[#1FAF54]">🎉 오늘의 모든 미션 완료!</p>
          <p className="text-xs text-gray-500">스트릭이 업데이트됐어요.</p>
        </div>
      )}

      {/* 다음 미션 안내 */}
      {result.nextMission && (
        <div className="rounded-xl border border-[#1865F2]/20 bg-blue-50 p-4 text-center">
          <p className="text-sm text-gray-500 mb-1">다음 미션</p>
          <p className="text-sm font-bold text-[#1865F2]">
            🔓 {result.nextMission.title} (해제됨!)
          </p>
        </div>
      )}

      {/* 버튼 */}
      <div className="flex flex-col gap-3">
        {result.nextMission && (
          <button
            onClick={() => onNextMission(result.nextMission!.index)}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#1865F2] text-sm font-semibold text-white transition-colors hover:bg-[#1558d6]"
          >
            다음 미션 시작
            <ChevronRight className="h-4 w-4" />
          </button>
        )}
        <button
          onClick={onHome}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
        >
          <Home className="h-4 w-4" />
          홈으로
        </button>
      </div>
    </div>
  )
}
