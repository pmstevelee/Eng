'use client'

import { useState } from 'react'
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
  type: string
  date: string
  score: number | null
  grammarScore: number | null
  vocabularyScore: number | null
  readingScore: number | null
  writingScore: number | null
}

type FilterKey = 'all' | 'grammar' | 'vocabulary' | 'reading' | 'writing'

const FILTERS: {
  key: FilterKey
  label: string
  color: string
  dataKey: keyof SessionPoint
}[] = [
  { key: 'all', label: '전체', color: '#1865F2', dataKey: 'score' },
  { key: 'grammar', label: '문법', color: '#1865F2', dataKey: 'grammarScore' },
  { key: 'vocabulary', label: '어휘', color: '#7854F7', dataKey: 'vocabularyScore' },
  { key: 'reading', label: '독해', color: '#0FBFAD', dataKey: 'readingScore' },
  { key: 'writing', label: '쓰기', color: '#E35C20', dataKey: 'writingScore' },
]

type Props = { sessions: SessionPoint[] }

export function GradesLineChartWrapper({ sessions }: Props) {
  const [filter, setFilter] = useState<FilterKey>('all')

  const activeFilter = FILTERS.find((f) => f.key === filter) ?? FILTERS[0]
  const lineColor = activeFilter.color
  const dataKey = activeFilter.dataKey

  const data = sessions.map((s) => ({
    name: s.date,
    title: s.title,
    score: s[dataKey],
  }))

  return (
    <div>
      <div className="mb-5 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`min-h-[36px] rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              filter === f.key
                ? 'text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
            style={filter === f.key ? { backgroundColor: f.color } : {}}
          >
            {f.label}
          </button>
        ))}
      </div>

      {data.length === 0 ? (
        <div className="flex items-center justify-center py-16 text-sm text-gray-400">
          완료된 테스트가 없습니다
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F0F1F3" />
            <XAxis dataKey="name" tick={{ fill: '#6B6F7A', fontSize: 12 }} />
            <YAxis domain={[0, 100]} tick={{ fill: '#6B6F7A', fontSize: 12 }} />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null
                const point = payload[0]?.payload as { title: string; score: number | null }
                return (
                  <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
                    <p className="mb-0.5 max-w-[160px] truncate text-xs font-medium text-gray-700">
                      {point.title}
                    </p>
                    <p className="text-xs text-gray-400">{label}</p>
                    <p className="mt-1 text-base font-bold" style={{ color: lineColor }}>
                      {point.score ?? '—'}점
                    </p>
                  </div>
                )
              }}
            />
            <Line
              type="monotone"
              dataKey="score"
              stroke={lineColor}
              strokeWidth={2.5}
              dot={{ fill: lineColor, r: 4, strokeWidth: 0 }}
              activeDot={{ r: 6 }}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
