// 퇴원 위험 신호 · 퇴원 처리 — 라벨·설정·사유 문장 (클라이언트/서버 공용 — 서버 전용 import 금지)
//
// 위험 신호는 AI 없이 규칙으로만 판정한다 (상담 시 "왜 위험인지" 설명할 수 있어야 하므로).

export type RiskLevelValue = 'NORMAL' | 'WATCH' | 'RISK'

export const RISK_LEVEL_LABEL: Record<RiskLevelValue, string> = {
  NORMAL: '정상',
  WATCH: '주의',
  RISK: '위험',
}

export const RISK_LEVEL_BADGE: Record<RiskLevelValue, string> = {
  NORMAL: 'bg-gray-100 text-gray-700',
  WATCH: 'bg-accent-gold-light text-[#9A6B00]',
  RISK: 'bg-accent-red-light text-accent-red',
}

/** 해당 기준이 이 개수 이상이면 RISK, 1개면 WATCH */
export const RISK_MIN_COUNT = 2

/** 학습일수·정답률 비교 기간 (최근 N일 vs 직전 N일) */
export const RISK_WINDOW_DAYS = 14

/** 정답률 비교 시 각 기간 최소 풀이 문항 수 (이보다 적으면 판정 제외) */
export const RISK_MIN_ANSWERS = 10
/** 학습일수 감소 비교 시 직전 기간 최소 학습일 (원래 거의 안 하던 학생은 제외) */
export const RISK_MIN_BASE_STUDY_DAYS = 2

export type RiskCriterionKey = 'INACTIVE' | 'STUDY_DROP' | 'ACCURACY_DROP'

export const RISK_CRITERION_KEYS: RiskCriterionKey[] = ['INACTIVE', 'STUDY_DROP', 'ACCURACY_DROP']

export const RISK_CRITERION_LABEL: Record<RiskCriterionKey, string> = {
  INACTIVE: '연속 미학습',
  STUDY_DROP: '학습일수 감소',
  ACCURACY_DROP: '정답률 하락',
}

// ─── 설정 (settingsJson.consultation.risk — 본원·지점 공통) ─────────────────────

export type RiskSettings = {
  enabled: Record<RiskCriterionKey, boolean>
  /** 최근 N일 연속 미학습 */
  inactiveDays: number
  /** 최근 14일 학습일수가 직전 14일 대비 N% 이상 감소 */
  studyDropPct: number
  /** 최근 14일 정답률이 직전 14일 대비 N%p 이상 하락 */
  accuracyDropPp: number
}

export const RISK_INACTIVE_DAY_OPTIONS = [3, 5, 7, 10, 14]
export const RISK_STUDY_DROP_OPTIONS = [30, 40, 50, 60, 70]
export const RISK_ACCURACY_DROP_OPTIONS = [5, 10, 15, 20, 25]

export const DEFAULT_RISK_SETTINGS: RiskSettings = {
  enabled: { INACTIVE: true, STUDY_DROP: true, ACCURACY_DROP: true },
  inactiveDays: 7,
  studyDropPct: 50,
  accuracyDropPp: 15,
}

function asObject(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null
}

function pick(v: unknown, options: number[], fallback: number): number {
  return typeof v === 'number' && options.includes(v) ? v : fallback
}

/** settingsJson.consultation.risk (없는 값·잘못된 값은 기본값) */
export function readRiskSettings(settingsJson: unknown): RiskSettings {
  const raw = asObject(asObject(asObject(settingsJson)?.consultation)?.risk)
  const d = DEFAULT_RISK_SETTINGS
  if (!raw) return { ...d, enabled: { ...d.enabled } }
  const rawEnabled = asObject(raw.enabled) ?? {}
  const enabled = { ...d.enabled }
  for (const key of RISK_CRITERION_KEYS) {
    if (typeof rawEnabled[key] === 'boolean') enabled[key] = rawEnabled[key] as boolean
  }
  return {
    enabled,
    inactiveDays: pick(raw.inactiveDays, RISK_INACTIVE_DAY_OPTIONS, d.inactiveDays),
    studyDropPct: pick(raw.studyDropPct, RISK_STUDY_DROP_OPTIONS, d.studyDropPct),
    accuracyDropPp: pick(raw.accuracyDropPp, RISK_ACCURACY_DROP_OPTIONS, d.accuracyDropPp),
  }
}

