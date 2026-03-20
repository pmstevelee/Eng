'use client'

import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'

type DomainScore = {
  subject: string
  score: number
  fullMark: number
}

type Props = {
  grammarScore: number | null
  vocabularyScore: number | null
  readingScore: number | null
  writingScore: number | null
}

export function ResultRadarChart({ grammarScore, vocabularyScore, readingScore, writingScore }: Props) {
  const data: DomainScore[] = [
    { subject: '문법', score: grammarScore ?? 0, fullMark: 100 },
    { subject: '어휘', score: vocabularyScore ?? 0, fullMark: 100 },
    { subject: '독해', score: readingScore ?? 0, fullMark: 100 },
    { subject: '쓰기', score: writingScore ?? 0, fullMark: 100 },
  ]

  return (
    <ResponsiveContainer width="100%" height={280}>
      <RadarChart data={data}>
        <PolarGrid stroke="#e5e7eb" />
        <PolarAngleAxis
          dataKey="subject"
          tick={{ fill: '#6b7280', fontSize: 13, fontWeight: 500 }}
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
          contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
        />
      </RadarChart>
    </ResponsiveContainer>
  )
}
