'use client'

import { useEffect, useRef, useState } from 'react'
import { Printer, Sparkles, Loader2, RefreshCw } from 'lucide-react'
import type {
  TestResultReportData,
  TestReportNarrative,
  TestResultReportSnapshot,
  DomainReportStat,
  ReportDomainKey,
} from '@/lib/reports/test-result-report'

const DOMAIN_LABEL: Record<ReportDomainKey, string> = {
  GRAMMAR: '문법',
  VOCABULARY: '어휘',
  READING: '독해',
  WRITING: '쓰기',
  LISTENING: '듣기',
}

const DOMAIN_COLOR: Record<ReportDomainKey, string> = {
  GRAMMAR: '#1865F2',
  VOCABULARY: '#7854F7',
  READING: '#0FBFAD',
  WRITING: '#E35C20',
  LISTENING: '#E91E8A',
}

const DOMAIN_NARRATIVE_KEY: Record<ReportDomainKey, keyof TestReportNarrative['domainComments']> = {
  GRAMMAR: 'grammar',
  VOCABULARY: 'vocabulary',
  READING: 'reading',
  WRITING: 'writing',
  LISTENING: 'listening',
}

const TEST_TYPE_LABEL: Record<string, string> = {
  LEVEL_TEST: '레벨 테스트',
  UNIT_TEST: '단원 테스트',
  PRACTICE: '연습 테스트',
}

