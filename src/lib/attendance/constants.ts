// 출결관리 공용 상수·헬퍼 (서버·클라이언트 공용)

export type AttendanceModeValue = 'CLASS' | 'ACADEMY'

export const ATTENDANCE_MODE_LABEL: Record<AttendanceModeValue, { title: string; description: string }> = {
  ACADEMY: { title: '원 출결', description: '학원에 오고 가는 시각을 기록합니다. (등원 · 하원)' },
  CLASS: { title: '반 출결', description: '수업마다 출석을 체크하고 수업 종료 처리를 합니다.' },
}

export const LATE_GRACE_MIN = 0
export const LATE_GRACE_MAX = 60

export type AttendanceSettingValues = {
  mode: AttendanceModeValue
  lateGraceMinutes: number
  autoAbsentOnEnd: boolean
  notifyCheckIn: boolean
  notifyCheckOut: boolean
  notifyAbsent: boolean
  includeStudySummary: boolean
}

/** 0=일 ~ 6=토 */
export const DAY_OF_WEEK_LABEL = ['일', '월', '화', '수', '목', '금', '토'] as const
/** 화면 표시 순서: 월~일 */
export const DAY_OF_WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0] as const

export type ClassScheduleRow = { dayOfWeek: number; startTime: string; endTime: string }

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

export function isValidTime(value: string): boolean {
  return TIME_RE.test(value)
}

/** 시간표 행 검증 — 문제가 있으면 한국어 에러 메시지 */
export function validateScheduleRow(row: ClassScheduleRow): string | null {
  if (!Number.isInteger(row.dayOfWeek) || row.dayOfWeek < 0 || row.dayOfWeek > 6) return '요일을 선택해주세요.'
  if (!isValidTime(row.startTime) || !isValidTime(row.endTime)) return '시작·종료 시각을 입력해주세요.'
  // "HH:mm" 고정 길이라 문자열 비교로 시각 비교 가능
  if (row.endTime <= row.startTime) return '종료 시각은 시작 시각보다 늦어야 합니다.'
  return null
}

// ─── 학부모 연락처 · 키패드 번호 ───────────────────────────────────────────────

/** 학부모 휴대폰: 010으로 시작하는 11자리 (숫자만) */
export function isValidParentMobile(digits: string): boolean {
  return /^010\d{8}$/.test(digits)
}

/** 키패드 번호 = 학부모 연락처 뒷 4자리 (연락처가 없거나 짧으면 null) */
export function keypadCodeFor(parentPhone: string | null | undefined): string | null {
  const digits = (parentPhone ?? '').replace(/\D/g, '')
  return digits.length >= 4 ? digits.slice(-4) : null
}
