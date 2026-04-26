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
  BarChart2,
  Zap,
  Flag,
} from 'lucide-react'
import type { WritingEvaluationResult } from '@/app/api/ai/evaluate-writing/route'
import type { DomainLevels } from '@/lib/ai/domain-level-calculator'

// ── 타입 ──────────────────────────────────────────────────────────────────────

export type StudentProfileForWriting = {
  currentLevel: number
  cefrLevel: string
  grammarAvg: number | null
  vocabAvg: number | null
  readingAvg: number | null
  writingAvg: number | null
  recentWritingScores: number[]
  domainLevels: DomainLevels | null
}

type TopicData = {
  id: string
  titleKo: string
  prompt: string
  minWords: number
  maxWords: number
  level: number
}

// ── 10단계 레벨별 주제 데이터 ──────────────────────────────────────────────────

const ALL_TOPICS: TopicData[] = [
  // Level 1 (Pre-A1): 단어 나열, 10~20단어
  {
    id: 'l1-1',
    titleKo: '나를 소개해주세요',
    prompt: 'Write your name, age, and one thing you like. Use simple words.',
    minWords: 10,
    maxWords: 20,
    level: 1,
  },
  {
    id: 'l1-2',
    titleKo: '우리 가족',
    prompt: 'Write about your family members. Who are they?',
    minWords: 10,
    maxWords: 20,
    level: 1,
  },
  {
    id: 'l1-3',
    titleKo: '내가 좋아하는 것',
    prompt: 'Write 3~5 things you like. Use "I like ___."',
    minWords: 10,
    maxWords: 20,
    level: 1,
  },
  // Level 2 (A1 하): 기초 문장, 20~35단어
  {
    id: 'l2-1',
    titleKo: '내 친구 소개',
    prompt: 'Write about your friend. What is their name? What do they look like? What do they like?',
    minWords: 20,
    maxWords: 35,
    level: 2,
  },
  {
    id: 'l2-2',
    titleKo: '오늘 날씨',
    prompt: 'Write about today\'s weather. Is it sunny, cloudy, or rainy? How do you feel?',
    minWords: 20,
    maxWords: 35,
    level: 2,
  },
  {
    id: 'l2-3',
    titleKo: '내가 좋아하는 음식',
    prompt: 'Write about your favorite food. What is it? Why do you like it?',
    minWords: 20,
    maxWords: 35,
    level: 2,
  },
  // Level 3 (A1 상): 2~3문장 연결, 30~50단어
  {
    id: 'l3-1',
    titleKo: '나의 하루 일과',
    prompt: 'Describe your daily routine. What do you do in the morning, afternoon, and evening?',
    minWords: 30,
    maxWords: 50,
    level: 3,
  },
  {
    id: 'l3-2',
    titleKo: '주말에 한 일',
    prompt: 'Write about what you did last weekend. Where did you go? What did you do?',
    minWords: 30,
    maxWords: 50,
    level: 3,
  },
  {
    id: 'l3-3',
    titleKo: '나의 학교 생활',
    prompt: 'Write about your school life. What do you study? Who is your best friend at school?',
    minWords: 30,
    maxWords: 50,
    level: 3,
  },
  // Level 4 (A2 하): 과거시제, 전치사, 2~3문장 연결, 40~65단어
  {
    id: 'l4-1',
    titleKo: '어제 한 일을 써보세요',
    prompt: 'Write about what you did yesterday. What activities did you do? How did you feel?',
    minWords: 40,
    maxWords: 65,
    level: 4,
  },
  {
    id: 'l4-2',
    titleKo: '좋아하는 계절과 이유',
    prompt: 'What is your favorite season and why? Describe what you like to do in that season.',
    minWords: 40,
    maxWords: 65,
    level: 4,
  },
  {
    id: 'l4-3',
    titleKo: '기억에 남는 여행',
    prompt: 'Write about a trip you remember. Where did you go? What did you see and do?',
    minWords: 40,
    maxWords: 65,
    level: 4,
  },
  // Level 5 (A2 상): and/but/because, 짧은 단락, 60~85단어
  {
    id: 'l5-1',
    titleKo: '내가 가고 싶은 곳',
    prompt: 'Write about a place you want to visit. Why do you want to go there? What will you do?',
    minWords: 60,
    maxWords: 85,
    level: 5,
  },
  {
    id: 'l5-2',
    titleKo: '나의 꿈',
    prompt: 'Write about your dream job. What do you want to be? Why? What will you do in that job?',
    minWords: 60,
    maxWords: 85,
    level: 5,
  },
  {
    id: 'l5-3',
    titleKo: '스마트폰의 장단점',
    prompt: 'Write about the good and bad things about smartphones. Use "because" and "but".',
    minWords: 60,
    maxWords: 85,
    level: 5,
  },
  // Level 6 (B1 하): 연결어, 의견 표현, 80~110단어
  {
    id: 'l6-1',
    titleKo: '환경을 보호하는 방법',
    prompt:
      'What can we do to protect the environment? Give specific examples and explain why they are important.',
    minWords: 80,
    maxWords: 110,
    level: 6,
  },
  {
    id: 'l6-2',
    titleKo: '학교에서 가장 좋아하는 과목과 이유',
    prompt:
      'What is your favorite subject at school? Explain why you like it and how it helps you in daily life.',
    minWords: 80,
    maxWords: 110,
    level: 6,
  },
  {
    id: 'l6-3',
    titleKo: '인터넷 학습 vs 학교 공부',
    prompt:
      'Compare studying on the internet and studying at school. Which do you prefer and why? Use connectors like "however" and "moreover".',
    minWords: 80,
    maxWords: 110,
    level: 6,
  },
  // Level 7 (B1 상): 관계대명사, 완료시제, 논리적 단락, 100~140단어
  {
    id: 'l7-1',
    titleKo: '기술 발전이 학교 생활에 미치는 영향',
    prompt:
      'How has technology changed school life? Discuss the benefits and drawbacks with specific examples.',
    minWords: 100,
    maxWords: 140,
    level: 7,
  },
  {
    id: 'l7-2',
    titleKo: '만약 100만원이 있다면 무엇을 하겠습니까?',
    prompt:
      'If you had 1,000,000 won, what would you do with it? Give two or three reasons for your choices and include examples.',
    minWords: 100,
    maxWords: 140,
    level: 7,
  },
  {
    id: 'l7-3',
    titleKo: '소셜 미디어와 친구 관계',
    prompt:
      'How does social media affect friendships among teenagers? Use relative clauses and give examples from your experience.',
    minWords: 100,
    maxWords: 140,
    level: 7,
  },
  // Level 8 (B2 하): 복문/가정법, 추상 주제, 130~185단어
  {
    id: 'l8-1',
    titleKo: '소셜 미디어가 청소년에게 미치는 영향',
    prompt:
      'Discuss the impact of social media on teenagers. Consider both positive and negative effects with evidence and examples.',
    minWords: 130,
    maxWords: 185,
    level: 8,
  },
  {
    id: 'l8-2',
    titleKo: '도시 생활과 시골 생활의 장단점',
    prompt:
      'Compare the advantages and disadvantages of city life and country life. Which do you prefer and why? Support your argument with specific reasons.',
    minWords: 130,
    maxWords: 185,
    level: 8,
  },
  {
    id: 'l8-3',
    titleKo: '기술 발전이 교육에 미치는 영향',
    prompt:
      'How has technological advancement affected education? Discuss both the benefits and drawbacks, and propose solutions to the challenges.',
    minWords: 130,
    maxWords: 185,
    level: 8,
  },
  // Level 9 (B2 상): 정교한 문장, 학술 어휘, 180~225단어
  {
    id: 'l9-1',
    titleKo: '인공지능이 미래 직업 시장에 미칠 영향',
    prompt:
      'Discuss how artificial intelligence will impact the future job market. Consider both opportunities and challenges, and propose concrete solutions.',
    minWords: 180,
    maxWords: 225,
    level: 9,
  },
  {
    id: 'l9-2',
    titleKo: '세계화의 문화적 영향에 대한 당신의 견해',
    prompt:
      'Share your perspective on the cultural impacts of globalization. Discuss how it affects local cultures, identity, and values, using critical analysis.',
    minWords: 180,
    maxWords: 225,
    level: 9,
  },
  {
    id: 'l9-3',
    titleKo: '환경 위기와 국제 사회의 책임',
    prompt:
      'Analyze the global environmental crisis and argue what responsibilities individuals, governments, and corporations should take. Support your argument with evidence.',
    minWords: 180,
    maxWords: 225,
    level: 9,
  },
  // Level 10 (C1+): 네이티브급, 논술, 220~260단어
  {
    id: 'l10-1',
    titleKo: '교육 시스템의 근본적 변화가 필요한가?',
    prompt:
      'Does the education system need fundamental changes? Argue your position with evidence, acknowledge counterarguments, and propose specific reforms.',
    minWords: 220,
    maxWords: 260,
    level: 10,
  },
  {
    id: 'l10-2',
    titleKo: 'AI 시대의 창의성과 인간의 역할',
    prompt:
      'In the age of AI, what is the role of human creativity? Discuss the philosophical and practical implications, and argue whether AI enhances or threatens human expression.',
    minWords: 220,
    maxWords: 260,
    level: 10,
  },
  {
    id: 'l10-3',
    titleKo: '과학 기술의 발전과 윤리적 책임',
    prompt:
      'As science and technology advance rapidly, how should society balance innovation with ethical responsibility? Use specific examples and develop a nuanced argument.',
    minWords: 220,
    maxWords: 260,
    level: 10,
  },
]

