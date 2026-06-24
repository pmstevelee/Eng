'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import type { ClassWordComparison } from '../_actions/report'

export function ClassComparisonChart({ data }: { data: ClassWordComparison[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: 0 }} barGap={4}>
        <XAxis dataKey="className" tick={{ fontSize: 11, fill: '#6B7280' }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fontSize: 11, fill: '#6B7280' }} tickLine={false} axisLine={false} width={36} />
        <Tooltip
          formatter={(value, name) => {
            const labels: Record<string, string> = { avgLearned: '평균 학습', avgMastered: '평균 마스터', avgAccuracy: '평균 정답률(%)' }
            return [value, labels[String(name)] ?? name]
          }}
          contentStyle={{ borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 12 }}
        />
        <Legend
          formatter={(value) => {
            const map: Record<string, string> = { avgLearned: '평균 학습', avgMastered: '평균 마스터', avgAccuracy: '정답률(%)' }
            return <span style={{ fontSize: 12, color: '#6B7280' }}>{map[value] ?? value}</span>
          }}
        />
        <Bar dataKey="avgLearned" name="avgLearned" fill="#DDE8FD" radius={[4, 4, 0, 0]} maxBarSize={32} />
        <Bar dataKey="avgMastered" name="avgMastered" fill="#1865F2" radius={[4, 4, 0, 0]} maxBarSize={32} />
        <Bar dataKey="avgAccuracy" name="avgAccuracy" fill="#1FAF54" radius={[4, 4, 0, 0]} maxBarSize={32} />
      </BarChart>
    </ResponsiveContainer>
  )
}
