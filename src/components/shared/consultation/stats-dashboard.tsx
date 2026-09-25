'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { BarChart3, Download, Info } from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { cn } from '@/lib/utils'
import {
  STATS_DEFINITION,
  STATS_PERIOD_LABEL,
  STATS_PERIOD_PRESETS,
  formatMonthLabel,
  formatPercent,
  ratio,
  type ConsultationStats,
  type RateRow,
  type StatsPeriodPreset,
} from '@/lib/consultation/stats-constants'

const COLOR = {
  primary: '#1865F2',
  green: '#1FAF54',
  gold: '#FFB100',
  red: '#D92916',
  purple: '#7854F7',
  grid: '#E3E5EA',
  axis: '#6B6F7A',
}

const tooltipStyle = {
  backgroundColor: '#fff',
  border: '1px solid #E3E5EA',
  borderRadius: '8px',
  padding: '8px 12px',
  fontSize: '13px',
  color: '#21242C',
}

// ─── 공용 조각 ────────────────────────────────────────────────────────────────

const TOOLTIP_WIDTH = 256

/** 지표 기준 설명 툴팁 — 마우스 오버·키보드 포커스·탭(모바일)으로 열림 */
function InfoTip({ text, label }: { text: string; label: string }) {
  const [open, setOpen] = useState(false)
  const [align, setAlign] = useState<'center' | 'left' | 'right'>('center')
  const id = useId()
  const ref = useRef<HTMLSpanElement>(null)

  // 화면 가장자리 근처에서는 툴팁이 잘리지 않도록 정렬 방향을 바꾼다
  const show = () => {
    const rect = ref.current?.getBoundingClientRect()
    if (rect) {
      const half = TOOLTIP_WIDTH / 2
      const mid = rect.left + rect.width / 2
      setAlign(mid + half > window.innerWidth - 16 ? 'right' : mid - half < 16 ? 'left' : 'center')
    }
    setOpen(true)
  }

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <span ref={ref} className="relative inline-flex" onMouseEnter={show} onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        aria-label={`${label} 계산 기준`}
        aria-describedby={open ? id : undefined}
        aria-expanded={open}
        onClick={show}
        onFocus={show}
        onBlur={() => setOpen(false)}
        className="w-6 h-6 inline-flex items-center justify-center rounded-full text-gray-500 hover:text-gray-900 hover:bg-gray-100"
      >
        <Info size={14} />
      </button>
      {open && (
        <span
          id={id}
          role="tooltip"
          style={{ width: TOOLTIP_WIDTH }}
          className={cn(
            'absolute z-20 top-7 rounded-lg border border-gray-200 bg-white p-3 text-xs leading-relaxed font-normal text-gray-700 shadow-sm',
            align === 'center' && 'left-1/2 -translate-x-1/2',
            align === 'left' && 'left-0',
            align === 'right' && 'right-0',
          )}
        >
          {text}
        </span>
      )}
    </span>
  )
}

