// 키패드 출결 요청·응답 타입 (서버·클라이언트 공용)
// 응답에는 학생 이름·반 이름만 담는다 (연락처 등 개인정보 제외)

export type KioskCheckRequest = {
  /** 학부모 휴대폰 뒷 4자리 */
  code: string
  /** 형제 선택 화면에서 고른 학생 */
  studentId?: string
  /** 수업 선택 화면에서 고른 회차 */
  sessionId?: string
  /** 오프라인 저장분 재전송 — 입력 시각(ISO). 이 시각 기준으로 출결을 판정한다 */
  at?: string
}

export type KioskStudentChoice = { studentId: string; name: string; className: string | null }
export type KioskSessionChoice = { sessionId: string; className: string; startAt: string; endAt: string }

export type KioskCheckResult =
  | { kind: 'NOT_FOUND' }
  | { kind: 'CHOOSE_STUDENT'; students: KioskStudentChoice[] }
  | { kind: 'CHOOSE_SESSION'; studentId: string; name: string; sessions: KioskSessionChoice[] }
  /** 반 출결: 지금 출석할 수 있는 수업 없음 */
  | { kind: 'NO_SESSION'; name: string }
  | { kind: 'CHECKED_IN'; name: string; className: string | null; at: string; late: boolean }
  | { kind: 'CHECKED_OUT'; name: string; at: string }
  /** 이미 출석(반) / 이미 하원(원) */
  | { kind: 'ALREADY'; name: string; what: 'ATTENDED' | 'CHECKED_OUT' }
  /** 원 출결: 등원 후 5분 이내 재입력 — 무시 */
  | { kind: 'IGNORED'; name: string }

/** API 응답 본문 — serverNow는 기기 시계 보정용 */
export type KioskCheckResponse =
  | { ok: true; result: KioskCheckResult; serverNow: string }
  | { ok: false; error: 'UNREGISTERED' | 'RATE_LIMITED' | 'INVALID' | 'SERVER_ERROR'; serverNow?: string }

/** 반 출결: 수업 시작 몇 분 전부터 체크 가능한지 */
export const KIOSK_EARLY_CHECK_MIN = 30
/** 원 출결: 등원 후 이 시간 안의 재입력은 무시 */
export const KIOSK_CHECKOUT_MIN_GAP_MIN = 5
