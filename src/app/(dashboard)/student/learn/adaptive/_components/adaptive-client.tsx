'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import {
  Brain,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  XCircle,
  RotateCcw,
  TrendingUp,
  Flame,
  Target,
  Star,
} from 'lucide-react'
import { gradeAnswer, savePracticeSession } from '../../actions'
import type {
  AdaptiveQuestion,
  StudentProfileSummary,
  PracticeQuestion,
  GradeResult,
  PracticeResultItem,
} from '../../actions'

// ── 상수 ───────────────────────────────────────────────────────────────────────

const LETTERS = ['A', 'B', 'C', 'D'] as const

const DOMAIN_COLOR: Record<string, string> = {
  GRAMMAR: '#1865F2',
  VOCABULARY: '#7854F7',
  READING: '#0FBFAD',
  WRITING: '#E35C20',
}

const DOMAIN_LABEL: Record<string, string> = {
  GRAMMAR: '문법',
  VOCABULARY: '어휘',
  READING: '독해',
  WRITING: '쓰기',
  grammar: '문법',
  vocabulary: '어휘',
  reading: '독해',
  writing: '쓰기',
}

const TAG_CONFIG = {
  weakness: {
    icon: '🎯',
    color: '#D92916',
    bg: '#FFF5F5',
    border: '#FCA5A5',
    textColor: '#B91C1C',
  },
  maintain: {
    icon: '✅',
    color: '#1FAF54',
    bg: '#F0FDF4',
    border: '#86EFAC',
    textColor: '#15803D',
  },
  challenge: {
    icon: '⭐',
    color: '#FFB100',
    bg: '#FFFBEB',
    border: '#FDE68A',
    textColor: '#B45309',
  },
} as const

// ── 타입 ───────────────────────────────────────────────────────────────────────

type AdaptiveResult = {
  questionId: string
  domain: string
  isCorrect: boolean
  tagType: 'weakness' | 'maintain' | 'challenge'
  tagLabel: string
}

type Phase = 'intro' | 'practicing' | 'complete'

type Props = {
  questions: AdaptiveQuestion[]
  summary: StudentProfileSummary
}

// ── 메인 컴포넌트 ──────────────────────────────────────────────────────────────

export function SmartAdaptiveClient({ questions, summary }: Props) {
  const [phase, setPhase] = useState<Phase>('intro')
  const [results, setResults] = useState<AdaptiveResult[]>([])

  function handleStart() {
    setPhase('practicing')
  }

  function handleComplete(adaptiveResults: AdaptiveResult[]) {
    setResults(adaptiveResults)
    setPhase('complete')
    // 세션 저장
    const items: PracticeResultItem[] = adaptiveResults.map((r) => ({
      questionId: r.questionId,
      domain: r.domain,
      isCorrect: r.isCorrect,
    }))
    savePracticeSession({ mode: 'adaptive', results: items }).catch(() => {})
  }

  if (phase === 'intro') {
    return <IntroScreen summary={summary} onStart={handleStart} />
  }

  if (phase === 'complete') {
    return <CompleteScreen results={results} summary={summary} onRestart={() => setPhase('intro')} />
  }

  return (
    <AdaptivePractice
      questions={questions}
      onComplete={handleComplete}
    />
  )
}

// ── 시작 전 분석 화면 ──────────────────────────────────────────────────────────

