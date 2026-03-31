'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Loader2,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  BookOpen,
  Target,
  Star,
} from 'lucide-react'
import type { WritingEvaluationResult } from '@/app/api/ai/evaluate-writing/route'

// ── 타입 ──────────────────────────────────────────────────────────────────────

export type StudentProfileForWriting = {
  currentLevel: number
  cefrLevel: string
  grammarAvg: number | null
  vocabAvg: number | null
  readingAvg: number | null
  writingAvg: number | null
  recentWritingScores: number[]
}

type TopicData = {
  id: string
  titleKo: string
  prompt: string
  minWords: number
  maxWords: number
  level: number
}

// ── 레벨별 주제 데이터 ─────────────────────────────────────────────────────────

const ALL_TOPICS: TopicData[] = [
  // Level 1 (Pre-A1)
  {
    id: 'l1-1',
    titleKo: '나를 소개해주세요',
    prompt: 'Introduce yourself. Write about your name, age, and what you like.',
    minWords: 30,
    maxWords: 50,
    level: 1,
  },
  {
    id: 'l1-2',
    titleKo: '우리 가족에 대해 써보세요',
    prompt: 'Write about your family. Who are they and what do they do?',
    minWords: 30,
    maxWords: 50,
    level: 1,
  },
  {
    id: 'l1-3',
    titleKo: '내가 좋아하는 음식',
    prompt: 'Write about your favorite food. What is it and why do you like it?',
    minWords: 30,
    maxWords: 50,
    level: 1,
  },
  // Level 2 (A1-A2)
  {
    id: 'l2-1',
    titleKo: '어제 한 일을 써보세요',
    prompt: 'Write about what you did yesterday. What activities did you do?',
    minWords: 50,
    maxWords: 80,
    level: 2,
  },
  {
    id: 'l2-2',
    titleKo: '나의 하루 일과',
    prompt: 'Describe your daily routine. What do you do every day?',
    minWords: 50,
    maxWords: 80,
    level: 2,
  },
  {
    id: 'l2-3',
    titleKo: '좋아하는 계절과 이유',
    prompt: 'What is your favorite season and why? Describe what you like about it.',
    minWords: 50,
    maxWords: 80,
    level: 2,
  },
  // Level 3 (B1)
  {
    id: 'l3-1',
    titleKo: '학교에서 가장 좋아하는 과목과 이유',
    prompt:
      'What is your favorite subject at school? Explain why you like it and how it helps you.',
    minWords: 80,
    maxWords: 120,
    level: 3,
  },
  {
    id: 'l3-2',
    titleKo: '만약 100만원이 있다면 무엇을 하겠습니까?',
    prompt:
      'If you had 1,000,000 won, what would you do with it? Give reasons for your choices.',
    minWords: 80,
    maxWords: 120,
    level: 3,
  },
  {
    id: 'l3-3',
    titleKo: '환경을 보호하기 위해 우리가 할 수 있는 일',
    prompt:
      'What can we do to protect the environment? Give specific examples and explain why they are important.',
    minWords: 80,
    maxWords: 120,
    level: 3,
  },
  // Level 4 (B2)
  {
    id: 'l4-1',
    titleKo: '소셜 미디어가 청소년에게 미치는 영향',
    prompt:
      'Discuss the impact of social media on teenagers. Consider both positive and negative effects with examples.',
    minWords: 120,
    maxWords: 180,
    level: 4,
  },
  {
    id: 'l4-2',
    titleKo: '도시 생활과 시골 생활의 장단점을 비교하세요',
    prompt:
      'Compare the advantages and disadvantages of city life and country life. Which do you prefer and why?',
    minWords: 120,
    maxWords: 180,
    level: 4,
  },
  {
    id: 'l4-3',
    titleKo: '기술 발전이 교육에 미치는 영향',
    prompt:
      'How has technological advancement affected education? Discuss both the benefits and drawbacks.',
    minWords: 120,
    maxWords: 180,
    level: 4,
  },
  // Level 5 (C1-C2)
  {
    id: 'l5-1',
    titleKo: '인공지능이 미래 직업 시장에 미칠 영향을 논하세요',
    prompt:
      'Discuss how artificial intelligence will impact the future job market. Consider both opportunities and challenges, and propose solutions.',
    minWords: 180,
    maxWords: 250,
    level: 5,
  },
  {
    id: 'l5-2',
    titleKo: '세계화의 문화적 영향에 대한 당신의 견해',
    prompt:
      'Share your perspective on the cultural impacts of globalization. Discuss how it affects local cultures, identity, and values.',
    minWords: 180,
    maxWords: 250,
    level: 5,
  },
  {
    id: 'l5-3',
    titleKo: '교육 시스템의 근본적 변화가 필요한가?',
    prompt:
      'Does the education system need fundamental changes? Argue your position with evidence and propose specific reforms.',
    minWords: 180,
    maxWords: 250,
    level: 5,
  },
]

