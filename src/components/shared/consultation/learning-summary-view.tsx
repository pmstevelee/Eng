'use client'

import { ArrowDown, ArrowRight, ArrowUp, Minus } from 'lucide-react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatDateKeyShort } from '@/lib/consultation/constants'
import {
  LEVEL_ASSESSMENT_TYPE_LABEL,
  SUMMARY_DOMAIN_COLOR,
  SUMMARY_DOMAIN_LABEL,
  WRITING_ERROR_TYPE_LABEL,
  metricDelta,
  type LearningSummary,
  type SummaryMetric,
} from '@/lib/consultation/learning-summary-types'
import { getLevelInfo } from '@/lib/constants/levels'
import { cn } from '@/lib/utils'

type Unit = { suffix: string; deltaSuffix: string }
const COUNT_DAY: Unit = { suffix: '일', deltaSuffix: '일' }
const COUNT: Unit = { suffix: '개', deltaSuffix: '개' }
const PERCENT: Unit = { suffix: '%', deltaSuffix: '%p' }
const SCORE: Unit = { suffix: '점', deltaSuffix: '점' }
const XP: Unit = { suffix: ' XP', deltaSuffix: '' }

function shortDate(key: string): string {
  return formatDateKeyShort(key).split('(')[0]
}

function levelLabel(level: number): string {
  return `Lv.${level} (${getLevelInfo(level).cefr})`
}

function DeltaChip({ metric, unit }: { metric: SummaryMetric; unit: Unit }) {
  const delta = metricDelta(metric)
  if (delta === null) return <span className="text-[11px] text-gray-500">비교 없음</span>
  if (delta === 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[11px] text-gray-500">
        <Minus size={11} /> 변화 없음
      </span>
    )
  }
  const up = delta > 0
  return (
    <span className={cn('inline-flex items-center gap-0.5 text-[11px] font-semibold', up ? 'text-[#16803D]' : 'text-accent-red')}>
      {up ? <ArrowUp size={11} /> : <ArrowDown size={11} />}
      {Math.abs(delta).toLocaleString('ko-KR')}
      {unit.deltaSuffix}
    </span>
  )
}

function StatTile({ label, metric, unit, note }: { label: string; metric: SummaryMetric; unit: Unit; note?: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-3 py-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-1 text-lg font-bold text-gray-900 tabular-nums">
        {metric.current === null ? '-' : `${metric.current.toLocaleString('ko-KR')}${unit.suffix}`}
      </p>
      <div className="mt-0.5 min-h-4">
        <DeltaChip metric={metric} unit={unit} />
      </div>
      {note && <p className="mt-1 text-[11px] text-gray-500">{note}</p>}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h4 className="text-sm font-semibold text-gray-900">{title}</h4>
      {children}
    </section>
  )
}

/**
 * 학습 요약 표시 — 상담 작성 패널·상담 기록 스냅샷·학부모 리포트 공용.
 * compact: 좁은 영역(패널)용 2열 배치
 */
