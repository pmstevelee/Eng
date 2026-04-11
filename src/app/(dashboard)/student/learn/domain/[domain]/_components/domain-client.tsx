'use client'

import { useState, useTransition, useRef } from 'react'
import {
  ChevronRight,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Sparkles,
  Target,
  BarChart2,
  TrendingUp,
  AlertCircle,
  BookOpen,
  Volume2,
  Play,
  Pause,
} from 'lucide-react'
import {
  gradeAnswer,
  getSmartDomainQuestions,
  savePracticeSession,
  generateSessionAdvice,
} from '../../../actions'
import type {
  SmartDomainQuestion,
  LearningMode,
  DomainProfileData,
  CategoryAccuracy,
  GradeResult,
  PracticeResultItem,
  SessionAdvice,
} from '../../../actions'

// ── 타입 ──────────────────────────────────────────────────────────────────────

type AiQuestion = {
  id: string // 클라이언트 임시 ID
  questionText: string
  options: string[]
  correctAnswer: string // "A" | "B" | "C" | "D"
  explanation: string
  keyPoint: string
  commonMistake: string
  subCategory?: string
}

type QuestionResult = {
  questionId: string
  subCategory: string | null
  isCorrect: boolean
  isAiGenerated: boolean
}

type ChainState = {
  active: boolean
  category: string
  attempts: number // 1~3
  isLoading: boolean
  successMessage: boolean // 방금 맞춤
  giveUp: boolean // 3회 연속 실패
  currentAiQuestion: AiQuestion | null
  lastWrongAnswer: string // AI 문제 채점용
  lastWrongQuestionText: string // 재요청용
}

type SessionPhase = 'mode-select' | 'practicing' | 'complete'

type PracticeSubPhase = 'answering' | 'feedback'

// ── 상수 ──────────────────────────────────────────────────────────────────────

const LETTERS = ['A', 'B', 'C', 'D'] as const

// ── Props ─────────────────────────────────────────────────────────────────────