export function isValidRiskSettings(s: RiskSettings): boolean {
  return (
    RISK_INACTIVE_DAY_OPTIONS.includes(s.inactiveDays) &&
    RISK_STUDY_DROP_OPTIONS.includes(s.studyDropPct) &&
    RISK_ACCURACY_DROP_OPTIONS.includes(s.accuracyDropPp) &&
    RISK_CRITERION_KEYS.every((k) => typeof s.enabled[k] === 'boolean')
  )
}

// ─── 판정 결과 (StudentRiskSnapshot.reasons) ──────────────────────────────────

export type RiskReasonItem =
  | {
      key: 'INACTIVE'
      /** 마지막 학습일부터 오늘까지 일수 */
      days: number
      /** 등록 후 학습 기록이 한 번도 없음 */
      never: boolean
    }
  | { key: 'STUDY_DROP'; current: number; previous: number; dropPct: number }
  | { key: 'ACCURACY_DROP'; current: number; previous: number; dropPp: number }

/** 판정에서 제외된 이유 */
export type RiskSkipReason =
  | 'DISABLED' // 학원 설정에서 끔
  | 'TOO_NEW' // 등록 후 비교 기간(28일)이 지나지 않음
  | 'LOW_BASE' // 직전 기간 학습일이 너무 적음
  | 'LOW_DATA' // 풀이 문항 수 부족

export const RISK_SKIP_LABEL: Record<RiskSkipReason, string> = {
  DISABLED: '설정에서 사용 안 함',
  TOO_NEW: '등록 후 28일 미만',
  LOW_BASE: '직전 기간 학습 기록 부족',
  LOW_DATA: '풀이 문항 수 부족',
}

export type RiskReasons = {
  version: 1
  items: RiskReasonItem[]
  skipped: { key: RiskCriterionKey; why: RiskSkipReason }[]
  /** 계산 당시 기준값 (설정이 바뀌어도 당시 판정을 설명할 수 있게) */
  settings: RiskSettings
}

export function parseRiskReasons(v: unknown): RiskReasons | null {
  const o = asObject(v)
  if (!o || o.version !== 1 || !Array.isArray(o.items)) return null
  return o as unknown as RiskReasons
}

function round1(n: number): string {
  return String(Math.round(n * 10) / 10)
}

/** 사유 → 상담 화면용 문장 ("7일째 학습하지 않음" 등) */
export function riskReasonText(item: RiskReasonItem): string {
  switch (item.key) {
    case 'INACTIVE':
      return item.never ? `등록 후 ${item.days}일째 학습 기록 없음` : `${item.days}일째 학습하지 않음`
    case 'STUDY_DROP':
      return `최근 ${RISK_WINDOW_DAYS}일 학습일 ${item.current}일 — 직전 ${RISK_WINDOW_DAYS}일(${item.previous}일)보다 ${item.dropPct}% 감소`
    case 'ACCURACY_DROP':
      return `최근 ${RISK_WINDOW_DAYS}일 정답률 ${round1(item.current)}% — 직전 ${RISK_WINDOW_DAYS}일(${round1(item.previous)}%)보다 ${round1(item.dropPp)}%p 하락`
  }
}

/** 배지 툴팁 등 한 줄 요약 */
export function riskReasonSummary(reasons: RiskReasons | null): string {
  if (!reasons || reasons.items.length === 0) return ''
  return reasons.items.map(riskReasonText).join(' / ')
}

// ─── 퇴원 처리 ─────────────────────────────────────────────────────────────────

export type WithdrawalReasonValue =
  | 'PRICE'
  | 'SCHEDULE'
  | 'OTHER_ACADEMY'
  | 'MOVE'
  | 'LOW_SATISFACTION'
  | 'STUDY_BREAK'
  | 'OTHER'

export const WITHDRAWAL_REASON_LABEL: Record<WithdrawalReasonValue, string> = {
  PRICE: '비용',
  SCHEDULE: '시간',
  OTHER_ACADEMY: '타 학원',
  MOVE: '이사',
  LOW_SATISFACTION: '만족도',
  STUDY_BREAK: '학업 중단',
  OTHER: '기타',
}

export const WITHDRAWAL_REASON_KEYS = Object.keys(WITHDRAWAL_REASON_LABEL) as WithdrawalReasonValue[]

export function isWithdrawalReason(v: unknown): v is WithdrawalReasonValue {
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(WITHDRAWAL_REASON_LABEL, v)
}
