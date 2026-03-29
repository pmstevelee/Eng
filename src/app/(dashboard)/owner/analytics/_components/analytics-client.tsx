'use client'

import { useRouter } from 'next/navigation'
import { useCallback } from 'react'
import { Download, TrendingUp, TrendingDown, Minus, AlertTriangle, Star } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ScoreHistogramChart,
  LevelPieChart,
  LevelAvgBarChart,
  DomainRadarChart,
  DomainAvgBars,
  MonthlyTrendLineChart,
  ClassMultiLineChart,
  ClassDomainGroupedBarChart,
  WeekdayAttendanceBarChart,
  MonthlyEnrollmentChart,
  TeacherActivityBarChart,
  AttendanceHeatmap,
  CLASS_LINE_COLORS,
} from './analytics-charts'
import type {
  ScoreHistogramItem,
  LevelDistItem,
  LevelAvgItem,
  DomainAvgItem,
  MonthlyTrendItem,
  ClassTrendItem,
  ClassDomainItem,
  WeekdayAvgItem,
  MonthlyEnrollmentItem,
  DailyAttendanceItem,
  TeacherActivityItem,
} from './analytics-charts'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ScoreStats = {
  avg: number | null
  median: number | null
  max: number | null
  min: number | null
  total: number
}

export type LevelUpStudent = { name: string; className: string; level: number }

export type ClassComparisonRow = {
  id: string
  name: string
  studentCount: number
  avgScore: number | null
  growthRate: number | null
  attendanceRate: number | null
}

export type TeacherPerfRow = {
  id: string
  name: string
  studentCount: number
  avgScore: number | null
  testCount: number
  commentCount: number
  improvementRate: number | null
}

export type AbsentStudentItem = { name: string; className: string; absentCount: number; rate: number }

export type AnalyticsData = {
  // Tab 1
  scoreHistogram: ScoreHistogramItem[]
  scoreStats: ScoreStats
  levelDistribution: LevelDistItem[]
  levelAvgScores: LevelAvgItem[]
  levelUpStudents: LevelUpStudent[]
  domainAvgs: DomainAvgItem[]
  weakestDomain: string | null
  monthlyTrend: MonthlyTrendItem[]
  classTrendNames: string[]
  classTrendData: ClassTrendItem[]
  // Tab 2
  classComparison: ClassComparisonRow[]
  classDomainData: ClassDomainItem[]
  // Tab 3
  teacherPerformance: TeacherPerfRow[]
  teacherActivityData: TeacherActivityItem[]
  // Tab 4
  dailyAttendance: DailyAttendanceItem[]
  weekdayAvgs: WeekdayAvgItem[]
  absentTop10: AbsentStudentItem[]
  // Tab 5
  monthlyEnrollments: MonthlyEnrollmentItem[]
  totalActiveStudents: number
}

// ─── Period Options ───────────────────────────────────────────────────────────

const PERIOD_OPTIONS = [
  { value: 'this-month', label: '이번 달' },
  { value: 'last-month', label: '지난 달' },
  { value: '3-months', label: '최근 3개월' },
  { value: '6-months', label: '최근 6개월' },
]

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  unit,
  sub,
  color = 'blue',
}: {
  label: string
  value: string | number | null
  unit?: string
  sub?: string
  color?: 'blue' | 'green' | 'gold' | 'red' | 'purple'
}) {
  const bg: Record<string, string> = {
    blue: 'bg-primary-100',
    green: 'bg-accent-green-light',
    gold: 'bg-accent-gold-light',
    red: 'bg-accent-red-light',
    purple: 'bg-accent-purple-light',
  }
  const text: Record<string, string> = {
    blue: 'text-primary-700',
    green: 'text-accent-green',
    gold: 'text-[#B37D00]',
    red: 'text-accent-red',
    purple: 'text-accent-purple',
  }
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-xs font-medium text-gray-500">{label}</p>
        <p className={`mt-2 text-3xl font-bold ${text[color]}`}>
          {value !== null ? value : '–'}
          {value !== null && unit && <span className="ml-1 text-base font-normal text-gray-500">{unit}</span>}
        </p>
        {sub && <p className="mt-1 text-xs text-gray-400">{sub}</p>}
      </CardContent>
    </Card>
  )
}

