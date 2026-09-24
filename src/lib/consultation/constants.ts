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
