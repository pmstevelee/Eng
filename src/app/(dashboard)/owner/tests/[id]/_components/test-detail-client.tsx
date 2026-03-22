'use client'

import { useState } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  Legend,
} from 'recharts'
import { Users, Clock, BookOpen, TrendingUp, AlertTriangle } from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

type StudentSession = {
  id: string
  studentName: string
  status: string
  score: number | null
  grammarScore: number | null
  vocabularyScore: number | null
  readingScore: number | null
  writingScore: number | null
  durationMin: number | null
}

type QuestionStat = {
  id: string
  index: number
  domain: string
  questionText: string
  totalAttempts: number
  correctCount: number
  correctRate: number
}

type ClassComparison = {
  className: string
  avgScore: number
  count: number
}

type TestDetailData = {
  id: string
  title: string
  type: string
  status: string
  questionCount: number
  totalScore: number
  timeLimitMin: number | null
  creatorName: string
  className: string | null
  createdAt: string
  sessions: StudentSession[]
  questionStats: QuestionStat[]
  classComparison: ClassComparison[]
}

// ── Constants ─────────────────────────────────────────────────────────────────

const TYPE_LABEL: Record<string, string> = {
  LEVEL_TEST: '레벨',
  UNIT_TEST: '단원',
  PRACTICE: '연습',
}
const TYPE_COLOR: Record<string, string> = {
  LEVEL_TEST: 'bg-blue-50 text-blue-700',
  UNIT_TEST: 'bg-purple-50 text-purple-700',
  PRACTICE: 'bg-teal-50 text-teal-700',
}
const STATUS_LABEL: Record<string, string> = {
  DRAFT: '초안',
  PUBLISHED: '배포됨',
  GRADED: '채점완료',
}
const STATUS_COLOR: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-600',
  PUBLISHED: 'bg-blue-100 text-blue-700',
  GRADED: 'bg-green-100 text-green-700',
}
const SESSION_LABEL: Record<string, string> = {
  NOT_STARTED: '미응시',
  IN_PROGRESS: '진행중',
  COMPLETED: '완료',
  GRADED: '채점완료',
}
const SESSION_COLOR: Record<string, string> = {
  NOT_STARTED: 'bg-gray-100 text-gray-500',
  IN_PROGRESS: 'bg-amber-100 text-amber-700',
  COMPLETED: 'bg-green-100 text-green-700',
  GRADED: 'bg-blue-100 text-blue-700',
}
const DOMAIN_LABEL: Record<string, string> = {
  GRAMMAR: '문법',
  VOCABULARY: '어휘',
  READING: '읽기',
  WRITING: '쓰기',
}
const DOMAIN_COLOR: Record<string, string> = {
  GRAMMAR: '#1865F2',
  VOCABULARY: '#7854F7',
  READING: '#0FBFAD',
  WRITING: '#E35C20',
}
const DOMAIN_BG: Record<string, string> = {
  GRAMMAR: 'bg-blue-50 text-blue-700',
  VOCABULARY: 'bg-purple-50 text-purple-700',
  READING: 'bg-teal-50 text-teal-700',
  WRITING: 'bg-orange-50 text-orange-700',
}