function GrowthBadge({ rate }: { rate: number | null }) {
  if (rate === null) return <span className="text-xs text-gray-400">–</span>
  if (rate > 0)
    return (
      <span className="inline-flex items-center gap-0.5 rounded-full bg-accent-green-light px-2 py-0.5 text-xs font-semibold text-accent-green">
        <TrendingUp size={10} /> +{rate}점
      </span>
    )
  if (rate < 0)
    return (
      <span className="inline-flex items-center gap-0.5 rounded-full bg-accent-red-light px-2 py-0.5 text-xs font-semibold text-accent-red">
        <TrendingDown size={10} /> {rate}점
      </span>
    )
  return (
    <span className="inline-flex items-center gap-0.5 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
      <Minus size={10} /> 유지
    </span>
  )
}

function ScoreColor({ score }: { score: number | null }) {
  if (score === null) return <span className="text-sm text-gray-400">–</span>
  const cls = score >= 80 ? 'text-accent-green' : score >= 60 ? 'text-[#B37D00]' : 'text-accent-red'
  return <span className={`text-sm font-bold ${cls}`}>{score}점</span>
}

// ─── Tab: 학생 성적 분석 ───────────────────────────────────────────────────────

function ScoreAnalysisTab({ data }: { data: AnalyticsData }) {
  const { scoreHistogram, scoreStats, levelDistribution, levelAvgScores, levelUpStudents, domainAvgs, weakestDomain, monthlyTrend, classTrendNames, classTrendData } = data

  return (
    <div className="space-y-5">
      {/* Stats Row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="평균 점수" value={scoreStats.avg} unit="점" color="blue" />
        <StatCard label="중앙값" value={scoreStats.median} unit="점" color="purple" />
        <StatCard label="최고 점수" value={scoreStats.max} unit="점" color="green" sub={`전체 ${scoreStats.total}건`} />
        <StatCard label="최저 점수" value={scoreStats.min} unit="점" color="red" />
      </div>

      {/* Score Histogram */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="h-3 w-3 rounded-full bg-primary-700" />
            점수 구간별 학생 분포
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScoreHistogramChart data={scoreHistogram} />
        </CardContent>
      </Card>

      {/* Level charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <span className="h-3 w-3 rounded-full bg-primary-700" />
              레벨별 학생 분포
            </CardTitle>
          </CardHeader>
          <CardContent>
            <LevelPieChart data={levelDistribution} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <span className="h-3 w-3 rounded-full bg-[#7854F7]" />
              레벨별 평균 점수
            </CardTitle>
          </CardHeader>
          <CardContent>
            <LevelAvgBarChart data={levelAvgScores} />
          </CardContent>
        </Card>
      </div>

      {/* Level-up students */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Star size={16} className="text-accent-gold" />
            이번 달 레벨업 학생
            {levelUpStudents.length > 0 && (
              <span className="ml-auto rounded-full bg-accent-gold-light px-2 py-0.5 text-xs font-semibold text-[#B37D00]">
                {levelUpStudents.length}명
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {levelUpStudents.length === 0 ? (
            <p className="py-4 text-center text-sm text-gray-400">이번 달 레벨업 학생이 없습니다</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {levelUpStudents.map((s, i) => (
                <div key={i} className="flex items-center gap-2 rounded-xl border border-gray-100 px-3 py-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-gold-light text-xs font-bold text-[#B37D00]">
                    {s.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{s.name}</p>
                    <p className="text-xs text-gray-500">{s.className} · Level {s.level}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Domain analysis */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <span className="h-3 w-3 rounded-full bg-[#7854F7]" />
              영역별 평균 점수 (레이더)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DomainRadarChart data={domainAvgs} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <span className="h-3 w-3 rounded-full bg-[#7854F7]" />
              영역별 점수 분포
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DomainAvgBars data={domainAvgs} />
          </CardContent>
        </Card>
      </div>

      {/* Weakest domain highlight */}
      {weakestDomain && (
        <div className="flex items-start gap-3 rounded-xl border border-accent-red-light bg-accent-red-light/30 p-4">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-accent-red" />
          <div>
            <p className="text-sm font-semibold text-gray-900">개선이 필요한 영역</p>
            <p className="mt-0.5 text-sm text-gray-600">
              우리 학원 학생들은{' '}
              <span className="font-bold text-accent-red">{weakestDomain}</span> 영역이 가장 약합니다{' '}
              (평균{' '}
              <span className="font-bold">{domainAvgs.find((d) => d.domain === weakestDomain)?.avg ?? '–'}점</span>)
            </p>
          </div>
        </div>
      )}

      {/* Monthly trend */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <span className="h-3 w-3 rounded-full bg-primary-700" />
              월별 평균 점수 추이
            </CardTitle>
          </CardHeader>
          <CardContent>
            <MonthlyTrendLineChart data={monthlyTrend} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <span className="h-3 w-3 rounded-full bg-primary-700" />
              반별 성장률 추이
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ClassMultiLineChart data={classTrendData} classNames={classTrendNames} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ─── Tab: 반별 비교 ───────────────────────────────────────────────────────────

function ClassComparisonTab({ data }: { data: AnalyticsData }) {
  const { classComparison, classDomainData } = data

  const sorted = [...classComparison].sort((a, b) => (b.avgScore ?? 0) - (a.avgScore ?? 0))
  const best = sorted[0]
  const worst = sorted[sorted.length - 1]
  const needsAttention = classComparison.filter(
    (c) => c.avgScore !== null && c.avgScore < 60
  )

  return (
    <div className="space-y-5">
      {/* Highlight cards */}
      {classComparison.length > 1 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {best && (
            <div className="flex items-start gap-3 rounded-xl border border-accent-green-light bg-accent-green-light/30 p-4">
              <Star size={18} className="mt-0.5 shrink-0 text-accent-green" />
              <div>
                <p className="text-xs font-medium text-gray-500">우수 반</p>
                <p className="text-base font-bold text-gray-900">{best.name}</p>
                <p className="text-sm text-gray-600">
                  평균 {best.avgScore ?? '–'}점 · 학생 {best.studentCount}명
                </p>
              </div>
            </div>
          )}
          {needsAttention.length > 0 && (
            <div className="flex items-start gap-3 rounded-xl border border-accent-red-light bg-accent-red-light/30 p-4">
              <AlertTriangle size={18} className="mt-0.5 shrink-0 text-accent-red" />
              <div>
                <p className="text-xs font-medium text-gray-500">주의 필요</p>
                <p className="text-base font-bold text-gray-900">
                  {needsAttention.map((c) => c.name).join(', ')}
                </p>
                <p className="text-sm text-gray-600">평균 60점 미만 반</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Comparison table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="h-3 w-3 rounded-full bg-primary-700" />
            반별 성과 비교
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {classComparison.length === 0 ? (
            <p className="py-10 text-center text-sm text-gray-400">반 데이터가 없습니다</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px]">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    {['반 이름', '학생 수', '평균 점수', '성장률', '출석률'].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {sorted.map((row) => (
                    <tr key={row.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{row.name}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{row.studentCount}명</td>
                      <td className="px-4 py-3">
                        <ScoreColor score={row.avgScore} />
                      </td>
                      <td className="px-4 py-3">
                        <GrowthBadge rate={row.growthRate} />
                      </td>
                      <td className="px-4 py-3">
                        {row.attendanceRate !== null ? (
                          <span className={`text-sm font-semibold ${row.attendanceRate >= 80 ? 'text-accent-green' : 'text-accent-red'}`}>
                            {row.attendanceRate}%
                          </span>
                        ) : (
                          <span className="text-sm text-gray-400">–</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Domain group bar */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="h-3 w-3 rounded-full bg-primary-700" />
            반별 영역 점수 비교
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ClassDomainGroupedBarChart data={classDomainData} />
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Tab: 교사 성과 ───────────────────────────────────────────────────────────

function TeacherPerformanceTab({ data }: { data: AnalyticsData }) {
  const { teacherPerformance, teacherActivityData } = data

  const sorted = [...teacherPerformance].sort((a, b) => (b.avgScore ?? 0) - (a.avgScore ?? 0))

  return (
    <div className="space-y-5">
      {/* Teacher table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="h-3 w-3 rounded-full bg-primary-700" />
            교사별 성과 현황
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {teacherPerformance.length === 0 ? (
            <p className="py-10 text-center text-sm text-gray-400">교사 데이터가 없습니다</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px]">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    {['교사', '담당 학생', '학생 평균 점수', '성장률', '테스트 출제', '코멘트'].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {sorted.map((row, idx) => (
                    <tr key={row.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {idx === 0 && (
                            <span className="rounded-full bg-accent-gold-light px-1.5 py-0.5 text-[10px] font-bold text-[#B37D00]">
                              TOP
                            </span>
                          )}
                          <span className="text-sm font-medium text-gray-900">{row.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">{row.studentCount}명</td>
                      <td className="px-4 py-3">
                        <ScoreColor score={row.avgScore} />
                      </td>
                      <td className="px-4 py-3">
                        <GrowthBadge rate={row.improvementRate} />
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">{row.testCount}회</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{row.commentCount}건</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Teacher activity bar */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="h-3 w-3 rounded-full bg-primary-700" />
            교사별 활동량
          </CardTitle>
        </CardHeader>
        <CardContent>
          <TeacherActivityBarChart data={teacherActivityData} />
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Tab: 출석 분석 ───────────────────────────────────────────────────────────

function AttendanceTab({ data }: { data: AnalyticsData }) {
  const { dailyAttendance, weekdayAvgs, absentTop10 } = data

  const totalDays = dailyAttendance.length
  const avgRate =
    totalDays > 0
      ? Math.round((dailyAttendance.reduce((s, d) => s + d.rate, 0) / totalDays) * 100)
      : null

  return (
    <div className="space-y-5">
      {/* Summary card */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="기간 평균 출석률" value={avgRate} unit="%" color="green" />
        <StatCard
          label="출석 기록 일수"
          value={totalDays}
          unit="일"
          color="blue"
        />
        <StatCard
          label="결석 빈번 학생"
          value={absentTop10.filter((s) => s.rate < 0.7).length}
          unit="명"
          color="red"
          sub="출석률 70% 미만"
        />
      </div>

      {/* Heatmap */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="h-3 w-3 rounded-full bg-[#1FAF54]" />
            일별 출석률 캘린더
          </CardTitle>
        </CardHeader>
        <CardContent>
          <AttendanceHeatmap data={dailyAttendance} />
        </CardContent>
      </Card>

      {/* Weekday avg */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="h-3 w-3 rounded-full bg-[#1FAF54]" />
            요일별 평균 출석률
          </CardTitle>
        </CardHeader>
        <CardContent>
          <WeekdayAttendanceBarChart data={weekdayAvgs} />
        </CardContent>
      </Card>

      {/* Absent top 10 table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle size={16} className="text-accent-red" />
            결석 빈번 학생 Top 10
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {absentTop10.length === 0 ? (
            <p className="py-10 text-center text-sm text-gray-400">결석 데이터가 없습니다</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[400px]">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    {['순위', '학생', '반', '결석 횟수', '출석률'].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {absentTop10.map((s, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-bold text-gray-500">#{i + 1}</td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{s.name}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{s.className}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-accent-red">{s.absentCount}회</td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-sm font-semibold ${
                            s.rate >= 0.8 ? 'text-accent-green' : s.rate >= 0.6 ? 'text-[#B37D00]' : 'text-accent-red'
                          }`}
                        >
                          {Math.round(s.rate * 100)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Tab: 수익 분석 ───────────────────────────────────────────────────────────

function RevenueTab({ data }: { data: AnalyticsData }) {
  const { monthlyEnrollments, totalActiveStudents } = data

  const totalNew = monthlyEnrollments.reduce((s, m) => s + m.newStudents, 0)
  const totalWithdrawn = monthlyEnrollments.reduce((s, m) => s + m.withdrawn, 0)
  const dropoutRate =
    totalNew + totalActiveStudents > 0
      ? Math.round((totalWithdrawn / (totalNew + totalActiveStudents)) * 100)
      : 0

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="현재 활성 학생" value={totalActiveStudents} unit="명" color="blue" />
        <StatCard label="기간 내 신규 등록" value={totalNew} unit="명" color="green" />
        <StatCard label="기간 내 이탈" value={totalWithdrawn} unit="명" color="red" sub={`이탈률 약 ${dropoutRate}%`} />
      </div>

      {/* Monthly enrollment chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="h-3 w-3 rounded-full bg-[#1FAF54]" />
            월별 등록 / 이탈 학생 추이
          </CardTitle>
        </CardHeader>
        <CardContent>
          <MonthlyEnrollmentChart data={monthlyEnrollments} />
        </CardContent>
      </Card>

      {/* Dropout rate table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="h-3 w-3 rounded-full bg-accent-red" />
            월별 상세 현황
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {monthlyEnrollments.length === 0 ? (
            <p className="py-10 text-center text-sm text-gray-400">데이터가 없습니다</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[400px]">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    {['월', '신규 등록', '퇴원/휴원', '순증감'].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {monthlyEnrollments.map((row, i) => {
                    const net = row.newStudents - row.withdrawn
                    return (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{row.month}</td>
                        <td className="px-4 py-3 text-sm font-semibold text-accent-green">+{row.newStudents}</td>
                        <td className="px-4 py-3 text-sm font-semibold text-accent-red">{row.withdrawn > 0 ? `-${row.withdrawn}` : '0'}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`text-sm font-bold ${
                              net > 0 ? 'text-accent-green' : net < 0 ? 'text-accent-red' : 'text-gray-500'
                            }`}
                          >
                            {net > 0 ? `+${net}` : net}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Main Client Component ────────────────────────────────────────────────────

const TABS = [
  { id: 'scores', label: '학생 성적 분석' },
  { id: 'classes', label: '반별 비교' },
  { id: 'teachers', label: '교사 성과' },
  { id: 'attendance', label: '출석 분석' },
  { id: 'revenue', label: '수익 분석' },
]

interface AnalyticsClientProps {
  data: AnalyticsData
  period: string
  activeTab: string
}

export function AnalyticsClient({ data, period, activeTab }: AnalyticsClientProps) {
  const router = useRouter()

  const updateParam = useCallback(
    (key: string, value: string) => {
      const newPeriod = key === 'period' ? value : period
      const newTab = key === 'tab' ? value : activeTab
      const params = new URLSearchParams()
      params.set('period', newPeriod)
      params.set('tab', newTab)
      router.push(`/owner/analytics?${params.toString()}`)
    },
    [router, period, activeTab],
  )

  const handlePrint = () => window.print()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">분석 & 통계</h1>
          <p className="mt-1 text-sm text-gray-500">학원 전체 데이터 심층 분석</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Period Select */}
          <select
            value={period}
            onChange={(e) => updateParam('period', e.target.value)}
            className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none focus:border-primary-700 focus:ring-1 focus:ring-primary-700"
          >
            {PERIOD_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          {/* PDF Download */}
          <button
            onClick={handlePrint}
            className="flex h-9 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            <Download size={14} />
            PDF 저장
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex gap-0 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => updateParam('tab', tab.id)}
              className={`shrink-0 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'border-primary-700 text-primary-700'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'scores' && <ScoreAnalysisTab data={data} />}
        {activeTab === 'classes' && <ClassComparisonTab data={data} />}
        {activeTab === 'teachers' && <TeacherPerformanceTab data={data} />}
        {activeTab === 'attendance' && <AttendanceTab data={data} />}
        {activeTab === 'revenue' && <RevenueTab data={data} />}
      </div>
    </div>
  )
}
