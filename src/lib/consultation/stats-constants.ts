// 상담 통계 — 기간 파싱·지표 정의·결과 타입 (클라이언트/서버 공용 — 서버 전용 import 금지)

import { addDaysToDateKey, addMonthsToDateKey, isDateKey, todayKst } from './constants'
import type { LostReasonValue } from './constants'
import type { WithdrawalReasonValue } from './risk-constants'

export type StatsPeriodPreset = 'this_month' | 'last_month' | 'last_3_months' | 'this_year' | 'custom'

export const STATS_PERIOD_LABEL: Record<StatsPeriodPreset, string> = {
  this_month: '이번 달',
  last_month: '지난 달',
  last_3_months: '최근 3개월',
  this_year: '올해',
  custom: '직접 선택',
}

export const STATS_PERIOD_PRESETS = Object.keys(STATS_PERIOD_LABEL) as StatsPeriodPreset[]

export const DEFAULT_STATS_PERIOD: StatsPeriodPreset = 'last_3_months'

/** 직접 선택 최대 범위 (월별 차트 막대 수 제한) */
export const STATS_MAX_MONTHS = 36

/** 조회 기간 — from·to 모두 KST 날짜(포함) */
export type StatsRange = { preset: StatsPeriodPreset; from: string; to: string }

function monthStart(date: string): string {
  return `${date.slice(0, 7)}-01`
}

/** URL 파라미터 → 조회 기간. 잘못된 값은 기본 기간으로 */
export function parseStatsRange(
  period: string | undefined,
  fromParam: string | undefined,
  toParam: string | undefined,
  today: string = todayKst(),
): StatsRange {
  const preset = (STATS_PERIOD_PRESETS as string[]).includes(period ?? '')
    ? (period as StatsPeriodPreset)
    : DEFAULT_STATS_PERIOD

  switch (preset) {
    case 'this_month':
      return { preset, from: monthStart(today), to: today }
    case 'last_month': {
      const from = addMonthsToDateKey(monthStart(today), -1)
      return { preset, from, to: addDaysToDateKey(monthStart(today), -1) }
    }
    case 'last_3_months':
      return { preset, from: addMonthsToDateKey(monthStart(today), -2), to: today }
    case 'this_year':
      return { preset, from: `${today.slice(0, 4)}-01-01`, to: today }
    case 'custom': {
      if (!isDateKey(fromParam) || !isDateKey(toParam)) {
        return parseStatsRange(DEFAULT_STATS_PERIOD, undefined, undefined, today)
      }
      let [from, to] = fromParam <= toParam ? [fromParam, toParam] : [toParam, fromParam]
      // 너무 긴 기간은 종료일 기준으로 자름
      const minFrom = addMonthsToDateKey(monthStart(to), -(STATS_MAX_MONTHS - 1))
      if (from < minFrom) from = minFrom
      if (to > today) to = today < from ? from : today
      return { preset, from, to }
    }
  }
}

/** 기간에 포함된 월 목록 (YYYY-MM) */
export function monthsInRange(range: StatsRange): string[] {
  const out: string[] = []
  let cur = monthStart(range.from)
  const last = range.to.slice(0, 7)
  while (cur.slice(0, 7) <= last && out.length < STATS_MAX_MONTHS + 1) {
    out.push(cur.slice(0, 7))
    cur = addMonthsToDateKey(cur, 1)
  }
  return out
}

/** 2026-09 → 26.9월 */
export function formatMonthLabel(month: string): string {
  return `${month.slice(2, 4)}.${Number(month.slice(5, 7))}월`
}

// ─── 지표 정의 (화면 툴팁에 그대로 표시 — 계산 기준을 바꾸면 여기도 함께 수정) ─────────

