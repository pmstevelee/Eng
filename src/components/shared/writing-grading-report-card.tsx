'use client'

import { useState } from 'react'
import { Sparkles, ChevronDown, ChevronUp } from 'lucide-react'
import type { WritingError, WritingGradingReport } from '@/lib/ai/writing-grading'

const CATEGORY_LABELS: Record<keyof WritingGradingReport['categoryScores'], string> = {
  grammar: '문법',
  spelling: '철자',
  vocabulary: '어휘',
  sentenceStructure: '문장 구조',
  coherence: '응집성',
  taskAchievement: '과제 수행도',
}

const SEVERITY_STYLE: Record<WritingError['severity'], string> = {
  minor: 'border-blue-200 bg-blue-50 text-blue-700',
  moderate: 'border-[#FFB100]/30 bg-[#FFB100]/10 text-[#8a6200]',
  major: 'border-[#D92916]/30 bg-[#D92916]/10 text-[#D92916]',
}

const SEVERITY_LABELS: Record<WritingError['severity'], string> = {
  minor: '경미',
  moderate: '보통',
  major: '중요',
}

export function WritingGradingReportCard({
  report,
  showTeacherNote = false,
}: {
  report: WritingGradingReport
  showTeacherNote?: boolean
}) {
  const [showImproved, setShowImproved] = useState(false)

  return (
    <div className="rounded-lg border border-purple-100 bg-purple-50 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Sparkles className="h-4 w-4 text-[#7854F7]" />
          <p className="text-xs font-medium text-[#7854F7]">
            AI 쓰기 채점 리포트 ({report.cefrEstimate} · {report.wordCount}단어)
          </p>
        </div>
        <span className="text-sm font-bold text-[#7854F7]">{report.overallScore}점</span>
      </div>

      {/* 영역별 점수 */}
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {(Object.keys(CATEGORY_LABELS) as (keyof WritingGradingReport['categoryScores'])[]).map((key) => (
          <div key={key} className="rounded-lg bg-white/70 py-2 text-center">
            <p className="text-[11px] text-gray-500">{CATEGORY_LABELS[key]}</p>
            <p className="text-sm font-bold text-[#7854F7]">{report.categoryScores[key]}</p>
          </div>
        ))}
      </div>

      {/* 잘한 점 */}
      {report.strengths.length > 0 && (
        <div className="rounded-lg bg-white/70 p-3">
          <p className="mb-1 text-xs font-semibold text-[#1FAF54]">잘한 점</p>
          <ul className="space-y-0.5 text-sm text-gray-700">
            {report.strengths.map((s, i) => (
              <li key={i}>· {s}</li>
            ))}
          </ul>
        </div>
      )}

      {/* 오류 목록 */}
      {report.errors.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-800">오류 상세 ({report.errors.length}건)</p>
          {report.errors.map((err, i) => (
            <div key={i} className="rounded-lg border border-gray-200 bg-white/70 p-3 text-sm">
              <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${SEVERITY_STYLE[err.severity]}`}>
                  {SEVERITY_LABELS[err.severity]}
                </span>
                <span className="text-[11px] font-medium text-gray-500">{err.subType}</span>
                {err.occurrenceCount > 1 && (
                  <span className="text-[11px] text-gray-400">동일 유형 오류 {err.occurrenceCount}회 반복</span>
                )}
              </div>
              <p className="text-[#D92916] line-through">{err.original}</p>
              <p className="text-[#1FAF54]">{err.corrected}</p>
              <p className="mt-1 text-gray-600">{err.explanationKo}</p>
            </div>
          ))}
        </div>
      )}

      {/* 철자/문법 오류 요약 */}
      {(report.spellingErrorSummary.length > 0 || report.grammarErrorSummary.length > 0) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {report.spellingErrorSummary.length > 0 && (
            <div className="rounded-lg bg-white/70 p-3">
              <p className="mb-1 text-xs font-semibold text-gray-800">철자 오류 요약</p>
              <ul className="space-y-0.5 text-xs text-gray-600">
                {report.spellingErrorSummary.map((s, i) => (
                  <li key={i}>
                    <span className="text-[#D92916] line-through">{s.misspelled}</span> → {s.correct} ({s.occurrenceCount}회)
                  </li>
                ))}
              </ul>
            </div>
          )}
          {report.grammarErrorSummary.length > 0 && (
            <div className="rounded-lg bg-white/70 p-3">
              <p className="mb-1 text-xs font-semibold text-gray-800">문법 오류 요약</p>
              <ul className="space-y-0.5 text-xs text-gray-600">
                {report.grammarErrorSummary.map((g, i) => (
                  <li key={i}>
                    {g.category} {g.count}건{g.examples.length > 0 ? ` — ${g.examples.join(', ')}` : ''}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* 수정본 */}
      {report.improvedVersion && (
        <div className="rounded-lg bg-white/70 p-3">
          <button
            type="button"
            onClick={() => setShowImproved((v) => !v)}
            className="flex w-full items-center justify-between text-xs font-semibold text-gray-800"
          >
            수정 버전 보기
            {showImproved ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
          {showImproved && (
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
              {report.improvedVersion}
            </p>
          )}
        </div>
      )}

      {showTeacherNote && report.teacherNote && (
        <div className="rounded-lg border border-gray-200 bg-white/70 p-3">
          <p className="mb-1 text-xs font-semibold text-gray-800">교사 참고 메모</p>
          <p className="text-sm text-gray-700">{report.teacherNote}</p>
        </div>
      )}

      {report.nextStepRecommendation && (
        <div className="rounded-lg border border-[#FFB100]/30 bg-[#FFB100]/10 p-3">
          <p className="mb-1 text-xs font-semibold text-[#8a6200]">다음 학습 추천</p>
          <p className="text-sm text-[#8a6200]">{report.nextStepRecommendation}</p>
        </div>
      )}
    </div>
  )
}