function IntroScreen({
  summary,
  onStart,
}: {
  summary: StudentProfileSummary
  onStart: () => void
}) {
  const weakLabel = DOMAIN_LABEL[summary.overallWeakest] ?? summary.overallWeakest
  const strongLabel = DOMAIN_LABEL[summary.overallStrongest] ?? summary.overallStrongest

  return (
    <div className="mx-auto max-w-md space-y-4">
      {/* AI 분석 배너 */}
      <div className="rounded-xl border border-[#7854F7]/30 bg-[#F9F7FF] p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#7854F7]">
            <Brain className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900">AI 학습 분석 완료</p>
            <p className="text-xs text-gray-500">
              Level {summary.currentLevel} · {summary.cefrLevel}
            </p>
          </div>
          {summary.readyForLevelUp && (
            <span className="ml-auto rounded-full bg-[#FFB100] px-2.5 py-0.5 text-xs font-bold text-white">
              레벨업 준비 완료!
            </span>
          )}
        </div>

        {/* 분석 결과 */}
        <div className="space-y-2.5">
          {/* 가장 약한 영역 */}
          <div className="flex items-start gap-2.5 rounded-xl bg-[#FFF5F5] border border-[#FCA5A5] p-3">
            <span className="text-base">🎯</span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-[#B91C1C]">집중 영역</p>
              <p className="text-sm font-bold text-gray-900">
                {weakLabel}
                {summary.weakestScore !== null ? ` (${summary.weakestScore}점)` : ''}
              </p>
              {summary.topWeakCategories.length > 0 && (
                <p className="mt-0.5 text-xs text-gray-500">
                  약점: {summary.topWeakCategories.join(', ')}
                </p>
              )}
            </div>
          </div>

          {/* 강점 영역 */}
          <div className="flex items-start gap-2.5 rounded-xl bg-[#F0FDF4] border border-[#86EFAC] p-3">
            <span className="text-base">✅</span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-[#15803D]">강점 영역</p>
              <p className="text-sm font-bold text-gray-900">
                {strongLabel}
                {summary.strongestScore !== null ? ` (${summary.strongestScore}점)` : ''}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 오늘의 문제 구성 */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <p className="mb-3 text-sm font-bold text-gray-900">오늘의 문제 구성</p>
        <div className="space-y-2">
          {summary.weakCount > 0 && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm">🎯</span>
                <span className="text-sm text-gray-700">약점 보강 문제</span>
              </div>
              <span className="rounded-full bg-[#FFF5F5] px-2.5 py-0.5 text-xs font-bold text-[#D92916]">
                {summary.weakCount}문제
              </span>
            </div>
          )}
          {summary.maintainCount > 0 && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm">✅</span>
                <span className="text-sm text-gray-700">실력 유지 문제</span>
              </div>
              <span className="rounded-full bg-[#F0FDF4] px-2.5 py-0.5 text-xs font-bold text-[#1FAF54]">
                {summary.maintainCount}문제
              </span>
            </div>
          )}
          {summary.challengeCount > 0 && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm">⭐</span>
                <span className="text-sm text-gray-700">도전 문제</span>
              </div>
              <span className="rounded-full bg-[#FFFBEB] px-2.5 py-0.5 text-xs font-bold text-[#B45309]">
                {summary.challengeCount}문제
              </span>
            </div>
          )}
        </div>

        {/* 총 문제 수 */}
        <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3">
          <span className="text-sm font-semibold text-gray-700">총</span>
          <span className="text-sm font-bold text-[#1865F2]">
            {summary.weakCount + summary.maintainCount + summary.challengeCount}문제
          </span>
        </div>
      </div>

      {/* 스트릭 */}
      {summary.streakDays > 0 && (
        <div className="flex items-center gap-2 rounded-xl border border-[#FFB100]/40 bg-[#FFFBEB] px-4 py-2.5">
          <Flame className="h-4 w-4 text-[#FFB100]" />
          <p className="text-sm font-medium text-[#B45309]">
            {summary.streakDays}일 연속 학습 중! 오늘도 화이팅!
          </p>
        </div>
      )}

      {/* 시작 버튼 */}
      <button
        onClick={onStart}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#1865F2] text-sm font-bold text-white transition-colors hover:bg-[#1558d6]"
      >
        학습 시작
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  )
}

// ── 문제 풀이 세션 ─────────────────────────────────────────────────────────────

