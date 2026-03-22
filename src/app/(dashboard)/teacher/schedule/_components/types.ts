// ─── 공유 타입 & 유틸리티 ─────────────────────────────────────────────────────

/** 반의 schedule_json 배열 아이템 형식
 * { "day": 1, "startTime": "14:00", "endTime": "16:00", "room": "A실" }
 * day: JS Date.getDay() 규칙 → 0=일, 1=월, 2=화, 3=수, 4=목, 5=금, 6=토
 */
export type ScheduleItem = {
  day: number
  startTime: string // "HH:mm"
  endTime: string   // "HH:mm"
  room?: string
}

export type ClassData = {
  id: string
  name: string
  levelRange: string | null
  scheduleJson: unknown
  studentCount: number
}

export type TestEvent = {
  id: string
  title: string
  type: string
  classId: string | null
  createdAt: string // ISO string
}

export type PersonalEvent = {
  id: string
  title: string
  date: string      // "YYYY-MM-DD"
  startTime: string // "HH:mm" (빈 문자열이면 종일)
  endTime: string   // "HH:mm"
  memo: string
  type: 'CLASS' | 'TEST' | 'MEETING' | 'OTHER'
  repeat: 'NONE' | 'WEEKLY' | 'MONTHLY'
}

// ─── 반 색상 팔레트 (최대 6개, 이후 순환) ─────────────────────────────────────
export const CLASS_COLORS = [
  { bg: '#1865F2', light: '#EEF4FF', text: '#1865F2' }, // primary-700 / primary-100
  { bg: '#7854F7', light: '#F3EFFF', text: '#7854F7' }, // accent-purple / accent-purple-light
  { bg: '#0FBFAD', light: '#E6FAF8', text: '#0B8A81' }, // accent-teal / accent-teal-light
  { bg: '#E35C20', light: '#FEF0E8', text: '#B34619' }, // domain-writing
  { bg: '#1FAF54', light: '#E6F7ED', text: '#147D3A' }, // accent-green / accent-green-light
  { bg: '#FFB100', light: '#FFF8E6', text: '#B37D00' }, // accent-gold / accent-gold-light
] as const

// ─── 개인 일정 유형별 색상 ─────────────────────────────────────────────────────
export const EVENT_TYPE_COLORS: Record<PersonalEvent['type'], { bg: string; light: string; text: string }> = {
  CLASS:   { bg: '#1865F2', light: '#EEF4FF', text: '#1865F2' },
  TEST:    { bg: '#FFB100', light: '#FFF8E6', text: '#B37D00' },
  MEETING: { bg: '#7854F7', light: '#F3EFFF', text: '#7854F7' },
  OTHER:   { bg: '#6B7280', light: '#F0F1F3', text: '#3B3E48' },
}

export const EVENT_TYPE_LABELS: Record<PersonalEvent['type'], string> = {
  CLASS:   '수업',
  TEST:    '테스트',
  MEETING: '회의',
  OTHER:   '기타',
}

export const REPEAT_LABELS: Record<PersonalEvent['repeat'], string> = {
  NONE:    '없음',
  WEEKLY:  '매주',
  MONTHLY: '매월',
}

export const TEST_TYPE_LABELS: Record<string, string> = {
  LEVEL_TEST: '레벨테스트',
  UNIT_TEST:  '단원평가',
  PRACTICE:   '연습테스트',
}

// ─── 유틸리티 ─────────────────────────────────────────────────────────────────

/** schedule_json (unknown) → ScheduleItem[] 파싱 (유효하지 않으면 빈 배열) */
export function parseScheduleJson(json: unknown): ScheduleItem[] {
  if (!Array.isArray(json)) return []
  return (json as unknown[]).filter((item): item is ScheduleItem => {
    if (typeof item !== 'object' || item === null) return false
    const o = item as Record<string, unknown>
    return (
      typeof o.day === 'number' &&
      typeof o.startTime === 'string' &&
      typeof o.endTime === 'string'
    )
  })
}

/** Date → "YYYY-MM-DD" */
export function formatDateStr(date: Date): string {
  return (
    `${date.getFullYear()}-` +
    `${String(date.getMonth() + 1).padStart(2, '0')}-` +
    `${String(date.getDate()).padStart(2, '0')}`
  )
}

/** "HH:mm" → 총 분 */
export function timeToMinutes(time: string): number {
  const parts = time.split(':')
  return Number(parts[0]) * 60 + Number(parts[1] ?? '0')
}

/** 해당 날짜의 주 월요일을 반환 */
export function getWeekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay() // 0=일
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

/** 개인 일정이 특정 날짜(Date)에 해당하는지 판단 */
export function personalEventMatchesDate(event: PersonalEvent, date: Date): boolean {
  const dateStr = formatDateStr(date)
  if (event.repeat === 'NONE') return event.date === dateStr
  if (event.repeat === 'WEEKLY') {
    return new Date(event.date).getDay() === date.getDay()
  }
  // MONTHLY: 같은 날짜(일)
  return new Date(event.date).getDate() === date.getDate()
}