const CEFR_MAP: Record<number, string> = {
  1: 'Pre-A1',
  2: 'A1 하',
  3: 'A1 상',
  4: 'A2 하',
  5: 'A2 상',
  6: 'B1 하',
  7: 'B1 상',
  8: 'B2 하',
  9: 'B2 상',
  10: 'C1+',
}

const DOMAIN_COLORS: Record<string, string> = {
  grammar: '#1865F2',
  vocabulary: '#7854F7',
  reading: '#0FBFAD',
  listening: '#E91E8A',
  writing: '#E35C20',
}

const DOMAIN_LABELS: Record<string, string> = {
  grammar: '문법',
  vocabulary: '어휘',
  reading: '읽기',
  listening: '듣기',
  writing: '쓰기',
}

const AREA_LABELS: Record<string, string> = {
  grammarInWriting: '쓰기 문법',
  organization: '쓰기 구성',
  vocabularyInWriting: '쓰기 어휘',
  expression: '표현력',
}

const AREA_COLORS: Record<string, string> = {
  grammarInWriting: '#1865F2',
  organization: '#0FBFAD',
  vocabularyInWriting: '#7854F7',
  expression: '#E35C20',
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

// ── 가로 레벨 바 ───────────────────────────────────────────────────────────────

function LevelBar({
  label,
  level,
  score,
  cefr,
  color,
  hasGap,
  gapBadge,
}: {
  label: string
  level: number
  score: number
  cefr: string
  color: string
  hasGap?: boolean
  gapBadge?: string
}) {
  const filledBars = level
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="w-16 shrink-0 text-xs font-medium text-gray-600">{label}</span>
        <div className="flex flex-1 gap-0.5">
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              className="h-3 flex-1 rounded-sm transition-all"
              style={{
                backgroundColor: i < filledBars ? color : '#E5E7EB',
                opacity: i < filledBars ? 1 : 0.4,
              }}
            />
          ))}
        </div>
        <div className="flex items-center gap-1.5 text-right">
          <span className="text-xs font-bold" style={{ color }}>
            Lv.{level}
          </span>
          <span className="text-xs text-gray-400">{cefr}</span>
          <span className="w-10 text-right text-xs text-gray-400">({score}점)</span>
          {gapBadge && (
            <span className="shrink-0 text-xs">{gapBadge}</span>
          )}
        </div>
      </div>
      {hasGap && (
        <div className="ml-16 mb-0.5 text-xs text-gray-400">{''}</div>
      )}
    </div>
  )
}

