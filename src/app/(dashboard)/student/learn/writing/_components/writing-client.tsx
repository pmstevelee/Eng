'use client'

import { useState } from 'react'
import {
  ChevronLeft,
  CheckCircle2,
  Sparkles,
  Loader2,
  RotateCcw,
} from 'lucide-react'

// ── 주제 목록 (매주 갱신 시뮬레이션: 주차별 5개) ────────────────────────────────

type Topic = {
  id: string
  title: string
  prompt: string
  difficulty: '초급' | '중급' | '고급'
  minWords: number
  maxWords: number
  difficultyColor: string
}

const WRITING_TOPICS: Topic[] = [
  {
    id: '1',
    title: '나의 꿈',
    prompt:
      'Describe your dream job and explain why you want to pursue it. What skills do you need to achieve this dream?',
    difficulty: '초급',
    minWords: 100,
    maxWords: 200,
    difficultyColor: '#1FAF54',
  },
  {
    id: '2',
    title: '환경 보호',
    prompt:
      'What can individuals do to protect the environment in their daily lives? Give specific examples and explain why these actions are important.',
    difficulty: '중급',
    minWords: 150,
    maxWords: 250,
    difficultyColor: '#FFB100',
  },
  {
    id: '3',
    title: '소셜 미디어의 영향',
    prompt:
      'Do you think social media has a positive or negative impact on teenagers? Support your opinion with reasons and examples.',
    difficulty: '중급',
    minWords: 150,
    maxWords: 250,
    difficultyColor: '#FFB100',
  },
  {
    id: '4',
    title: '도시 vs 농촌 생활',
    prompt:
      'Compare city life and country life. Which do you prefer and why? Consider factors such as lifestyle, opportunities, and quality of life.',
    difficulty: '고급',
    minWords: 200,
    maxWords: 350,
    difficultyColor: '#D92916',
  },
  {
    id: '5',
    title: '기술의 발전',
    prompt:
      'How has technology changed the way we communicate and learn? Discuss both the benefits and drawbacks of these changes.',
    difficulty: '고급',
    minWords: 200,
    maxWords: 300,
    difficultyColor: '#D92916',
  },
]

// ── AI 피드백 결과 타입 ──────────────────────────────────────────────────────

type FeedbackResult = {
  grammar: number
  structure: number
  vocabulary: number
  expression: number
  totalScore: number
  summary: string
  suggestions: [string, string, string]
}

// ── 메인 컴포넌트 ──────────────────────────────────────────────────────────────