const CustomTooltipStyle = {
  backgroundColor: '#fff',
  border: '1px solid #E3E5EA',
  borderRadius: '8px',
  padding: '8px 12px',
  fontSize: '13px',
  color: '#21242C',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildScoreDistribution(sessions: StudentSession[], totalScore: number) {
  const buckets = Array.from({ length: 10 }, (_, i) => ({
    label: `${i * 10}~${i * 10 + 9}`,
    count: 0,
  }))
  for (const s of sessions) {
    if (s.score === null) continue
    const pct = Math.min(100, Math.round((s.score / totalScore) * 100))
    const idx = Math.min(9, Math.floor(pct / 10))
    buckets[idx].count++
  }
  return buckets
}

function buildDomainRadar(sessions: StudentSession[]) {
  const domains = ['GRAMMAR', 'VOCABULARY', 'READING', 'WRITING'] as const
  const keys = ['grammarScore', 'vocabularyScore', 'readingScore', 'writingScore'] as const
  return domains.map((d, i) => {
    const scored = sessions.filter((s) => s[keys[i]] !== null)
    const avg =
      scored.length > 0
        ? Math.round(scored.reduce((sum, s) => sum + (s[keys[i]] ?? 0), 0) / scored.length)
        : 0
    return { domain: DOMAIN_LABEL[d], 평균: avg, fullMark: 100 }
  })
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function TestDetailClient({ test }: { test: TestDetailData }) {
  const [tab, setTab] = useState<'status' | 'analysis' | 'comparison'>('status')

  const totalSessions = test.sessions.length
  const completedSessions = test.sessions.filter((s) =>
    ['COMPLETED', 'GRADED'].includes(s.status),
  )
  const notStartedSessions = test.sessions.filter((s) => s.status === 'NOT_STARTED')
  const completionRate = totalSessions > 0 ? Math.round((completedSessions.length / totalSessions) * 100) : 0

  const scoredSessions = test.sessions.filter((s) => s.score !== null)
  const avgScore =
    scoredSessions.length > 0
      ? Math.round(scoredSessions.reduce((sum, s) => sum + (s.score ?? 0), 0) / scoredSessions.length)
      : null

  const scoreDistribution = buildScoreDistribution(test.sessions, test.totalScore)
  const domainRadar = buildDomainRadar(test.sessions)

  const sortedQuestions = [...test.questionStats].sort((a, b) => a.correctRate - b.correctRate)

  const tabs = [
    { key: 'status' as const, label: '응시 현황' },
    { key: 'analysis' as const, label: '결과 분석' },
    { key: 'comparison' as const, label: '반별 비교' },
  ]

  return (
    <div className="space-y-5">
      {/* 기본 정보 카드 */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span
                className={`text-xs font-semibold px-2 py-0.5 rounded-full ${TYPE_COLOR[test.type] ?? 'bg-gray-100 text-gray-600'}`}
              >
                {TYPE_LABEL[test.type] ?? test.type}
              </span>
              <span
                className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLOR[test.status] ?? 'bg-gray-100 text-gray-600'}`}
              >
                {STATUS_LABEL[test.status] ?? test.status}
              </span>
            </div>
            <h1 className="text-xl font-bold text-gray-900">{test.title}</h1>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4 pt-4 border-t border-gray-100">
          <div>
            <p className="text-xs text-gray-500 mb-0.5">출제 교사</p>
            <p className="text-sm font-semibold text-gray-900">{test.creatorName}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-0.5">대상 반</p>
            <p className="text-sm font-semibold text-gray-900">{test.className ?? '-'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-0.5">총 문제 수</p>
            <p className="text-sm font-semibold text-gray-900">{test.questionCount}문제</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-0.5">시간 제한</p>
            <p className="text-sm font-semibold text-gray-900">
              {test.timeLimitMin ? `${test.timeLimitMin}분` : '제한 없음'}
            </p>
          </div>
        </div>
      </div>

      {/* 요약 수치 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="flex items-center gap-2 mb-1.5">
            <Users size={14} className="text-gray-400" />
            <p className="text-xs text-gray-500">총 대상</p>
          </div>
          <p className="text-2xl font-bold text-gray-900">{totalSessions}</p>
          <p className="text-xs text-gray-400 mt-0.5">명</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="flex items-center gap-2 mb-1.5">
            <TrendingUp size={14} className="text-[#1FAF54]" />
            <p className="text-xs text-gray-500">응시 완료</p>
          </div>
          <p className="text-2xl font-bold text-[#1FAF54]">{completedSessions.length}</p>
          <p className="text-xs text-gray-400 mt-0.5">명 ({completionRate}%)</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="flex items-center gap-2 mb-1.5">
            <AlertTriangle size={14} className="text-[#FFB100]" />
            <p className="text-xs text-gray-500">미응시</p>
          </div>
          <p className="text-2xl font-bold text-[#FFB100]">{notStartedSessions.length}</p>
          <p className="text-xs text-gray-400 mt-0.5">명</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="flex items-center gap-2 mb-1.5">
            <BookOpen size={14} className="text-primary-700" />
            <p className="text-xs text-gray-500">평균 점수</p>
          </div>
          <p className="text-2xl font-bold text-primary-700">
            {avgScore !== null ? `${avgScore}` : '-'}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">{avgScore !== null ? '점' : '채점 전'}</p>
        </div>
      </div>

      {/* 탭 */}
      <div className="flex gap-1 border-b border-gray-200">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === t.key
                ? 'border-primary-700 text-primary-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── 탭: 응시 현황 ── */}
      {tab === 'status' && (
        <div className="space-y-4">
          {/* 프로그레스 바 */}
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">응시 현황</h3>
            <div className="space-y-3">
              {[
                { label: '완료', count: completedSessions.length, color: '#1FAF54', bg: 'bg-[#1FAF54]' },
                {
                  label: '진행중',
                  count: test.sessions.filter((s) => s.status === 'IN_PROGRESS').length,
                  color: '#FFB100',
                  bg: 'bg-[#FFB100]',
                },
                { label: '미응시', count: notStartedSessions.length, color: '#9CA3AF', bg: 'bg-gray-400' },
              ].map((item) => (
                <div key={item.label}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: item.color }} />
                      <span className="text-gray-600">{item.label}</span>
                    </div>
                    <span className="font-semibold text-gray-900">
                      {item.count}명
                      {totalSessions > 0 && (
                        <span className="font-normal text-gray-400 ml-1">
                          ({Math.round((item.count / totalSessions) * 100)}%)
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${item.bg}`}
                      style={{ width: totalSessions > 0 ? `${(item.count / totalSessions) * 100}%` : '0%' }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 학생별 테이블 */}
          {totalSessions === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-white p-10 text-center">
              <Users size={28} className="mx-auto text-gray-300 mb-3" />
              <p className="text-sm text-gray-500">배포된 학생이 없습니다.</p>
            </div>
          ) : (
            <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-3">
                        학생 이름
                      </th>
                      <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">
                        상태
                      </th>
                      <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">
                        점수
                      </th>
                      <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">
                        소요 시간
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {test.sessions.map((s) => (
                      <tr key={s.id} className="hover:bg-gray-50">
                        <td className="px-5 py-3 font-medium text-gray-900">{s.studentName}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`text-xs font-semibold px-2 py-0.5 rounded-full ${SESSION_COLOR[s.status] ?? 'bg-gray-100 text-gray-500'}`}
                          >
                            {SESSION_LABEL[s.status] ?? s.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {s.score !== null ? (
                            <span className="font-semibold text-gray-900">{s.score}점</span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-500">
                          {s.durationMin !== null ? (
                            <span className="flex items-center justify-end gap-1">
                              <Clock size={12} className="text-gray-400" />
                              {s.durationMin}분
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── 탭: 결과 분석 ── */}
      {tab === 'analysis' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* 점수 분포 히스토그램 */}
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">점수 분포</h3>
              {scoredSessions.length === 0 ? (
                <div className="h-[220px] flex items-center justify-center">
                  <p className="text-sm text-gray-400">채점된 응시 결과가 없습니다.</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart
                    data={scoreDistribution}
                    margin={{ top: 4, right: 8, left: -24, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#E3E5EA" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 10, fill: '#6B6F7A' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 11, fill: '#6B6F7A' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={CustomTooltipStyle}
                      formatter={(value) => [`${value}명`, '학생 수']}
                    />
                    <Bar dataKey="count" name="학생 수" fill="#1865F2" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* 영역별 평균 레이더 */}
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">영역별 평균 점수</h3>
              {domainRadar.every((d) => d.평균 === 0) ? (
                <div className="h-[220px] flex items-center justify-center">
                  <p className="text-sm text-gray-400">영역별 점수 데이터가 없습니다.</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <RadarChart data={domainRadar}>
                    <PolarGrid stroke="#E3E5EA" />
                    <PolarAngleAxis
                      dataKey="domain"
                      tick={{ fontSize: 12, fill: '#6B6F7A' }}
                    />
                    <Radar
                      name="평균"
                      dataKey="평균"
                      stroke="#1865F2"
                      fill="#1865F2"
                      fillOpacity={0.15}
                    />
                    <Legend iconSize={10} wrapperStyle={{ fontSize: '12px' }} />
                    <Tooltip contentStyle={CustomTooltipStyle} formatter={(v) => [`${v}점`, '평균']} />
                  </RadarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* 문제별 정답률 */}
          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-700">문제별 정답률</h3>
              <p className="text-xs text-gray-400 mt-0.5">정답률 낮은 순 (문제 품질 파악)</p>
            </div>
            {sortedQuestions.length === 0 ? (
              <div className="p-10 text-center">
                <p className="text-sm text-gray-400">문제 데이터가 없습니다.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {sortedQuestions.map((q) => (
                  <div key={q.id} className="px-5 py-3.5 flex items-center gap-4">
                    <span className="text-xs text-gray-400 w-8 shrink-0 text-center">
                      #{q.index}
                    </span>
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${DOMAIN_BG[q.domain] ?? 'bg-gray-100 text-gray-600'}`}
                    >
                      {DOMAIN_LABEL[q.domain] ?? q.domain}
                    </span>
                    <p className="text-sm text-gray-700 flex-1 line-clamp-1">{q.questionText}</p>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${q.correctRate}%`,
                            backgroundColor:
                              q.correctRate >= 70
                                ? '#1FAF54'
                                : q.correctRate >= 40
                                  ? '#FFB100'
                                  : '#D92916',
                          }}
                        />
                      </div>
                      <span
                        className={`text-sm font-semibold w-10 text-right ${
                          q.correctRate >= 70
                            ? 'text-[#1FAF54]'
                            : q.correctRate >= 40
                              ? 'text-[#FFB100]'
                              : 'text-[#D92916]'
                        }`}
                      >
                        {q.totalAttempts > 0 ? `${q.correctRate}%` : '-'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── 탭: 반별 비교 ── */}
      {tab === 'comparison' && (
        <div className="space-y-4">
          {test.classComparison.length < 2 ? (
            <div className="rounded-xl border border-gray-200 bg-white p-12 text-center">
              <TrendingUp size={32} className="mx-auto text-gray-300 mb-3" />
              <p className="text-sm text-gray-500">반별 비교 데이터가 없습니다.</p>
              <p className="text-xs text-gray-400 mt-1">
                같은 테스트를 여러 반에 배포하면 반별 성적을 비교할 수 있습니다.
              </p>
            </div>
          ) : (
            <>
              <div className="rounded-xl border border-gray-200 bg-white p-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-4">반별 평균 점수 비교</h3>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart
                    data={test.classComparison}
                    margin={{ top: 4, right: 8, left: -24, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#E3E5EA" vertical={false} />
                    <XAxis
                      dataKey="className"
                      tick={{ fontSize: 12, fill: '#6B6F7A' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      domain={[0, 100]}
                      tick={{ fontSize: 11, fill: '#6B6F7A' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={CustomTooltipStyle}
                      formatter={(v) => [`${v}점`, '평균 점수']}
                    />
                    <Bar dataKey="avgScore" name="평균 점수" fill="#1865F2" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-3">
                        반
                      </th>
                      <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-3">
                        응시자 수
                      </th>
                      <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-3">
                        평균 점수
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {test.classComparison
                      .sort((a, b) => b.avgScore - a.avgScore)
                      .map((c, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-5 py-3 font-medium text-gray-900">{c.className}</td>
                          <td className="px-5 py-3 text-right text-gray-600">{c.count}명</td>
                          <td className="px-5 py-3 text-right font-semibold text-gray-900">
                            {c.avgScore}점
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