const CEFR_MAP: Record<number, string> = {
  1: 'Pre-A1',
  2: 'A1-A2',
  3: 'B1',
  4: 'B2',
  5: 'C1-C2',
}

const AREA_LABELS: Record<string, string> = {
  grammar: '문법',
  vocabulary: '어휘',
  organization: '구성',
  expression: '표현',
}

const AREA_COLORS: Record<string, string> = {
  grammar: '#1865F2',
  organization: '#0FBFAD',
  vocabulary: '#7854F7',
  expression: '#E35C20',
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

// ── 원형 프로그레스 ────────────────────────────────────────────────────────────

function CircularProgress({
  value,
  max,
  color,
}: {
  value: number
  max: number
  color: string
}) {
  const pct = Math.min((value / max) * 100, 100)
  const radius = 38
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (pct / 100) * circumference

  return (
    <svg width="96" height="96" className="shrink-0">
      <circle cx="48" cy="48" r={radius} fill="none" stroke="#F3F4F6" strokeWidth="8" />
      <circle
        cx="48"
        cy="48"
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth="8"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform="rotate(-90 48 48)"
      />
      <text x="48" y="44" textAnchor="middle" fontSize="17" fontWeight="700" fill="#21242C">
        {value}
      </text>
      <text x="48" y="60" textAnchor="middle" fontSize="10" fill="#9CA3AF">
        /{max}
      </text>
    </svg>
  )
}

// ── 메인 컴포넌트 ──────────────────────────────────────────────────────────────

export function WritingClient({ studentProfile }: { studentProfile: StudentProfileForWriting }) {
  const [selectedTopic, setSelectedTopic] = useState<TopicData | null>(null)
  const [essay, setEssay] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [feedback, setFeedback] = useState<WritingEvaluationResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const { currentLevel } = studentProfile
  const wordCount = countWords(essay)

  // 현재 레벨 주제 + 도전 주제 (레벨+1) 표시
  const currentTopics = ALL_TOPICS.filter((t) => t.level === currentLevel)
  const challengeTopics =
    currentLevel < 5 ? ALL_TOPICS.filter((t) => t.level === currentLevel + 1) : []

  async function handleGetFeedback() {
    if (!selectedTopic || wordCount < Math.max(selectedTopic.minWords - 5, 5)) return
    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/ai/evaluate-writing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          essay,
          topicTitle: selectedTopic.titleKo,
          topicPrompt: selectedTopic.prompt,
          minWords: selectedTopic.minWords,
          maxWords: selectedTopic.maxWords,
          studentProfile,
        }),
      })

      if (!res.ok) {
        const data = (await res.json()) as { error?: string }
        throw new Error(data.error ?? '분석에 실패했어요. 다시 시도해주세요.')
      }

      const data = (await res.json()) as { success: boolean; data: WritingEvaluationResult }
      setFeedback(data.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : '분석에 실패했어요. 다시 시도해주세요.')
    } finally {
      setIsLoading(false)
    }
  }

  function handleReset() {
    setSelectedTopic(null)
    setEssay('')
    setFeedback(null)
    setError(null)
  }

  function handleRetry() {
    setError(null)
    handleGetFeedback()
  }

  // ── 주제 선택 화면 ─────────────────────────────────────────────────────────
  if (!selectedTopic) {
    return (
      <div className="space-y-4">
        {/* 현재 레벨 주제 */}
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span
              className="rounded-full px-2.5 py-0.5 text-xs font-bold text-white"
              style={{ backgroundColor: '#E35C20' }}
            >
              Level {currentLevel}
            </span>
            <span className="text-sm font-semibold text-gray-700">
              현재 레벨 주제 ({CEFR_MAP[currentLevel]})
            </span>
          </div>
          <div className="space-y-2">
            {currentTopics.map((topic) => (
              <TopicCard
                key={topic.id}
                topic={topic}
                isChallenge={false}
                onSelect={setSelectedTopic}
              />
            ))}
          </div>
        </div>

        {/* 도전 주제 */}
        {challengeTopics.length > 0 && (
          <div>
            <div className="mb-2 flex items-center gap-2">
              <span
                className="rounded-full px-2.5 py-0.5 text-xs font-bold text-white"
                style={{ backgroundColor: '#7854F7' }}
              >
                도전 ✦
              </span>
              <span className="text-sm font-semibold text-gray-700">
                도전 주제 (Level {currentLevel + 1} · {CEFR_MAP[currentLevel + 1]})
              </span>
            </div>
            <div className="space-y-2">
              {challengeTopics.map((topic) => (
                <TopicCard
                  key={topic.id}
                  topic={topic}
                  isChallenge={true}
                  onSelect={setSelectedTopic}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── 에세이 작성 + 피드백 화면 ─────────────────────────────────────────────
  const isChallengeTopic = selectedTopic.level > currentLevel
  const minWordThreshold = Math.max(selectedTopic.minWords - 5, 5)
  const canSubmit = wordCount >= minWordThreshold && !isLoading

  return (
    <div className="space-y-4">
      {/* 선택된 주제 */}
      <div
        className="rounded-xl border p-4"
        style={{
          backgroundColor: isChallengeTopic ? '#F5F3FF' : '#FFF7ED',
          borderColor: isChallengeTopic ? '#C4B5FD' : '#FED7AA',
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
              {isChallengeTopic ? (
                <span
                  className="rounded-full px-2 py-0.5 text-xs font-bold text-white"
                  style={{ backgroundColor: '#7854F7' }}
                >
                  도전 ✦
                </span>
              ) : (
                <span
                  className="rounded-full px-2 py-0.5 text-xs font-bold text-white"
                  style={{ backgroundColor: '#E35C20' }}
                >
                  Level {selectedTopic.level}
                </span>
              )}
              <span className="font-bold text-gray-900 text-sm">{selectedTopic.titleKo}</span>
            </div>
            <p className="text-sm leading-relaxed text-gray-600">{selectedTopic.prompt}</p>
            <p className="mt-1.5 text-xs text-gray-400">
              권장 {selectedTopic.minWords}~{selectedTopic.maxWords}단어
            </p>
          </div>
          {!feedback && (
            <button
              onClick={() => {
                setSelectedTopic(null)
                setEssay('')
                setFeedback(null)
                setError(null)
              }}
              className="shrink-0 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-50"
            >
              <ChevronLeft className="inline h-3 w-3 mr-0.5" />
              변경
            </button>
          )}
        </div>
      </div>

      {/* 피드백 결과 */}
      {feedback ? (
        <FeedbackDisplay
          feedback={feedback}
          studentProfile={studentProfile}
          essay={essay}
          onReset={handleReset}
          onRetry={() => {
            setFeedback(null)
            setEssay('')
          }}
        />
      ) : (
        <>
          {/* 텍스트 에디터 */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">에세이 작성</label>
            <textarea
              value={essay}
              onChange={(e) => setEssay(e.target.value)}
              placeholder="영어로 에세이를 작성하세요..."
              rows={12}
              className="w-full resize-none rounded-xl border border-gray-200 px-4 py-3 text-sm leading-relaxed text-gray-900 outline-none transition-all focus:border-[#E35C20] focus:ring-2 focus:ring-[#E35C20]/20"
            />
            <div className="mt-1.5 flex items-center justify-between text-xs">
              <span>
                {wordCount < selectedTopic.minWords ? (
                  <span className="text-[#FFB100] font-medium">
                    최소 {selectedTopic.minWords}단어 필요 (현재 {wordCount}단어)
                  </span>
                ) : wordCount > selectedTopic.maxWords ? (
                  <span className="text-[#D92916] font-medium">
                    권장 단어수 초과 (현재 {wordCount}단어)
                  </span>
                ) : (
                  <span className="text-[#1FAF54] font-medium">
                    적정 길이 ({wordCount}단어)
                  </span>
                )}
              </span>
              <span className="text-gray-400">
                {wordCount} / {selectedTopic.maxWords}단어
              </span>
            </div>
          </div>

          {/* 오류 */}
          {error && (
            <div className="rounded-xl border border-[#FCA5A5] bg-[#FFF5F5] px-4 py-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-[#D92916] shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[#D92916]">{error}</p>
                </div>
                <button
                  onClick={handleRetry}
                  className="shrink-0 rounded-lg bg-[#D92916] px-3 py-1 text-xs font-medium text-white hover:bg-[#B91C1C]"
                >
                  재시도
                </button>
              </div>
            </div>
          )}

          {/* AI 피드백 버튼 */}
          <button
            onClick={handleGetFeedback}
            disabled={!canSubmit}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-bold text-white transition-all disabled:cursor-not-allowed disabled:opacity-50"
            style={{ backgroundColor: '#7854F7' }}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                AI가 에세이를 분석하고 있어요... (약 10~15초)
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                AI 피드백 받기
              </>
            )}
          </button>
        </>
      )}
    </div>
  )
}

// ── 주제 카드 ──────────────────────────────────────────────────────────────────

function TopicCard({
  topic,
  isChallenge,
  onSelect,
}: {
  topic: TopicData
  isChallenge: boolean
  onSelect: (t: TopicData) => void
}) {
  const starCount = isChallenge ? 4 : 3
  const accentColor = isChallenge ? '#7854F7' : '#E35C20'

  return (
    <button
      onClick={() => onSelect(topic)}
      className="w-full rounded-xl border border-gray-200 bg-white p-4 text-left transition-all hover:border-gray-300 hover:shadow-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 mb-1">
            {/* 별점 */}
            <span className="flex items-center gap-0.5">
              {Array.from({ length: starCount }).map((_, i) => (
                <Star
                  key={i}
                  className="h-3 w-3 fill-current"
                  style={{ color: accentColor }}
                />
              ))}
            </span>
            <span className="text-xs text-gray-400">
              {topic.minWords}~{topic.maxWords}단어
            </span>
          </div>
          <p className="font-bold text-gray-900 text-sm">{topic.titleKo}</p>
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-gray-500">
            {topic.prompt}
          </p>
          <p className="mt-1.5 text-xs text-gray-400">
            평가: 문법 · 구성 · 어휘 · 표현력
          </p>
        </div>
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-lg"
          style={{ backgroundColor: accentColor + '18' }}
        >
          ✍️
        </div>
      </div>
    </button>
  )
}

// ── 피드백 결과 화면 ───────────────────────────────────────────────────────────

const SCORE_KEYS = ['grammar', 'organization', 'vocabulary', 'expression'] as const
type ScoreKey = (typeof SCORE_KEYS)[number]

function FeedbackDisplay({
  feedback,
  studentProfile,
  essay,
  onReset,
  onRetry,
}: {
  feedback: WritingEvaluationResult
  studentProfile: StudentProfileForWriting
  essay: string
  onReset: () => void
  onRetry: () => void
}) {
  const [showModelEssay, setShowModelEssay] = useState(false)
  const { currentLevel } = studentProfile

  const pct = feedback.percentage
  const progressColor =
    pct >= 70 ? '#1FAF54' : pct >= 50 ? '#FFB100' : '#D92916'

  const { levelUpStrategy, modelEssay, corrections } = feedback
  const isMaxLevel = currentLevel >= 5

  return (
    <div className="space-y-4">
      {/* 상단: 점수 요약 */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <h3 className="mb-4 text-sm font-semibold text-gray-700">평가 결과</h3>
        <div className="flex items-center gap-5">
          {/* 원형 프로그레스 */}
          <div className="flex flex-col items-center gap-1">
            <CircularProgress value={feedback.totalScore} max={feedback.totalMaxScore} color={progressColor} />
            <span className="text-xs text-gray-400 font-medium">{pct.toFixed(1)}%</span>
          </div>
          {/* 4개 영역 바 */}
          <div className="flex-1 min-w-0 space-y-2.5">
            {SCORE_KEYS.map((key) => {
              const item = feedback.scores[key]
              const barPct = (item.score / item.maxForLevel) * 100
              const color = AREA_COLORS[key]
              return (
                <div key={key}>
                  <div className="mb-0.5 flex items-center justify-between">
                    <span className="text-xs text-gray-500">{AREA_LABELS[key]}</span>
                    <span className="text-xs font-bold" style={{ color }}>
                      {item.score}/{item.maxForLevel}
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-1.5 rounded-full"
                      style={{ width: `${barPct}%`, backgroundColor: color }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* 섹션 1: 총평 */}
      <div
        className="rounded-xl border px-4 py-4"
        style={{ backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }}
      >
        <div className="flex items-center gap-2 mb-2">
          <CheckCircle2 className="h-4 w-4 text-[#1865F2]" />
          <h3 className="text-sm font-semibold text-[#1865F2]">AI 총평</h3>
        </div>
        <p className="text-sm leading-relaxed text-gray-700">{feedback.overallComment}</p>
      </div>

      {/* 영역별 세부 피드백 */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <h3 className="mb-3 text-sm font-semibold text-gray-700">영역별 피드백</h3>
        <div className="space-y-3">
          {SCORE_KEYS.map((key) => {
            const item = feedback.scores[key]
            const color = AREA_COLORS[key]
            return (
              <div key={key} className="flex items-start gap-3">
                <span
                  className="mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-xs font-bold text-white"
                  style={{ backgroundColor: color }}
                >
                  {AREA_LABELS[key]}
                </span>
                <p className="text-xs leading-relaxed text-gray-600">{item.details}</p>
              </div>
            )
          })}
        </div>
      </div>

      {/* 섹션 2: 교정 사항 */}
      {corrections.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="h-4 w-4 text-[#D92916]" />
            <h3 className="text-sm font-semibold text-gray-700">교정 사항</h3>
          </div>
          <div className="space-y-3">
            {corrections.map((c, i) => (
              <div key={i} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                <div className="space-y-1 mb-2">
                  <p className="text-xs text-[#D92916] line-through leading-relaxed">
                    {c.original}
                  </p>
                  <p className="text-xs text-[#1FAF54] font-medium leading-relaxed">
                    → {c.corrected}
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <span
                    className="shrink-0 rounded-full px-1.5 py-0.5 text-xs font-medium text-white capitalize"
                    style={{
                      backgroundColor:
                        c.category === 'grammar'
                          ? '#1865F2'
                          : c.category === 'vocabulary'
                            ? '#7854F7'
                            : '#E35C20',
                    }}
                  >
                    {AREA_LABELS[c.category as ScoreKey] ?? c.category}
                  </span>
                  <p className="text-xs leading-relaxed text-gray-500">{c.explanation}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 섹션 3: 레벨업 전략 */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="h-4 w-4 text-[#7854F7]" />
          <h3 className="text-sm font-semibold text-gray-700">
            {isMaxLevel
              ? 'Level 5 (C1-C2) 최고 레벨 유지 전략'
              : `Level ${levelUpStrategy.currentLevel} → Level ${levelUpStrategy.targetLevel} 로드맵`}
          </h3>
        </div>

        {/* 현재 점수 → 목표 점수 */}
        {!isMaxLevel && (
          <div className="mb-4 rounded-lg bg-gray-50 p-3">
            <div className="flex items-center justify-between mb-1.5 text-xs text-gray-500">
              <span>현재 쓰기 평균</span>
              <span>
                <span className="font-bold text-gray-900">
                  {levelUpStrategy.currentWritingAvg}점
                </span>
                {' → '}
                <span className="font-bold" style={{ color: '#7854F7' }}>
                  목표 {levelUpStrategy.targetScore}점
                </span>
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
              <div
                className="h-2 rounded-full transition-all"
                style={{
                  width: `${Math.min((levelUpStrategy.currentWritingAvg / levelUpStrategy.targetScore) * 100, 100)}%`,
                  backgroundColor: '#7854F7',
                }}
              />
            </div>
            <div className="mt-1.5 flex items-center justify-between text-xs">
              <span className="text-gray-400">
                {levelUpStrategy.gap > 0
                  ? `목표까지 ${levelUpStrategy.gap}점 남음`
                  : '목표 달성!'}
              </span>
              <span className="font-medium" style={{ color: '#7854F7' }}>
                예상 소요: 약 {levelUpStrategy.estimatedWeeks}주
              </span>
            </div>
          </div>
        )}

        {/* 우선순위 액션 */}
        <div className="space-y-2.5 mb-3">
          {levelUpStrategy.priorityActions.map((action) => (
            <div
              key={action.priority}
              className="rounded-lg border border-gray-100 p-3"
            >
              <div className="flex items-center gap-2 mb-1.5">
                <span
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                  style={{ backgroundColor: '#7854F7' }}
                >
                  {action.priority}
                </span>
                <span
                  className="rounded-full px-2 py-0.5 text-xs font-bold text-white"
                  style={{
                    backgroundColor:
                      AREA_COLORS[action.area] ?? '#7854F7',
                  }}
                >
                  {AREA_LABELS[action.area] ?? action.area}
                </span>
                <span className="text-xs font-semibold text-gray-800">{action.action}</span>
              </div>
              <p className="text-xs leading-relaxed text-gray-600 mb-1.5">{action.detail}</p>
              <div
                className="rounded-lg px-2.5 py-1.5"
                style={{ backgroundColor: '#F5F3FF' }}
              >
                <p className="text-xs font-medium" style={{ color: '#7854F7' }}>
                  <Target className="inline h-3 w-3 mr-1" />
                  이번 주 목표: {action.weeklyGoal}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* 주간 플랜 */}
        <div className="rounded-lg bg-gray-50 px-3 py-2.5 mb-3">
          <div className="flex items-start gap-2">
            <BookOpen className="h-4 w-4 text-gray-500 shrink-0 mt-0.5" />
            <p className="text-xs leading-relaxed text-gray-600">{levelUpStrategy.weeklyPlan}</p>
          </div>
        </div>

        {/* 격려 메시지 */}
        <div
          className="rounded-lg px-3 py-2.5"
          style={{ backgroundColor: '#ECFDF5', borderLeft: '3px solid #1FAF54' }}
        >
          <p className="text-xs leading-relaxed text-gray-700">{levelUpStrategy.encouragement}</p>
        </div>
      </div>

      {/* 섹션 4: 모범 답안 (접기/펼치기) */}
      <div className="rounded-xl border border-gray-200 bg-white">
        <button
          onClick={() => setShowModelEssay((v) => !v)}
          className="flex w-full items-center justify-between px-4 py-3.5 text-left"
        >
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-gray-500" />
            <span className="text-sm font-semibold text-gray-700">
              Level {currentLevel} 모범 답안 보기
            </span>
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
              {modelEssay.wordCount}단어
            </span>
          </div>
          {showModelEssay ? (
            <ChevronUp className="h-4 w-4 text-gray-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-gray-400" />
          )}
        </button>

        {showModelEssay && (
          <div className="border-t border-gray-100 px-4 pb-4 pt-3">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700 mb-3">
              {modelEssay.text}
            </p>
            {modelEssay.keyFeatures.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1.5">핵심 특징</p>
                <ul className="space-y-1">
                  {modelEssay.keyFeatures.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-gray-600">
                      <CheckCircle2
                        className="h-3.5 w-3.5 shrink-0 mt-0.5"
                        style={{ color: '#1FAF54' }}
                      />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 내가 쓴 글 */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <h3 className="mb-2 text-sm font-semibold text-gray-700">내가 작성한 에세이</h3>
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-600">{essay}</p>
      </div>

      {/* 하단 버튼 */}
      <div className="space-y-2">
        <button
          onClick={onReset}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-bold text-white"
          style={{ backgroundColor: '#E35C20' }}
        >
          <RotateCcw className="h-4 w-4" />
          다른 주제로 연습하기
        </button>
        <button
          onClick={onRetry}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50"
        >
          같은 주제로 다시 쓰기
        </button>
        <Link
          href="/student/learn/domain/WRITING"
          className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#7854F7] text-sm font-medium text-[#7854F7] hover:bg-[#F5F3FF]"
        >
          <Sparkles className="h-4 w-4" />
          레벨업 연습 시작
        </Link>
      </div>
    </div>
  )
}
