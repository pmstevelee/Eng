'use client'

import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'

type RadarPoint = { subject: string; score: number }

type Props = {
  thisMonth: RadarPoint[]
  lastMonth: RadarPoint[]
}

export function GradesRadarChart({ thisMonth, lastMonth }: Props) {
  const data = thisMonth.map((d, i) => ({
    subject: d.subject,
    이번달: d.score,
    지난달: lastMonth[i]?.score ?? 0,
  }))

  return (
    <ResponsiveContainer width="100%" height={300}>
      <RadarChart data={data} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
        <PolarGrid stroke="#e3e5ea" />
        <PolarAngleAxis
          dataKey="subject"
          tick={{ fill: '#6B6F7A', fontSize: 13, fontWeight: 500 }}
        />
        <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
        <Radar
          name="이번달"
          dataKey="이번달"
          stroke="#1865F2"
          fill="#1865F2"
          fillOpacity={0.15}
          strokeWidth={2}
        />
        <Radar
          name="지난달"
          dataKey="지난달"
          stroke="#1865F2"
          fill="transparent"
          fillOpacity={0}
          strokeWidth={1.5}
          strokeDasharray="5 4"
        />
        <Tooltip
          formatter={(value, name) => [`${value}점`, name === '이번달' ? '이번 달' : '지난 달']}
          contentStyle={{
            borderRadius: '10px',
            border: '1px solid #E3E5EA',
            fontSize: '13px',
            boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
          }}
        />
      </RadarChart>
    </ResponsiveContainer>
  )
}
