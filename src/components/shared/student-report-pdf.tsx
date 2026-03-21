'use client'

import { useRef, useState, useTransition } from 'react'
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from 'recharts'
import { Printer, Download, Sparkles, Loader2, RefreshCw } from 'lucide-react'
import type { ReportResult } from '@/types'

type DomainScore = {
  subject: string
  score: number
  fullMark: number
  color: string
  key: 'grammar' | 'vocabulary' | 'reading' | 'writing'
}

type TeacherCommentData = {
  id: string
  content: string
  teacherName: string
  createdAt: Date
}

type Props = {
  studentName: string
  studentId: string
  grade?: number | null
  currentLevel: number
  className?: string | null
  academyName: string
  domainScores: DomainScore[]
  teacherComments: TeacherCommentData[]
  initialReport?: ReportResult | null
  reportDate?: string
}

const DOMAIN_COLORS: Record<string, string> = {
  grammar: '#1865F2',
  vocabulary: '#7854F7',
  reading: '#0FBFAD',
  writing: '#E35C20',
}

const DOMAIN_LABEL: Record<string, string> = {
  grammar: '문법',
  vocabulary: '어휘',
  reading: '읽기',
  writing: '쓰기',
}

function ScoreBar({ score, color }: { score: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${score}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-sm font-semibold text-gray-700 w-10 text-right">{score}점</span>
    </div>
  )
}