type Props = {
  domain: string
  domainLabel: string
  domainColor: string
  domainBg: string
  domainBorder: string
  profileData: DomainProfileData
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────────────────────

export function DomainClient({
  domain,
  domainLabel,
  domainColor,
  domainBg,
  domainBorder,
  profileData,
}: Props) {
  const [phase, setPhase] = useState<SessionPhase>('mode-select')
  const [selectedMode, setSelectedMode] = useState<LearningMode>('balanced')
  const [isPending, startTransition] = useTransition()

  // 풀이 상태
  const [questions, setQuestions] = useState<SmartDomainQuestion[]>([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState('')
  const [subPhase, setSubPhase] = useState<PracticeSubPhase>('answering')
  const [gradeResult, setGradeResult] = useState<GradeResult | null>(null)
  const [results, setResults] = useState<QuestionResult[]>([])

  // 유사 문제 체인 상태 (약점 집중 모드)
  const [chain, setChain] = useState<ChainState>({
    active: false,
    category: '',
    attempts: 0,
    isLoading: false,
    successMessage: false,
    giveUp: false,
    currentAiQuestion: null,
    lastWrongAnswer: '',
    lastWrongQuestionText: '',
  })

  // 완료 화면 상태
  const [advice, setAdvice] = useState<SessionAdvice | null>(null)
  const [loadingAdvice, setLoadingAdvice] = useState(false)

  // ── 모드 선택 → 문제 로드 ───────────────────────────────────────────────────

  function handleModeSelect(mode: LearningMode) {
    setSelectedMode(mode)
    startTransition(async () => {
      const qs = await getSmartDomainQuestions(domain, mode, 5)
      setQuestions(qs)
      setCurrentIdx(0)
      setSelectedAnswer('')
      setSubPhase('answering')
      setGradeResult(null)
      setResults([])
      setChain({
        active: false,
        category: '',
        attempts: 0,
        isLoading: false,
        successMessage: false,
        giveUp: false,
        currentAiQuestion: null,
        lastWrongAnswer: '',
        lastWrongQuestionText: '',
      })
      setPhase('practicing')
    })
  }

  // ── 답변 제출 ───────────────────────────────────────────────────────────────

  function handleSubmit() {
    if (!selectedAnswer || isPending) return

    // AI 생성 문제 (로컬 채점)
    if (chain.active && chain.currentAiQuestion) {
      const aiQ = chain.currentAiQuestion
      const isCorrect = selectedAnswer.trim() === aiQ.correctAnswer.trim()

      setGradeResult({
        isCorrect,
        correctAnswer: aiQ.correctAnswer,
        explanation: aiQ.explanation,
      })
      setResults((prev) => [
        ...prev,
        {
          questionId: aiQ.id,
          subCategory: aiQ.subCategory ?? chain.category,
          isCorrect,
          isAiGenerated: true,
        },
      ])
      setSubPhase('feedback')

      if (isCorrect) {
        setChain((c) => ({ ...c, successMessage: true }))
      } else {
        const newAttempts = chain.attempts + 1
        if (newAttempts >= 3) {
          setChain((c) => ({ ...c, giveUp: true, attempts: newAttempts }))
        } else {
          setChain((c) => ({
            ...c,
            attempts: newAttempts,
            lastWrongAnswer: selectedAnswer,
            lastWrongQuestionText: aiQ.questionText,
          }))
        }
      }
      return
    }

    // DB 문제 (서버 채점)
    const currentQ = questions[currentIdx]
    startTransition(async () => {
      const result = await gradeAnswer(currentQ.id, selectedAnswer)
      setGradeResult(result)
      setResults((prev) => [
        ...prev,
        {
          questionId: currentQ.id,
          subCategory: currentQ.subCategory ?? null,
          isCorrect: result.isCorrect,
          isAiGenerated: false,
        },
      ])
      setSubPhase('feedback')
    })
  }

  // ── 유사 문제 요청 ──────────────────────────────────────────────────────────

  async function requestSimilarQuestion(difficultyShift: 'easier' | 'same') {
    const currentQ = questions[currentIdx]
    const questionText = chain.active
      ? chain.lastWrongQuestionText
      : currentQ.content.question_text

    // 객관식일 때 선택지 텍스트 포함하여 정답/오답 표현
    const opts = chain.active
      ? chain.currentAiQuestion?.options
      : currentQ.content.options
    const LETTERS_ARR = ['A', 'B', 'C', 'D']
    const correctLetter = gradeResult?.correctAnswer ?? ''
    const correctIdx = LETTERS_ARR.indexOf(correctLetter)
    const correctAnswerText =
      opts && correctIdx >= 0 ? `${correctLetter}. ${opts[correctIdx]}` : correctLetter
    const studentLetter = selectedAnswer
    const studentIdx = LETTERS_ARR.indexOf(studentLetter)
    const studentAnswerText =
      opts && studentIdx >= 0 ? `${studentLetter}. ${opts[studentIdx]}` : studentLetter

    const category = currentQ.subCategory ?? chain.category ?? domain

    setChain((c) => ({ ...c, isLoading: true, active: true, category }))

    try {
      const res = await fetch('/api/ai/similar-question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionText: questionText + (opts ? `\n선택지: ${opts.map((o, i) => `${LETTERS_ARR[i]}. ${o}`).join(', ')}` : ''),
          studentAnswer: studentAnswerText,
          correctAnswer: correctAnswerText,
          level: profileData.currentLevel,
          cefr: profileData.cefrLevel,
          categoryAccuracy:
            profileData.categories.find((c) => c.name === category)?.accuracy ?? 50,
          difficulty: difficultyShift,
          domain,
        }),
      })

      const json = await res.json()
      if (!json.success || !json.data) throw new Error('생성 실패')

      const aiQ: AiQuestion = {
        id: `ai-${Date.now()}`,
        questionText: json.data.questionText,
        options: json.data.options,
        correctAnswer: json.data.correctAnswer,
        explanation: json.data.explanation,
        keyPoint: json.data.keyPoint,
        commonMistake: json.data.commonMistake,
        subCategory: category,
      }

      setChain((c) => ({
        ...c,
        isLoading: false,
        currentAiQuestion: aiQ,
        lastWrongAnswer: '',
        successMessage: false,
        giveUp: false,
      }))
      setSelectedAnswer('')
      setGradeResult(null)
      setSubPhase('answering')
    } catch {
      // 실패 시 체인 취소하고 다음 문제로
      setChain((c) => ({ ...c, isLoading: false, active: false, currentAiQuestion: null }))
      advanceToNext()
    }
  }

  // ── 다음 문제로 이동 ────────────────────────────────────────────────────────

  function advanceToNext() {
    // 체인 초기화
    setChain({
      active: false,
      category: '',
      attempts: 0,
      isLoading: false,
      successMessage: false,
      giveUp: false,
      currentAiQuestion: null,
      lastWrongAnswer: '',
      lastWrongQuestionText: '',
    })
    setSelectedAnswer('')
    setGradeResult(null)

    if (currentIdx < questions.length - 1) {
      setCurrentIdx((i) => i + 1)
      setSubPhase('answering')
    } else {
      handleComplete()
    }
  }

  // ── 세션 완료 ───────────────────────────────────────────────────────────────

  function handleComplete() {
    setPhase('complete')

    // 연습 세션 저장 (fire & forget)
    const items: PracticeResultItem[] = results.map((r) => ({
      questionId: r.questionId,
      domain,
      isCorrect: r.isCorrect,
    }))
    savePracticeSession({ mode: `domain_${selectedMode}`, domain: domain.toUpperCase(), results: items }).catch(() => {})

    // AI 조언 로드
    setLoadingAdvice(true)
    const catMap: Record<string, { correct: number; total: number }> = {}
    for (const r of results) {
      const cat = r.subCategory ?? 'general'
      if (!catMap[cat]) catMap[cat] = { correct: 0, total: 0 }
      catMap[cat].total++
      if (r.isCorrect) catMap[cat].correct++
    }

    const categoryResults = Object.entries(catMap).map(([name, { correct, total }]) => {
      const prevAccuracy = profileData.categories.find((c) => c.name === name)?.accuracy ?? 50
      const sessionAccuracy = total > 0 ? Math.round((correct / total) * 100) : 0
      // 가중 평균으로 새 정확도 계산 (세션 30% + 기존 70%)
      const newAccuracy = Math.round(sessionAccuracy * 0.3 + prevAccuracy * 0.7)
      return { name, correct, total, prevAccuracy, newAccuracy }
    })

    const totalCorrect = results.filter((r) => r.isCorrect).length

    generateSessionAdvice({
      domain: domain.toUpperCase(),
      mode: selectedMode,
      categoryResults,
      totalCorrect,
      totalCount: results.length || 1,
    })
      .then((adv) => setAdvice(adv))
      .catch(() => {})
      .finally(() => setLoadingAdvice(false))
  }

  // ── "더 풀기" (새 세트) ─────────────────────────────────────────────────────

  function handleLoadMore() {
    const usedIds = questions.map((q) => q.id)
    startTransition(async () => {
      const qs = await getSmartDomainQuestions(domain, selectedMode, 5, usedIds)
      setQuestions(qs)
      setCurrentIdx(0)
      setSelectedAnswer('')
      setSubPhase('answering')
      setGradeResult(null)
      setResults([])
      setChain({
        active: false, category: '', attempts: 0, isLoading: false,
        successMessage: false, giveUp: false, currentAiQuestion: null,
        lastWrongAnswer: '', lastWrongQuestionText: '',
      })
      setAdvice(null)
      setPhase('practicing')
    })
  }

  // ── 렌더 분기 ───────────────────────────────────────────────────────────────

  if (phase === 'mode-select') {
    return (
      <ModeSelectScreen
        domainLabel={domainLabel}
        domainColor={domainColor}
        domainBg={domainBg}
        domainBorder={domainBorder}
        profileData={profileData}
        onSelect={handleModeSelect}
        isLoading={isPending}
      />
    )
  }

  if (phase === 'complete') {
    return (
      <CompleteScreen
        results={results}
        profileData={profileData}
        advice={advice}
        loadingAdvice={loadingAdvice}
        mode={selectedMode}
        onRestart={() => setPhase('mode-select')}
        onLoadMore={handleLoadMore}
        isLoading={isPending}
      />
    )
  }

  // ── 풀이 화면 ───────────────────────────────────────────────────────────────

  // 문제 없음 상태
  if (questions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-gray-200 bg-white px-6 py-16 text-center">
        <BookOpen className="h-12 w-12 text-gray-300" />
        <div>
          <p className="font-semibold text-gray-700">풀 수 있는 문제가 없습니다</p>
          <p className="mt-1 text-sm text-gray-400">
            현재 레벨에 맞는 {domainLabel} 문제가 준비되어 있지 않습니다.
          </p>
        </div>
        <button
          onClick={() => setPhase('mode-select')}
          className="mt-2 rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
        >
          돌아가기
        </button>
      </div>
    )
  }

  const isChainQuestion = chain.active && chain.currentAiQuestion !== null
  const currentAiQ = chain.currentAiQuestion

  return (
    <div className="space-y-4">
      {/* 모드 배지 + 진행률 */}
      <div className="flex items-center justify-between">
        <ModeBadge mode={selectedMode} color={domainColor} />
        <span className="text-xs text-gray-400">
          {currentIdx + 1} / {questions.length}
          {isChainQuestion && <span className="ml-1 text-[#D92916]">유사 문제</span>}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
        <div
          className="h-1.5 rounded-full transition-all"
          style={{
            width: `${((currentIdx + 1) / questions.length) * 100}%`,
            backgroundColor: domainColor,
          }}
        />
      </div>

      {/* 문제 카드 */}
      <div className="rounded-xl border border-gray-200 bg-white">
        {/* 헤더 */}
        <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-3">
          <span
            className="rounded-full px-2.5 py-0.5 text-xs font-semibold text-white"
            style={{ backgroundColor: isChainQuestion ? '#D92916' : domainColor }}
          >
            {isChainQuestion ? '유사 문제' : domainLabel}
          </span>
          {isChainQuestion && (
            <span className="rounded-full border border-[#D92916]/30 bg-[#FFF5F5] px-2 py-0.5 text-xs text-[#D92916]">
              {chain.attempts}번째 시도
            </span>
          )}
          {!isChainQuestion && (
            <span className="text-xs text-gray-400">문제 {currentIdx + 1}</span>
          )}
          {!isChainQuestion && questions[currentIdx]?.subCategory && (
            <span className="ml-auto rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
              {questions[currentIdx].subCategory}
            </span>
          )}
        </div>

        <div className="px-5 py-5">
          {/* AI 생성 문제 키포인트 */}
          {isChainQuestion && currentAiQ?.keyPoint && subPhase === 'answering' && (
            <div className="mb-4 rounded-xl border border-[#7854F7]/20 bg-[#F3F0FF] px-4 py-3">
              <p className="text-xs font-semibold text-[#7854F7]">💡 핵심 포인트</p>
              <p className="mt-0.5 text-sm text-[#4C2F9E]">{currentAiQ.keyPoint}</p>
            </div>
          )}

          {/* DB 문제 전용: 오디오 플레이어 (듣기 영역) */}
          {!isChainQuestion && questions[currentIdx]?.content.audio_url && (
            <AudioPlayer
              audioUrl={questions[currentIdx].content.audio_url!}
              playCount={questions[currentIdx].content.play_count ?? 2}
            />
          )}

          {/* DB 문제 전용: 지문 (독해 영역) */}
          {!isChainQuestion && questions[currentIdx]?.content.passage && (
            <PassageBlock passage={questions[currentIdx].content.passage!} />
          )}

          {/* DB 문제 전용: 지문 이미지 */}
          {!isChainQuestion && questions[currentIdx]?.content.passage_image_url && (
            <img
              src={questions[currentIdx].content.passage_image_url}
              alt="지문 이미지"
              className="mb-4 w-full rounded-xl border border-gray-200 object-contain"
            />
          )}

          {/* 문제 텍스트 */}
          <p className="mb-5 text-base leading-relaxed text-gray-900">
            {isChainQuestion ? currentAiQ?.questionText : questions[currentIdx]?.content.question_text}
          </p>

          {/* DB 문제 전용: 문제 이미지 */}
          {!isChainQuestion && questions[currentIdx]?.content.question_image_url && (
            <img
              src={questions[currentIdx].content.question_image_url}
              alt="문제 이미지"
              className="mb-4 w-full rounded-xl border border-gray-200 object-contain"
            />
          )}

          {/* 객관식 선택지 (AI 문제 포함) */}
          {(isChainQuestion
            ? (currentAiQ?.options ?? []).length > 0
            : (questions[currentIdx]?.content.options ?? []).length > 0
          ) && (
            <div className="space-y-2.5">
              {(isChainQuestion ? currentAiQ?.options : questions[currentIdx]?.content.options)?.map(
                (opt, i) => {
                  const letter = LETTERS[i] ?? String(i + 1)
                  const isSelected = selectedAnswer === letter
                  const correctAns = isChainQuestion
                    ? currentAiQ?.correctAnswer
                    : gradeResult?.correctAnswer
                  const isCorrectOpt = subPhase === 'feedback' && correctAns === letter
                  const isWrongSelected =
                    subPhase === 'feedback' && isSelected && !gradeResult?.isCorrect

                  let cls =
                    'flex w-full items-start gap-3 rounded-xl border p-3.5 text-left transition-all'
                  if (isCorrectOpt) cls += ' border-[#1FAF54] bg-[#F0FDF4]'
                  else if (isWrongSelected) cls += ' border-[#D92916] bg-[#FFF5F5]'
                  else if (isSelected) cls += ' border-[#1865F2] bg-[#EEF4FF]'
                  else {
                    cls += ' border-gray-200 bg-white'
                    if (subPhase === 'answering') cls += ' hover:border-gray-300 hover:bg-gray-50'
                  }

                  return (
                    <button
                      key={i}
                      onClick={() => subPhase === 'answering' && setSelectedAnswer(letter)}
                      disabled={subPhase === 'feedback'}
                      className={cls}
                    >
                      <span
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold"
                        style={
                          isCorrectOpt
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
                          isCorrectOpt
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
                },
              )}
            </div>
          )}

          {/* 단답형 / 빈칸 채우기 입력창 (DB 문제) */}
          {!isChainQuestion &&
            (questions[currentIdx]?.content.type === 'short_answer' ||
              questions[currentIdx]?.content.type === 'fill_blank') && (
              <ShortAnswerInput
                value={selectedAnswer}
                onChange={setSelectedAnswer}
                disabled={subPhase === 'feedback'}
                isCorrect={subPhase === 'feedback' ? gradeResult?.isCorrect ?? null : null}
                correctAnswer={subPhase === 'feedback' ? gradeResult?.correctAnswer ?? null : null}
              />
            )}

          {/* 피드백 패널 */}
          {subPhase === 'feedback' && gradeResult && (
            <div
              className="mt-4 rounded-xl border p-4"
              style={{
                backgroundColor: gradeResult.isCorrect ? '#F0FDF4' : '#FFF5F5',
                borderColor: gradeResult.isCorrect ? '#86EFAC' : '#FCA5A5',
              }}
            >
              <div className="flex items-start gap-2">
                {gradeResult.isCorrect ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#1FAF54]" />
                ) : (
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#D92916]" />
                )}
                <div className="flex-1 min-w-0">
                  <p
                    className="text-sm font-bold"
                    style={{ color: gradeResult.isCorrect ? '#1FAF54' : '#D92916' }}
                  >
                    {chain.successMessage
                      ? '잘했어요! 감을 잡았네요! 🎉'
                      : gradeResult.isCorrect
                        ? '정답입니다!'
                        : '오답입니다'}
                  </p>
                  {!gradeResult.isCorrect && gradeResult.correctAnswer && (
                    <p className="mt-1 text-sm text-gray-700">
                      정답:{' '}
                      <span className="font-semibold text-[#1FAF54]">
                        {gradeResult.correctAnswer}
                      </span>
                    </p>
                  )}
                  {gradeResult.explanation && (
                    <p className="mt-1.5 text-sm leading-relaxed text-gray-600">
                      {gradeResult.explanation}
                    </p>
                  )}
                  {/* AI 유사 문제의 commonMistake */}
                  {isChainQuestion && currentAiQ?.commonMistake && !gradeResult.isCorrect && (
                    <div className="mt-2 rounded-lg bg-[#FFF3E0] px-3 py-2">
                      <p className="text-xs font-semibold text-[#E35C20]">자주 하는 실수</p>
                      <p className="mt-0.5 text-xs text-gray-700">{currentAiQ.commonMistake}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* 포기 메시지 */}
              {chain.giveUp && (
                <div className="mt-3 rounded-lg border border-[#FFB100]/30 bg-[#FFFBEB] px-3 py-2.5">
                  <p className="text-sm font-semibold text-[#92400E]">
                    선생님과 함께 복습하면 좋겠어요 📚
                  </p>
                  <p className="mt-0.5 text-xs text-gray-600">
                    이 부분은 선생님께 질문하거나 교재로 기초를 다지고 다시 도전해봐요!
                  </p>
                </div>
              )}
            </div>
          )}

          {/* 유사 문제 체인 로딩 */}
          {chain.isLoading && (
            <div className="mt-4 flex items-center gap-2 rounded-xl border border-[#7854F7]/20 bg-[#F3F0FF] px-4 py-3">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#7854F7] border-t-transparent" />
              <p className="text-sm text-[#7854F7]">유사 문제를 생성하고 있어요...</p>
            </div>
          )}
        </div>

        {/* 하단 버튼 */}
        <div className="border-t border-gray-100 px-5 py-4">
          {subPhase === 'answering' ? (
            <button
              onClick={handleSubmit}
              disabled={!selectedAnswer || isPending || chain.isLoading}
              className="h-11 w-full rounded-xl text-sm font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-40"
              style={{ backgroundColor: domainColor }}
            >
              {isPending ? '채점 중...' : '답변 제출'}
            </button>
          ) : (
            <ActionButtons
              gradeResult={gradeResult}
              chain={chain}
              mode={selectedMode}
              isLastQuestion={currentIdx >= questions.length - 1}
              isPending={isPending}
              onRequestSimilar={requestSimilarQuestion}
              onNext={advanceToNext}
            />
          )}
        </div>
      </div>
    </div>
  )
}

// ── 모드 선택 화면 ────────────────────────────────────────────────────────────

function ModeSelectScreen({
  domainLabel,
  domainColor,
  domainBg,
  domainBorder,
  profileData,
  onSelect,
  isLoading,
}: {
  domainLabel: string
  domainColor: string
  domainBg: string
  domainBorder: string
  profileData: DomainProfileData
  onSelect: (mode: LearningMode) => void
  isLoading: boolean
}) {
  const { domainScore, currentLevel, cefrLevel, categories, levelUpGap } = profileData

  return (
    <div className="space-y-5">
      {/* 스킬 요약 카드 */}
      <div
        className="rounded-xl border p-5"
        style={{ backgroundColor: domainBg, borderColor: domainBorder }}
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              {domainLabel} 현재 실력
            </p>
            <p className="mt-0.5 text-2xl font-black" style={{ color: domainColor }}>
              {domainScore !== null ? `${domainScore}점` : '—'}
              <span className="ml-1 text-sm font-normal text-gray-400">/ 100</span>
            </p>
          </div>
          <div className="text-right">
            <span
              className="rounded-full px-3 py-1 text-xs font-bold text-white"
              style={{ backgroundColor: domainColor }}
            >
              Level {currentLevel} · {cefrLevel}
            </span>
            {levelUpGap > 0 && (
              <p className="mt-1 text-xs text-gray-500">레벨업까지 {levelUpGap}점</p>
            )}
          </div>
        </div>

        {/* 카테고리별 바 차트 */}
        {categories.length > 0 ? (
          <div className="space-y-2.5">
            {categories.slice(0, 6).map((cat) => (
              <CategoryBar key={cat.name} cat={cat} domainColor={domainColor} />
            ))}
          </div>
        ) : (
          <p className="text-center text-xs text-gray-400 py-2">
            문제를 풀면 카테고리별 분석이 시작돼요
          </p>
        )}
      </div>

      {/* 학습 모드 선택 */}
      <div>
        <p className="mb-3 text-sm font-semibold text-gray-700">학습 모드 선택</p>
        <div className="space-y-3">
          {/* 약점 집중 모드 */}
          <ModeCard
            mode="weakness"
            title="약점 집중 모드"
            description="가장 약한 부분을 집중적으로 연습합니다"
            details={[
              '가장 낮은 정답률 카테고리 문제 선별',
              '현재 레벨과 같거나 1단계 낮은 난이도',
              '틀리면 유사 문제를 즉시 제공',
            ]}
            icon={<Target className="h-5 w-5" />}
            bg="#FFF5F5"
            border="#FCA5A5"
            color="#D92916"
            disabled={isLoading}
            onClick={() => onSelect('weakness')}
            isLoading={isLoading}
          />

          {/* 균형 연습 모드 */}
          <ModeCard
            mode="balanced"
            title="균형 연습 모드"
            description="모든 카테고리를 골고루 연습합니다"
            details={[
              '각 카테고리에서 균등 배분',
              '현재 레벨 수준의 난이도',
              '약한 카테고리 비중 30% 가중',
            ]}
            icon={<BarChart2 className="h-5 w-5" />}
            bg="#EEF4FF"
            border="#BFDBFE"
            color="#1865F2"
            disabled={isLoading}
            onClick={() => onSelect('balanced')}
            isLoading={isLoading}
          />

          {/* 레벨업 도전 모드 */}
          <ModeCard
            mode="levelup"
            title="레벨업 도전 모드"
            description={`다음 레벨 문제에 도전합니다${levelUpGap > 0 ? ` · 레벨업까지 ${levelUpGap}점` : ' · 레벨업 준비 완료!'}`}
            details={[
              `현재 Level ${currentLevel + 1} 난이도 문제`,
              '강한 카테고리 위주로 자신감 키우기',
              '성공 경험으로 다음 레벨 도약',
            ]}
            icon={<TrendingUp className="h-5 w-5" />}
            bg="#FFFBEB"
            border="#FDE68A"
            color="#92400E"
            disabled={isLoading}
            onClick={() => onSelect('levelup')}
            isLoading={isLoading}
          />
        </div>
      </div>
    </div>
  )
}

// ── 카테고리 바 ───────────────────────────────────────────────────────────────

function CategoryBar({ cat, domainColor }: { cat: CategoryAccuracy; domainColor: string }) {
  const isWeak = cat.accuracy < 50
  const isOk = cat.accuracy >= 50 && cat.accuracy < 70

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-gray-700">{cat.name}</span>
          {cat.total > 0 && (
            <span className="text-xs text-gray-400">
              ({cat.correct}/{cat.total})
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className="text-xs font-bold"
            style={{ color: isWeak ? '#D92916' : isOk ? '#E35C20' : '#1FAF54' }}
          >
            {cat.total > 0 ? `${cat.accuracy}%` : '—'}
          </span>
          {isWeak && cat.total > 0 && (
            <span className="rounded-full bg-[#D92916] px-1.5 py-0.5 text-[10px] font-bold text-white">
              집중 필요
            </span>
          )}
          {isOk && cat.total > 0 && (
            <span className="rounded-full bg-[#E35C20] px-1.5 py-0.5 text-[10px] font-bold text-white">
              보완 필요
            </span>
          )}
        </div>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
        <div
          className="h-2 rounded-full transition-all"
          style={{
            width: cat.total > 0 ? `${cat.accuracy}%` : '0%',
            backgroundColor: isWeak ? '#D92916' : isOk ? '#E35C20' : domainColor,
          }}
        />
      </div>
    </div>
  )
}

// ── 모드 카드 ─────────────────────────────────────────────────────────────────

function ModeCard({
  title,
  description,
  details,
  icon,
  bg,
  border,
  color,
  disabled,
  onClick,
  isLoading,
}: {
  mode: LearningMode
  title: string
  description: string
  details: string[]
  icon: React.ReactNode
  bg: string
  border: string
  color: string
  disabled: boolean
  onClick: () => void
  isLoading: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full rounded-xl border p-4 text-left transition-all hover:opacity-90 active:scale-[0.99] disabled:opacity-50"
      style={{ backgroundColor: bg, borderColor: border }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span style={{ color }}>{icon}</span>
            <span className="text-sm font-bold" style={{ color }}>
              {title}
            </span>
          </div>
          <p className="mt-1 text-xs text-gray-600">{description}</p>
          <ul className="mt-2 space-y-0.5">
            {details.map((d, i) => (
              <li key={i} className="flex items-center gap-1.5 text-xs text-gray-500">
                <span className="h-1 w-1 rounded-full bg-gray-400" />
                {d}
              </li>
            ))}
          </ul>
        </div>
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
          style={{ backgroundColor: color, opacity: 0.15 }}
        />
        <ChevronRight className="h-4 w-4 shrink-0" style={{ color }} />
      </div>
      {isLoading && (
        <div className="mt-2 flex items-center gap-1.5">
          <div
            className="h-3 w-3 animate-spin rounded-full border-2 border-t-transparent"
            style={{ borderColor: color }}
          />
          <span className="text-xs" style={{ color }}>
            문제 불러오는 중...
          </span>
        </div>
      )}
    </button>
  )
}

// ── 액션 버튼 (피드백 이후) ───────────────────────────────────────────────────

function ActionButtons({
  gradeResult,
  chain,
  mode,
  isLastQuestion,
  isPending,
  onRequestSimilar,
  onNext,
}: {
  gradeResult: GradeResult | null
  chain: ChainState
  mode: LearningMode
  isLastQuestion: boolean
  isPending: boolean
  onRequestSimilar: (difficulty: 'easier' | 'same') => Promise<void>
  onNext: () => void
}) {
  const isWrong = gradeResult && !gradeResult.isCorrect

  // 성공 또는 포기 후: 다음으로
  if (chain.successMessage || chain.giveUp) {
    return (
      <button
        onClick={onNext}
        className="flex h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-[#1865F2] text-sm font-semibold text-white transition-colors hover:bg-[#1558d6]"
      >
        {isLastQuestion ? '결과 보기' : '다음 문제'}
        <ChevronRight className="h-4 w-4" />
      </button>
    )
  }

  // 약점 집중 모드 + 틀림 + 체인 미활성화: 유사 문제 제안
  if (mode === 'weakness' && isWrong && !chain.active && !chain.isLoading) {
    return (
      <div className="space-y-2">
        <p className="text-center text-xs font-semibold text-gray-600">
          이 유형을 더 연습해볼까요?
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => onRequestSimilar('easier')}
            disabled={isPending}
            className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-[#D92916] text-sm font-medium text-[#D92916] hover:bg-[#FFF5F5] disabled:opacity-50"
          >
            <Sparkles className="h-4 w-4" />
            더 쉽게
          </button>
          <button
            onClick={() => onRequestSimilar('same')}
            disabled={isPending}
            className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#D92916] text-sm font-semibold text-white hover:bg-[#B91C1C] disabled:opacity-50"
          >
            <Sparkles className="h-4 w-4" />
            같은 수준
          </button>
        </div>
        <button
          onClick={onNext}
          className="h-9 w-full rounded-xl border border-gray-200 text-xs font-medium text-gray-500 hover:bg-gray-50"
        >
          다음 문제로 넘어가기
        </button>
      </div>
    )
  }

  // 약점 집중 모드 + 틀림 + 체인 활성화 + 3번 미만: 다음 유사 문제
  if (mode === 'weakness' && isWrong && chain.active && !chain.giveUp && chain.attempts < 3) {
    const nextDifficulty = chain.attempts >= 2 ? 'easier' : 'same'
    return (
      <div className="space-y-2">
        <div className="rounded-lg border border-[#FFB100]/30 bg-[#FFFBEB] px-3 py-2">
          <p className="text-xs text-gray-600">
            <span className="font-semibold text-[#92400E]">한 번 더!</span> 비슷한 문제로 다시
            도전해봐요
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onNext}
            className="flex h-11 flex-1 items-center justify-center rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            건너뛰기
          </button>
          <button
            onClick={() => onRequestSimilar(nextDifficulty)}
            disabled={isPending}
            className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#D92916] text-sm font-semibold text-white hover:bg-[#B91C1C] disabled:opacity-50"
          >
            <Sparkles className="h-4 w-4" />
            유사 문제
          </button>
        </div>
      </div>
    )
  }

  // 기본: 다음으로
  return (
    <button
      onClick={onNext}
      className="flex h-11 w-full items-center justify-center gap-1.5 rounded-xl text-sm font-semibold text-white transition-colors hover:opacity-90"
      style={{ backgroundColor: '#1865F2' }}
    >
      {isLastQuestion ? '결과 보기' : '다음 문제'}
      <ChevronRight className="h-4 w-4" />
    </button>
  )
}

// ── 모드 배지 ─────────────────────────────────────────────────────────────────

function ModeBadge({ mode, color }: { mode: LearningMode; color: string }) {
  const CONFIG: Record<LearningMode, { label: string; icon: React.ReactNode }> = {
    weakness: { label: '약점 집중', icon: <Target className="h-3 w-3" /> },
    balanced: { label: '균형 연습', icon: <BarChart2 className="h-3 w-3" /> },
    levelup: { label: '레벨업 도전', icon: <TrendingUp className="h-3 w-3" /> },
  }
  const { label, icon } = CONFIG[mode]
  return (
    <div
      className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold text-white"
      style={{ backgroundColor: color }}
    >
      {icon}
      {label}
    </div>
  )
}

// ── 완료 화면 ─────────────────────────────────────────────────────────────────

function CompleteScreen({
  results,
  profileData,
  advice,
  loadingAdvice,
  mode,
  onRestart,
  onLoadMore,
  isLoading,
}: {
  results: QuestionResult[]
  profileData: DomainProfileData
  advice: SessionAdvice | null
  loadingAdvice: boolean
  mode: LearningMode
  onRestart: () => void
  onLoadMore: () => void
  isLoading: boolean
}) {
  const totalCorrect = results.filter((r) => r.isCorrect).length
  const totalCount = results.length || 1
  const accuracy = Math.round((totalCorrect / totalCount) * 100)

  // 카테고리별 집계
  const catMap: Record<string, { correct: number; total: number }> = {}
  for (const r of results) {
    const cat = r.subCategory ?? 'general'
    if (!catMap[cat]) catMap[cat] = { correct: 0, total: 0 }
    catMap[cat].total++
    if (r.isCorrect) catMap[cat].correct++
  }

  const categoryResults = Object.entries(catMap).map(([name, { correct, total }]) => {
    const prevAccuracy = profileData.categories.find((c) => c.name === name)?.accuracy ?? null
    const sessionAccuracy = total > 0 ? Math.round((correct / total) * 100) : 0
    const newAccuracy = prevAccuracy !== null
      ? Math.round(sessionAccuracy * 0.3 + prevAccuracy * 0.7)
      : sessionAccuracy
    const trend: 'up' | 'down' | 'same' =
      prevAccuracy === null
        ? 'same'
        : newAccuracy > prevAccuracy + 2
          ? 'up'
          : newAccuracy < prevAccuracy - 2
            ? 'down'
            : 'same'
    return { name, correct, total, prevAccuracy, newAccuracy, trend }
  })

  const NEXT_MODE_LABEL: Record<LearningMode, string> = {
    weakness: '약점 집중 모드',
    balanced: '균형 연습 모드',
    levelup: '레벨업 도전 모드',
  }

  return (
    <div className="mx-auto max-w-md space-y-5 py-2">
      {/* 결과 요약 */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 text-center">
        <div className="mb-3 text-4xl">
          {accuracy >= 80 ? '🎉' : accuracy >= 60 ? '😊' : '💪'}
        </div>
        <h2 className="text-xl font-bold text-gray-900">학습 완료!</h2>
        <p
          className="mt-2 text-4xl font-black"
          style={{ color: accuracy >= 70 ? '#1FAF54' : '#D92916' }}
        >
          {totalCorrect} / {totalCount}
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

      {/* 카테고리별 분석 */}
      {categoryResults.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="mb-3 flex items-center gap-1.5">
            <BarChart2 className="h-4 w-4 text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-700">카테고리별 분석</h3>
          </div>
          <div className="space-y-3">
            {categoryResults.map((cat) => (
              <div key={cat.name}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-gray-700">{cat.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">
                      {cat.correct}/{cat.total}
                    </span>
                    {cat.prevAccuracy !== null && (
                      <span
                        className="text-xs font-bold"
                        style={{
                          color:
                            cat.trend === 'up'
                              ? '#1FAF54'
                              : cat.trend === 'down'
                                ? '#D92916'
                                : '#6B7280',
                        }}
                      >
                        {cat.prevAccuracy}% → {cat.newAccuracy}%{' '}
                        {cat.trend === 'up' ? '↑' : cat.trend === 'down' ? '↓' : '→'}
                      </span>
                    )}
                    {cat.prevAccuracy === null && (
                      <span className="text-xs font-bold text-gray-500">
                        {cat.newAccuracy}%
                      </span>
                    )}
                  </div>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-1.5 rounded-full"
                    style={{
                      width: `${cat.newAccuracy}%`,
                      backgroundColor:
                        cat.trend === 'up'
                          ? '#1FAF54'
                          : cat.trend === 'down'
                            ? '#D92916'
                            : '#6B7280',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI 학습 조언 */}
      <div className="rounded-xl border border-[#7854F7]/20 bg-[#F3F0FF] p-5">
        <div className="mb-2 flex items-center gap-1.5">
          <Sparkles className="h-4 w-4 text-[#7854F7]" />
          <h3 className="text-sm font-semibold text-[#7854F7]">AI 학습 조언</h3>
        </div>
        {loadingAdvice ? (
          <div className="flex items-center gap-2 py-2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#7854F7] border-t-transparent" />
            <span className="text-sm text-[#7854F7]">분석 중...</span>
          </div>
        ) : advice ? (
          <>
            <p className="text-sm leading-relaxed text-gray-700">{advice.advice}</p>
            {advice.nextRecommendation && (
              <div className="mt-3 rounded-lg border border-[#7854F7]/20 bg-white px-3 py-2.5">
                <div className="flex items-center gap-1.5">
                  <BookOpen className="h-3.5 w-3.5 text-[#7854F7]" />
                  <p className="text-xs font-semibold text-[#7854F7]">
                    다음 추천:{' '}
                    <span className="text-gray-800">
                      {NEXT_MODE_LABEL[advice.nextRecommendation.mode]}
                    </span>
                  </p>
                </div>
                <p className="mt-0.5 text-xs text-gray-500">{advice.nextRecommendation.reason}</p>
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-gray-500">꾸준한 연습이 실력 향상의 지름길입니다!</p>
        )}
      </div>

      {/* 액션 버튼 */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          onClick={onRestart}
          className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
        >
          <RotateCcw className="h-4 w-4" />
          모드 다시 선택
        </button>
        <button
          onClick={onLoadMore}
          disabled={isLoading}
          className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#1865F2] text-sm font-semibold text-white transition-colors hover:bg-[#1558d6] disabled:opacity-60"
        >
          {isLoading ? (
            <>
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              불러오는 중...
            </>
          ) : (
            <>
              더 풀기
              <ChevronRight className="h-4 w-4" />
            </>
          )}
        </button>
      </div>
    </div>
  )
}

// ── 지문 블록 ─────────────────────────────────────────────────────────────────

function PassageBlock({ passage }: { passage: string }) {
  const [expanded, setExpanded] = useState(false)
  const isLong = passage.length > 300

  return (
    <div className="mb-4 rounded-xl border border-[#0FBFAD]/30 bg-[#EFFAF9]">
      <div className="flex items-center justify-between border-b border-[#0FBFAD]/20 px-4 py-2.5">
        <div className="flex items-center gap-1.5">
          <BookOpen className="h-3.5 w-3.5 text-[#0FBFAD]" />
          <span className="text-xs font-semibold text-[#0FBFAD]">지문</span>
        </div>
        {isLong && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-xs text-[#0FBFAD] hover:underline"
          >
            {expanded ? '접기' : '전체 보기'}
          </button>
        )}
      </div>
      <div
        className={`overflow-hidden px-4 py-3 transition-all ${
          isLong && !expanded ? 'max-h-32' : 'max-h-[600px]'
        }`}
      >
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-800">{passage}</p>
      </div>
      {isLong && !expanded && (
        <div className="flex justify-center pb-2">
          <button
            onClick={() => setExpanded(true)}
            className="text-xs text-[#0FBFAD] hover:underline"
          >
            더 보기 ↓
          </button>
        </div>
      )}
    </div>
  )
}

// ── 오디오 플레이어 ───────────────────────────────────────────────────────────

function AudioPlayer({ audioUrl, playCount }: { audioUrl: string; playCount: number }) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playedCount, setPlayedCount] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)

  const remaining = Math.max(0, playCount - playedCount)
  const canPlay = remaining > 0

  function handlePlay() {
    if (!canPlay || !audioRef.current) return
    if (isPlaying) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      setIsPlaying(false)
    } else {
      setPlayedCount((c) => c + 1)
      setIsPlaying(true)
      audioRef.current.play().catch(() => setIsPlaying(false))
    }
  }

  return (
    <div className="mb-4 rounded-xl border border-[#0EA5E9]/30 bg-[#E0F2FE] px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <Volume2 className="h-4 w-4 text-[#0EA5E9]" />
          <span className="text-xs font-semibold text-[#0EA5E9]">듣기</span>
        </div>
        <button
          onClick={handlePlay}
          disabled={!canPlay}
          className="flex h-9 items-center gap-2 rounded-xl border border-[#0EA5E9] bg-white px-4 text-sm font-medium text-[#0EA5E9] transition-colors hover:bg-[#0EA5E9] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          {isPlaying ? '정지' : '재생'}
        </button>
        <span className="ml-auto text-xs text-gray-500">
          {canPlay ? `재생 가능 ${remaining}회` : '재생 횟수 초과'}
        </span>
      </div>
      <audio
        ref={audioRef}
        src={audioUrl}
        onEnded={() => setIsPlaying(false)}
        className="hidden"
      />
    </div>
  )
}

// ── 단답형 입력창 ─────────────────────────────────────────────────────────────

function ShortAnswerInput({
  value,
  onChange,
  disabled,
  isCorrect,
  correctAnswer,
}: {
  value: string
  onChange: (v: string) => void
  disabled: boolean
  isCorrect: boolean | null
  correctAnswer: string | null
}) {
  return (
    <div className="mt-1">
      <label className="mb-1.5 block text-sm font-medium text-gray-700">답변 입력</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder="답을 입력하세요"
        className="h-11 w-full rounded-xl border px-4 text-sm text-gray-900 outline-none transition-all focus:ring-2 disabled:bg-gray-50"
        style={{
          borderColor:
            isCorrect === null ? '#E5E7EB' : isCorrect ? '#1FAF54' : '#D92916',
        }}
      />
      {disabled && correctAnswer && isCorrect === false && (
        <p className="mt-1.5 text-xs text-gray-500">
          정답:{' '}
          <span className="font-semibold text-[#1FAF54]">{correctAnswer}</span>
        </p>
      )}
    </div>
  )
}