export function WritingClient() {
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null)
  const [essay, setEssay] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [feedback, setFeedback] = useState<FeedbackResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const charCount = essay.length

  async function handleGetFeedback() {
    if (!selectedTopic || essay.trim().length < 50) return
    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/ai/evaluate-writing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ essay, prompt: selectedTopic.prompt }),
      })

      if (!res.ok) {
        const data = await res.json() as { error?: string }
        throw new Error(data.error ?? 'AI 분석 중 오류가 발생했습니다.')
      }

      const data = await res.json() as { success: boolean; data: FeedbackResult }
      setFeedback(data.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI 분석 중 오류가 발생했습니다.')
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

  // ── 주제 선택 화면 ───────────────────────────────────────────────────────────
  if (!selectedTopic) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-gray-500">주제를 선택하세요</p>
        {WRITING_TOPICS.map((topic) => (
          <button
            key={topic.id}
            onClick={() => setSelectedTopic(topic)}
            className="w-full rounded-xl border border-gray-200 bg-white p-4 text-left transition-all hover:border-gray-300 hover:shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <span
                    className="rounded-full px-2.5 py-0.5 text-xs font-bold text-white"
                    style={{ backgroundColor: topic.difficultyColor }}
                  >
                    {topic.difficulty}
                  </span>
                  <span className="text-xs text-gray-400">
                    {topic.minWords}~{topic.maxWords}자
                  </span>
                </div>
                <p className="font-bold text-gray-900">{topic.title}</p>
                <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-gray-500">
                  {topic.prompt}
                </p>
              </div>
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                style={{ backgroundColor: topic.difficultyColor + '20' }}
              >
                <span className="text-lg">✍️</span>
              </div>
            </div>
          </button>
        ))}
      </div>
    )
  }

  // ── 에세이 작성 화면 ─────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* 선택된 주제 */}
      <div
        className="rounded-xl border p-4"
        style={{ backgroundColor: '#FFFBEB', borderColor: '#FCD34D' }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span
                className="rounded-full px-2.5 py-0.5 text-xs font-bold text-white"
                style={{ backgroundColor: selectedTopic.difficultyColor }}
              >
                {selectedTopic.difficulty}
              </span>
              <span className="font-bold text-gray-900">{selectedTopic.title}</span>
            </div>
            <p className="text-sm leading-relaxed text-gray-600">{selectedTopic.prompt}</p>
            <p className="mt-1.5 text-xs text-gray-400">
              권장 {selectedTopic.minWords}~{selectedTopic.maxWords}자
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
              주제 변경
            </button>
          )}
        </div>
      </div>

      {/* 피드백 결과 */}
      {feedback ? (
        <FeedbackDisplay feedback={feedback} onReset={handleReset} essay={essay} />
      ) : (
        <>
          {/* 텍스트 에디터 */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              에세이 작성
            </label>
            <textarea
              value={essay}
              onChange={(e) => setEssay(e.target.value)}
              placeholder="영어로 에세이를 작성하세요..."
              rows={12}
              className="w-full resize-none rounded-xl border border-gray-200 px-4 py-3 text-sm leading-relaxed text-gray-900 outline-none transition-all focus:border-[#FFB100] focus:ring-2 focus:ring-[#FFB100]/20"
            />
            <div className="mt-1.5 flex items-center justify-between text-xs text-gray-400">
              <span>
                {charCount < selectedTopic.minWords ? (
                  <span className="text-[#FFB100] font-medium">
                    최소 {selectedTopic.minWords}자 필요 ({charCount}자 작성 중)
                  </span>
                ) : charCount > selectedTopic.maxWords ? (
                  <span className="text-[#D92916] font-medium">
                    권장 글자수 초과 ({charCount}자)
                  </span>
                ) : (
                  <span className="text-[#1FAF54] font-medium">
                    적정 길이 ({charCount}자)
                  </span>
                )}
              </span>
              <span>
                {charCount} / {selectedTopic.maxWords}자
              </span>
            </div>
          </div>

          {/* 오류 */}
          {error && (
            <div className="rounded-xl border border-[#FCA5A5] bg-[#FFF5F5] px-4 py-3 text-sm text-[#D92916]">
              {error}
            </div>
          )}

          {/* AI 피드백 버튼 */}
          <button
            onClick={handleGetFeedback}
            disabled={isLoading || essay.trim().length < 50}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-bold text-white transition-all disabled:cursor-not-allowed disabled:opacity-50"
            style={{ backgroundColor: '#7854F7' }}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                AI 분석 중...
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

// ── 피드백 결과 화면 ───────────────────────────────────────────────────────────

const SCORE_ITEMS = [
  { key: 'grammar' as const, label: '문법 정확도', color: '#1865F2' },
  { key: 'structure' as const, label: '내용 구성', color: '#0FBFAD' },
  { key: 'vocabulary' as const, label: '어휘 다양성', color: '#7854F7' },
  { key: 'expression' as const, label: '표현력', color: '#E35C20' },
]

function FeedbackDisplay({
  feedback,
  onReset,
  essay,
}: {
  feedback: FeedbackResult
  onReset: () => void
  essay: string
}) {
  const totalColor =
    feedback.totalScore >= 8 ? '#1FAF54' : feedback.totalScore >= 6 ? '#FFB100' : '#D92916'

  return (
    <div className="space-y-4">
      {/* 총점 카드 */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 text-center">
        <div className="mb-1 text-3xl">
          {feedback.totalScore >= 8 ? '🌟' : feedback.totalScore >= 6 ? '👍' : '💪'}
        </div>
        <p
          className="text-5xl font-black"
          style={{ color: totalColor }}
        >
          {feedback.totalScore}
        </p>
        <p className="text-sm text-gray-400 mt-0.5">/ 10점</p>
      </div>

      {/* 영역별 점수 */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <h3 className="mb-4 text-sm font-semibold text-gray-700">영역별 점수</h3>
        <div className="space-y-3">
          {SCORE_ITEMS.map(({ key, label, color }) => {
            const score = feedback[key]
            const pct = (score / 10) * 100
            return (
              <div key={key}>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-600">{label}</span>
                  <span className="text-sm font-bold" style={{ color }}>
                    {score} / 10
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-2 rounded-full transition-all"
                    style={{ width: `${pct}%`, backgroundColor: color }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* 총평 */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="flex items-center gap-2 mb-3">
          <CheckCircle2 className="h-4 w-4 text-[#7854F7]" />
          <h3 className="text-sm font-semibold text-gray-700">총평</h3>
        </div>
        <p className="text-sm leading-relaxed text-gray-600">{feedback.summary}</p>
      </div>

      {/* 개선 제안 */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="h-4 w-4 text-[#FFB100]" />
          <h3 className="text-sm font-semibold text-gray-700">개선 제안</h3>
        </div>
        <div className="space-y-3">
          {feedback.suggestions.map((suggestion, i) => (
            <div key={i} className="flex items-start gap-3">
              <span
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                style={{ backgroundColor: '#FFB100' }}
              >
                {i + 1}
              </span>
              <p className="text-sm leading-relaxed text-gray-600">{suggestion}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 내가 쓴 글 */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <h3 className="mb-3 text-sm font-semibold text-gray-700">내가 작성한 에세이</h3>
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-600">{essay}</p>
      </div>

      {/* 액션 버튼 */}
      <div className="flex gap-3">
        <button
          onClick={onReset}
          className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
        >
          <RotateCcw className="h-4 w-4" />
          다른 주제 선택
        </button>
      </div>
    </div>
  )
}
