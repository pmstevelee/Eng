'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  Legend,
  ComposedChart,
} from 'recharts'

// ─── Shared Styles ────────────────────────────────────────────────────────────

const tooltipStyle = {
  backgroundColor: '#fff',
  border: '1px solid #E3E5EA',
  borderRadius: '8px',
  padding: '8px 12px',
  fontSize: '13px',
  color: '#21242C',
}

const DOMAIN_META: Record<string, { color: string }> = {
  Grammar: { color: '#1865F2' },
  Vocabulary: { color: '#7854F7' },
  Reading: { color: '#0FBFAD' },
  Writing: { color: '#E35C20' },
}

const LEVEL_COLORS = ['#C7D9FE', '#93B8FC', '#4B8AF5', '#1865F2', '#1449C1']
export const CLASS_LINE_COLORS = ['#1865F2', '#7854F7', '#0FBFAD', '#E35C20', '#1FAF54', '#FFB100', '#D92916']

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex h-[200px] items-center justify-center">
      <p className="text-sm text-gray-400">{message}</p>
    </div>
  )
}

// ─── 1. Score Histogram ───────────────────────────────────────────────────────

export type ScoreHistogramItem = { range: string; count: number }

export function ScoreHistogramChart({ data }: { data: ScoreHistogramItem[] }) {
  if (data.every((d) => d.count === 0)) return <EmptyChart message="해당 기간 내 채점된 테스트가 없습니다" />

  const fillColor = (range: string) => {
    if (range === '81~100') return '#1FAF54'
    if (range === '0~20') return '#D92916'
    if (range === '21~40') return '#FFB100'
    return '#1865F2'
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: -24, bottom: 0 }} style={{ outline: 'none' }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E3E5EA" vertical={false} />
        <XAxis dataKey="range" tick={{ fontSize: 12, fill: '#6B6F7A' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 12, fill: '#6B6F7A' }} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v) => [String(v ?? 0) + "명", "학생 수"]} />
        <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={64}>
          {data.map((entry, i) => (
            <Cell key={i} fill={fillColor(entry.range)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

// ─── 2. Level Pie Chart ───────────────────────────────────────────────────────

export type LevelDistItem = { level: string; count: number }

export function LevelPieChart({ data }: { data: LevelDistItem[] }) {
  const total = data.reduce((s, d) => s + d.count, 0)
  if (total === 0) return <EmptyChart message="레벨 데이터가 없습니다" />

  return (
    <div className="flex items-center gap-6">
      <ResponsiveContainer width="55%" height={200}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={85}
            paddingAngle={2}
            dataKey="count"
            strokeWidth={0}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={LEVEL_COLORS[i % LEVEL_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} formatter={(v) => [String(v ?? 0) + "명", "학생 수"]} />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex flex-1 flex-col gap-2">
        {data.map((item, i) => (
          <div key={item.level} className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: LEVEL_COLORS[i % LEVEL_COLORS.length] }} />
              <span className="text-xs text-gray-700">{item.level}</span>
            </div>
            <span className="text-xs font-semibold text-gray-900">{item.count}명</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── 3. Level Avg Score Bar ───────────────────────────────────────────────────

export type LevelAvgItem = { level: string; avgScore: number }

export function LevelAvgBarChart({ data }: { data: LevelAvgItem[] }) {
  if (data.length === 0) return <EmptyChart message="데이터가 없습니다" />
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: -24, bottom: 0 }} style={{ outline: 'none' }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E3E5EA" vertical={false} />
        <XAxis dataKey="level" tick={{ fontSize: 12, fill: '#6B6F7A' }} axisLine={false} tickLine={false} />
        <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: '#6B6F7A' }} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v) => [String(v ?? 0) + "점", "평균 점수"]} />
        <Bar dataKey="avgScore" name="평균 점수" fill="#7854F7" radius={[4, 4, 0, 0]} maxBarSize={48} />
      </BarChart>
    </ResponsiveContainer>
  )
}

// ─── 4. Domain Radar Chart ────────────────────────────────────────────────────

export type DomainAvgItem = { domain: string; avg: number }

export function DomainRadarChart({ data }: { data: DomainAvgItem[] }) {
  if (data.every((d) => d.avg === 0)) return <EmptyChart message="영역별 데이터가 없습니다" />
  return (
    <ResponsiveContainer width="100%" height={260}>
      <RadarChart data={data} margin={{ top: 8, right: 32, left: 32, bottom: 8 }}>
        <PolarGrid stroke="#E3E5EA" />
        <PolarAngleAxis dataKey="domain" tick={{ fontSize: 12, fill: '#6B6F7A' }} />
        <Radar
          name="평균"
          dataKey="avg"
          stroke="#7854F7"
          fill="#7854F7"
          fillOpacity={0.18}
          strokeWidth={2}
          dot={{ r: 4, fill: '#7854F7', strokeWidth: 0 }}
        />
        <Tooltip contentStyle={tooltipStyle} formatter={(v) => [String(v ?? 0) + "점", "평균"]} />
      </RadarChart>
    </ResponsiveContainer>
  )
}

// ─── 5. Domain Avg Progress Bars ─────────────────────────────────────────────

export function DomainAvgBars({ data }: { data: DomainAvgItem[] }) {
  if (data.every((d) => d.avg === 0))
    return <p className="py-8 text-center text-sm text-gray-400">데이터가 없습니다</p>

  return (
    <div className="space-y-4">
      {data.map((d) => {
        const meta = DOMAIN_META[d.domain] ?? { color: '#1865F2' }
        return (
          <div key={d.domain} className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium" style={{ color: meta.color }}>
                {d.domain}
              </span>
              <span className="text-sm font-bold text-gray-900">{d.avg}점</span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${d.avg}%`, backgroundColor: meta.color }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── 6. Monthly Trend Line Chart ──────────────────────────────────────────────

export type MonthlyTrendItem = { month: string; avg: number | null }

export function MonthlyTrendLineChart({ data }: { data: MonthlyTrendItem[] }) {
  const hasData = data.some((d) => d.avg !== null && d.avg > 0)
  if (!hasData) return <EmptyChart message="월별 추이 데이터가 없습니다" />

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 4, right: 8, left: -24, bottom: 0 }} style={{ outline: 'none' }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E3E5EA" vertical={false} />
        <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#6B6F7A' }} axisLine={false} tickLine={false} />
        <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: '#6B6F7A' }} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v) => [String(v ?? 0) + "점", "평균 점수"]} />
        <Line
          type="monotone"
          dataKey="avg"
          name="평균 점수"
          stroke="#1865F2"
          strokeWidth={2}
          dot={{ r: 4, fill: '#1865F2', strokeWidth: 0 }}
          connectNulls
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

// ─── 7. Class Multi-Line Trend ────────────────────────────────────────────────

export interface ClassTrendItem {
  month: string
  [key: string]: number | null | string
}

export function ClassMultiLineChart({
  data,
  classNames,
}: {
  data: ClassTrendItem[]
  classNames: string[]
}) {
  if (classNames.length === 0) return <EmptyChart message="반 데이터가 없습니다" />

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 4, right: 8, left: -24, bottom: 0 }} style={{ outline: 'none' }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E3E5EA" vertical={false} />
        <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#6B6F7A' }} axisLine={false} tickLine={false} />
        <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: '#6B6F7A' }} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v) => [String(v ?? 0) + '점', '']} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '12px' }} />
        {classNames.map((name, i) => (
          <Line
            key={name}
            type="monotone"
            dataKey={name}
            stroke={CLASS_LINE_COLORS[i % CLASS_LINE_COLORS.length]}
            strokeWidth={2}
            dot={{ r: 3, strokeWidth: 0, fill: CLASS_LINE_COLORS[i % CLASS_LINE_COLORS.length] }}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}

// ─── 8. Class Domain Grouped Bar ─────────────────────────────────────────────

export type ClassDomainItem = {
  name: string
  Grammar: number
  Vocabulary: number
  Reading: number
  Writing: number
}

export function ClassDomainGroupedBarChart({ data }: { data: ClassDomainItem[] }) {
  if (data.length === 0) return <EmptyChart message="데이터가 없습니다" />

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: -24, bottom: 0 }} style={{ outline: 'none' }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E3E5EA" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6B6F7A' }} axisLine={false} tickLine={false} />
        <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: '#6B6F7A' }} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v) => [String(v ?? 0) + '점', '']} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '12px' }} />
        <Bar dataKey="Grammar" fill="#1865F2" radius={[2, 2, 0, 0]} maxBarSize={18} />
        <Bar dataKey="Vocabulary" fill="#7854F7" radius={[2, 2, 0, 0]} maxBarSize={18} />
        <Bar dataKey="Reading" fill="#0FBFAD" radius={[2, 2, 0, 0]} maxBarSize={18} />
        <Bar dataKey="Writing" fill="#E35C20" radius={[2, 2, 0, 0]} maxBarSize={18} />
      </BarChart>
    </ResponsiveContainer>
  )
}

// ─── 9. Weekday Attendance Bar ────────────────────────────────────────────────

export type WeekdayAvgItem = { day: string; avg: number }

export function WeekdayAttendanceBarChart({ data }: { data: WeekdayAvgItem[] }) {
  if (data.length === 0) return <EmptyChart message="출석 데이터가 없습니다" />

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: -24, bottom: 0 }} style={{ outline: 'none' }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E3E5EA" vertical={false} />
        <XAxis dataKey="day" tick={{ fontSize: 12, fill: '#6B6F7A' }} axisLine={false} tickLine={false} />
        <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: '#6B6F7A' }} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v) => [String(v ?? 0) + "%", "평균 출석률"]} />
        <Bar dataKey="avg" name="평균 출석률" fill="#1FAF54" radius={[4, 4, 0, 0]} maxBarSize={48} />
      </BarChart>
    </ResponsiveContainer>
  )
}

// ─── 10. Monthly Enrollment Composed Chart ────────────────────────────────────

export type MonthlyEnrollmentItem = { month: string; newStudents: number; withdrawn: number }

export function MonthlyEnrollmentChart({ data }: { data: MonthlyEnrollmentItem[] }) {
  if (data.length === 0) return <EmptyChart message="등록 데이터가 없습니다" />

  return (
    <ResponsiveContainer width="100%" height={240}>
      <ComposedChart data={data} margin={{ top: 4, right: 8, left: -24, bottom: 0 }} style={{ outline: 'none' }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E3E5EA" vertical={false} />
        <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#6B6F7A' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 12, fill: '#6B6F7A' }} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip contentStyle={tooltipStyle} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '12px' }} />
        <Bar dataKey="newStudents" name="신규 등록" fill="#1FAF54" radius={[4, 4, 0, 0]} maxBarSize={40} />
        <Bar dataKey="withdrawn" name="퇴원/휴원" fill="#D92916" radius={[4, 4, 0, 0]} maxBarSize={40} />
      </ComposedChart>
    </ResponsiveContainer>
  )
}

// ─── 11. Teacher Activity Bar ─────────────────────────────────────────────────

export type TeacherActivityItem = { name: string; tests: number; comments: number }

export function TeacherActivityBarChart({ data }: { data: TeacherActivityItem[] }) {
  if (data.length === 0) return <EmptyChart message="교사 데이터가 없습니다" />

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: -24, bottom: 0 }} style={{ outline: 'none' }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E3E5EA" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#6B6F7A' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 12, fill: '#6B6F7A' }} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip contentStyle={tooltipStyle} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '12px' }} />
        <Bar dataKey="tests" name="테스트 출제" fill="#1865F2" radius={[2, 2, 0, 0]} maxBarSize={28} />
        <Bar dataKey="comments" name="코멘트 작성" fill="#7854F7" radius={[2, 2, 0, 0]} maxBarSize={28} />
      </BarChart>
    </ResponsiveContainer>
  )
}

// ─── 12. Attendance Heatmap Calendar ─────────────────────────────────────────

export type DailyAttendanceItem = { date: string; rate: number; present: number; total: number }

function rateToColor(rate: number): string {
  if (rate >= 0.9) return '#1FAF54'
  if (rate >= 0.7) return '#4CC474'
  if (rate >= 0.5) return '#86D49C'
  if (rate >= 0.25) return '#C0E9CC'
  return '#E8F5EC'
}

export function AttendanceHeatmap({ data }: { data: DailyAttendanceItem[] }) {
  if (data.length === 0) return <EmptyChart message="출석 데이터가 없습니다" />

  const rateMap: Record<string, DailyAttendanceItem> = {}
  data.forEach((d) => {
    rateMap[d.date] = d
  })

  const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date))
  const startDate = new Date(sorted[0].date)
  const endDate = new Date(sorted[sorted.length - 1].date)

  // Align start to Sunday
  const alignedStart = new Date(startDate)
  alignedStart.setDate(alignedStart.getDate() - alignedStart.getDay())

  // Build flat list of all days
  const allDays: Date[] = []
  const cur = new Date(alignedStart)
  while (cur <= endDate) {
    allDays.push(new Date(cur))
    cur.setDate(cur.getDate() + 1)
  }
  // Pad to complete week
  while (allDays.length % 7 !== 0) {
    allDays.push(new Date(cur))
    cur.setDate(cur.getDate() + 1)
  }

  // Chunk into weeks
  const weeks: Date[][] = []
  for (let i = 0; i < allDays.length; i += 7) {
    weeks.push(allDays.slice(i, i + 7))
  }

  const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']

  return (
    <div className="overflow-x-auto">
      <div className="inline-flex flex-col gap-1">
        {/* Month header row */}
        <div className="flex gap-1">
          <div className="w-6" />
          {weeks.map((week, wi) => {
            const firstDay = week.find((d) => d.getDate() === 1)
            return (
              <div key={wi} className="w-4 text-[10px] text-gray-400">
                {firstDay ? `${firstDay.getMonth() + 1}월` : ''}
              </div>
            )
          })}
        </div>

        {/* Day rows */}
        {DAY_LABELS.map((dayLabel, dayIdx) => (
          <div key={dayIdx} className="flex items-center gap-1">
            <div className="w-6 text-right text-[10px] text-gray-400">{dayLabel}</div>
            {weeks.map((week, wi) => {
              const day = week[dayIdx]
              const dateStr = day.toISOString().split('T')[0]
              const isOutOfRange = day < startDate || day > endDate
              const entry = rateMap[dateStr]

              let bgColor = 'transparent'
              if (!isOutOfRange) {
                bgColor = entry ? rateToColor(entry.rate) : '#F3F4F6'
              }

              return (
                <div
                  key={wi}
                  className="h-4 w-4 rounded-sm"
                  style={{ backgroundColor: bgColor }}
                  title={
                    entry
                      ? `${dateStr}: 출석률 ${Math.round(entry.rate * 100)}% (${entry.present}/${entry.total}명)`
                      : isOutOfRange
                        ? ''
                        : `${dateStr}: 데이터 없음`
                  }
                />
              )
            })}
          </div>
        ))}

        {/* Legend */}
        <div className="mt-3 flex items-center gap-1.5">
          <span className="text-[10px] text-gray-400">낮음</span>
          {[0.1, 0.3, 0.55, 0.8, 1.0].map((r, i) => (
            <div key={i} className="h-3 w-3 rounded-sm" style={{ backgroundColor: rateToColor(r) }} />
          ))}
          <span className="text-[10px] text-gray-400">높음</span>
        </div>
      </div>
    </div>
  )
}
