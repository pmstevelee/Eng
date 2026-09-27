// 출결 날짜·시각 헬퍼 — 모든 날짜 키는 KST 기준 'YYYY-MM-DD' (서버·클라이언트 공용)

const KST_OFFSET_MS = 9 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

const DATE_KEY_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/
const MONTH_KEY_RE = /^\d{4}-(0[1-9]|1[0-2])$/

export function isDateKey(value: string | undefined | null): value is string {
  return !!value && DATE_KEY_RE.test(value) && !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime())
}

export function isMonthKey(value: string | undefined | null): value is string {
  return !!value && MONTH_KEY_RE.test(value)
}

/** 현재 KST 날짜 */
export function todayKst(nowMs: number = Date.now()): string {
  return new Date(nowMs + KST_OFFSET_MS).toISOString().slice(0, 10)
}

/** 시각 → KST 날짜 키 */
export function toKstDateKey(value: string | Date): string {
  return new Date(new Date(value).getTime() + KST_OFFSET_MS).toISOString().slice(0, 10)
}

/** @db.Date 컬럼에 넣을 값 (UTC 자정) */
export function dbDate(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00.000Z`)
}

/** @db.Date 컬럼 값 → 날짜 키 */
export function fromDbDate(value: Date): string {
  return value.toISOString().slice(0, 10)
}

/** 날짜 키 + "HH:mm"(KST) → 시각 */
export function kstDateTime(dateKey: string, hhmm: string): Date {
  return new Date(`${dateKey}T${hhmm}:00+09:00`)
}

export function addDays(dateKey: string, days: number): string {
  return new Date(dbDate(dateKey).getTime() + days * DAY_MS).toISOString().slice(0, 10)
}

/** 0=일 ~ 6=토 */
export function dayOfWeekOf(dateKey: string): number {
  return dbDate(dateKey).getUTCDay()
}

/** 'YYYY-MM' → 해당 월 1일·말일 날짜 키 */
export function monthRange(monthKey: string): { first: string; last: string } {
  const [y, m] = monthKey.split('-').map(Number)
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return { first: `${monthKey}-01`, last: `${monthKey}-${String(lastDay).padStart(2, '0')}` }
}

export function addMonths(monthKey: string, months: number): string {
  const [y, m] = monthKey.split('-').map(Number)
  const total = y * 12 + (m - 1) + months
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`
}

/** 날짜 키의 월 1일 0시(KST) — 퇴원생 명단 포함 기준 */
export function kstMonthStart(dateKey: string): Date {
  return new Date(`${dateKey.slice(0, 7)}-01T00:00:00+09:00`)
}

const TIME_FMT = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

/** ISO → "HH:mm" (KST) */
export function formatKstTime(iso: string | null | undefined): string {
  if (!iso) return ''
  return TIME_FMT.format(new Date(iso))
}

const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토']

/** '2026-09-27' → '9월 27일 (일)' */
export function formatDateLabel(dateKey: string): string {
  const [, m, d] = dateKey.split('-').map(Number)
  return `${m}월 ${d}일 (${WEEKDAY[dayOfWeekOf(dateKey)]})`
}
