// 상담관리 라벨·색상·포맷 유틸 (클라이언트/서버 공용 — 서버 전용 import 금지)

export type LeadStatusValue =
  | 'NEW'
  | 'SCHEDULED'
  | 'CONSULTED'
  | 'PENDING'
  | 'ENROLLED'
  | 'ON_HOLD'
  | 'LOST'
export type LeadChannelValue = 'PHONE' | 'VISIT' | 'NAVER' | 'KAKAO' | 'WEB' | 'OTHER'
export type LostReasonValue = 'PRICE' | 'SCHEDULE' | 'OTHER_ACADEMY' | 'NO_RESPONSE' | 'OTHER'
export type ConsultationTypeValue = 'INITIAL' | 'FOLLOW_UP'

/** 파이프라인 순서 (탭·선택지 표시 순서) */
export const LEAD_STATUS_ORDER: LeadStatusValue[] = [
  'NEW',
  'SCHEDULED',
  'CONSULTED',
  'PENDING',
  'ENROLLED',
  'ON_HOLD',
  'LOST',
]

export const LEAD_STATUS_LABEL: Record<LeadStatusValue, string> = {
  NEW: '문의',
  SCHEDULED: '상담예약',
  CONSULTED: '상담완료',
  PENDING: '등록대기',
  ENROLLED: '등록',
  ON_HOLD: '보류',
  LOST: '이탈',
}

/** 상태 배지 색상 (rounded-full 배지용 bg/text 클래스) */
export const LEAD_STATUS_BADGE: Record<LeadStatusValue, string> = {
  NEW: 'bg-primary-100 text-primary-700',
  SCHEDULED: 'bg-accent-purple-light text-accent-purple',
  CONSULTED: 'bg-accent-teal-light text-[#0B8A7D]',
  PENDING: 'bg-accent-gold-light text-[#9A6B00]',
  ENROLLED: 'bg-accent-green-light text-[#16803D]',
  ON_HOLD: 'bg-gray-100 text-gray-700',
  LOST: 'bg-accent-red-light text-accent-red',
}

/** 상태 변경 다이얼로그에서 직접 선택 가능한 상태 (ENROLLED는 등록 전환으로만) */
export const MANUAL_LEAD_STATUSES: LeadStatusValue[] = [
  'NEW',
  'SCHEDULED',
  'CONSULTED',
  'PENDING',
  'ON_HOLD',
  'LOST',
]

export const LEAD_CHANNEL_LABEL: Record<LeadChannelValue, string> = {
  PHONE: '전화',
  VISIT: '방문',
  NAVER: '네이버',
  KAKAO: '카카오톡',
  WEB: '웹 폼',
  OTHER: '기타',
}

export const LOST_REASON_LABEL: Record<LostReasonValue, string> = {
  PRICE: '비용',
  SCHEDULE: '시간 불일치',
  OTHER_ACADEMY: '타 학원 선택',
  NO_RESPONSE: '연락 두절',
  OTHER: '기타',
}

export const CONSULTATION_TYPE_LABEL: Record<ConsultationTypeValue, string> = {
  INITIAL: '신규 상담',
  FOLLOW_UP: '추가 상담',
}

/** 재원생 상담 유형 (문의 상담은 CONSULTATION_TYPE_LABEL) */
export type StudentConsultationTypeValue = 'REGULAR' | 'FOLLOW_UP' | 'RETENTION' | 'WITHDRAWAL'

export const STUDENT_CONSULTATION_TYPE_LABEL: Record<StudentConsultationTypeValue, string> = {
  REGULAR: '정기 상담',
  FOLLOW_UP: '추가 상담',
  RETENTION: '퇴원 방지 상담',
  WITHDRAWAL: '퇴원 상담',
}

export type AnyConsultationTypeValue = ConsultationTypeValue | StudentConsultationTypeValue

/** 타임라인 표시용 — 문의·재원생 상담 유형 전체 */
export const ALL_CONSULTATION_TYPE_LABEL: Record<AnyConsultationTypeValue, string> = {
  ...CONSULTATION_TYPE_LABEL,
  ...STUDENT_CONSULTATION_TYPE_LABEL,
}

export const CONSULTATION_TYPE_BADGE: Record<AnyConsultationTypeValue, string> = {
  INITIAL: 'bg-primary-100 text-primary-700',
  FOLLOW_UP: 'bg-gray-100 text-gray-700',
  REGULAR: 'bg-accent-green-light text-[#16803D]',
  RETENTION: 'bg-accent-gold-light text-[#9A6B00]',
  WITHDRAWAL: 'bg-accent-red-light text-accent-red',
}