function csvCell(v: string | number): string {
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** CSV 다운로드 (엑셀 한글 깨짐 방지 BOM 포함) — 집계값만 담고 개인정보는 넣지 않는다 */
function CsvButton({ filename, header, rows }: { filename: string; header: string[]; rows: (string | number)[][] }) {
  const download = () => {
    const body = [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\n')
    const blob = new Blob(['﻿' + body], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${filename}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }
  return (
    <button
      type="button"
      onClick={download}
      disabled={rows.length === 0}
      className="h-11 px-3 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 inline-flex items-center gap-1.5 shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <Download size={16} />
      CSV
    </button>
  )
}

function Section({
  title,
  info,
  action,
  children,
}: {
  title: string
  info?: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="min-w-0 rounded-xl border border-gray-200 bg-white">
      <div className="flex items-center gap-2 px-4 sm:px-5 pt-4 pb-3">
        <h2 className="text-base font-bold text-gray-900">{title}</h2>
        {info && <InfoTip text={info} label={title} />}
        <div className="flex-1" />
        {action}
      </div>
      <div className="px-4 sm:px-5 pb-5">{children}</div>
    </section>
  )
}

function EmptyBlock({ message }: { message: string }) {
  return (
    <div className="flex h-40 items-center justify-center rounded-lg bg-gray-50">
      <p className="text-sm text-gray-500">{message}</p>
    </div>
  )
}

const TH = 'px-3 py-2.5 text-left text-sm font-medium uppercase text-gray-500 whitespace-nowrap'
const TD = 'px-3 py-3 text-sm text-gray-900 whitespace-nowrap'

// ─── 기간 필터 ────────────────────────────────────────────────────────────────

function PeriodFilter({ range }: { range: ConsultationStats['range'] }) {
  const router = useRouter()
  const pathname = usePathname()
  const [from, setFrom] = useState(range.from)
  const [to, setTo] = useState(range.to)
  const [custom, setCustom] = useState(range.preset === 'custom')

  const go = (preset: StatsPeriodPreset) => {
    if (preset === 'custom') {
      setCustom(true)
      return
    }
    setCustom(false)
    router.push(`${pathname}?period=${preset}`)
  }

  const applyCustom = (e: React.FormEvent) => {
    e.preventDefault()
    if (!from || !to) return
    router.push(`${pathname}?period=custom&from=${from}&to=${to}`)
  }

  const activePreset: StatsPeriodPreset = custom ? 'custom' : range.preset

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2" role="group" aria-label="조회 기간">
        {STATS_PERIOD_PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => go(p)}
            aria-pressed={activePreset === p}
            className={cn(
              'h-11 px-4 rounded-full border text-sm font-medium transition-colors',
              activePreset === p
                ? 'border-primary-700 bg-primary-700 text-white'
                : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50',
            )}
          >
            {STATS_PERIOD_LABEL[p]}
          </button>
        ))}
      </div>
      {custom && (
        <form onSubmit={applyCustom} className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={from}
            max={to || undefined}
            onChange={(e) => setFrom(e.target.value)}
            aria-label="시작일"
            className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900"
          />
          <span className="text-sm text-gray-500">~</span>
          <input
            type="date"
            value={to}
            min={from || undefined}
            onChange={(e) => setTo(e.target.value)}
            aria-label="종료일"
            className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900"
          />
          <button
            type="submit"
            className="h-11 px-4 rounded-xl bg-primary-700 text-sm font-medium text-white hover:bg-primary-800"
          >
            조회
          </button>
        </form>
      )}
      <p className="text-sm text-gray-500">
        조회 기간: {range.from.replace(/-/g, '.')} ~ {range.to.replace(/-/g, '.')}
      </p>
    </div>
  )
}

// ─── KPI ─────────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, info }: { label: string; value: string; sub?: string; info: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-center gap-1 text-sm text-gray-500">
        {label}
        <InfoTip text={info} label={label} />
      </div>
      <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-gray-500">{sub}</p>}
    </div>
  )
}

// ─── 표 ──────────────────────────────────────────────────────────────────────

