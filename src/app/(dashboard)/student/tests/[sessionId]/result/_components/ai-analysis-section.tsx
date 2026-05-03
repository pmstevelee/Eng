'use client'

import { useEffect, useState, useRef } from 'react'
import { Sparkles, Loader2, ChevronDown, ChevronUp } from 'lucide-react'
import type { TestSessionAnalysis } from '@/app/api/ai/analyze-test-session/route'

type Props = {
  sessionId: string
}

const DOMAIN_COLOR: Record<string, string> = {
  GRAMMAR: '#1865F2',
  VOCABULARY: '#7854F7',
  READING: '#0FBFAD',
  WRITING: '#E35C20',
  LISTENING: '#E91E8A',
}

const DOMAIN_LABEL: Record<string, string> = {
  GRAMMAR: '문법',
  VOCABULARY: '어휘',
  READING: '독해',
  WRITING: '쓰기',
  LISTENING: '듣기',
}

export function AiAnalysisSection({ sessionId }: Props) {
  const [analysis, setAnalysis] = useState<TestSessionAnalysis | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expanded, setExpanded] = useState(true)
  const hasFetched = useRef(false)

  useEffect(() => {
    if (hasFetched.current) return
    hasFetched.current = true

    fetch('/api/ai/analyze-test-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    })
      .then((r) => r.json())
      .then((json) => {
        if (json.success) {
          setAnalysis(json.data as TestSessionAnalysis)
        } else {
          setError(json.error ?? 'AI 분석을 불러오지 못했습니다.')
        }
      })
      .catch(() => setError('AI 분석 중 오류가 발생했습니다.'))
      .finally(() => setLoading(false))
  }, [sessionId])

  return (
    <div className="rounded-xl border border-[#7854F7]/20 bg-[#7854F7]/5 overflow-hidden">
      {/* 헤더 */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-4"
      >
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-[#7854F7]" />
          <span className="font-semibold text-[#7854F7]">AI 상세 분석</span>
          {loading && (
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <Loader2 className="h-3 w-3 animate-spin" />
              분석 중...
            </span>
          )}
          {!loading && analysis && (
            <span className="rounded-full bg-[#7854F7]/20 px-2 py-0.5 text-xs font-medium text-[#7854F7]">
              완료
            </span>
          )}
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-gray-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-gray-400" />
        )}
      </button>

      {expanded && (
        <div className="border-t border-[#7854F7]/10 px-5 py-5">
          {/* 로딩 스켈레톤 */}
          {loading && (
            <div className="space-y-3 animate-pulse">
              <div className="h-4 w-3/4 rounded bg-[#7854F7]/10" />
              <div className="h-4 w-full rounded bg-[#7854F7]/10" />
              <div className="h-4 w-5/6 rounded bg-[#7854F7]/10" />
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="h-16 rounded-xl bg-[#7854F7]/10" />
                <div className="h-16 rounded-xl bg-[#7854F7]/10" />
              </div>
            </div>
          )}

          {/* 에러 */}
          {error && !loading && (
            <p className="text-sm text-[#D92916]">{error}</p>
          )}

          {/* 분석 결과 */}
          {analysis && !loading && (
            <div className="space-y-5">
              {/* 종합 평가 */}
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[#7854F7]">
                  종합 평가
                </p>
                <p className="text-sm leading-relaxed text-gray-700">{analysis.summary}</p>
              </div>

              {/* 영역별 분석 */}
              {Object.keys(analysis.domainAnalysis).length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#7854F7]">
                    영역별 분석
                  </p>
                  <div className="space-y-2">
                    {(
                      [
                        ['grammar', 'GRAMMAR'],
                        ['vocabulary', 'VOCABULARY'],
                        ['reading', 'READING'],
                        ['writing', 'WRITING'],
                        ['listening', 'LISTENING'],
                      ] as Array<[keyof TestSessionAnalysis['domainAnalysis'], string]>
                    )
                      .filter(([key]) => analysis.domainAnalysis[key])
                      .map(([key, domain]) => (
                        <div key={key} className="flex gap-2 text-sm">
                          <span
                            className="mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-xs font-semibold text-white"
                            style={{ backgroundColor: DOMAIN_COLOR[domain] }}
                          >
                            {DOMAIN_LABEL[domain]}
                          </span>
                          <p className="leading-relaxed text-gray-700">
                            {analysis.domainAnalysis[key]}
                          </p>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* 강점 / 개선점 */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-[#1FAF54]/5 p-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#1FAF54]">
                    강점
                  </p>
                  <ul className="space-y-1.5">
                    {analysis.strengths.map((s, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-sm text-gray-700">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#1FAF54]" />
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-xl bg-[#D92916]/5 p-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#D92916]">
                    개선 필요
                  </p>
                  <ul className="space-y-1.5">
                    {analysis.weaknesses.map((w, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-sm text-gray-700">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#D92916]" />
                        {w}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* 오답 패턴 */}
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[#7854F7]">
                  오답 패턴 분석
                </p>
                <p className="text-sm leading-relaxed text-gray-700">{analysis.wrongPatterns}</p>
              </div>

              {/* 학습 권고사항 */}
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#1865F2]">
                  학습 권고사항
                </p>
                <ol className="space-y-2">
                  {analysis.studyRecommendations.map((r, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#1865F2] text-xs font-bold text-white">
                        {i + 1}
                      </span>
                      {r}
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