export function StudentReportPdf({
  studentName,
  studentId,
  grade,
  currentLevel,
  className,
  academyName,
  domainScores,
  teacherComments,
  initialReport,
  reportDate,
}: Props) {
  const printRef = useRef<HTMLDivElement>(null)
  const [aiReport, setAiReport] = useState<ReportResult | null>(initialReport ?? null)
  const [isGenerating, startGenerating] = useTransition()
  const [aiError, setAiError] = useState<string | null>(null)

  const today = reportDate ?? new Date().toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const avgScore =
    domainScores.length > 0
      ? Math.round(domainScores.reduce((s, d) => s + d.score, 0) / domainScores.length)
      : 0

  function handlePrint() {
    window.print()
  }

  async function handleGenerateAI() {
    setAiError(null)
    startGenerating(async () => {
      try {
        const res = await fetch('/api/ai/generate-report', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ studentId }),
        })
        const json = await res.json()
        if (!res.ok) {
          setAiError(json.error ?? 'AI 분석 생성에 실패했습니다.')
        } else {
          setAiReport(json.data as ReportResult)
        }
      } catch {
        setAiError('네트워크 오류가 발생했습니다.')
      }
    })
  }

  return (
    <div className="space-y-4">
      {/* 인쇄/다운로드 버튼 - 화면에서만 보임 */}
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">학생 성적 리포트</h1>
          <p className="text-sm text-gray-500 mt-1">{studentName} 학생 종합 분석</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleGenerateAI}
            disabled={isGenerating}
            className="flex items-center gap-2 px-4 h-10 bg-accent-purple hover:bg-purple-700 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-colors"
          >
            {isGenerating ? (
              <Loader2 size={15} className="animate-spin" />
            ) : aiReport ? (
              <RefreshCw size={15} />
            ) : (
              <Sparkles size={15} />
            )}
            {isGenerating ? 'AI 분석 중...' : aiReport ? 'AI 재분석' : 'AI 분석 생성'}
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 h-10 bg-primary-700 hover:bg-primary-800 text-white text-sm font-medium rounded-xl transition-colors"
          >
            <Printer size={15} />
            인쇄 / PDF 저장
          </button>
        </div>
      </div>

      {aiError && (
        <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-100 text-sm text-accent-red print:hidden">
          {aiError}
        </div>
      )}

      {/* ───── 인쇄 영역 ───── */}
      <div
        ref={printRef}
        data-print-area
        className="bg-white rounded-xl border border-gray-200 overflow-hidden print:border-0 print:rounded-none print:shadow-none"
      >
        {/* 리포트 헤더 */}
        <div className="px-8 py-6 border-b border-gray-100 print:border-gray-200">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1">
                {academyName}
              </p>
              <h2 className="text-2xl font-bold text-gray-900">학생 성적 리포트</h2>
              <p className="text-sm text-gray-500 mt-1">최근 1개월 학습 성과 종합 분석</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-400">발행일</p>
              <p className="text-sm font-semibold text-gray-700 mt-0.5">{today}</p>
            </div>
          </div>
        </div>

        <div className="px-8 py-6 space-y-8">
          {/* 학생 정보 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: '학생명', value: studentName },
              { label: '현재 레벨', value: `Level ${currentLevel}` },
              { label: '소속 반', value: className ?? '미배정' },
              { label: '학년', value: grade ? `${grade}학년` : '미등록' },
            ].map((item) => (
              <div key={item.label} className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                <p className="text-xs text-gray-500 uppercase tracking-wide">{item.label}</p>
                <p className="text-base font-bold text-gray-900 mt-0.5">{item.value}</p>
              </div>
            ))}
          </div>

          {/* 종합 점수 + 레이더 차트 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            {/* 레이더 차트 */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">영역별 성취도</h3>
              <ResponsiveContainer width="100%" height={240}>
                <RadarChart data={domainScores} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
                  <PolarGrid stroke="#e5e7eb" />
                  <PolarAngleAxis
                    dataKey="subject"
                    tick={{ fill: '#6b7280', fontSize: 12, fontWeight: 500 }}
                  />
                  <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                  <Radar
                    name="점수"
                    dataKey="score"
                    stroke="#1865F2"
                    fill="#1865F2"
                    fillOpacity={0.15}
                    strokeWidth={2}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>

            {/* 영역별 점수 막대 */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-700">영역별 상세 점수</h3>
              {domainScores.map((d) => (
                <div key={d.key}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: d.color }}
                      />
                      <span className="text-sm font-medium text-gray-700">{d.subject}</span>
                    </div>
                  </div>
                  <ScoreBar score={d.score} color={d.color} />
                </div>
              ))}

              {/* 평균 점수 */}
              <div className="pt-3 border-t border-gray-100">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-700">전체 평균</span>
                  <span className="text-xl font-bold text-primary-700">{avgScore}점</span>
                </div>
              </div>
            </div>
          </div>

          {/* 교사 코멘트 */}
          {teacherComments.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">교사 피드백</h3>
              <div className="space-y-3">
                {teacherComments.map((c) => (
                  <div key={c.id} className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-semibold text-gray-600">{c.teacherName} 선생님</span>
                      <span className="text-xs text-gray-400">
                        {new Date(c.createdAt).toLocaleDateString('ko-KR')}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 leading-relaxed">{c.content}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI 분석 */}
          {aiReport ? (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-lg bg-accent-purple/10 flex items-center justify-center">
                  <Sparkles size={13} className="text-accent-purple" />
                </div>
                <h3 className="text-sm font-semibold text-gray-700">AI 종합 분석</h3>
              </div>

              <div className="space-y-4">
                {/* 종합 평가 */}
                <div className="rounded-xl border border-purple-100 bg-purple-50 px-4 py-4">
                  <p className="text-xs font-semibold text-accent-purple uppercase tracking-wide mb-2">
                    종합 평가
                  </p>
                  <p className="text-sm text-gray-700 leading-relaxed">{aiReport.overallEvaluation}</p>
                </div>

                {/* 영역별 분석 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {(Object.entries(aiReport.domainAnalysis) as [string, string][]).map(([key, text]) => (
                    <div
                      key={key}
                      className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3"
                      style={{ borderLeftColor: DOMAIN_COLORS[key], borderLeftWidth: 3 }}
                    >
                      <p
                        className="text-xs font-semibold uppercase tracking-wide mb-1"
                        style={{ color: DOMAIN_COLORS[key] }}
                      >
                        {DOMAIN_LABEL[key]}
                      </p>
                      <p className="text-sm text-gray-600 leading-relaxed">{text}</p>
                    </div>
                  ))}
                </div>

                {/* 성장 포인트 + 학습 제안 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-semibold text-accent-green uppercase tracking-wide mb-2">
                      성장 포인트
                    </p>
                    <ul className="space-y-1.5">
                      {aiReport.growthPoints.map((point, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                          <span className="text-accent-green mt-0.5 shrink-0">✓</span>
                          {point}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-primary-700 uppercase tracking-wide mb-2">
                      학습 제안
                    </p>
                    <ul className="space-y-1.5">
                      {aiReport.studySuggestions.map((s, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                          <span className="text-primary-700 mt-0.5 shrink-0">→</span>
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-gray-200 py-8 text-center print:hidden">
              <Sparkles size={24} className="mx-auto text-gray-300 mb-2" />
              <p className="text-sm text-gray-400">
                상단의 &apos;AI 분석 생성&apos; 버튼을 눌러 AI 종합 분석을 생성하세요
              </p>
            </div>
          )}

          {/* 리포트 푸터 */}
          <div className="pt-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
            <span>{academyName}</span>
            <span>EduLevel LMS · {today}</span>
          </div>
        </div>
      </div>

    </div>
  )
}
