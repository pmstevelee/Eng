'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  Legend,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export type ClassChartItem = { name: string; 평균점수: number; 학생수: number }
export type MonthlyChartItem = { month: string; 신규학생: number }
export type LevelChartItem = { name: string; value: number }
export type DomainChartItem = { domain: string; 평균: number }

interface OwnerChartsProps {
  classChartData: ClassChartItem[]
  monthlyChartData: MonthlyChartItem[]
  levelChartData: LevelChartItem[]
  domainData: DomainChartItem[]
}

const DOMAIN_COLORS = ['#1865F2', '#7854F7', '#0FBFAD', '#E35C20', '#1FAF54', '#FFB100', '#D92916']
const LEVEL_COLORS = ['#EEF4FF', '#C7D9FE', '#93B8FC', '#4B8AF5', '#1865F2', '#1449C1', '#0C2E8A']

const CustomTooltipStyle = {
  backgroundColor: '#fff',
  border: '1px solid #E3E5EA',
  borderRadius: '8px',
  padding: '8px 12px',
  fontSize: '13px',
  color: '#21242C',
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex h-[220px] items-center justify-center">
      <p className="text-sm text-gray-500">{message}</p>
    </div>
  )
}

export function OwnerCharts({
  classChartData,
  monthlyChartData,
  levelChartData,
  domainData,
}: OwnerChartsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {/* 반별 비교 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="h-3 w-3 rounded-full bg-[#1865F2]" />
            반별 평균 점수 비교
          </CardTitle>
        </CardHeader>
        <CardContent>
          {classChartData.length === 0 ? (
            <EmptyChart message="반 데이터가 없습니다" />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={classChartData} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E3E5EA" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#6B6F7A' }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: '#6B6F7A' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={CustomTooltipStyle} cursor={{ fill: '#F7F8F9' }} />
                <Bar dataKey="평균점수" fill="#1865F2" radius={[4, 4, 0, 0]} maxBarSize={48} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* 월별 신규 학생 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="h-3 w-3 rounded-full bg-[#1FAF54]" />
            월별 신규 학생 등록
          </CardTitle>
        </CardHeader>
        <CardContent>
          {monthlyChartData.length === 0 ? (
            <EmptyChart message="학생 등록 데이터가 없습니다" />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={monthlyChartData} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
                <defs>
                  <linearGradient id="greenGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1FAF54" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#1FAF54" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E3E5EA" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#6B6F7A' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: '#6B6F7A' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={CustomTooltipStyle} />
                <Area type="monotone" dataKey="신규학생" stroke="#1FAF54" strokeWidth={2} fill="url(#greenGrad)" dot={{ r: 4, fill: '#1FAF54', strokeWidth: 0 }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* 레벨 분포 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="h-3 w-3 rounded-full bg-[#7854F7]" />
            학생 레벨 분포
          </CardTitle>
        </CardHeader>
        <CardContent>
          {levelChartData.length === 0 ? (
            <EmptyChart message="레벨 데이터가 없습니다" />
          ) : (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="55%" height={220}>
                <PieChart>
                  <Pie
                    data={levelChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="value"
                    strokeWidth={0}
                  >
                    {levelChartData.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={LEVEL_COLORS[index % LEVEL_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={CustomTooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-1 flex-col gap-1.5">
                {levelChartData.map((item, index) => (
                  <div key={item.name} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: LEVEL_COLORS[index % LEVEL_COLORS.length] }}
                      />
                      <span className="text-xs text-gray-700">{item.name}</span>
                    </div>
                    <span className="text-xs font-semibold text-gray-900">{item.value}명</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 영역별 평균 점수 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="h-3 w-3 rounded-full bg-[#7854F7]" />
            영역별 평균 점수
          </CardTitle>
        </CardHeader>
        <CardContent>
          {domainData.every((d) => d.평균 === 0) ? (
            <EmptyChart message="채점된 테스트 결과가 없습니다" />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <RadarChart data={domainData} margin={{ top: 8, right: 24, left: 24, bottom: 8 }}>
                <PolarGrid stroke="#E3E5EA" />
                <PolarAngleAxis
                  dataKey="domain"
                  tick={{ fontSize: 11, fill: '#6B6F7A' }}
                />
                <Radar
                  name="평균"
                  dataKey="평균"
                  stroke="#7854F7"
                  fill="#7854F7"
                  fillOpacity={0.18}
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#7854F7', strokeWidth: 0 }}
                />
                <Tooltip contentStyle={CustomTooltipStyle} />
              </RadarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export function DomainScoreBars({ domainData }: { domainData: DomainChartItem[] }) {
  const domainMeta: Record<string, { color: string; label: string }> = {
    Grammar: { color: '#1865F2', label: 'Grammar' },
    Vocabulary: { color: '#7854F7', label: 'Vocabulary' },
    Reading: { color: '#0FBFAD', label: 'Reading' },
    Writing: { color: '#E35C20', label: 'Writing' },
  }

  return (
    <div className="space-y-3">
      {domainData.map((d) => {
        const meta = domainMeta[d.domain] ?? { color: '#1865F2', label: d.domain }
        return (
          <div key={d.domain} className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium" style={{ color: meta.color }}>
                {meta.label}
              </span>
              <span className="text-xs font-semibold text-gray-900">{d.평균}점</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${d.평균}%`, backgroundColor: meta.color }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
