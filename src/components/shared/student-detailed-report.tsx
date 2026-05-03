'use client'

import { useState, useTransition } from 'react'
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  BarChart, Bar, Cell, Legend,
} from 'recharts'
import { Printer, Sparkles, Loader2, RefreshCw, Download } from 'lucide-react'
import type { DetailedReportResult } from '@/types'

// ── Types ─────────────────────────────────────────────────────────────────────

export type TestSessionData = {
  id: string
  testTitle: string
  testType: string
  score: number | null
  grammarScore: number | null
  vocabularyScore: number | null
  readingScore: number | null
  writingScore: number | null
  listeningScore: number | null
  completedAt: string | null
}

export type PracticeLogData = {
  id: string
  mode: string
  domain: string | null
  totalCount: number
  correctCount: number
  score: number
  createdAt: string
}

export type WritingLogData = {
  id: string
  createdAt: string
  topicTitle: string
  level: number
  cefrLevel: string
  wordCount: number
  percentage: number
  grammarScore: number
  grammarMax: number
  orgScore: number
  orgMax: number
  vocabScore: number
  vocabMax: number
  expressionScore: number
  expressionMax: number
}

export type GradeComparisonData = {
  grade: string | null
  peerCount: number
  studentAvgScore: number | null
  peerAvgScore: number | null
  studentAvgGrammar: number | null
  peerAvgGrammar: number | null
  studentAvgVocabulary: number | null
  peerAvgVocabulary: number | null
  studentAvgReading: number | null
  peerAvgReading: number | null
  studentAvgWriting: number | null
  peerAvgWriting: number | null
}

export type TeacherCommentData = {
  id: string
  content: string
  teacherName: string
  createdAt: string
}

type Props = {
  studentId: string
  studentName: string
  grade: string | null
  currentLevel: number
  className: string | null
  academyName: string
  testSessions: TestSessionData[]
  practiceLogs: PracticeLogData[]
  writingLogs: WritingLogData[]
  gradeComparison: GradeComparisonData
  teacherComments: TeacherCommentData[]
  initialReport?: DetailedReportResult | null
  reportDate?: string
}

// ── Constants ─────────────────────────────────────────────────────────────────