function RateTable({ firstColumn, rows }: { firstColumn: string; rows: RateRow[] }) {
  return (
    <div className="overflow-x-auto -mx-4 sm:mx-0">
      <table className="w-full min-w-[420px]">
        <thead className="bg-gray-50">
          <tr>
            <th className={TH}>{firstColumn}</th>
            <th className={cn(TH, 'text-right')}>문의 수</th>
            <th className={cn(TH, 'text-right')}>등록 수</th>
            <th className={cn(TH, 'text-right')}>전환율</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((r) => (
            <tr key={r.key || '__none'}>
              <td className={cn(TD, !r.key && 'text-gray-500')}>{r.label}</td>
              <td className={cn(TD, 'text-right tabular-nums')}>{r.total}</td>
              <td className={cn(TD, 'text-right tabular-nums')}>{r.enrolled}</td>
              <td className={cn(TD, 'text-right tabular-nums font-medium')}>{formatPercent(ratio(r.enrolled, r.total))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function rateCsvRows(rows: RateRow[]): (string | number)[][] {
  return rows.map((r) => [r.label, r.total, r.enrolled, formatPercent(ratio(r.enrolled, r.total))])
}

/** 사유 분포 — 가로 막대 목록 */
function ReasonBars({ rows, color }: { rows: { key: string; label: string; count: number }[]; color: string }) {
  const total = rows.reduce((s, r) => s + r.count, 0)
  const max = Math.max(1, ...rows.map((r) => r.count))
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.key}>
          <div className="flex items-baseline justify-between text-sm">
            <span className="text-gray-700">{r.label}</span>
            <span className="tabular-nums text-gray-900 font-medium">
              {r.count}건 <span className="text-gray-500 font-normal">({formatPercent(ratio(r.count, total))})</span>
            </span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-gray-100 overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${(r.count / max) * 100}%`, backgroundColor: color }} />
          </div>
        </li>
      ))}
    </ul>
  )
}

function Funnel({ steps }: { steps: ConsultationStats['funnel'] }) {
  const first = steps[0]?.count ?? 0
  const colors = [COLOR.primary, COLOR.purple, '#0FBFAD', COLOR.green]
  return (
    <ol className="space-y-3">
      {steps.map((s, i) => {
        const prev = i > 0 ? steps[i - 1].count : null
        return (
          <li key={s.key}>
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="font-medium text-gray-900">
                {i + 1}. {s.label}
              </span>
              <span className="tabular-nums text-gray-900">
                <span className="font-bold">{s.count}건</span>
                {prev !== null && (
                  <span className="ml-2 text-gray-500">전 단계 대비 {formatPercent(ratio(s.count, prev))}</span>
                )}
              </span>
            </div>
            <div className="mt-1 h-7 rounded-lg bg-gray-100 overflow-hidden">
              <div
                className="h-full rounded-lg"
                style={{ width: `${first > 0 ? Math.max(2, (s.count / first) * 100) : 0}%`, backgroundColor: colors[i] }}
              />
            </div>
          </li>
        )
      })}
    </ol>
  )
}

// ─── 대시보드 ─────────────────────────────────────────────────────────────────

export function StatsDashboard({ data }: { data: ConsultationStats }) {
  const { kpi, range } = data
  const suffix = `${range.from}_${range.to}`
  const monthlyChart = data.monthly.map((m) => ({ ...m, label: formatMonthLabel(m.month) }))
  const hasLeads = kpi.newLeads > 0
  const hasMonthlyLeads = data.monthly.some((m) => m.leads > 0 || m.enrolled > 0)
  const lostTotal = data.lostReasons.reduce((s, r) => s + r.count, 0)
  const withdrawalTotal = data.withdrawalReasons.reduce((s, r) => s + r.count, 0)
  const hasWithdrawals = data.monthly.some((m) => m.withdrawals > 0)
  const isEmpty =
    !hasLeads &&
    !hasMonthlyLeads &&
    kpi.appointmentsDecided === 0 &&
    withdrawalTotal === 0 &&
    data.risk.watch + data.risk.risk === 0 &&
    !(data.assignees ?? []).some((a) => a.leadConsultations + a.studentConsultations > 0)

  return (
    <div className="space-y-6">
      <PeriodFilter key={`${range.preset}-${range.from}-${range.to}`} range={range} />

      {isEmpty ? (
        <div className="rounded-xl border border-gray-200 bg-white px-6 py-16 text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
            <BarChart3 size={24} className="text-gray-500" />
          </div>
          <p className="mt-4 text-base font-bold text-gray-900">이 기간에 집계할 상담 데이터가 없습니다</p>
          <p className="mt-1 text-sm text-gray-500">
            문의를 등록하고 상담을 기록하면 전환율·퍼널 등의 통계가 여기에 표시됩니다.
            <br />
            다른 기간을 선택해 보세요.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard label="신규 문의" value={`${kpi.newLeads}건`} info={STATS_DEFINITION.newLeads} />
            <KpiCard
              label="등록 전환율"
              value={formatPercent(ratio(kpi.enrolled, kpi.newLeads))}
              sub={hasLeads ? `${kpi.newLeads}건 중 ${kpi.enrolled}건 등록` : undefined}
              info={STATS_DEFINITION.conversionRate}
            />
            <KpiCard
              label="평균 등록 소요일"
              value={kpi.avgDaysToEnroll === null ? '-' : `${kpi.avgDaysToEnroll.toFixed(1)}일`}
              info={STATS_DEFINITION.avgDaysToEnroll}
            />
            <KpiCard
              label="노쇼율"
              value={formatPercent(ratio(kpi.noShows, kpi.appointmentsDecided))}
              sub={kpi.appointmentsDecided > 0 ? `예약 ${kpi.appointmentsDecided}건 중 ${kpi.noShows}건` : undefined}
              info={STATS_DEFINITION.noShowRate}
            />
          </div>

          <Section
            title="월별 신규 문의 · 등록"
            info={STATS_DEFINITION.monthly}
            action={
              <CsvButton
                filename={`월별_문의_등록_${suffix}`}
                header={['월', '신규 문의', '등록']}
                rows={data.monthly.map((m) => [m.month, m.leads, m.enrolled])}
              />
            }
          >
            {hasMonthlyLeads ? (
              <ResponsiveContainer width="100%" height={260}>
                <ComposedChart data={monthlyChart} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={COLOR.grid} vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 12, fill: COLOR.axis }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: COLOR.axis }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: '#F7F8F9' }} formatter={(v) => `${v ?? 0}건`} />
                  <Legend wrapperStyle={{ fontSize: 13 }} />
                  <Bar dataKey="leads" name="신규 문의" fill={COLOR.primary} radius={[4, 4, 0, 0]} maxBarSize={48} />
                  <Line
                    dataKey="enrolled"
                    name="등록"
                    type="monotone"
                    stroke={COLOR.green}
                    strokeWidth={2}
                    dot={{ r: 4, fill: COLOR.green }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <EmptyBlock message="이 기간에 생성되거나 등록된 문의가 없습니다" />
            )}
          </Section>

          <Section
            title="전환 퍼널"
            info={STATS_DEFINITION.funnel}
            action={
              <CsvButton
                filename={`전환퍼널_${suffix}`}
                header={['단계', '문의 수', '전 단계 대비 전환율', '전체 대비 비율']}
                rows={data.funnel.map((s, i) => [
                  s.label,
                  s.count,
                  i === 0 ? '-' : formatPercent(ratio(s.count, data.funnel[i - 1].count)),
                  formatPercent(ratio(s.count, data.funnel[0].count)),
                ])}
              />
            }
          >
            {hasLeads ? <Funnel steps={data.funnel} /> : <EmptyBlock message="이 기간에 생성된 문의가 없습니다" />}
          </Section>

          <div className="grid gap-6 lg:grid-cols-2">
            <Section
              title="문의 채널별"
              info={STATS_DEFINITION.channel}
              action={
                <CsvButton
                  filename={`채널별_${suffix}`}
                  header={['채널', '문의 수', '등록 수', '전환율']}
                  rows={rateCsvRows(data.channels)}
                />
              }
            >
              {hasLeads ? (
                <RateTable firstColumn="채널" rows={data.channels} />
              ) : (
                <EmptyBlock message="이 기간에 생성된 문의가 없습니다" />
              )}
            </Section>

            <Section
              title="유입경로별"
              info={STATS_DEFINITION.source}
              action={
                <CsvButton
                  filename={`유입경로별_${suffix}`}
                  header={['유입경로', '문의 수', '등록 수', '전환율']}
                  rows={rateCsvRows(data.sources)}
                />
              }
            >
              {data.sources.length > 0 ? (
                <RateTable firstColumn="유입경로" rows={data.sources} />
              ) : (
                <EmptyBlock message="이 기간에 생성된 문의가 없습니다" />
              )}
            </Section>
          </div>

          {data.assignees && (
            <Section
              title="담당자별 실적"
              info={STATS_DEFINITION.assignee}
              action={
                <CsvButton
                  filename={`담당자별_${suffix}`}
                  header={['담당자', '담당 문의', '문의 상담', '재원생 상담', '등록', '전환율']}
                  rows={data.assignees.map((a) => [
                    a.name,
                    a.leads,
                    a.leadConsultations,
                    a.studentConsultations,
                    a.enrolled,
                    formatPercent(ratio(a.enrolled, a.leads)),
                  ])}
                />
              }
            >
              {data.assignees.length > 0 ? (
                <div className="overflow-x-auto -mx-4 sm:mx-0">
                  <table className="w-full min-w-[560px]">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className={TH}>담당자</th>
                        <th className={cn(TH, 'text-right')}>담당 문의</th>
                        <th className={cn(TH, 'text-right')}>문의 상담</th>
                        <th className={cn(TH, 'text-right')}>재원생 상담</th>
                        <th className={cn(TH, 'text-right')}>등록</th>
                        <th className={cn(TH, 'text-right')}>전환율</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {data.assignees.map((a) => (
                        <tr key={a.userId ?? '__none'}>
                          <td className={cn(TD, !a.userId && 'text-gray-500')}>{a.name}</td>
                          <td className={cn(TD, 'text-right tabular-nums')}>{a.leads}</td>
                          <td className={cn(TD, 'text-right tabular-nums')}>{a.leadConsultations}</td>
                          <td className={cn(TD, 'text-right tabular-nums')}>{a.studentConsultations}</td>
                          <td className={cn(TD, 'text-right tabular-nums')}>{a.enrolled}</td>
                          <td className={cn(TD, 'text-right tabular-nums font-medium')}>
                            {formatPercent(ratio(a.enrolled, a.leads))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyBlock message="이 기간에 담당 문의나 상담 기록이 없습니다" />
              )}
            </Section>
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            <Section
              title="이탈 사유"
              info={STATS_DEFINITION.lostReason}
              action={
                <CsvButton
                  filename={`이탈사유_${suffix}`}
                  header={['사유', '건수', '비율']}
                  rows={data.lostReasons.map((r) => [r.label, r.count, formatPercent(ratio(r.count, lostTotal))])}
                />
              }
            >
              {lostTotal > 0 ? (
                <ReasonBars rows={data.lostReasons} color={COLOR.red} />
              ) : (
                <EmptyBlock message="이 기간에 이탈한 문의가 없습니다" />
              )}
            </Section>

            <Section
              title="퇴원 사유"
              info={STATS_DEFINITION.withdrawalReason}
              action={
                <CsvButton
                  filename={`퇴원사유_${suffix}`}
                  header={['사유', '건수', '비율']}
                  rows={data.withdrawalReasons.map((r) => [r.label, r.count, formatPercent(ratio(r.count, withdrawalTotal))])}
                />
              }
            >
              {withdrawalTotal > 0 ? (
                <ReasonBars rows={data.withdrawalReasons} color={COLOR.gold} />
              ) : (
                <EmptyBlock message="이 기간에 퇴원 처리 기록이 없습니다" />
              )}
            </Section>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="min-w-0 lg:col-span-2">
              <Section
                title="월별 퇴원"
                info={STATS_DEFINITION.monthlyWithdrawal}
                action={
                  <CsvButton
                    filename={`월별_퇴원_${suffix}`}
                    header={['월', '퇴원 수']}
                    rows={data.monthly.map((m) => [m.month, m.withdrawals])}
                  />
                }
              >
                {hasWithdrawals ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={monthlyChart} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={COLOR.grid} vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 12, fill: COLOR.axis }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 12, fill: COLOR.axis }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip contentStyle={tooltipStyle} cursor={{ fill: '#F7F8F9' }} formatter={(v) => [`${v ?? 0}명`, '퇴원']} />
                      <Bar dataKey="withdrawals" name="퇴원" fill={COLOR.gold} radius={[4, 4, 0, 0]} maxBarSize={48} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyBlock message="이 기간에 퇴원 처리 기록이 없습니다" />
                )}
              </Section>
            </div>

            <Section title="현재 퇴원 위험군" info={STATS_DEFINITION.risk}>
              {data.risk.calculated ? (
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-gray-200 p-4">
                    <p className="text-sm text-gray-500">주의</p>
                    <p className="mt-1 text-2xl font-bold text-[#9A6B00] tabular-nums">{data.risk.watch}명</p>
                  </div>
                  <div className="rounded-xl border border-gray-200 p-4">
                    <p className="text-sm text-gray-500">위험</p>
                    <p className="mt-1 text-2xl font-bold text-accent-red tabular-nums">{data.risk.risk}명</p>
                  </div>
                </div>
              ) : (
                <EmptyBlock message="아직 퇴원 위험 계산 결과가 없습니다" />
              )}
            </Section>
          </div>
        </>
      )}
    </div>
  )
}
