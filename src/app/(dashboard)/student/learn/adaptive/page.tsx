import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Brain } from 'lucide-react'
import { getCurrentUser } from '@/lib/auth'
import { getAdaptiveQuestions } from '../actions'
import { AdaptiveClient } from './_components/adaptive-client'

const DOMAIN_CONFIG = {
  GRAMMAR: { label: '문법', color: '#1865F2', bg: '#EEF4FF' },
  VOCABULARY: { label: '어휘', color: '#7854F7', bg: '#F3F0FF' },
  READING: { label: '독해', color: '#0FBFAD', bg: '#EFFAF9' },
  WRITING: { label: '쓰기', color: '#E35C20', bg: '#FFF3EE' },
} as const

export default async function AdaptivePage() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'STUDENT') redirect('/login')

  const { questions, domain, domainScore } = await getAdaptiveQuestions()

  const cfg = DOMAIN_CONFIG[domain as keyof typeof DOMAIN_CONFIG] ?? DOMAIN_CONFIG.GRAMMAR

  return (
    <div className="space-y-4">
      {/* 뒤로가기 + 헤더 */}
      <div className="flex items-center gap-3">
        <Link
          href="/student/learn"
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50"
        >
          <ChevronLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">AI 맞춤형 학습</h1>
          <p className="text-xs text-gray-500">취약 영역 분석 기반 추천 문제</p>
        </div>
      </div>

      {/* AI 추천 배너 */}
      <div
        className="flex items-center gap-3 rounded-xl border p-4"
        style={{ backgroundColor: cfg.bg, borderColor: cfg.color + '40' }}
      >
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          style={{ backgroundColor: cfg.color }}
        >
          <Brain className="h-5 w-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900">
            <span style={{ color: cfg.color }}>{cfg.label}</span> 영역 집중 훈련
          </p>
          <p className="text-xs text-gray-500">
            {domainScore !== null
              ? `현재 점수: ${domainScore}점 · AI가 약점을 분석하여 추천한 문제입니다`
              : 'AI가 추천한 영역입니다 · 문제를 풀고 실력을 측정하세요'}
          </p>
        </div>
        <span className="shrink-0 rounded-full px-2.5 py-1 text-xs font-bold text-white" style={{ backgroundColor: cfg.color }}>
          {questions.length}문제
        </span>
      </div>

      {questions.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 py-16 text-center">
          <div className="mb-3 text-4xl">📚</div>
          <p className="text-sm font-medium text-gray-600">추천 문제가 없습니다</p>
          <p className="mt-1 text-xs text-gray-400">아직 이 영역에 문제가 없어요.</p>
          <Link
            href="/student/learn"
            className="mt-4 inline-flex h-10 items-center rounded-xl bg-[#1865F2] px-5 text-sm font-semibold text-white"
          >
            돌아가기
          </Link>
        </div>
      ) : (
        <AdaptiveClient questions={questions} />
      )}
    </div>
  )
}