const DOMAIN_COLOR: Record<string, string> = {
  GRAMMAR: '#1865F2',
  VOCABULARY: '#7854F7',
  READING: '#0FBFAD',
  WRITING: '#E35C20',
  LISTENING: '#E91E8A',
}
const DOMAIN_LABEL: Record<string, string> = {
  GRAMMAR: '문법', VOCABULARY: '어휘', READING: '읽기', WRITING: '쓰기', LISTENING: '듣기',
}
const TEST_TYPE_LABEL: Record<string, string> = {
  LEVEL_TEST: '레벨 테스트', UNIT_TEST: '단원 테스트', PRACTICE: '연습',
}
const MODE_LABEL: Record<string, string> = {
  adaptive: 'AI 맞춤형', domain: '영역별', review: '오답 복습',
}
const CustomTooltipStyle = {
  backgroundColor: '#fff', border: '1px solid #E3E5EA',
  borderRadius: '8px', padding: '8px 12px', fontSize: '12px', color: '#21242C',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function avg(arr: (number | null)[]): number | null {
  const vals = arr.filter((v): v is number => v !== null)
  return vals.length > 0 ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null
}

function ScoreChip({ value, compare, label }: { value: number | null; compare?: number | null; label: string }) {
  if (value === null) return <span className="text-gray-400 text-sm">-</span>
  const diff = compare !== undefined && compare !== null ? value - compare : null
  return (
    <div className="text-center">
      <div className="text-lg font-bold text-gray-900">{value}</div>
      <div className="text-xs text-gray-500">{label}</div>
      {diff !== null && (
        <div className={`text-xs font-medium ${diff >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
          {diff >= 0 ? `+${diff}` : diff}
        </div>
      )}
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide border-l-4 border-primary-700 pl-3 mb-4">
      {children}
    </h3>
  )
}

function AIBadge() {
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-accent-purple bg-purple-50 px-2 py-0.5 rounded-full">
      <Sparkles size={10} />AI 분석
    </span>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function StudentDetailedReport({
  studentId, studentName, grade, currentLevel, className, academyName,
  testSessions, practiceLogs, writingLogs, gradeComparison,
  teacherComments, initialReport, reportDate,
}: Props) {
  const [aiReport, setAiReport] = useState<DetailedReportResult | null>(initialReport ?? null)
  const [isGenerating, startGenerating] = useTransition()
  const [aiError, setAiError] = useState<string | null>(null)

  const today = reportDate ?? new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })

  // ── Computed stats ──────────────────────────────────────────────────────────

  const levelTests = testSessions.filter((s) => s.testType === 'LEVEL_TEST')
  const unitTests = testSessions.filter((s) => s.testType === 'UNIT_TEST')

  const myAvgScore = avg(testSessions.map((s) => s.score))
  const myAvgGrammar = avg(testSessions.map((s) => s.grammarScore))
  const myAvgVocab = avg(testSessions.map((s) => s.vocabularyScore))
  const myAvgReading = avg(testSessions.map((s) => s.readingScore))
  const myAvgWriting = avg(testSessions.map((s) => s.writingScore))
  const myAvgListening = avg(testSessions.map((s) => s.listeningScore))

  const radarData = [
    { subject: '문법', score: myAvgGrammar ?? 0, peer: gradeComparison.peerAvgGrammar ?? 0 },
    { subject: '어휘', score: myAvgVocab ?? 0, peer: gradeComparison.peerAvgVocabulary ?? 0 },
    { subject: '읽기', score: myAvgReading ?? 0, peer: gradeComparison.peerAvgReading ?? 0 },
    { subject: '쓰기', score: myAvgWriting ?? 0, peer: gradeComparison.peerAvgWriting ?? 0 },
  ]

  // 점수 추이 (시간순)
  const scoreTrend = testSessions
    .filter((s) => s.completedAt && s.score !== null)
    .map((s, i) => ({
      name: `${i + 1}회`,
      date: new Date(s.completedAt!).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' }),
      총점: s.score,
      type: TEST_TYPE_LABEL[s.testType] ?? s.testType,
    }))

  // 연습 통계
  const practiceTotal = practiceLogs.reduce((s, l) => s + l.totalCount, 0)
  const practiceCorrect = practiceLogs.reduce((s, l) => s + l.correctCount, 0)
  const practiceAccuracy = practiceTotal > 0 ? Math.round((practiceCorrect / practiceTotal) * 100) : 0

  const domainPractice: Record<string, { total: number; correct: number }> = {}
  for (const l of practiceLogs) {
    const key = l.domain ?? 'UNKNOWN'
    if (!domainPractice[key]) domainPractice[key] = { total: 0, correct: 0 }
    domainPractice[key].total += l.totalCount
    domainPractice[key].correct += l.correctCount
  }
  const domainPracticeArr = Object.entries(domainPractice)
    .filter(([key]) => key !== 'UNKNOWN')
    .map(([key, stat]) => ({
      domain: DOMAIN_LABEL[key] ?? key,
      accuracy: Math.round((stat.correct / stat.total) * 100),
      color: DOMAIN_COLOR[key] ?? '#9CA3AF',
      total: stat.total,
    }))
    .sort((a, b) => b.accuracy - a.accuracy)

  // 쓰기 추이
  const writingTrend = writingLogs.map((w, i) => ({
    name: `${i + 1}회`,
    date: new Date(w.createdAt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' }),
    점수: w.percentage,
    topic: w.topicTitle,
  }))
  const avgWritingPct = writingLogs.length > 0
    ? Math.round(writingLogs.reduce((s, w) => s + w.percentage, 0) / writingLogs.length)
    : null

  // 학년 비교 bar data
  const compareBar = [
    { name: '총점', 나: myAvgScore ?? 0, 동학년평균: gradeComparison.peerAvgScore ?? 0 },
    { name: '문법', 나: myAvgGrammar ?? 0, 동학년평균: gradeComparison.peerAvgGrammar ?? 0 },
    { name: '어휘', 나: myAvgVocab ?? 0, 동학년평균: gradeComparison.peerAvgVocabulary ?? 0 },
    { name: '읽기', 나: myAvgReading ?? 0, 동학년평균: gradeComparison.peerAvgReading ?? 0 },
    { name: '쓰기', 나: myAvgWriting ?? 0, 동학년평균: gradeComparison.peerAvgWriting ?? 0 },
  ]

  // ── Handlers ────────────────────────────────────────────────────────────────

  async function handleGenerateAI() {
    setAiError(null)
    startGenerating(async () => {
      try {
        const res = await fetch('/api/ai/generate-detailed-report', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ studentId }),
        })
        const json = await res.json()
        if (!res.ok) setAiError(json.error ?? 'AI 분석 생성에 실패했습니다.')
        else setAiReport(json.data as DetailedReportResult)
      } catch {
        setAiError('네트워크 오류가 발생했습니다.')
      }
    })
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* 상단 액션 버튼 */}
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">AI 성적 분석 상세 리포트</h1>
          <p className="text-sm text-gray-500 mt-1">{studentName} 학생 · 최근 3개월 종합 분석</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleGenerateAI}
            disabled={isGenerating}
            className="flex items-center gap-2 px-4 h-10 bg-accent-purple hover:bg-purple-700 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-colors"
          >
            {isGenerating ? <Loader2 size={15} className="animate-spin" /> : aiReport ? <RefreshCw size={15} /> : <Sparkles size={15} />}
            {isGenerating ? 'AI 분석 중...' : aiReport ? 'AI 재분석' : 'AI 분석 생성'}
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 h-10 bg-primary-700 hover:bg-primary-800 text-white text-sm font-medium rounded-xl transition-colors"
          >
            <Printer size={15} />
            인쇄
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 h-10 border border-primary-700 text-primary-700 hover:bg-primary-50 text-sm font-medium rounded-xl transition-colors"
          >
            <Download size={15} />
            PDF 저장
          </button>
        </div>
      </div>

      {aiError && (
        <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-100 text-sm text-accent-red print:hidden">
          {aiError}
        </div>
      )}

      {/* ══ 인쇄 영역 ══════════════════════════════════════════════════════════ */}
      <div className="bg-white rounded-xl border border-gray-200 print:border-0 print:rounded-none print:shadow-none">

        {/* 리포트 헤더 */}
        <div className="px-8 py-6 border-b-2 border-gray-900 print:border-gray-900">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-1">{academyName}</p>
              <h2 className="text-2xl font-bold text-gray-900">AI 성적 분석 상세 리포트</h2>
              <p className="text-sm text-gray-500 mt-1">최근 3개월 종합 학습 성과 분석 (학부모 상담용)</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs text-gray-400">발행일</p>
              <p className="text-sm font-semibold text-gray-700 mt-0.5">{today}</p>
              <p className="text-xs text-gray-400 mt-1">CONFIDENTIAL</p>
            </div>
          </div>
        </div>

        <div className="px-8 py-6 space-y-8 print:space-y-6">

          {/* 1. 학생 기본 정보 */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { label: '학생명', value: studentName },
              { label: '학년', value: grade ?? '미등록' },
              { label: '현재 레벨', value: `Level ${currentLevel}` },
              { label: '소속 반', value: className ?? '미배정' },
              { label: '분석 기간', value: '최근 3개월' },
            ].map((item) => (
              <div key={item.label} className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                <p className="text-xs text-gray-500 uppercase tracking-wide">{item.label}</p>
                <p className="text-sm font-bold text-gray-900 mt-0.5">{item.value}</p>
              </div>
            ))}
          </div>

          {/* 2. 학부모 종합 소견 (AI) */}
          {aiReport ? (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <SectionTitle>학부모님께 드리는 종합 소견</SectionTitle>
                <AIBadge />
              </div>
              <div className="rounded-xl border border-purple-200 bg-purple-50 px-5 py-4">
                <p className="text-sm text-gray-800 leading-relaxed">{aiReport.parentSummary}</p>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-gray-200 py-6 text-center print:hidden">
              <Sparkles size={22} className="mx-auto text-gray-300 mb-2" />
              <p className="text-sm text-gray-400">상단 &apos;AI 분석 생성&apos; 버튼을 눌러 분석 리포트를 완성하세요</p>
            </div>
          )}

          {/* 3. 테스트 성적 요약 */}
          <div>
            <SectionTitle>최근 3개월 테스트 성적</SectionTitle>
            {testSessions.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">최근 3개월 테스트 기록이 없습니다.</p>
            ) : (
              <div className="space-y-4">
                {/* 영역별 평균 */}
                <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                  {[
                    { label: '총점 평균', value: myAvgScore, compare: gradeComparison.peerAvgScore },
                    { label: '문법', value: myAvgGrammar, compare: gradeComparison.peerAvgGrammar },
                    { label: '어휘', value: myAvgVocab, compare: gradeComparison.peerAvgVocabulary },
                    { label: '읽기', value: myAvgReading, compare: gradeComparison.peerAvgReading },
                    { label: '쓰기', value: myAvgWriting, compare: gradeComparison.peerAvgWriting },
                    { label: '듣기', value: myAvgListening, compare: null },
                  ].map((item) => (
                    <div key={item.label} className="rounded-xl border border-gray-100 bg-gray-50 py-3 px-2">
                      <ScoreChip value={item.value} compare={item.compare ?? undefined} label={item.label} />
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-400 print:block hidden md:block">
                  ※ 숫자 아래 +/- 는 동학년 평균 대비 차이입니다
                  {gradeComparison.grade && gradeComparison.peerCount > 0
                    ? ` (${gradeComparison.grade} ${gradeComparison.peerCount}명 기준)`
                    : ' (비교 데이터 없음)'}
                </p>

                {/* 점수 추이 차트 */}
                {scoreTrend.length >= 2 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-600 mb-2">점수 추이</p>
                    <ResponsiveContainer width="100%" height={160}>
                      <LineChart data={scoreTrend} margin={{ top: 4, right: 12, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={CustomTooltipStyle} formatter={(v) => [`${v}점`, '총점']} />
                        <Line type="monotone" dataKey="총점" stroke="#1865F2" strokeWidth={2} dot={{ fill: '#1865F2', r: 4 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* 테스트 상세 테이블 */}
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="text-left font-semibold text-gray-500 uppercase tracking-wide px-4 py-2.5">날짜</th>
                        <th className="text-left font-semibold text-gray-500 uppercase tracking-wide px-3 py-2.5">유형</th>
                        <th className="text-left font-semibold text-gray-500 uppercase tracking-wide px-3 py-2.5 max-w-[180px]">테스트명</th>
                        <th className="text-center font-semibold text-gray-500 uppercase tracking-wide px-2 py-2.5">총점</th>
                        <th className="text-center font-semibold px-2 py-2.5" style={{ color: DOMAIN_COLOR.GRAMMAR }}>문법</th>
                        <th className="text-center font-semibold px-2 py-2.5" style={{ color: DOMAIN_COLOR.VOCABULARY }}>어휘</th>
                        <th className="text-center font-semibold px-2 py-2.5" style={{ color: DOMAIN_COLOR.READING }}>읽기</th>
                        <th className="text-center font-semibold px-2 py-2.5" style={{ color: DOMAIN_COLOR.WRITING }}>쓰기</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {testSessions.map((s) => (
                        <tr key={s.id} className="hover:bg-gray-50">
                          <td className="px-4 py-2 text-gray-500">
                            {s.completedAt ? new Date(s.completedAt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' }) : '-'}
                          </td>
                          <td className="px-3 py-2">
                            <span className="font-medium text-gray-600">{TEST_TYPE_LABEL[s.testType] ?? s.testType}</span>
                          </td>
                          <td className="px-3 py-2 text-gray-700 max-w-[180px]">
                            <span className="line-clamp-1">{s.testTitle}</span>
                          </td>
                          <td className="px-2 py-2 text-center font-bold text-gray-900">{s.score ?? '-'}</td>
                          <td className="px-2 py-2 text-center text-gray-600">{s.grammarScore ?? '-'}</td>
                          <td className="px-2 py-2 text-center text-gray-600">{s.vocabularyScore ?? '-'}</td>
                          <td className="px-2 py-2 text-center text-gray-600">{s.readingScore ?? '-'}</td>
                          <td className="px-2 py-2 text-center text-gray-600">{s.writingScore ?? '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex gap-4 text-xs text-gray-500">
                  <span>레벨 테스트 {levelTests.length}회</span>
                  <span>단원 테스트 {unitTests.length}회</span>
                </div>
              </div>
            )}
          </div>

          {/* 4. 학년 대비 성취도 */}
          <div>
            <SectionTitle>
              학년 대비 성취도
              {gradeComparison.grade && <span className="font-normal text-gray-500 ml-2">({gradeComparison.grade} · 동학년 {gradeComparison.peerCount}명 비교)</span>}
            </SectionTitle>
            {gradeComparison.peerCount === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">
                {gradeComparison.grade ? `같은 학년(${gradeComparison.grade}) 비교 데이터가 없습니다.` : '학년이 등록되지 않아 비교가 불가합니다.'}
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                <div>
                  <ResponsiveContainer width="100%" height={220}>
                    <RadarChart data={radarData} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
                      <PolarGrid stroke="#E5E7EB" />
                      <PolarAngleAxis dataKey="subject" tick={{ fill: '#6B7280', fontSize: 12 }} />
                      <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                      <Radar name="나" dataKey="score" stroke="#1865F2" fill="#1865F2" fillOpacity={0.2} strokeWidth={2} />
                      <Radar name="동학년 평균" dataKey="peer" stroke="#FFB100" fill="#FFB100" fillOpacity={0.1} strokeWidth={2} strokeDasharray="4 2" />
                      <Legend iconSize={10} wrapperStyle={{ fontSize: '11px' }} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
                <div>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={compareBar} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={CustomTooltipStyle} formatter={(v) => [`${v}점`]} />
                      <Bar dataKey="나" fill="#1865F2" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="동학년평균" fill="#FFB100" radius={[3, 3, 0, 0]} opacity={0.7} />
                      <Legend iconSize={10} wrapperStyle={{ fontSize: '11px' }} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
            {aiReport && (
              <div className="mt-3 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <AIBadge />
                  <span className="text-xs font-semibold text-gray-600">학년 비교 분석</span>
                </div>
                <p className="text-sm text-gray-700 leading-relaxed">{aiReport.gradeComparisonAnalysis}</p>
              </div>
            )}
          </div>

          {/* 5. 연습 활동 분석 */}
          <div>
            <SectionTitle>연습 활동 분석 (최근 3개월)</SectionTitle>
            {practiceLogs.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">최근 3개월 연습 기록이 없습니다.</p>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: '총 연습 횟수', value: `${practiceLogs.length}회` },
                    { label: '총 풀이 문제', value: `${practiceTotal}문제` },
                    { label: '전체 정답률', value: `${practiceAccuracy}%` },
                  ].map((item) => (
                    <div key={item.label} className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-center">
                      <p className="text-xs text-gray-500">{item.label}</p>
                      <p className="text-xl font-bold text-primary-700 mt-1">{item.value}</p>
                    </div>
                  ))}
                </div>

                {domainPracticeArr.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-600 mb-2">영역별 정답률</p>
                    <div className="space-y-2.5">
                      {domainPracticeArr.map((d) => (
                        <div key={d.domain}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-medium text-gray-700">{d.domain}</span>
                            <span className="text-xs font-bold" style={{ color: d.color }}>{d.accuracy}%</span>
                          </div>
                          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${d.accuracy}%`, backgroundColor: d.color }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 연습 모드별 통계 */}
                <div className="border border-gray-100 rounded-xl overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        <th className="text-left font-semibold text-gray-500 px-4 py-2.5 uppercase">모드</th>
                        <th className="text-right font-semibold text-gray-500 px-3 py-2.5 uppercase">횟수</th>
                        <th className="text-right font-semibold text-gray-500 px-3 py-2.5 uppercase">문제 수</th>
                        <th className="text-right font-semibold text-gray-500 px-3 py-2.5 uppercase">정답률</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {(['adaptive', 'domain', 'review'] as const).map((mode) => {
                        const logs = practiceLogs.filter((l) => l.mode === mode)
                        if (logs.length === 0) return null
                        const total = logs.reduce((s, l) => s + l.totalCount, 0)
                        const correct = logs.reduce((s, l) => s + l.correctCount, 0)
                        return (
                          <tr key={mode}>
                            <td className="px-4 py-2 font-medium text-gray-700">{MODE_LABEL[mode]}</td>
                            <td className="px-3 py-2 text-right text-gray-600">{logs.length}회</td>
                            <td className="px-3 py-2 text-right text-gray-600">{total}문제</td>
                            <td className="px-3 py-2 text-right font-bold text-gray-900">
                              {total > 0 ? `${Math.round((correct / total) * 100)}%` : '-'}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {aiReport && (
                  <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                    <div className="flex items-center gap-1.5 mb-1.5"><AIBadge /><span className="text-xs font-semibold text-gray-600">학습 습관 분석</span></div>
                    <p className="text-sm text-gray-700 leading-relaxed">{aiReport.practiceAnalysis}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 6. 쓰기 실력 분석 */}
          <div>
            <SectionTitle>쓰기 실력 분석 (최근 3개월)</SectionTitle>
            {writingLogs.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">최근 3개월 쓰기 기록이 없습니다.</p>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: '총 제출 횟수', value: `${writingLogs.length}회` },
                    { label: '평균 점수', value: avgWritingPct !== null ? `${avgWritingPct}%` : '-' },
                    { label: '평균 단어 수', value: `${Math.round(writingLogs.reduce((s, w) => s + w.wordCount, 0) / writingLogs.length)}단어` },
                  ].map((item) => (
                    <div key={item.label} className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-center">
                      <p className="text-xs text-gray-500">{item.label}</p>
                      <p className="text-xl font-bold mt-1" style={{ color: '#E35C20' }}>{item.value}</p>
                    </div>
                  ))}
                </div>

                {writingTrend.length >= 2 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-600 mb-2">쓰기 점수 추이</p>
                    <ResponsiveContainer width="100%" height={140}>
                      <LineChart data={writingTrend} margin={{ top: 4, right: 12, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={CustomTooltipStyle} formatter={(v) => [`${v}%`, '점수']} labelFormatter={(_, payload) => payload?.[0]?.payload?.topic ?? ''} />
                        <Line type="monotone" dataKey="점수" stroke="#E35C20" strokeWidth={2} dot={{ fill: '#E35C20', r: 4 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* 쓰기 세부 점수 테이블 */}
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="text-left font-semibold text-gray-500 px-4 py-2.5">날짜</th>
                        <th className="text-left font-semibold text-gray-500 px-3 py-2.5">주제</th>
                        <th className="text-center font-semibold text-gray-500 px-2 py-2.5">점수</th>
                        <th className="text-center font-semibold text-gray-500 px-2 py-2.5">단어</th>
                        <th className="text-center font-semibold text-gray-500 px-2 py-2.5">문법</th>
                        <th className="text-center font-semibold text-gray-500 px-2 py-2.5">구성</th>
                        <th className="text-center font-semibold text-gray-500 px-2 py-2.5">어휘</th>
                        <th className="text-center font-semibold text-gray-500 px-2 py-2.5">표현</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {writingLogs.map((w) => (
                        <tr key={w.id}>
                          <td className="px-4 py-2 text-gray-500">
                            {new Date(w.createdAt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                          </td>
                          <td className="px-3 py-2 text-gray-700 max-w-[140px]">
                            <span className="line-clamp-1">{w.topicTitle}</span>
                          </td>
                          <td className="px-2 py-2 text-center font-bold" style={{ color: '#E35C20' }}>{w.percentage}%</td>
                          <td className="px-2 py-2 text-center text-gray-600">{w.wordCount}</td>
                          <td className="px-2 py-2 text-center text-gray-600">{w.grammarScore}/{w.grammarMax}</td>
                          <td className="px-2 py-2 text-center text-gray-600">{w.orgScore}/{w.orgMax}</td>
                          <td className="px-2 py-2 text-center text-gray-600">{w.vocabScore}/{w.vocabMax}</td>
                          <td className="px-2 py-2 text-center text-gray-600">{w.expressionScore}/{w.expressionMax}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {aiReport && (
                  <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                    <div className="flex items-center gap-1.5 mb-1.5"><AIBadge /><span className="text-xs font-semibold text-gray-600">쓰기 실력 트렌드</span></div>
                    <p className="text-sm text-gray-700 leading-relaxed">{aiReport.writingTrend}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 7. AI 영역별 상세 분석 */}
          {aiReport && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <SectionTitle>AI 영역별 상세 분석</SectionTitle>
                <AIBadge />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {(Object.entries(aiReport.domainAnalysis) as [string, string][]).map(([key, text]) => (
                  <div
                    key={key}
                    className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3"
                    style={{ borderLeftColor: DOMAIN_COLOR[key.toUpperCase()] ?? '#9CA3AF', borderLeftWidth: 3 }}
                  >
                    <p className="text-xs font-bold uppercase tracking-wide mb-1.5"
                      style={{ color: DOMAIN_COLOR[key.toUpperCase()] ?? '#6B7280' }}>
                      {DOMAIN_LABEL[key.toUpperCase()] ?? key}
                    </p>
                    <p className="text-sm text-gray-700 leading-relaxed">{text}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 8. 강점 & 개선 사항 */}
          {aiReport && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <SectionTitle>강점</SectionTitle>
                  <AIBadge />
                </div>
                <ul className="space-y-2">
                  {aiReport.strengthPoints.map((point, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                      <span className="shrink-0 w-5 h-5 rounded-full bg-accent-green/10 text-accent-green flex items-center justify-center text-xs font-bold mt-0.5">✓</span>
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <SectionTitle>보완이 필요한 부분</SectionTitle>
                  <AIBadge />
                </div>
                <ul className="space-y-2">
                  {aiReport.improvementPoints.map((point, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                      <span className="shrink-0 w-5 h-5 rounded-full bg-accent-gold/10 text-accent-gold flex items-center justify-center text-xs font-bold mt-0.5">!</span>
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* 9. 학부모 권장 사항 & 학습 제안 */}
          {aiReport && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <SectionTitle>학부모 가정 지도 권장 사항</SectionTitle>
                  <AIBadge />
                </div>
                <ul className="space-y-2">
                  {aiReport.parentRecommendations.map((rec, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                      <span className="shrink-0 text-primary-700 font-bold mt-0.5">{i + 1}.</span>
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <SectionTitle>학원 학습 제안</SectionTitle>
                  <AIBadge />
                </div>
                <ul className="space-y-2">
                  {aiReport.studySuggestions.map((s, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                      <span className="shrink-0 text-accent-purple font-bold mt-0.5">→</span>
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* 10. 교사 피드백 */}
          {teacherComments.length > 0 && (
            <div>
              <SectionTitle>담당 교사 피드백</SectionTitle>
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

          {/* 리포트 서명란 (인쇄용) */}
          <div className="pt-6 border-t-2 border-gray-900 print:block hidden">
            <div className="grid grid-cols-3 gap-8 text-xs text-gray-500">
              <div>
                <p className="font-semibold text-gray-700 mb-6">담당 교사 확인</p>
                <div className="border-b border-gray-400 pb-1">&nbsp;</div>
                <p className="mt-1 text-center">서명</p>
              </div>
              <div>
                <p className="font-semibold text-gray-700 mb-6">원장 확인</p>
                <div className="border-b border-gray-400 pb-1">&nbsp;</div>
                <p className="mt-1 text-center">서명</p>
              </div>
              <div>
                <p className="font-semibold text-gray-700 mb-6">학부모 확인</p>
                <div className="border-b border-gray-400 pb-1">&nbsp;</div>
                <p className="mt-1 text-center">서명</p>
              </div>
            </div>
          </div>

          {/* 푸터 */}
          <div className="pt-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
            <span>{academyName}</span>
            <span>EduLevel AI 성적 분석 · {today}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
