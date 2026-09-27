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

// ─── 출결 상태 ─────────────────────────────────────────────────────────────────

export type AttendanceStatusValue =
  | 'PRESENT'
  | 'LATE'
  | 'ABSENT'
  | 'EXCUSED'
  | 'EARLY_LEAVE'
  | 'MAKEUP'
  | 'UNCHECKED'

export type AttendanceSourceValue = 'MANUAL' | 'KEYPAD' | 'AUTO'

/** 상태별 표시 정보 — color는 배지·셀 강조색, symbol은 월간 출석부 기호 */
export const ATTENDANCE_STATUS_META: Record<
  AttendanceStatusValue,
  { label: string; color: string; symbol: string }
> = {
  PRESENT: { label: '출석', color: '#22C55E', symbol: '●' },
  LATE: { label: '지각', color: '#F59E0B', symbol: '▲' },
  ABSENT: { label: '결석', color: '#EF4444', symbol: '✕' },
  EXCUSED: { label: '인정결석', color: '#94A3B8', symbol: '◆' },
  EARLY_LEAVE: { label: '조퇴', color: '#8B5CF6', symbol: '◐' },
  MAKEUP: { label: '보강', color: '#4458F6', symbol: '★' },
  UNCHECKED: { label: '미체크', color: '#BABEC7', symbol: '' },
}

/** 카드 탭 순환: 미체크 → 출석 → 지각 → 결석 → 미체크 (그 외 상태는 미체크로 되돌림) */
export function nextCycleStatus(status: AttendanceStatusValue): AttendanceStatusValue {
  switch (status) {
    case 'UNCHECKED':
      return 'PRESENT'
    case 'PRESENT':
      return 'LATE'
    case 'LATE':
      return 'ABSENT'
    default:
      return 'UNCHECKED'
  }
}

/** 길게 누르기 시트에서 고르는 특수 상태 (사유 입력) */
export const SPECIAL_STATUSES: AttendanceStatusValue[] = ['EXCUSED', 'EARLY_LEAVE', 'MAKEUP']

/** 월간 출석부 팝오버에서 고를 수 있는 상태 */
export const SELECTABLE_STATUSES: AttendanceStatusValue[] = [
  'PRESENT',
  'LATE',
  'ABSENT',
  'EXCUSED',
  'EARLY_LEAVE',
  'MAKEUP',
  'UNCHECKED',
]

/** 등원했다고 볼 수 있는 상태 (체크 시각 기록 대상) */
export function isArrivedStatus(status: AttendanceStatusValue): boolean {
  return status === 'PRESENT' || status === 'LATE' || status === 'MAKEUP' || status === 'EARLY_LEAVE'
}

export type AttendanceCounts = Record<AttendanceStatusValue, number>

export function emptyCounts(): AttendanceCounts {
  return { PRESENT: 0, LATE: 0, ABSENT: 0, EXCUSED: 0, EARLY_LEAVE: 0, MAKEUP: 0, UNCHECKED: 0 }
}

/**
 * 출석률(%) = (출석 + 지각 + 보강) / (수업일 − 인정결석)
 * total은 미체크를 포함한 전체 수업일(또는 학생-수업 쌍) 수. 분모가 0이면 null.
 */
export function attendanceRate(counts: AttendanceCounts, total: number): number | null {
  const denominator = total - counts.EXCUSED
  if (denominator <= 0) return null
  return Math.round(((counts.PRESENT + counts.LATE + counts.MAKEUP) / denominator) * 100)
}

/** 수업 진행 상태 */
export type SessionPhase = 'WAITING' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED'

export const SESSION_PHASE_LABEL: Record<SessionPhase, string> = {
  WAITING: '대기',
  IN_PROGRESS: '진행중',
  DONE: '완료',
  CANCELLED: '휴강',
}

export function sessionPhase(
  s: { startAt: string; endedAt: string | null; cancelled: boolean },
  nowMs: number,
): SessionPhase {
  if (s.cancelled) return 'CANCELLED'
  if (s.endedAt) return 'DONE'
  return nowMs < new Date(s.startAt).getTime() ? 'WAITING' : 'IN_PROGRESS'
}

/** 수업 시작 + 지각 허용시간이 지났는지 */
export function isPastLateLine(startAt: string, lateGraceMinutes: number, nowMs: number): boolean {
  return nowMs > new Date(startAt).getTime() + lateGraceMinutes * 60_000
}
