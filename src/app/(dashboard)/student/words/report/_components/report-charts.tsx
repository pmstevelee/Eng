'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'

type CefrEntry = { level: number; label: string; learned: number; mastered: number }
type WeekEntry = { date: string; count: number }

// ─── CEFR 레벨별 막대 그래프 ────────────────────────────────────────────────────

export function CefrProgressChart({ data }: { data: CefrEntry[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 4, right: 4, bottom: 4, left: 0 }} barGap={2}>
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#6B7280' }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fontSize: 11, fill: '#6B7280' }} tickLine={false} axisLine={false} width={32} />
        <Tooltip
          formatter={(value, name) => [`${value}개`, name === 'learned' ? '학습' : '마스터']}
          contentStyle={{ borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 12 }}
        />
        <Bar dataKey="learned" name="학습" fill="#DDE8FD" radius={[4, 4, 0, 0]} maxBarSize={28} />
        <Bar dataKey="mastered" name="마스터" fill="#1865F2" radius={[4, 4, 0, 0]} maxBarSize={28} />
      </BarChart>
    </ResponsiveContainer>
  )
}

// ─── 최근 7일 활동 히트맵 ─────────────────────────────────────────────────────────

const DAY_KO = ['일', '월', '화', '수', '목', '금', '토']

function intensityColor(count: number) {
  if (count === 0) return '#F3F4F6'
  if (count < 5) return '#BFDBFE'
  if (count < 15) return '#60A5FA'
  return '#1865F2'
}

export function WeeklyActivityHeatmap({ data }: { data: WeekEntry[] }) {
  return (
    <div className="flex gap-2 items-end">
      {data.map((d) => {
        const date = new Date(d.date)
        const dayLabel = DAY_KO[date.getDay()]
        const mmdd = `${date.getMonth() + 1}/${date.getDate()}`
        return (
          <div key={d.date} className="flex flex-col items-center gap-1 flex-1">
            <span className="text-xs text-gray-400 font-medium">{d.count > 0 ? d.count : ''}</span>
            <div
              title={`${mmdd} · ${d.count}개`}
              className="w-full rounded-lg transition-colors"
              style={{ height: 40, backgroundColor: intensityColor(d.count) }}
            />
            <span className="text-xs text-gray-400">{dayLabel}</span>
            <span className="text-[10px] text-gray-300">{mmdd}</span>
          </div>
        )
      })}
    </div>
  )
}