export const GRADE_OPTIONS = [
  '미취학',
  '초1', '초2', '초3', '초4', '초5', '초6',
  '중1', '중2', '중3',
  '고1', '고2', '고3',
  '일반', '기타',
]

export function isLeadStatus(v: string): v is LeadStatusValue {
  return (LEAD_STATUS_ORDER as string[]).includes(v)
}

/** 전화번호에서 숫자만 추출 (DB 저장·중복 비교용) */
export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '')
}

/** 01012345678 → 010-1234-5678 */
export function formatPhone(phone: string): string {
  const d = normalizePhone(phone)
  if (d.length === 11) return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`
  if (d.length === 10) {
    if (d.startsWith('02')) return `${d.slice(0, 2)}-${d.slice(2, 6)}-${d.slice(6)}`
    return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`
  }
  if (d.length === 9 && d.startsWith('02')) return `${d.slice(0, 2)}-${d.slice(2, 5)}-${d.slice(5)}`
  return d
}

/**
 * 국내 전화번호 형식 검증 (숫자만 받은 값 기준)
 * - 서울(02): 9~10자리 / 휴대폰(01X)·지역번호·인터넷전화: 10~11자리 / 010은 11자리
 */
export function isValidPhone(digits: string): boolean {
  if (!/^0\d+$/.test(digits)) return false
  if (digits.startsWith('02')) return digits.length >= 9 && digits.length <= 10
  if (digits.startsWith('010')) return digits.length === 11
  return digits.length >= 10 && digits.length <= 11
}

/** 입력 중 하이픈 자동 포맷 (010-1234-5678, 02-123-4567, 031-123-4567) */
export function formatPhoneInput(raw: string): string {
  const d = normalizePhone(raw).slice(0, 11)
  if (d.startsWith('02')) {
    if (d.length <= 2) return d
    if (d.length <= 5) return `${d.slice(0, 2)}-${d.slice(2)}`
    if (d.length <= 9) return `${d.slice(0, 2)}-${d.slice(2, 5)}-${d.slice(5)}`
    return `${d.slice(0, 2)}-${d.slice(2, 6)}-${d.slice(6, 10)}`
  }
  if (d.length <= 3) return d
  // 010은 항상 3-4-4, 그 외는 10자리까지 3-3-4 → 11자리에서 3-4-4
  if (d.startsWith('010') || d.length === 11) {
    if (d.length <= 7) return `${d.slice(0, 3)}-${d.slice(3)}`
    return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`
  }
  if (d.length <= 6) return `${d.slice(0, 3)}-${d.slice(3)}`
  return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`
}

/** 목록 화면용 마스킹: 010-****-5678 */
export function maskPhone(phone: string): string {
  const parts = formatPhone(phone).split('-')
  if (parts.length !== 3) return phone.length > 4 ? `${'*'.repeat(phone.length - 4)}${phone.slice(-4)}` : phone
  return `${parts[0]}-${'*'.repeat(parts[1].length)}-${parts[2]}`
}

const KST_DATE = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})
const KST_DATETIME = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

/** 2026. 09. 25. (서버·클라이언트 동일 결과를 위해 KST 고정) */
export function formatKstDate(iso: string | Date): string {
  return KST_DATE.format(new Date(iso))
}

export function formatKstDateTime(iso: string | Date): string {
  return KST_DATETIME.format(new Date(iso))
}

/** <input type="datetime-local"> 기본값 (현재 KST) */
export function nowKstLocalInput(): string {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000)
  return kst.toISOString().slice(0, 16)
}

/** ISO → <input type="datetime-local"> 값 (KST) */
export function toKstLocalInput(iso: string): string {
  const kst = new Date(new Date(iso).getTime() + 9 * 60 * 60 * 1000)
  return kst.toISOString().slice(0, 16)
}

/** <input type="datetime-local"> 값(KST로 해석) → ISO */
export function kstLocalInputToIso(local: string): string {
  return new Date(`${local}:00+09:00`).toISOString()
}

// ─── 상담 예약 ────────────────────────────────────────────────────────────────

export type AppointmentStatusValue = 'SCHEDULED' | 'COMPLETED' | 'NO_SHOW' | 'CANCELED'

export const APPOINTMENT_STATUS_LABEL: Record<AppointmentStatusValue, string> = {
  SCHEDULED: '예정',
  COMPLETED: '완료',
  NO_SHOW: '노쇼',
  CANCELED: '취소',
}

