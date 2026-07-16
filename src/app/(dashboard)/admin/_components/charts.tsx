'use client'

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
  BarChart,
  Bar,
} from 'recharts'

export type MonthlyData = { month: string; count: number }
export type PlanData = { plan: string; label: string; count: number }

const PLAN_COLORS: Record<string, string> = {
  BASIC: '#BABEC7',
  STANDARD: '#1865F2',
  PREMIUM: '#7854F7',
  ENTERPRISE: '#FFB100',
}

export function MonthlySignupChart({ data }: { data: MonthlyData[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E3E5EA" />
        <XAxis
          dataKey="month"
          tick={{ fontSize: 12, fill: '#6B6F7A' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 12, fill: '#6B6F7A' }}
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
          width={30}
        />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E3E5EA' }}
          labelStyle={{ color: '#21242C', fontWeight: 600 }}
        />
        <Line
          type="monotone"
          dataKey="count"
          stroke="#1865F2"
          strokeWidth={2}
          dot={{ fill: '#1865F2', r: 4 }}
          activeDot={{ r: 6 }}
          name="신규 학원"
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

export type ActionFrequencyData = { action: string; label: string; count: number }

export function ActionFrequencyChart({ data }: { data: ActionFrequencyData[] }) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(160, data.length * 40)}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#E3E5EA" horizontal={false} />
        <XAxis
          type="number"
          tick={{ fontSize: 12, fill: '#6B6F7A' }}
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
        />
        <YAxis
          type="category"
          dataKey="label"
          tick={{ fontSize: 12, fill: '#21242C' }}
          axisLine={false}
          tickLine={false}
          width={110}
        />
        <Tooltip
          formatter={(value) => [`${value}건`]}
          contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E3E5EA' }}
        />
        <Bar dataKey="count" fill="#1865F2" radius={[0, 4, 4, 0]} name="사용 건수" />
      </BarChart>
    </ResponsiveContainer>
  )
}

export function PlanDistributionChart({ data }: { data: PlanData[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={95}
          dataKey="count"
          nameKey="label"
          paddingAngle={2}
        >
          {data.map((entry) => (
            <Cell key={entry.plan} fill={PLAN_COLORS[entry.plan] ?? '#BABEC7'} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value) => [`${value}개`]}
          contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E3E5EA' }}
        />
        <Legend
          iconType="circle"
          iconSize={8}
          formatter={(value: string) => (
            <span style={{ fontSize: 12, color: '#6B6F7A' }}>{value}</span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}