export const STATS_DEFINITION = {
  newLeads: '조회 기간에 새로 생성된 문의 수입니다.',
  conversionRate:
    '조회 기간에 생성된 문의 중 현재 상태가 "등록"인 비율입니다. (문의 생성 시점 기준 코호트 — 나중에 등록되면 해당 기간 수치가 올라갑니다)',
  avgDaysToEnroll:
    '조회 기간에 생성되어 현재 "등록" 상태인 문의의 문의 생성일부터 등록 처리일(처음 "등록"으로 변경된 날)까지 평균 일수입니다.',
  noShowRate:
    '조회 기간에 예정됐던 상담 예약 중 "노쇼" 비율입니다. 결과가 확정된 예약(완료+노쇼)만 계산하며, 취소·아직 처리 전인 예약은 제외합니다.',
  monthly:
    '막대: 해당 월에 생성된 문의 수 / 선: 해당 월에 등록 처리된 문의 수 (문의 생성 월과 무관하게 등록 처리일 기준)',
  funnel:
    '조회 기간에 생성된 문의 기준. 상담완료 = 상담 기록이 있거나 상담완료·등록대기 상태를 거친 문의, 레벨테스트 완료 = 비회원 레벨테스트를 끝낸 문의, 등록 = 현재 등록 상태. 뒤 단계에 도달한 문의(예: 레벨테스트 없이 등록)는 앞 단계도 통과한 것으로 셉니다. 전환율은 바로 앞 단계 대비 비율입니다.',
  channel: '조회 기간에 생성된 문의의 문의 채널별 수와 등록 전환율(현재 등록 상태 비율)입니다.',
  source: '조회 기간에 생성된 문의의 유입경로(자유 입력값)별 수와 등록 전환율입니다. 입력하지 않은 문의는 "미입력"으로 묶습니다.',
  assignee:
    '담당 문의 = 조회 기간에 생성된 문의 중 해당 담당자에게 배정된 수, 문의 상담 = 조회 기간에 작성한 문의 상담 기록 수, 재원생 상담 = 조회 기간에 작성한 재원생 상담 기록 수, 등록 = 담당 문의 중 현재 등록 상태, 전환율 = 등록 ÷ 담당 문의.',
  lostReason: '조회 기간에 생성된 문의 중 현재 "이탈" 상태인 문의의 이탈 사유 분포입니다.',
  withdrawalReason: '조회 기간에 퇴원일이 있는 퇴원 처리 기록의 사유 분포입니다. (퇴원 처리 화면에서 사유를 기록한 경우만 포함)',
  monthlyWithdrawal: '퇴원 처리 화면에서 기록한 퇴원일 기준 월별 퇴원 학생 수입니다.',
  risk: '현재 재원 중인 학생의 최근 퇴원 위험 계산 결과입니다. (기간 필터와 무관)',
} as const

// ─── 결과 타입 ────────────────────────────────────────────────────────────────

export type RateRow = { key: string; label: string; total: number; enrolled: number }

export type AssigneeStatsRow = {
  userId: string | null
  name: string
  leads: number
  leadConsultations: number
  studentConsultations: number
  enrolled: number
}

export type FunnelStep = { key: 'lead' | 'consulted' | 'tested' | 'enrolled'; label: string; count: number }

export type ConsultationStats = {
  range: StatsRange
  kpi: {
    newLeads: number
    enrolled: number
    /** 등록 문의 중 소요일 계산 가능한 건 기준 평균 (없으면 null) */
    avgDaysToEnroll: number | null
    appointmentsDecided: number
    noShows: number
  }
  monthly: { month: string; leads: number; enrolled: number; withdrawals: number }[]
  funnel: FunnelStep[]
  channels: RateRow[]
  sources: RateRow[]
  /** 학원장만 (교사는 null) */
  assignees: AssigneeStatsRow[] | null
  lostReasons: { key: LostReasonValue | 'NONE'; label: string; count: number }[]
  withdrawalReasons: { key: WithdrawalReasonValue | 'NONE'; label: string; count: number }[]
  risk: { watch: number; risk: number; calculated: boolean }
}

/** 비율 (분모 0이면 null) */
export function ratio(n: number, d: number): number | null {
  return d > 0 ? n / d : null
}

/** 0.4567 → "45.7%" / null → "-" */
export function formatPercent(v: number | null): string {
  return v === null ? '-' : `${(Math.round(v * 1000) / 10).toFixed(1)}%`
}