function formatDuration(sec: number | null): string {
  if (sec === null) return '—'
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  if (h > 0) return `${h}시간 ${m}분 ${s}초`
  if (m > 0) return `${m}분 ${s}초`
  return `${s}초`
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

// ── 차트 (인라인 SVG) ─────────────────────────────────────────────────────────

function LevelDonut({ level }: { level: number }) {
  const r = 62
  const c = 2 * Math.PI * r
  const ratio = Math.max(0.04, Math.min(1, level / 10))
  return (
    <svg viewBox="0 0 160 160" className="h-40 w-40">
      <circle cx="80" cy="80" r={r} fill="none" stroke="#E5E7EB" strokeWidth="16" />
      <circle
        cx="80"
        cy="80"
        r={r}
        fill="none"
        stroke="#1865F2"
        strokeWidth="16"
        strokeLinecap="round"
        strokeDasharray={`${c * ratio} ${c * (1 - ratio)}`}
        transform="rotate(-90 80 80)"
      />
      <text x="80" y="88" textAnchor="middle" fontSize="30" fontWeight="700" fill="#1865F2">
        Lv. {level}
      </text>
    </svg>
  )
}

function RadarChart({ domains }: { domains: DomainReportStat[] }) {
  const items = domains.filter((d) => d.score !== null)
  if (items.length < 3) return null
  const cx = 130
  const cy = 120
  const R = 78
  const n = items.length

  function point(i: number, ratio: number): [number, number] {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / n
    return [cx + R * ratio * Math.cos(angle), cy + R * ratio * Math.sin(angle)]
  }
  function polygon(ratio: number): string {
    return items.map((_, i) => point(i, ratio).join(',')).join(' ')
  }
  const dataPoints = items
    .map((d, i) => point(i, Math.max(0.05, (d.score ?? 0) / 100)).join(','))
    .join(' ')

  return (
    <svg viewBox="0 0 260 240" className="h-52 w-64">
      {[0.25, 0.5, 0.75, 1].map((ratio) => (
        <polygon key={ratio} points={polygon(ratio)} fill="none" stroke="#E5E7EB" strokeWidth="1" />
      ))}
      {items.map((_, i) => {
        const [x, y] = point(i, 1)
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#E5E7EB" strokeWidth="1" />
      })}
      <polygon points={dataPoints} fill="#1865F2" fillOpacity="0.12" stroke="#1865F2" strokeWidth="2" />
      {items.map((d, i) => {
        const [x, y] = point(i, Math.max(0.05, (d.score ?? 0) / 100))
        return <circle key={i} cx={x} cy={y} r="3.5" fill="#1865F2" />
      })}
      {items.map((d, i) => {
        const [x, y] = point(i, 1.22)
        return (
          <text
            key={i}
            x={x}
            y={y + 4}
            textAnchor="middle"
            fontSize="12"
            fontWeight="600"
            fill="#4B5563"
          >
            {DOMAIN_LABEL[d.domain]}
          </text>
        )
      })}
    </svg>
  )
}

function ScoreHistogram({ stats }: { stats: TestResultReportData }) {
  const maxCount = Math.max(1, ...stats.distribution.map((b) => b.count))
  const barW = 40
  const gap = 14
  const chartH = 120
  const width = stats.distribution.length * (barW + gap) + gap
  return (
    <svg viewBox={`0 0 ${width} ${chartH + 40}`} className="w-full max-w-2xl">
      {stats.distribution.map((b, i) => {
        const h = Math.max(2, (b.count / maxCount) * chartH)
        const x = gap + i * (barW + gap)
        const y = chartH - h + 10
        return (
          <g key={b.label}>
            <rect
              x={x}
              y={y}
              width={barW}
              height={h}
              rx="3"
              fill={b.isMine ? '#1865F2' : '#E5E7EB'}
            />
            {b.count > 0 && (
              <text
                x={x + barW / 2}
                y={y - 3}
                textAnchor="middle"
                fontSize="10"
                fill={b.isMine ? '#1865F2' : '#9CA3AF'}
                fontWeight={b.isMine ? 700 : 400}
              >
                {b.count}
              </text>
            )}
            <text
              x={x + barW / 2}
              y={chartH + 24}
              textAnchor="middle"
              fontSize="9"
              fill="#6B7280"
            >
              {b.label}
            </text>
            {b.isMine && (
              <text
                x={x + barW / 2}
                y={chartH + 36}
                textAnchor="middle"
                fontSize="9"
                fontWeight="700"
                fill="#1865F2"
              >
                내 위치
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

function CompareBars({
  rows,
}: {
  rows: Array<{ label: string; mine: number | null; peer: number | null; color: string }>
}) {
  const valid = rows.filter((r) => r.mine !== null || r.peer !== null)
  if (valid.length === 0) return null
  return (
    <div className="space-y-3">
      {valid.map((r) => (
        <div key={r.label}>
          <p className="mb-1 text-xs font-semibold text-gray-600">{r.label}</p>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="h-4 flex-1 rounded-sm bg-gray-100">
                <div
                  className="flex h-full items-center justify-end rounded-sm pr-1.5"
                  style={{ width: `${Math.max(3, r.mine ?? 0)}%`, backgroundColor: r.color }}
                >
                  <span className="text-[10px] font-bold text-white">{r.mine ?? '—'}%</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-4 flex-1 rounded-sm bg-gray-100">
                <div
                  className="flex h-full items-center justify-end rounded-sm bg-gray-400 pr-1.5"
                  style={{ width: `${Math.max(3, r.peer ?? 0)}%` }}
                >
                  <span className="text-[10px] font-bold text-white">{r.peer ?? '—'}%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}
      <div className="flex items-center gap-4 pt-1 text-[11px] text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: valid[0].color }} />
          나의 정답률
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-gray-400" />
          응시자 평균 정답률
        </span>
      </div>
    </div>
  )
}

// ── 공통 UI ───────────────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h2 className="text-2xl font-bold text-gray-900">{children}</h2>
      <div className="mt-2 h-0.5 w-full bg-gray-900" />
    </div>
  )
}

function SubTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-4 text-base font-bold text-gray-900">{children}</h3>
}

function StatCard({ title, value, sub }: { title: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-gray-200 px-4 py-3 text-center">
      <p className="text-xs font-semibold text-gray-500">{title}</p>
      <p className="mt-1 text-lg font-bold text-[#E35C20]">{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-gray-400">{sub}</p>}
    </div>
  )
}

function NarrativeBox({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-[#1865F2]/15 bg-[#F7F8F9] p-5">
      <p className="text-sm leading-relaxed text-gray-700 whitespace-pre-line">{text}</p>
    </div>
  )
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────────────────────

type Props = {
  stats: TestResultReportData
  savedNarrative: TestReportNarrative | null
  hasSnapshot: boolean
}

export function SessionReportPrint({ stats: initialStats, savedNarrative, hasSnapshot }: Props) {
  const [stats, setStats] = useState(initialStats)
  const [narrative, setNarrative] = useState<TestReportNarrative | null>(savedNarrative)
  const [generating, setGenerating] = useState(false)
  const [aiError, setAiError] = useState('')
  const hasFetched = useRef(false)

  async function generate(force: boolean) {
    setGenerating(true)
    setAiError('')
    try {
      const res = await fetch('/api/ai/generate-test-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: stats.sessionId, force }),
      })
      const json = (await res.json()) as {
        success?: boolean
        data?: TestResultReportSnapshot
        error?: string
      }
      if (json.success && json.data) {
        setStats(json.data.stats)
        setNarrative(json.data.narrative)
      } else {
        setAiError(json.error ?? 'AI 분석 생성에 실패했습니다.')
      }
    } catch {
      setAiError('AI 분석 중 네트워크 오류가 발생했습니다.')
    } finally {
      setGenerating(false)
    }
  }

  useEffect(() => {
    if (hasSnapshot || hasFetched.current) return
    hasFetched.current = true
    void generate(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasSnapshot])

  const hasPeers = stats.peerCount >= 2
  const showDistribution = stats.peerCount >= 3

  // 우선 학습 필요 항목 (취약 항목)
  const weakItems = stats.domains.flatMap((d) =>
    d.subCategories
      .filter(
        (s) =>
          s.myRate < 60 || (s.peerRate !== null && s.myRate < s.peerRate - 10),
      )
      .map((s) => ({ domain: d.domain, subCategory: s.subCategory, myRate: s.myRate })),
  )

  return (
    <div className="bg-gray-100 print:bg-white">
      {/* 화면 전용 툴바 */}
      <div className="print:hidden sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-700">테스트 결과표</span>
          {generating && (
            <span className="flex items-center gap-1 text-xs text-[#7854F7]">
              <Loader2 className="h-3 w-3 animate-spin" />
              AI 분석 생성 중...
            </span>
          )}
          {narrative && !generating && (
            <span className="flex items-center gap-1 rounded-full bg-[#7854F7]/10 px-2 py-0.5 text-xs font-medium text-[#7854F7]">
              <Sparkles className="h-3 w-3" />
              리포트 저장됨
            </span>
          )}
          {aiError && !generating && <span className="text-xs text-[#D92916]">{aiError}</span>}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void generate(true)}
            disabled={generating}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className="h-4 w-4" />
            다시 생성
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 rounded-lg bg-[#1865F2] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1558d6]"
          >
            <Printer className="h-4 w-4" />
            PDF 저장 / 인쇄
          </button>
        </div>
      </div>

      {/* ═══════════ 1. 표지 ═══════════ */}
      <div className="report-page mx-auto flex min-h-[290mm] max-w-[210mm] flex-col bg-white p-8 print:min-h-0">
        <div className="flex flex-1 flex-col rounded-sm border-4 border-[#B08D57]/60 p-2">
          <div className="flex flex-1 flex-col border border-[#B08D57]/60 px-10 py-12">
            <div className="text-right">
              {stats.academyName && (
                <p className="text-sm font-bold text-[#0C2340]">{stats.academyName}</p>
              )}
            </div>

            <div className="mt-24">
              <h1 className="text-6xl font-extrabold tracking-tight">
                <span className="text-[#E35C20]">L</span>
                <span className="text-[#0C2340]">EVEL</span>
              </h1>
              <h1 className="mt-1 text-6xl font-extrabold tracking-tight text-[#0C2340]">REPORT</h1>
              <p className="mt-4 text-lg font-semibold text-[#0C2340]">
                EduLevel English Level Test
              </p>
            </div>

            <div className="mt-auto space-y-6 pb-4">
              <div>
                <p className="text-sm font-bold text-[#E35C20]">테스트 명</p>
                <p className="mt-1 text-lg font-bold text-gray-900">{stats.test.title}</p>
                <p className="text-sm text-gray-500">
                  {TEST_TYPE_LABEL[stats.test.type] ?? stats.test.type}
                  {stats.test.isAdaptive ? ' · 적응형' : ''}
                </p>
              </div>
              <div>
                <p className="text-sm font-bold text-[#E35C20]">응시자 정보</p>
                <div className="mt-1 space-y-0.5 text-base font-semibold text-gray-900">
                  <p>성명 : {stats.student.name}</p>
                  {stats.student.grade && <p>학년 : {stats.student.grade}</p>}
                  {stats.student.className && <p>반 : {stats.student.className}</p>}
                  <p>일자 : {formatDate(stats.completedAt)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════ 2. 종합 ═══════════ */}
      <div className="report-page mx-auto max-w-[210mm] bg-white px-10 py-10">
        <SectionTitle>종합</SectionTitle>
        <SubTitle>평가 결과</SubTitle>

        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <p className="mb-2 text-sm font-bold text-gray-700">종합 레벨</p>
            <LevelDonut level={stats.overallLevel} />
          </div>
          <div>
            <p className="mb-2 text-sm font-bold text-gray-700">항목별 평가</p>
            <RadarChart domains={stats.domains} />
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-3">
            <div className="rounded-xl border border-gray-200 p-4 text-center">
              <p className="text-sm font-bold text-gray-700">종합 수준</p>
              <p className="mt-1 text-xl font-bold text-[#E35C20]">
                {stats.overallNameKo}{' '}
                <span className="text-base font-semibold text-gray-500">({stats.overallCefr})</span>
              </p>
            </div>
            {hasPeers && stats.overallRankPercent !== null && (
              <div className="rounded-xl border border-gray-200 p-4 text-center">
                <p className="text-sm font-bold text-gray-700">
                  동일 테스트 응시자({stats.peerCount}명) 대비 석차
                </p>
                <p className="mt-1 text-xl font-bold text-[#E35C20]">
                  상위 {stats.overallRankPercent}%
                </p>
              </div>
            )}
            {stats.totalScore !== null && (
              <div className="rounded-xl border border-gray-200 p-4 text-center">
                <p className="text-sm font-bold text-gray-700">종합 점수</p>
                <p className="mt-1 text-xl font-bold text-[#1865F2]">
                  {stats.totalScore}점
                  <span className="ml-1 text-sm font-normal text-gray-400">/ 100점</span>
                </p>
              </div>
            )}
          </div>

          <table className="w-full self-start border-t-2 border-gray-900 text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-gray-500">
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase">영역</th>
                <th className="px-3 py-2 text-right text-xs font-semibold uppercase">점수</th>
                <th className="px-3 py-2 text-right text-xs font-semibold uppercase">수준</th>
              </tr>
            </thead>
            <tbody>
              {stats.domains.map((d) => (
                <tr key={d.domain} className="border-b border-gray-100">
                  <td className="px-3 py-2 font-semibold text-gray-700">
                    <span
                      className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: DOMAIN_COLOR[d.domain] }}
                    />
                    {DOMAIN_LABEL[d.domain]}
                  </td>
                  <td className="px-3 py-2 text-right text-gray-700">
                    {d.score !== null ? `${d.score}점` : '—'}
                  </td>
                  <td className="px-3 py-2 text-right font-bold text-[#E35C20]">
                    Lv.{d.level} ({d.cefr})
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {(narrative?.overall || generating) && (
          <div className="mt-6">
            {narrative?.overall ? (
              <NarrativeBox text={narrative.overall} />
            ) : (
              <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 p-5 text-sm text-gray-400 print:hidden">
                <Loader2 className="h-4 w-4 animate-spin" />
                AI 종합 총평을 생성하고 있습니다...
              </div>
            )}
          </div>
        )}
      </div>

      {/* ═══════════ 3. 비교 ═══════════ */}
      {(showDistribution || hasPeers) && (
        <div className="report-page mx-auto max-w-[210mm] bg-white px-10 py-10">
          <SectionTitle>응시자 비교</SectionTitle>

          {showDistribution && (
            <section className="mb-10">
              <SubTitle>동일 테스트 응시자 대비 나의 점수 분포</SubTitle>
              <ScoreHistogram stats={stats} />
              {stats.peerAvgScore !== null && (
                <p className="mt-2 text-xs text-gray-500">
                  응시자 평균 점수: <span className="font-bold text-gray-700">{stats.peerAvgScore}점</span>
                  {stats.totalScore !== null && (
                    <>
                      {' '}
                      · 내 점수: <span className="font-bold text-[#1865F2]">{stats.totalScore}점</span>
                    </>
                  )}
                </p>
              )}
            </section>
          )}

          <section>
            <SubTitle>응시자 대비 소요 시간 비교</SubTitle>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <table className="w-full self-start border-t-2 border-gray-900 text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 text-gray-500">
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase">구분</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold uppercase">나의 시간</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold uppercase">응시자 평균</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-100">
                    <td className="px-3 py-2 font-semibold text-gray-700">전체</td>
                    <td className="px-3 py-2 text-right font-bold text-[#E35C20]">
                      {formatDuration(stats.totalDurationSec)}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-600">
                      {formatDuration(stats.peerAvgDurationSec)}
                    </td>
                  </tr>
                  {stats.domains
                    .filter((d) => d.timeSpentSec !== null)
                    .map((d) => (
                      <tr key={d.domain} className="border-b border-gray-100">
                        <td className="px-3 py-2 font-semibold text-gray-700">
                          {DOMAIN_LABEL[d.domain]} 영역
                        </td>
                        <td className="px-3 py-2 text-right font-bold text-[#E35C20]">
                          {formatDuration(d.timeSpentSec)}
                        </td>
                        <td className="px-3 py-2 text-right text-gray-600">
                          {formatDuration(d.peerAvgTimeSec)}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
              <div className="rounded-xl border border-gray-200 p-5">
                <p className="text-sm font-bold text-gray-700">나의 소요 시간</p>
                <p className="mt-2 text-2xl font-bold text-[#E35C20]">
                  총 {formatDuration(stats.totalDurationSec)}
                </p>
                <div className="mt-3 space-y-1 text-sm text-gray-600">
                  {stats.domains
                    .filter((d) => d.timeSpentSec !== null)
                    .map((d) => (
                      <p key={d.domain}>
                        <span className="font-semibold">{DOMAIN_LABEL[d.domain]}</span> 영역{' '}
                        <span className="font-bold text-[#E35C20]">
                          {formatDuration(d.timeSpentSec)}
                        </span>
                      </p>
                    ))}
                </div>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* ═══════════ 4. 영역별 페이지 ═══════════ */}
      {stats.domains.map((d) => {
        const comment = narrative?.domainComments?.[DOMAIN_NARRATIVE_KEY[d.domain]]
        const benchmark = narrative?.domainBenchmarks?.[DOMAIN_NARRATIVE_KEY[d.domain]]
        return (
          <div key={d.domain} className="report-page mx-auto max-w-[210mm] bg-white px-10 py-10">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900">{DOMAIN_LABEL[d.domain]}</h2>
              <div className="mt-2 h-0.5 w-full" style={{ backgroundColor: DOMAIN_COLOR[d.domain] }} />
            </div>

            {/* 응시 정보 */}
            <section className="mb-8">
              <SubTitle>평가 결과</SubTitle>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatCard
                  title="내 점수"
                  value={d.score !== null ? `${d.score}점` : '—'}
                  sub="/ 100점"
                />
                <StatCard title={`${DOMAIN_LABEL[d.domain]} 수준`} value={`Lv.${d.level}`} sub={`${d.cefr} · ${d.levelNameKo}`} />
                <StatCard
                  title="정답률"
                  value={d.correctRate !== null ? `${d.correctRate}%` : '—'}
                  sub={d.gradedCount > 0 ? `${d.correctCount}/${d.gradedCount}문항` : undefined}
                />
                <StatCard
                  title="응시자 대비 석차"
                  value={d.rankPercent !== null ? `상위 ${d.rankPercent}%` : '—'}
                  sub={d.peerAvgScore !== null ? `평균 ${d.peerAvgScore}점` : undefined}
                />
              </div>
            </section>

            {/* 기준 환산 평가 (문법/듣기/어휘/독해: 수능 기준, 쓰기: 토론토대 기준) */}
            {benchmark && (
              <section className="mb-8 print:break-inside-avoid">
                <SubTitle>기준 환산 평가</SubTitle>
                <div
                  className="rounded-xl border p-5"
                  style={{ borderColor: DOMAIN_COLOR[d.domain] }}
                >
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span
                      className="rounded-full px-3 py-1 text-xs font-semibold text-white"
                      style={{ backgroundColor: DOMAIN_COLOR[d.domain] }}
                    >
                      {benchmark.standard}
                    </span>
                    <span className="text-base font-bold text-gray-900">{benchmark.grade}</span>
                  </div>
                  <p className="text-sm leading-relaxed text-gray-700">{benchmark.comment}</p>
                </div>
              </section>
            )}

            {/* 평가 항목별 역량 */}
            {d.subCategories.length > 0 && (
              <section className="mb-8">
                <SubTitle>평가 항목별 역량</SubTitle>
                <table className="mb-5 w-full border-t-2 border-gray-900 text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50 text-gray-500">
                      <th className="px-3 py-2 text-left text-xs font-semibold uppercase">평가 항목</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold uppercase">나의 정답률</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold uppercase">
                        응시자 평균 정답률
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.subCategories.map((s) => (
                      <tr key={s.subCategory} className="border-b border-gray-100">
                        <td className="px-3 py-2 font-medium text-gray-700">{s.subCategory}</td>
                        <td className="px-3 py-2 text-right font-bold" style={{ color: DOMAIN_COLOR[d.domain] }}>
                          {s.myRate}%
                        </td>
                        <td className="px-3 py-2 text-right text-gray-600">
                          {s.peerRate !== null ? `${s.peerRate}%` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="rounded-xl border border-gray-200 p-5">
                  <p className="mb-3 text-sm font-bold text-gray-700">
                    응시자 대비 나의 평가 항목별 정답률 비교
                  </p>
                  <CompareBars
                    rows={d.subCategories.map((s) => ({
                      label: s.subCategory,
                      mine: s.myRate,
                      peer: s.peerRate,
                      color: DOMAIN_COLOR[d.domain],
                    }))}
                  />
                </div>
              </section>
            )}

            {/* 항목별 세부 역량 (O/X) */}
            {d.oxItems.length > 0 && (
              <section className="mb-8 print:break-inside-avoid">
                <SubTitle>항목별 세부 역량</SubTitle>
                <table className="w-full border-t-2 border-gray-900 text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50 text-gray-500">
                      <th className="px-3 py-2 text-left text-xs font-semibold uppercase">평가 항목</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold uppercase">세부 내용</th>
                      <th className="px-3 py-2 text-center text-xs font-semibold uppercase">O/X</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.oxItems.map((item, i) => (
                      <tr key={i} className="border-b border-gray-100">
                        <td className="whitespace-nowrap px-3 py-1.5 text-xs font-medium text-gray-700">
                          {item.subCategory}
                        </td>
                        <td className="px-3 py-1.5 text-xs text-gray-600">{item.summary}</td>
                        <td className="px-3 py-1.5 text-center">
                          {item.correct === true ? (
                            <span className="font-bold text-[#1FAF54]">O</span>
                          ) : item.correct === false ? (
                            <span className="font-bold text-[#D92916]">X</span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            )}

            {/* AI 총평 */}
            {comment && (
              <section>
                <SubTitle>역량 총평 및 비교</SubTitle>
                <NarrativeBox text={comment} />
              </section>
            )}
          </div>
        )
      })}

      {/* ═══════════ 5. 학습 처방 ═══════════ */}
      {narrative && (
        <div className="report-page mx-auto max-w-[210mm] bg-white px-10 py-10">
          <SectionTitle>학습 처방</SectionTitle>

          {stats.domains.map((d) => {
            const items = narrative.prescriptions?.[DOMAIN_NARRATIVE_KEY[d.domain]]
            if (!items || items.length === 0) return null
            return (
              <section key={d.domain} className="mb-6 print:break-inside-avoid">
                <p className="mb-3 text-base font-bold" style={{ color: DOMAIN_COLOR[d.domain] }}>
                  {DOMAIN_LABEL[d.domain]}
                </p>
                <div className="space-y-2.5">
                  {items.map((text, i) => (
                    <div key={i} className="flex gap-3 rounded-xl border border-gray-200 p-4">
                      <span className="text-sm font-bold text-gray-400">
                        {String(i + 1).padStart(2, '0')}.
                      </span>
                      <p className="text-sm leading-relaxed text-gray-700">{text}</p>
                    </div>
                  ))}
                </div>
              </section>
            )
          })}

          {weakItems.length > 0 && (
            <section className="print:break-inside-avoid">
              <SubTitle>우선 학습이 필요한 항목</SubTitle>
              <p className="mb-3 text-xs text-gray-500">
                아래 항목은 정답률이 낮거나 응시자 평균에 미치지 못한 항목입니다. 우선 학습이
                필요합니다.
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {weakItems.map((w, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  >
                    <span className="text-gray-700">
                      <span
                        className="mr-1.5 rounded px-1.5 py-0.5 text-[10px] font-bold text-white"
                        style={{ backgroundColor: DOMAIN_COLOR[w.domain] }}
                      >
                        {DOMAIN_LABEL[w.domain]}
                      </span>
                      {w.subCategory}
                    </span>
                    <span className="font-bold text-[#D92916]">{w.myRate}%</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* 푸터 */}
          <div className="mt-10 border-t border-gray-200 pt-4 text-center text-xs text-gray-400">
            {stats.academyName && <span>{stats.academyName} · </span>}
            EduLevel LMS · 테스트 결과표 · 생성일 {formatDate(stats.generatedAt)}
          </div>
        </div>
      )}

      <style>{`
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          @page { size: A4; margin: 12mm; }
          .report-page { break-after: page; }
        }
        @media screen {
          .report-page { margin-bottom: 16px; border: 1px solid #E5E7EB; }
        }
      `}</style>
    </div>
  )
}