function AdaptivePractice({
  questions,
  onComplete,
}: {
  questions: AdaptiveQuestion[]
  onComplete: (results: AdaptiveResult[]) => void
}) {
  const [currentIdx, setCurrentIdx] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState('')
  const [gradeResult, setGradeResult] = useState<GradeResult | null>(null)
  const [results, setResults] = useState<AdaptiveResult[]>([])
  const [isPending, startTransition] = useTransition()
  const [readingTab, setReadingTab] = useState<'passage' | 'question'>('passage')

  const currentQuestion = questions[currentIdx]
  const isAnswering = gradeResult === null

  function handleSubmit() {
    if (!selectedAnswer || isPending) return
    startTransition(async () => {
      const result = await gradeAnswer(currentQuestion.id, selectedAnswer)
      setGradeResult(result)
      setResults((prev) => [
        ...prev,
        {
          questionId: currentQuestion.id,
          domain: currentQuestion.domain,
          isCorrect: result.isCorrect,
          tagType: currentQuestion.tag.type,
          tagLabel: currentQuestion.tag.label,
        },
      ])
    })
  }

  function handleNext() {
    if (currentIdx < questions.length - 1) {
      setCurrentIdx((i) => i + 1)
      setSelectedAnswer('')
      setGradeResult(null)
      setReadingTab('passage')
    } else {
      const finalResults = [
        ...results,
      ]
      onComplete(finalResults)
    }
  }

  // 문제 이동 시 이미 채점된 결과가 있는 경우 onComplete에 전달
  function handleNextWithGuard() {
    if (gradeResult === null) return // 아직 채점 전
    handleNext()
  }

  const tagCfg = TAG_CONFIG[currentQuestion.tag.type]

  return (
    <div className="space-y-4">
      {/* 진행률 */}
      <div>
        <div className="mb-1 flex items-center justify-between text-xs text-gray-400">
          <span>진행</span>
          <span>{currentIdx + 1} / {questions.length}</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
          <div
            className="h-1.5 rounded-full bg-[#1865F2] transition-all"
            style={{ width: `${((currentIdx + 1) / questions.length) * 100}%` }}
          />
        </div>
      </div>

      {/* 문제 카드 */}
      <div className="rounded-xl border border-gray-200 bg-white">
        {/* 카드 헤더: 도메인 + 추천 태그 */}
        <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 px-5 py-3">
          <span
            className="rounded-full px-2.5 py-0.5 text-xs font-semibold text-white"
            style={{ backgroundColor: DOMAIN_COLOR[currentQuestion.domain] ?? '#1865F2' }}
          >
            {DOMAIN_LABEL[currentQuestion.domain] ?? currentQuestion.domain}
          </span>
          <span className="text-xs text-gray-400">문제 {currentIdx + 1}</span>
          {/* 추천 이유 태그 */}
          <span
            className="ml-auto rounded-full border px-2.5 py-0.5 text-xs font-semibold"
            style={{
              backgroundColor: tagCfg.bg,
              borderColor: tagCfg.border,
              color: tagCfg.textColor,
            }}
          >
            {tagCfg.icon} {currentQuestion.tag.label}
          </span>
        </div>

        {/* 문제 본문 */}
        <div className="px-5 py-5">
          {currentQuestion.content.type === 'multiple_choice' &&
          currentQuestion.content.passage ? (
            <ReadingQuestion
              content={currentQuestion.content}
              answer={selectedAnswer}
              onAnswer={setSelectedAnswer}
              gradeResult={gradeResult}
              readingTab={readingTab}
              onReadingTabChange={setReadingTab}
            />
          ) : currentQuestion.content.type === 'fill_blank' ||
            currentQuestion.content.type === 'short_answer' ? (
            <FillBlankQuestion
              content={currentQuestion.content}
              answer={selectedAnswer}
              onAnswer={setSelectedAnswer}
              gradeResult={gradeResult}
            />
          ) : (
            <MultipleChoiceQuestion
              content={currentQuestion.content}
              answer={selectedAnswer}
              onAnswer={setSelectedAnswer}
              gradeResult={gradeResult}
            />
          )}

          {/* 채점 피드백 */}
          {gradeResult !== null && (
            <AdaptiveFeedback
              result={gradeResult}
              question={currentQuestion}
            />
          )}
        </div>

        {/* 하단 버튼 */}
        <div className="border-t border-gray-100 px-5 py-4">
          {isAnswering ? (
            <button
              onClick={handleSubmit}
              disabled={!selectedAnswer || isPending}
              className="h-11 w-full rounded-xl bg-[#1865F2] text-sm font-semibold text-white transition-colors hover:bg-[#1558d6] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isPending ? '채점 중...' : '답변 제출'}
            </button>
          ) : (
            <div className="flex items-center justify-between gap-3">
              {currentIdx > 0 && (
                <button
                  onClick={() => {
                    setCurrentIdx((i) => i - 1)
                    setSelectedAnswer('')
                    setGradeResult(null)
                  }}
                  className="flex h-11 items-center gap-1 rounded-xl border border-gray-200 px-4 text-sm font-medium text-gray-600 hover:bg-gray-50"
                >
                  <ChevronLeft className="h-4 w-4" />
                  이전
                </button>
              )}
              <button
                onClick={handleNextWithGuard}
                className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#1865F2] text-sm font-semibold text-white transition-colors hover:bg-[#1558d6]"
              >
                {currentIdx < questions.length - 1 ? (
                  <>다음 문제 <ChevronRight className="h-4 w-4" /></>
                ) : (
                  '결과 보기'
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── 적응형 피드백 패널 ─────────────────────────────────────────────────────────

function AdaptiveFeedback({
  result,
  question,
}: {
  result: GradeResult
  question: AdaptiveQuestion
}) {
  const isWeakness = question.tag.type === 'weakness'
  const isChallenge = question.tag.type === 'challenge'

  return (
    <div
      className="mt-4 rounded-xl border p-4"
      style={{
        backgroundColor: result.isCorrect ? '#F0FDF4' : '#FFF5F5',
        borderColor: result.isCorrect ? '#86EFAC' : '#FCA5A5',
      }}
    >
      <div className="flex items-start gap-2">
        {result.isCorrect ? (
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#1FAF54]" />
        ) : (
          <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#D92916]" />
        )}
        <div className="flex-1 min-w-0">
          <p
            className="text-sm font-bold"
            style={{ color: result.isCorrect ? '#1FAF54' : '#D92916' }}
          >
            {result.isCorrect ? '정답입니다! 🎉' : '아쉽네요!'}
          </p>

          {!result.isCorrect && result.correctAnswer && (
            <p className="mt-1 text-sm text-gray-700">
              정답:{' '}
              <span className="font-semibold text-[#1FAF54]">{result.correctAnswer}</span>
            </p>
          )}

          {result.explanation && (
            <p className="mt-1.5 text-sm leading-relaxed text-gray-600">
              {result.explanation}
            </p>
          )}

          {/* 맥락별 메시지 */}
          {result.isCorrect && isWeakness && (
            <p className="mt-2 text-xs font-medium text-[#1FAF54]">
              <TrendingUp className="mr-1 inline h-3 w-3" />
              {question.tag.category
                ? `${question.tag.category} 정답률이 올라가고 있어요!`
                : '약점 영역을 극복하고 있어요!'}
            </p>
          )}
          {result.isCorrect && isChallenge && (
            <p className="mt-2 text-xs font-medium text-[#B45309]">
              <Star className="mr-1 inline h-3 w-3 fill-current" />
              도전 문제 정복! 레벨업이 가까워지고 있어요 🔥
            </p>
          )}
          {!result.isCorrect && isWeakness && (
            <p className="mt-2 text-xs text-gray-500">
              💡 이 문제는 복습 목록에 추가됩니다
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

// ── 완료 화면 ──────────────────────────────────────────────────────────────────

function CompleteScreen({
  results,
  summary,
  onRestart,
}: {
  results: AdaptiveResult[]
  summary: StudentProfileSummary
  onRestart: () => void
}) {
  const total = results.length
  const correct = results.filter((r) => r.isCorrect).length
  const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0

  // 타입별 집계
  const byType = {
    weakness: results.filter((r) => r.tagType === 'weakness'),
    maintain: results.filter((r) => r.tagType === 'maintain'),
    challenge: results.filter((r) => r.tagType === 'challenge'),
  }

  const typeStats = {
    weakness: {
      correct: byType.weakness.filter((r) => r.isCorrect).length,
      total: byType.weakness.length,
    },
    maintain: {
      correct: byType.maintain.filter((r) => r.isCorrect).length,
      total: byType.maintain.length,
    },
    challenge: {
      correct: byType.challenge.filter((r) => r.isCorrect).length,
      total: byType.challenge.length,
    },
  }

  const weakLabel = DOMAIN_LABEL[summary.overallWeakest] ?? summary.overallWeakest

  return (
    <div className="mx-auto max-w-md space-y-4">
      {/* 총점 */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 text-center">
        <div className="mb-2 text-4xl">
          {accuracy >= 80 ? '🎉' : accuracy >= 60 ? '😊' : '💪'}
        </div>
        <h2 className="text-xl font-bold text-gray-900">학습 완료!</h2>
        <p
          className="mt-2 text-4xl font-black"
          style={{ color: accuracy >= 70 ? '#1FAF54' : '#D92916' }}
        >
          {correct} / {total}
        </p>
        <p className="mt-0.5 text-sm text-gray-500">정답 ({accuracy}%)</p>
        <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-gray-100">
          <div
            className="h-2 rounded-full transition-all"
            style={{
              width: `${accuracy}%`,
              backgroundColor: accuracy >= 70 ? '#1FAF54' : '#D92916',
            }}
          />
        </div>
      </div>

      {/* 유형별 결과 */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <h3 className="mb-3 text-sm font-bold text-gray-900">유형별 결과</h3>
        <div className="space-y-3">
          {typeStats.weakness.total > 0 && (
            <TypeResultRow
              icon="🎯"
              label="약점 보강"
              stat={typeStats.weakness}
              message={
                typeStats.weakness.correct > 0
                  ? `${weakLabel} 실력이 조금씩 오르고 있어요!`
                  : `${weakLabel} 영역을 더 연습해봐요`
              }
              color="#D92916"
              bg="#FFF5F5"
            />
          )}
          {typeStats.maintain.total > 0 && (
            <TypeResultRow
              icon="✅"
              label="실력 유지"
              stat={typeStats.maintain}
              message={
                typeStats.maintain.correct === typeStats.maintain.total
                  ? `${DOMAIN_LABEL[summary.overallStrongest] ?? ''} 실력 유지 좋아요!`
                  : '강점 영역도 꾸준히 연습해요'
              }
              color="#1FAF54"
              bg="#F0FDF4"
            />
          )}
          {typeStats.challenge.total > 0 && (
            <TypeResultRow
              icon="⭐"
              label="도전 문제"
              stat={typeStats.challenge}
              message={
                typeStats.challenge.correct > 0
                  ? `Level ${summary.currentLevel + 1} 문제도 맞혔어요! 레벨업이 가까워요 🔥`
                  : '도전 계속! 조금만 더 하면 레벨업!'}
              color="#B45309"
              bg="#FFFBEB"
            />
          )}
        </div>
      </div>

      {/* 레벨업 준비 배너 */}
      {summary.readyForLevelUp && (
        <div className="flex items-center gap-3 rounded-xl border border-[#FFB100]/50 bg-[#FFFBEB] p-4">
          <Target className="h-5 w-5 shrink-0 text-[#FFB100]" />
          <p className="text-sm font-semibold text-[#B45309]">
            레벨업 조건을 충족했어요! 선생님께 레벨 테스트를 요청해보세요 🏆
          </p>
        </div>
      )}

      {/* 다음 추천 */}
      {summary.topWeakCategories.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
          <p className="text-xs font-semibold text-gray-500 mb-1">다음 학습 추천</p>
          <p className="text-sm text-gray-700">
            내일은{' '}
            <span className="font-semibold text-[#1865F2]">
              {summary.topWeakCategories[0]}
            </span>{' '}
            문제를 집중적으로 풀어보는 건 어떨까요?
          </p>
        </div>
      )}

      {/* 버튼 */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          onClick={onRestart}
          className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
        >
          <RotateCcw className="h-4 w-4" />
          다시 분석하기
        </button>
        <Link
          href="/student/learn"
          className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#1865F2] text-sm font-semibold text-white transition-colors hover:bg-[#1558d6]"
        >
          학습 홈으로
        </Link>
      </div>
    </div>
  )
}

function TypeResultRow({
  icon,
  label,
  stat,
  message,
  color,
  bg,
}: {
  icon: string
  label: string
  stat: { correct: number; total: number }
  message: string
  color: string
  bg: string
}) {
  const pct = stat.total > 0 ? Math.round((stat.correct / stat.total) * 100) : 0

  return (
    <div className="rounded-xl border p-3" style={{ backgroundColor: bg, borderColor: color + '40' }}>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <span className="text-sm">{icon}</span>
          <span className="text-xs font-semibold text-gray-700">{label}</span>
        </div>
        <span className="text-xs font-bold" style={{ color }}>
          {stat.correct}/{stat.total} ({pct}%)
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/70">
        <div
          className="h-1.5 rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <p className="mt-1.5 text-xs text-gray-600">{message}</p>
    </div>
  )
}

// ── 문제 렌더러 ────────────────────────────────────────────────────────────────

function MultipleChoiceQuestion({
  content,
  answer,
  onAnswer,
  gradeResult,
}: {
  content: PracticeQuestion['content']
  answer: string
  onAnswer: (v: string) => void
  gradeResult: GradeResult | null
}) {
  const options = content.options ?? []
  const isSubmitted = gradeResult !== null

  return (
    <div>
      <p className="mb-5 text-base leading-relaxed text-gray-900">{content.question_text}</p>
      {content.question_text_ko && (
        <p className="mb-4 text-sm leading-relaxed text-gray-500">{content.question_text_ko}</p>
      )}
      <div className="space-y-2.5">
        {options.map((opt, i) => {
          const letter = LETTERS[i] ?? String(i + 1)
          const isSelected = answer === letter
          const isCorrectOption = isSubmitted && gradeResult.correctAnswer === letter
          const isWrongSelected = isSubmitted && isSelected && !gradeResult.isCorrect

          return (
            <button
              key={i}
              onClick={() => !isSubmitted && onAnswer(letter)}
              disabled={isSubmitted}
              className="flex w-full items-start gap-3 rounded-xl border p-3.5 text-left transition-all"
              style={
                isCorrectOption
                  ? { backgroundColor: '#F0FDF4', borderColor: '#1FAF54' }
                  : isWrongSelected
                  ? { backgroundColor: '#FFF5F5', borderColor: '#D92916' }
                  : isSelected
                  ? { backgroundColor: '#EEF4FF', borderColor: '#1865F2' }
                  : { backgroundColor: 'white', borderColor: '#E5E7EB' }
              }
            >
              <span
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold"
                style={
                  isCorrectOption
                    ? { backgroundColor: '#1FAF54', color: 'white' }
                    : isWrongSelected
                    ? { backgroundColor: '#D92916', color: 'white' }
                    : isSelected
                    ? { backgroundColor: '#1865F2', color: 'white' }
                    : { backgroundColor: '#F3F4F6', color: '#4B5563' }
                }
              >
                {letter}
              </span>
              <span
                className="mt-0.5 text-sm leading-relaxed"
                style={
                  isCorrectOption
                    ? { color: '#15803D', fontWeight: 500 }
                    : isWrongSelected
                    ? { color: '#D92916', fontWeight: 500 }
                    : isSelected
                    ? { color: '#1865F2', fontWeight: 500 }
                    : { color: '#374151' }
                }
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

function FillBlankQuestion({
  content,
  answer,
  onAnswer,
  gradeResult,
}: {
  content: PracticeQuestion['content']
  answer: string
  onAnswer: (v: string) => void
  gradeResult: GradeResult | null
}) {
  const isSubmitted = gradeResult !== null
  return (
    <div>
      <p className="mb-4 text-base leading-relaxed text-gray-900">{content.question_text}</p>
      {content.question_text_ko && (
        <p className="mb-4 text-sm leading-relaxed text-gray-500">{content.question_text_ko}</p>
      )}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-700">답변 입력</label>
        <input
          type="text"
          value={answer}
          onChange={(e) => !isSubmitted && onAnswer(e.target.value)}
          disabled={isSubmitted}
          placeholder="답을 입력하세요"
          className="h-11 w-full rounded-xl border border-gray-200 px-4 text-sm text-gray-900 outline-none transition-all focus:border-[#1865F2] focus:ring-2 focus:ring-[#1865F2]/20 disabled:bg-gray-50"
        />
      </div>
    </div>
  )
}

function ReadingQuestion({
  content,
  answer,
  onAnswer,
  gradeResult,
  readingTab,
  onReadingTabChange,
}: {
  content: PracticeQuestion['content']
  answer: string
  onAnswer: (v: string) => void
  gradeResult: GradeResult | null
  readingTab: 'passage' | 'question'
  onReadingTabChange: (tab: 'passage' | 'question') => void
}) {
  return (
    <div>
      {/* 모바일 탭 */}
      <div className="mb-4 flex rounded-xl border border-gray-200 p-1 sm:hidden">
        {(['passage', 'question'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => onReadingTabChange(tab)}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
              readingTab === tab ? 'bg-[#0FBFAD] text-white' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab === 'passage' ? '지문' : '문제'}
          </button>
        ))}
      </div>
      <div className="sm:hidden">
        {readingTab === 'passage' && (
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">지문</p>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-800">
              {content.passage}
            </p>
          </div>
        )}
        {readingTab === 'question' && (
          <MultipleChoiceQuestion
            content={content}
            answer={answer}
            onAnswer={onAnswer}
            gradeResult={gradeResult}
          />
        )}
      </div>
      <div className="hidden sm:block">
        <div className="mb-4 max-h-52 overflow-y-auto rounded-xl border border-gray-200 bg-gray-50 p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">지문</p>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-800">
            {content.passage}
          </p>
        </div>
        <MultipleChoiceQuestion
          content={content}
          answer={answer}
          onAnswer={onAnswer}
          gradeResult={gradeResult}
        />
      </div>
    </div>
  )
}
