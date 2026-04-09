'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

type SessionPoint = {
  id: string
  title: string
  date: string
  grammarScore: number | null
  vocabularyScore: number | null
  readingScore: number | null
  listeningScore: number | null
  writingScore: number | null
}

type DomainKey = 'GRAMMAR' | 'VOCABULARY' | 'READING' | 'LISTENING' | 'WRITING'

const DOMAIN_DATA_KEY: Record<DomainKey, keyof SessionPoint> = {
  GRAMMAR: 'grammarScore',
  VOCABULARY: 'vocabularyScore',
  READING: 'readingScore',
  LISTENING: 'listeningScore',
  WRITING: 'writingScore',
}

type Props = {
  sessions: SessionPoint[]
  domain: DomainKey
  color: string
}

export function GradesDomainLineChart({ sessions, domain, color }: Props) {
  const dataKey = DOMAIN_DATA_KEY[domain]

  const data = sessions.map((s) => ({
    name: s.date,
    title: s.title,
    score: s[dataKey],
  }))

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center py-10 text-sm text-gray-400">
        데이터가 없습니다
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: -10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F0F1F3" />
        <XAxis dataKey="name" tick={{ fill: '#6B6F7A', fontSize: 11 }} />
        <YAxis domain={[0, 100]} tick={{ fill: '#6B6F7A', fontSize: 11 }} />
        <Tooltip
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null
            const point = payload[0]?.payload as { title: string; score: number | null }
            return (
              <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
                <p className="mb-0.5 text-xs font-medium text-gray-700 line-clamp-1">
                  {point.title}
                </p>
                <p className="text-xs text-gray-400">{label}</p>
                <p className="mt-1 text-base font-bold" style={{ color }}>
                  {point.score ?? '—'}점
                </p>
              </div>
            )
          }}
        />
        <Line
          type="monotone"
          dataKey="score"
          stroke={color}
          strokeWidth={2.5}
          dot={{ fill: color, r: 4, strokeWidth: 0 }}
          activeDot={{ r: 6 }}
          connectNulls
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
