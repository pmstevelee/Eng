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

type RadarDataPoint = {
  subject: string
  score: number
  fullMark: number
}

type Props = {
  data: RadarDataPoint[]
}

export function ResultRadarChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <RadarChart data={data} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
        <PolarGrid stroke="#e5e7eb" />
        <PolarAngleAxis
          dataKey="subject"
          tick={{ fill: '#6b7280', fontSize: 12, fontWeight: 500 }}
        />
        <PolarRadiusAxis
          domain={[0, 100]}
          tick={false}
          axisLine={false}
        />
        <Radar
          name="점수"
          dataKey="score"
          stroke="#1865F2"
          fill="#1865F2"
          fillOpacity={0.15}
          strokeWidth={2}
        />
        <Tooltip
          formatter={(value) => [`${value}점`, '점수']}
          contentStyle={{
            borderRadius: '8px',
            border: '1px solid #e5e7eb',
            fontSize: '13px',
          }}
        />
      </RadarChart>
    </ResponsiveContainer>
  )
}