// ── 메인 컴포넌트 ──────────────────────────────────────────────────────────────

export function WritingClient({ studentProfile }: { studentProfile: StudentProfileForWriting }) {
  const [selectedTopic, setSelectedTopic] = useState<TopicData | null>(null)
  const [essay, setEssay] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [feedback, setFeedback] = useState<WritingEvaluationResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showChallenge, setShowChallenge] = useState(false)

  const { currentLevel } = studentProfile
  const wordCount = countWords(essay)

  const currentTopics = ALL_TOPICS.filter((t) => t.level === currentLevel)
  const challengeTopics = ALL_TOPICS.filter(
    (t) => t.level === currentLevel + 1 || t.level === currentLevel + 2,
  ).slice(0, 6)

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
    setShowChallenge(false)
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
              <TopicCard key={topic.id} topic={topic} isChallenge={false} onSelect={setSelectedTopic} />
            ))}
          </div>
        </div>

        {/* 도전 주제 토글 */}
        {challengeTopics.length > 0 && currentLevel < 10 && (
          <div>
            <button
              onClick={() => setShowChallenge((v) => !v)}
              className="mb-2 flex items-center gap-2"
            >
              <span
                className="rounded-full px-2.5 py-0.5 text-xs font-bold text-white"
                style={{ backgroundColor: '#7854F7' }}
              >
                도전 ✦
              </span>
              <span className="text-sm font-semibold text-gray-700">
                도전 주제 (Level {currentLevel + 1}~{Math.min(currentLevel + 2, 10)})
              </span>
              {showChallenge ? (
                <ChevronUp className="h-4 w-4 text-gray-400" />
              ) : (
                <ChevronDown className="h-4 w-4 text-gray-400" />
              )}
            </button>
            {showChallenge && (
              <div className="space-y-2">
                {challengeTopics.map((topic) => (
                  <TopicCard key={topic.id} topic={topic} isChallenge={true} onSelect={setSelectedTopic} />
                ))}
              </div>
            )}
            {!showChallenge && (
              <button
                onClick={() => setShowChallenge(true)}
                className="w-full rounded-xl border border-dashed border-[#7854F7] py-3 text-xs font-medium text-[#7854F7] hover:bg-[#F5F3FF]"
              >
                도전 주제 보기 (1~2단계 높은 주제)
              </button>
            )}
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
          <div className="min-w-0 flex-1">
            <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
              {isChallengeTopic ? (
                <span
                  className="rounded-full px-2 py-0.5 text-xs font-bold text-white"
                  style={{ backgroundColor: '#7854F7' }}
                >
                  도전 ✦ Level {selectedTopic.level}
                </span>
              ) : (
                <span
                  className="rounded-full px-2 py-0.5 text-xs font-bold text-white"
                  style={{ backgroundColor: '#E35C20' }}
                >
                  Level {selectedTopic.level}
                </span>
              )}
              <span className="text-sm font-bold text-gray-900">{selectedTopic.titleKo}</span>
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
              <ChevronLeft className="mr-0.5 inline h-3 w-3" />
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
                  <span className="font-medium text-[#FFB100]">
                    최소 {selectedTopic.minWords}단어 필요 (현재 {wordCount}단어)
                  </span>
                ) : wordCount > selectedTopic.maxWords ? (
                  <span className="font-medium text-[#D92916]">
                    권장 단어수 초과 (현재 {wordCount}단어)
                  </span>
                ) : (
                  <span className="font-medium text-[#1FAF54]">적정 길이 ({wordCount}단어)</span>
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
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#D92916]" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-[#D92916]">{error}</p>
                </div>
                <button
                  onClick={handleGetFeedback}
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
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-1.5">
            <span className="flex items-center gap-0.5">
              {Array.from({ length: starCount }).map((_, i) => (
                <Star key={i} className="h-3 w-3 fill-current" style={{ color: accentColor }} />
              ))}
            </span>
            <span className="text-xs text-gray-400">
              {topic.minWords}~{topic.maxWords}단어
            </span>
            {isChallenge && (
              <span className="text-xs font-medium" style={{ color: '#7854F7' }}>
                Level {topic.level} ({CEFR_MAP[topic.level]})
              </span>
            )}
          </div>
          <p className="text-sm font-bold text-gray-900">{topic.titleKo}</p>
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-gray-500">{topic.prompt}</p>
          <p className="mt-1.5 text-xs text-gray-400">평가: 쓰기 레벨 · 문법 · 구성 · 어휘 · 표현</p>
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
  const { domainLevels } = studentProfile
  const { writingLevelAssessment, detailedScores, crossDomainAnalysis, corrections, levelUpStrategy, modelEssay } = feedback

  const assessedLevel = writingLevelAssessment.assessedLevel
  const maxGap = domainLevels?.gaps.maxGap ?? 0

  // 쓰기 레벨 판정 색상
  const levelColor =
    assessedLevel >= 8 ? '#1FAF54' : assessedLevel >= 5 ? '#FFB100' : '#D92916'

  return (
    <div className="space-y-4">

      {/* ① 쓰기 레벨 독립 판정 */}
      <div className="rounded-xl border-2 bg-white p-5" style={{ borderColor: levelColor }}>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4" style={{ color: levelColor }} />
            <h3 className="text-sm font-bold text-gray-900">쓰기 레벨 판정</h3>
            <span className="rounded-full px-2 py-0.5 text-xs font-medium text-white"
              style={{ backgroundColor: levelColor }}>
              {writingLevelAssessment.confidence === 'high' ? '신뢰도 높음' : writingLevelAssessment.confidence === 'medium' ? '신뢰도 보통' : '신뢰도 낮음'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex flex-col items-center rounded-xl px-5 py-3"
            style={{ backgroundColor: levelColor + '15' }}>
            <span className="text-3xl font-black" style={{ color: levelColor }}>
              Lv.{assessedLevel}
            </span>
            <span className="text-xs font-bold" style={{ color: levelColor }}>
              {writingLevelAssessment.assessedCefr}
            </span>
            <span className="text-xs text-gray-500">{writingLevelAssessment.assessedLevelName}</span>
          </div>
          <p className="flex-1 text-sm leading-relaxed text-gray-700">
            {writingLevelAssessment.summary}
          </p>
        </div>
      </div>

      {/* ② 5영역 레벨 비교 바 차트 (듣기 데이터 있는 경우 포함) */}
      {domainLevels && (
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="mb-3 flex items-center gap-2">
            <BarChart2 className="h-4 w-4 text-gray-500" />
            <h3 className="text-sm font-semibold text-gray-700">
              5영역 레벨 비교 (10단계)
            </h3>
          </div>
          <div className="space-y-2.5">
            {(
              [
                { key: 'grammar', level: domainLevels.grammar.level, score: domainLevels.grammar.score, cefr: domainLevels.grammar.cefr },
                { key: 'vocabulary', level: domainLevels.vocabulary.level, score: domainLevels.vocabulary.score, cefr: domainLevels.vocabulary.cefr },
                { key: 'reading', level: domainLevels.reading.level, score: domainLevels.reading.score, cefr: domainLevels.reading.cefr },
                ...(domainLevels.listening ? [{ key: 'listening', level: domainLevels.listening.level, score: domainLevels.listening.score, cefr: domainLevels.listening.cefr }] : []),
                { key: 'writing', level: assessedLevel, score: detailedScores.totalScore, cefr: writingLevelAssessment.assessedCefr },
              ] as { key: string; level: number; score: number; cefr: string }[]
            ).map(({ key, level, score, cefr }) => {
              const isWriting = key === 'writing'
              const gap = isWriting ? 0 : level - assessedLevel
              const gapBadge = isWriting ? undefined : gap >= 3 ? '🔴' : gap >= 1 ? '⚠️' : undefined
              return (
                <LevelBar
                  key={key}
                  label={DOMAIN_LABELS[key]}
                  level={level}
                  score={score}
                  cefr={cefr}
                  color={DOMAIN_COLORS[key]}
                  gapBadge={gapBadge}
                />
              )
            })}
          </div>
          {maxGap >= 2 && (
            <div className="mt-3 rounded-lg border border-[#FCA5A5] bg-[#FFF5F5] px-3 py-2">
              <p className="text-xs font-medium text-[#D92916]">
                ⚠️ 쓰기가 다른 영역보다{' '}
                {crossDomainAnalysis.levelMap.grammar.gap ?? 0}~{maxGap}단계 낮습니다!
              </p>
            </div>
          )}
        </div>
      )}

      {/* ③ 쓰기 내부 4항목 레벨 */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="mb-3 flex items-center gap-2">
          <Target className="h-4 w-4 text-gray-500" />
          <h3 className="text-sm font-semibold text-gray-700">쓰기 세부 레벨 분석</h3>
        </div>
        <div className="space-y-3">
          {(
            [
              { key: 'grammarInWriting', data: detailedScores.grammarInWriting },
              { key: 'organization', data: detailedScores.organization },
              { key: 'vocabularyInWriting', data: detailedScores.vocabularyInWriting },
              { key: 'expression', data: detailedScores.expression },
            ] as { key: string; data: typeof detailedScores.grammarInWriting }[]
          ).map(({ key, data }) => {
            const color = AREA_COLORS[key]
            const gap = data.gapFromTest?.gap ?? null
            return (
              <div key={key}>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-600">{AREA_LABELS[key]}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold" style={{ color }}>
                      Lv.{data.level}
                    </span>
                    {gap !== null && gap > 0 && (
                      <span className="text-xs text-gray-400">
                        ({gap >= 3 ? '🔴' : '⚠️'} 시험 Lv.{data.gapFromTest!.testLevel}과 {gap}단계 차이)
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-0.5">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-2.5 flex-1 rounded-sm"
                      style={{
                        backgroundColor: i < data.level ? color : '#E5E7EB',
                        opacity: i < data.level ? 1 : 0.35,
                      }}
                    />
                  ))}
                </div>
                <p className="mt-1 text-xs leading-relaxed text-gray-500">{data.detail}</p>
                {data.gapFromTest?.gapAnalysis && (
                  <p className="mt-0.5 text-xs text-[#7854F7]">{data.gapFromTest.gapAnalysis}</p>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ④ 종합 진단 */}
      <div
        className="rounded-xl border px-4 py-4"
        style={{ backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }}
      >
        <div className="mb-2 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-[#1865F2]" />
          <h3 className="text-sm font-semibold text-[#1865F2]">종합 진단</h3>
        </div>
        <p className="text-sm leading-relaxed text-gray-700">
          {crossDomainAnalysis.overallDiagnosis}
        </p>
        {crossDomainAnalysis.biggestGap && (
          <div className="mt-3 rounded-lg border border-[#FCA5A5] bg-white px-3 py-2">
            <p className="text-xs font-semibold text-[#D92916]">
              가장 큰 격차: {crossDomainAnalysis.biggestGap.area}
            </p>
            <p className="text-xs text-gray-600">{crossDomainAnalysis.biggestGap.detail}</p>
          </div>
        )}
      </div>

      {/* ⑤ 교정 사항 */}
      {corrections.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="mb-3 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-[#D92916]" />
            <h3 className="text-sm font-semibold text-gray-700">교정 사항</h3>
          </div>
          <div className="space-y-3">
            {corrections.map((c, i) => (
              <div key={i} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                <div className="mb-2 space-y-1">
                  <p className="text-xs leading-relaxed text-[#D92916] line-through">{c.original}</p>
                  <p className="text-xs font-medium leading-relaxed text-[#1FAF54]">→ {c.corrected}</p>
                </div>
                <p className="mb-1.5 text-xs leading-relaxed text-gray-500">{c.explanation}</p>
                {c.relatedStrength && (
                  <p className="text-xs text-[#1865F2]">
                    💡 {c.relatedStrength}
                  </p>
                )}
                {c.levelImpact && (
                  <p className="mt-0.5 text-xs font-medium" style={{ color: '#7854F7' }}>
                    📈 {c.levelImpact}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ⑥ 레벨업 로드맵 */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="mb-3 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-[#7854F7]" />
          <h3 className="text-sm font-semibold text-gray-700">
            Level {levelUpStrategy.currentWritingLevel} → Level {levelUpStrategy.targetWritingLevel} 로드맵
          </h3>
        </div>

        {/* 핵심 메시지 */}
        <div
          className="mb-4 rounded-lg px-3 py-2.5"
          style={{ backgroundColor: '#F5F3FF' }}
        >
          <p className="text-xs leading-relaxed font-medium" style={{ color: '#7854F7' }}>
            {levelUpStrategy.keyMessage}
          </p>
        </div>

        {/* 마일스톤 */}
        <div className="mb-4">
          <p className="mb-2 text-xs font-semibold text-gray-500">레벨업 경로</p>
          <div className="flex items-center gap-1 overflow-x-auto pb-1">
            {/* 현재 */}
            <div className="flex shrink-0 flex-col items-center">
              <div
                className="flex h-10 w-16 items-center justify-center rounded-xl text-xs font-bold text-white"
                style={{ backgroundColor: '#D92916' }}
              >
                Lv.{levelUpStrategy.currentWritingLevel}
              </div>
              <span className="mt-1 text-xs text-gray-400">현재</span>
            </div>
            {levelUpStrategy.milestones.map((ms, i) => (
              <>
                <div key={`arrow-${i}`} className="shrink-0 text-gray-300">→</div>
                <div key={`ms-${i}`} className="flex shrink-0 flex-col items-center">
                  <div
                    className="flex h-10 w-20 flex-col items-center justify-center rounded-xl border-2 border-dashed px-2 py-1 text-center"
                    style={{ borderColor: '#7854F7' }}
                  >
                    <span className="text-xs font-bold" style={{ color: '#7854F7' }}>
                      {ms.target.split(' ')[0]} {ms.target.split(' ')[1]}
                    </span>
                  </div>
                  <span className="mt-1 text-xs text-gray-400">{ms.week}주 후</span>
                  <span className="text-xs text-gray-400">{ms.sign.slice(0, 10)}...</span>
                </div>
              </>
            ))}
          </div>
        </div>

        {/* 전략 3가지 */}
        <div className="space-y-2.5 mb-3">
          {levelUpStrategy.strategies.map((strategy) => (
            <div key={strategy.priority} className="rounded-lg border border-gray-100 p-3">
              <div className="mb-1.5 flex items-center gap-2">
                <span
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                  style={{ backgroundColor: '#7854F7' }}
                >
                  {strategy.priority}
                </span>
                <span className="text-xs font-semibold text-gray-800">{strategy.title}</span>
                {strategy.bridgingFrom && (
                  <span className="text-xs text-gray-400">({strategy.bridgingFrom})</span>
                )}
              </div>
              <p className="mb-1.5 text-xs leading-relaxed text-gray-600">{strategy.action}</p>
              {strategy.example && (
                <div className="mb-1.5 rounded-lg border border-gray-100 bg-gray-50 px-2.5 py-2 space-y-1">
                  <p className="text-xs text-gray-400 line-through">{strategy.example.before}</p>
                  <p className="text-xs font-medium text-[#1FAF54]">→ {strategy.example.after}</p>
                </div>
              )}
              <div className="rounded-lg px-2.5 py-1.5" style={{ backgroundColor: '#F5F3FF' }}>
                <p className="text-xs font-medium" style={{ color: '#7854F7' }}>
                  <Target className="mr-1 inline h-3 w-3" />
                  이번 주 목표: {strategy.weeklyGoal}
                </p>
              </div>
              {strategy.expectedLevelGain && (
                <p className="mt-1 text-xs font-medium text-[#1FAF54]">
                  📈 {strategy.expectedLevelGain}
                </p>
              )}
            </div>
          ))}
        </div>

        {/* 격려 메시지 */}
        <div
          className="rounded-lg px-3 py-2.5"
          style={{ backgroundColor: '#ECFDF5', borderLeft: '3px solid #1FAF54' }}
        >
          <p className="text-xs leading-relaxed text-gray-700">{levelUpStrategy.encouragement}</p>
        </div>
      </div>

      {/* ⑦ 모범 답안 */}
      <div className="rounded-xl border border-gray-200 bg-white">
        <button
          onClick={() => setShowModelEssay((v) => !v)}
          className="flex w-full items-center justify-between px-4 py-3.5 text-left"
        >
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-gray-500" />
            <span className="text-sm font-semibold text-gray-700">{modelEssay.targetLevelName}</span>
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
            <p className="mb-3 whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
              {modelEssay.text}
            </p>
            {modelEssay.levelFeatures.length > 0 && (
              <div>
                <p className="mb-1.5 text-xs font-semibold text-gray-500">이 레벨의 핵심 특징</p>
                <ul className="space-y-1">
                  {modelEssay.levelFeatures.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-gray-600">
                      <Flag className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: '#7854F7' }} />
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