export const APPOINTMENT_STATUS_BADGE: Record<AppointmentStatusValue, string> = {
  SCHEDULED: 'bg-primary-100 text-primary-700',
  COMPLETED: 'bg-accent-green-light text-[#16803D]',
  NO_SHOW: 'bg-accent-red-light text-accent-red',
  CANCELED: 'bg-gray-100 text-gray-700',
}

export const APPOINTMENT_DURATION_OPTIONS = [20, 30, 40, 60, 90]

const KST_OFFSET_MS = 9 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

/** 현재 KST 날짜 (YYYY-MM-DD) */
export function todayKst(): string {
  return new Date(Date.now() + KST_OFFSET_MS).toISOString().slice(0, 10)
}

/** ISO/Date → KST 날짜 (YYYY-MM-DD) */
export function toKstDateKey(iso: string | Date): string {
  return new Date(new Date(iso).getTime() + KST_OFFSET_MS).toISOString().slice(0, 10)
}

/** KST 날짜(YYYY-MM-DD)의 자정 → UTC Date */
export function kstDateStart(date: string): Date {
  return new Date(`${date}T00:00:00+09:00`)
}

/** YYYY-MM-DD에 일수 더하기 */
export function addDaysToDateKey(date: string, days: number): string {
  return new Date(kstDateStart(date).getTime() + days * DAY_MS + KST_OFFSET_MS).toISOString().slice(0, 10)
}

/** YYYY-MM-DD에 개월 수 더하기 (말일 보정: 1/31 + 1개월 = 2/28) */
export function addMonthsToDateKey(date: string, months: number): string {
  const [y, m, d] = date.split('-').map(Number)
  const total = y * 12 + (m - 1) + months
  const ny = Math.floor(total / 12)
  const nm = total % 12
  const lastDay = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate()
  return `${ny}-${String(nm + 1).padStart(2, '0')}-${String(Math.min(d, lastDay)).padStart(2, '0')}`
}

/** 두 날짜(YYYY-MM-DD) 사이 일수 (b - a) */
export function diffDateKeys(a: string, b: string): number {
  return Math.round((kstDateStart(b).getTime() - kstDateStart(a).getTime()) / DAY_MS)
}

/** 해당 날짜가 속한 주의 월요일 (YYYY-MM-DD) */
export function weekStartKst(date: string): string {
  const dow = new Date(`${date}T00:00:00Z`).getUTCDay() // 0=일
  return addDaysToDateKey(date, dow === 0 ? -6 : 1 - dow)
}

/** ISO → KST 시:분 (HH:mm) */
export function formatKstTime(iso: string | Date): string {
  return new Date(new Date(iso).getTime() + KST_OFFSET_MS).toISOString().slice(11, 16)
}

/** ISO → KST 기준 0시부터 경과 분 */
export function kstMinutesOfDay(iso: string | Date): number {
  const d = new Date(new Date(iso).getTime() + KST_OFFSET_MS)
  return d.getUTCHours() * 60 + d.getUTCMinutes()
}

const WEEKDAY_KO = ['일', '월', '화', '수', '목', '금', '토']