export function LearningSummaryView({ summary, compact = false }: { summary: LearningSummary; compact?: boolean }) {
  const { period, previousPeriod } = summary
  const hasStudy = (summary.studyDays.current ?? 0) > 0 || summary.attendance.total > 0
  const gridCols = compact ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4'

  return (
    <div className="space-y-5">
      <p className="text-xs text-gray-500">
        {shortDate(period.from)} ~ {shortDate(period.to)} ({period.days}일) · 직전 기간 {shortDate(previousPeriod.from)} ~{' '}
        {shortDate(previousPeriod.to)} 대비
      </p>

      {!hasStudy && (
        <p className="rounded-xl bg-gray-50 border border-gray-200 px-4 py-3 text-sm text-gray-700">
          이 기간에 기록된 학습 활동이 없습니다.
        </p>
      )}

      <Section title="학습 습관">
        <div className={cn('grid gap-2', gridCols)}>
          <StatTile label="학습한 날" metric={summary.studyDays} unit={COUNT_DAY} />
          {summary.attendance.total > 0 && (
            <StatTile
              label="출석률"
              metric={summary.attendance.rate}
              unit={PERCENT}
              note={`출석 ${summary.attendance.present} · 지각 ${summary.attendance.late} · 결석 ${summary.attendance.absent}`}
            />
          )}
          <StatTile label="획득 XP" metric={summary.xp} unit={XP} />
          <div className="rounded-xl border border-gray-200 bg-white px-3 py-3">
            <p className="text-xs text-gray-500">연속 학습</p>
            <p className="mt-1 text-lg font-bold text-gray-900 tabular-nums">{summary.streak.current}일</p>
            <p className="mt-0.5 text-[11px] text-gray-500">최장 {summary.streak.longest}일 · 현재 기준</p>
          </div>
        </div>
      </Section>

      <Section title="단어 학습">
        <div className={cn('grid gap-2', gridCols)}>
          <StatTile label="학습한 단어" metric={summary.words.studied} unit={COUNT} />
          <StatTile label="암기 완료 단어" metric={summary.words.mastered} unit={COUNT} />
          <StatTile
            label="일일 복습 완료율"
            metric={summary.words.reviewRate}
            unit={PERCENT}
            note={`${summary.words.reviewDays.current ?? 0}일 / ${period.days}일`}
          />
          <StatTile label="단어 시험 평균" metric={summary.words.testAvg} unit={SCORE} />
        </div>
        {summary.words.overdueNow > 0 && (
          <p className="text-xs text-gray-500">
            현재 복습 기한이 지난 단어 {summary.words.overdueNow.toLocaleString('ko-KR')}개
          </p>
        )}
      </Section>

      <Section title="문제 풀이">
        <div className={cn('grid gap-2', gridCols)}>
          <StatTile label="정답률" metric={summary.accuracy.overall} unit={PERCENT} />
          <StatTile label="푼 문제" metric={summary.accuracy.solved} unit={COUNT} />
        </div>

        {summary.accuracy.weekly.length > 1 && (
          <div className="rounded-xl border border-gray-200 bg-white p-3">
            <p className="text-xs text-gray-500 mb-2">주별 정답률</p>
            <ResponsiveContainer width="100%" height={160}>
              <LineChart
                data={summary.accuracy.weekly.map((w) => ({ ...w, label: shortDate(w.weekStart) }))}
                margin={{ top: 8, right: 8, left: -20, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#E3E5EA" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#6B6F7A' }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#6B6F7A' }} />
                <Tooltip
                  contentStyle={{ borderRadius: '12px', border: '1px solid #E3E5EA', fontSize: 12 }}
                  formatter={(v, _n, item) => [`${v}% (${(item.payload as { count: number }).count}문항)`, '정답률']}
                  labelFormatter={(l) => `${l} 주`}
                />
                <Line
                  type="monotone"
                  dataKey="rate"
                  stroke="#1865F2"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#1865F2' }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {summary.accuracy.byDomain.length > 0 && (
          <ul className="rounded-xl border border-gray-200 bg-white divide-y divide-gray-200">
            {summary.accuracy.byDomain.map((d) => {
              const weak = summary.weakDomains.includes(d.domain)
              return (
                <li key={d.domain} className="px-3 py-2.5">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex items-center gap-1.5 font-medium text-gray-900">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: SUMMARY_DOMAIN_COLOR[d.domain] }} />
                      {SUMMARY_DOMAIN_LABEL[d.domain]}
                      {weak && (
                        <span className="rounded-full bg-accent-red-light text-accent-red px-2 py-0.5 text-[11px] font-semibold">
                          보완 필요
                        </span>
                      )}
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="tabular-nums font-semibold text-gray-900">
                        {d.rate.current === null ? '-' : `${d.rate.current}%`}
                      </span>
                      <DeltaChip metric={d.rate} unit={PERCENT} />
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${d.rate.current ?? 0}%`, backgroundColor: SUMMARY_DOMAIN_COLOR[d.domain] }}
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-gray-500">{d.count}문항</p>
                </li>
              )
            })}
          </ul>
        )}
      </Section>

      <Section title="레벨 변화">
        {summary.level.end === null ? (
          <p className="text-sm text-gray-500">레벨 평가 기록이 없습니다.</p>
        ) : (
          <div className="rounded-xl border border-gray-200 bg-white px-3 py-3 space-y-2">
            <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-gray-900">
              {summary.level.start !== null && summary.level.start !== summary.level.end ? (
                <>
                  {levelLabel(summary.level.start)}
                  <ArrowRight size={14} className="text-gray-500" />
                  {levelLabel(summary.level.end)}
                </>
              ) : (
                <>
                  {levelLabel(summary.level.end)}
                  <span className="text-xs font-normal text-gray-500">
                    {summary.level.changes.length === 0 ? '기간 중 변화 없음' : ''}
                  </span>
                </>
              )}
            </p>
            {summary.level.changes.length > 0 && (
              <ul className="text-xs text-gray-700 space-y-0.5">
                {summary.level.changes.map((c, i) => (
                  <li key={i}>
                    {shortDate(c.date)} · {LEVEL_ASSESSMENT_TYPE_LABEL[c.type] ?? '레벨 평가'} → {levelLabel(c.level)}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Section>

      {((summary.writing.graded.current ?? 0) > 0 || summary.writing.errorTypes.length > 0) && (
        <Section title="쓰기 채점 주요 오류">
          <div className="rounded-xl border border-gray-200 bg-white px-3 py-3 space-y-2">
            <p className="text-xs text-gray-500">
              채점된 글 {summary.writing.graded.current ?? 0}편 (직전 {summary.writing.graded.previous ?? 0}편)
            </p>
            {summary.writing.errorTypes.length === 0 ? (
              <p className="text-sm text-gray-700">발견된 오류가 없습니다.</p>
            ) : (
              <ul className="space-y-1">
                {summary.writing.errorTypes.map((e) => (
                  <li key={e.type} className="flex items-center justify-between text-sm">
                    <span className="text-gray-900">{WRITING_ERROR_TYPE_LABEL[e.type]}</span>
                    <span className="tabular-nums text-gray-700">
                      {e.current}건 <span className="text-xs text-gray-500">(직전 {e.previous}건)</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Section>
      )}
    </div>
  )
}