/** YYYY-MM-DD → 9/25(목) */
export function formatDateKeyShort(date: string): string {
  const d = new Date(`${date}T00:00:00Z`)
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}(${WEEKDAY_KO[d.getUTCDay()]})`
}

/** YYYY-MM-DD 형식 검증 */
export function isDateKey(v: string | undefined | null): v is string {
  return !!v && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(new Date(`${v}T00:00:00Z`).getTime())
}

// ─── 팔로업 · 방치 ─────────────────────────────────────────────────────────────

/** 마지막 활동 후 이 일수가 지나면 '방치' 표시 (학원 설정으로 변경 가능) */
export const DEFAULT_STALE_DAYS = 7
export const STALE_DAY_OPTIONS = [3, 5, 7, 10, 14, 30]

/** 방치 판정 제외 상태 */
export const STALE_EXCLUDED_STATUSES: LeadStatusValue[] = ['ENROLLED', 'LOST']

/** Academy.settingsJson.consultation.staleDays 읽기 (없거나 잘못된 값이면 null) */
export function readStaleDays(settingsJson: unknown): number | null {
  if (!settingsJson || typeof settingsJson !== 'object' || Array.isArray(settingsJson)) return null
  const consultation = (settingsJson as Record<string, unknown>).consultation
  if (!consultation || typeof consultation !== 'object' || Array.isArray(consultation)) return null
  const days = (consultation as Record<string, unknown>).staleDays
  return typeof days === 'number' && STALE_DAY_OPTIONS.includes(days) ? days : null
}

/** 할 일 빠른 마감 선택 */
export const FOLLOW_UP_QUICK_DUE = [
  { label: '내일', days: 1 },
  { label: '3일 후', days: 3 },
  { label: '1주 후', days: 7 },
]

// ─── 상담관리 설정 · 웹 상담신청 폼 ─────────────────────────────────────────────

/** 미등록 문의 개인정보 보관기간 (개월) — 자동 파기 기준, 신청 폼 동의 문구에도 표시 */
export const DEFAULT_RETENTION_MONTHS = 12
export const RETENTION_MONTH_OPTIONS = [6, 12, 24, 36]

/** 12 → "1년", 6 → "6개월", 18 → "1년 6개월" */
export function formatRetention(months: number): string {
  const y = Math.floor(months / 12)
  const m = months % 12
  if (y && m) return `${y}년 ${m}개월`
  return y ? `${y}년` : `${m}개월`
}

export type WebFormFieldKey = 'grade' | 'school' | 'schedule' | 'message'

export const WEB_FORM_FIELD_LABEL: Record<WebFormFieldKey, string> = {
  grade: '학년',
  school: '학교',
  schedule: '희망 요일·시간',
  message: '문의 내용',
}
export const WEB_FORM_FIELD_KEYS = Object.keys(WEB_FORM_FIELD_LABEL) as WebFormFieldKey[]

export const WEB_FORM_INTRO_MAX = 500

export type WebFormSettings = {
  enabled: boolean
  /** 폼 상단 안내 문구 */
  intro: string
  /** 선택 항목 표시 여부 */
  fields: Record<WebFormFieldKey, boolean>
  /** 신청자에게 접수 확인 알림톡(INQUIRY_RECEIVED) 발송 */
  sendReceipt: boolean
}

export const DEFAULT_WEB_FORM: WebFormSettings = {
  enabled: false,
  intro: '',
  fields: { grade: true, school: true, schedule: true, message: true },
  sendReceipt: false,
}

function asObject(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null
}

function readConsultationObject(settingsJson: unknown): Record<string, unknown> | null {
  return asObject(asObject(settingsJson)?.consultation)
}

/** settingsJson.consultation.retentionMonths (없거나 잘못된 값이면 null) */
export function readRetentionMonths(settingsJson: unknown): number | null {
  const v = readConsultationObject(settingsJson)?.retentionMonths
  return typeof v === 'number' && RETENTION_MONTH_OPTIONS.includes(v) ? v : null
}

/** settingsJson.consultation.defaultAssigneeId — 웹 신청 자동 배정 담당자 */
export function readDefaultAssigneeId(settingsJson: unknown): string | null {
  const v = readConsultationObject(settingsJson)?.defaultAssigneeId
  return typeof v === 'string' && v ? v : null
}

// ─── 재원생 정기상담 주기 ─────────────────────────────────────────────────────

export type RegularCycleValue = 'MONTHLY' | 'BIMONTHLY' | 'QUARTERLY' | 'OFF'

export const REGULAR_CYCLE_LABEL: Record<RegularCycleValue, string> = {
  MONTHLY: '매월',
  BIMONTHLY: '격월',
  QUARTERLY: '분기',
  OFF: '사용 안 함',
}

/** 주기별 개월 수 (OFF는 대상 없음) */
export const REGULAR_CYCLE_MONTHS: Record<Exclude<RegularCycleValue, 'OFF'>, number> = {
  MONTHLY: 1,
  BIMONTHLY: 2,
  QUARTERLY: 3,
}

export const DEFAULT_REGULAR_CYCLE: RegularCycleValue = 'OFF'

export function isRegularCycle(v: unknown): v is RegularCycleValue {
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(REGULAR_CYCLE_LABEL, v)
}

/** settingsJson.consultation.regularCycle (없거나 잘못된 값이면 null) */
export function readRegularCycle(settingsJson: unknown): RegularCycleValue | null {
  const v = readConsultationObject(settingsJson)?.regularCycle
  return isRegularCycle(v) ? v : null
}

/** 학부모 공유 리포트 링크 유효기간 */
export const REPORT_LINK_DAYS = 30

/** settingsJson.consultation.webForm (없는 값은 기본값으로 채움) */
export function readWebFormSettings(settingsJson: unknown): WebFormSettings {
  const raw = asObject(readConsultationObject(settingsJson)?.webForm)
  if (!raw) return { ...DEFAULT_WEB_FORM, fields: { ...DEFAULT_WEB_FORM.fields } }
  const rawFields = asObject(raw.fields) ?? {}
  const fields = { ...DEFAULT_WEB_FORM.fields }
  for (const key of WEB_FORM_FIELD_KEYS) {
    if (typeof rawFields[key] === 'boolean') fields[key] = rawFields[key] as boolean
  }
  return {
    enabled: raw.enabled === true,
    intro: typeof raw.intro === 'string' ? raw.intro.slice(0, WEB_FORM_INTRO_MAX) : '',
    fields,
    sendReceipt: raw.sendReceipt === true,
  }
}

/** 신청 폼 주소: 영문 소문자·숫자·하이픈 3~40자, 하이픈으로 시작/끝 불가 */
export const SLUG_RULE_TEXT = '영문 소문자, 숫자, 하이픈(-)으로 3~40자'
export function isValidSlug(v: string): boolean {
  return /^[a-z0-9](?:[a-z0-9-]{1,38})[a-z0-9]$/.test(v) && !v.includes('--')
}

/** ?src= 유입경로 값 정리 (영문·숫자·한글·-_. 최대 30자, 그 외 문자는 제거) */
export function sanitizeSource(v: string | null | undefined): string | null {
  const cleaned = (v ?? '').replace(/[^0-9A-Za-z가-힣._-]/g, '').slice(0, 30)
  return cleaned || null
}

export type LeadActivityTypeValue = 'WEB_INQUIRY' | 'WEB_REINQUIRY' | 'RETENTION_EXTENDED'

export const LEAD_ACTIVITY_LABEL: Record<LeadActivityTypeValue, string> = {
  WEB_INQUIRY: '웹 상담신청',
  WEB_REINQUIRY: '웹 재문의',
  RETENTION_EXTENDED: '개인정보 보관 연장',
}

/** 웹 신청 제출 내용 (LeadActivity.payload) */
export type WebInquiryPayload = {
  parentName: string
  studentName: string
  grade?: string
  school?: string
  preferredSchedule?: string
  message?: string
  source?: string
}

// ─── 개인정보 보관기간 · 자동 파기 ──────────────────────────────────────────────

/** 자동 파기 대상 상태 (등록 전환된 문의는 학생 정보로 관리되므로 제외) */
export const PURGE_TARGET_STATUSES: LeadStatusValue[] = ['LOST', 'ON_HOLD']

/** 파기 예정 목록에 미리 보여주는 기간 (일) */
export const PURGE_NOTICE_DAYS = 30

/** 파기된 문의의 학생 이름 자리 표시 */
export const PURGED_LEAD_NAME = '(파기됨)'

/** 마지막 활동일 + 보관기간 = 파기 예정일 (UTC 월 단위 계산) */
export function addMonthsToDate(date: Date, months: number): Date {
  const d = new Date(date)
  const day = d.getUTCDate()
  d.setUTCDate(1)
  d.setUTCMonth(d.getUTCMonth() + months)
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate()
  d.setUTCDate(Math.min(day, last))
  return d
}

// ─── 상담 알림 on/off ──────────────────────────────────────────────────────────

export type ConsultationNotificationSettings = {
  /** 상담 전날 학부모 리마인드 (예약 작업 자동 발송) */
  appointmentReminder: boolean
  /** 웹 상담신청 접수 시 학원장·담당자 앱 알림 */
  staffWebInquiry: boolean
}

export const DEFAULT_CONSULTATION_NOTIFICATIONS: ConsultationNotificationSettings = {
  appointmentReminder: true,
  staffWebInquiry: true,
}

export const CONSULTATION_NOTIFICATION_LABEL: Record<keyof ConsultationNotificationSettings, { title: string; help: string }> = {
  appointmentReminder: {
    title: '상담 전날 리마인드',
    help: '예약된 상담 전날 오전 10시에 보호자에게 알림톡(또는 문자)을 자동으로 보냅니다.',
  },
  staffWebInquiry: {
    title: '웹 상담신청 앱 알림',
    help: '상담신청 폼으로 신청·재문의가 들어오면 학원장과 담당자에게 앱 알림을 보냅니다.',
  },
}

/** settingsJson.consultation.notifications (없는 값은 기본값 = 켜짐) */
export function readConsultationNotifications(settingsJson: unknown): ConsultationNotificationSettings {
  const raw = asObject(readConsultationObject(settingsJson)?.notifications) ?? {}
  return {
    appointmentReminder: raw.appointmentReminder !== false,
    staffWebInquiry: raw.staffWebInquiry !== false,
  }
}
