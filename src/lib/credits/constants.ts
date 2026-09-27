// 통합 크레딧 공용 상수·타입 (서버·클라이언트 공용)
// 한 지갑으로 학부모 알림(알림톡·문자)과 AI 기능(쓰기 평가·문제 생성)을 함께 쓴다.

/** 알림 발송 채널 */
export type CreditChannelValue = 'ALIMTALK' | 'SMS'
/** AI 기능 차감 항목 */
export type AiCreditItemValue = 'AI_WRITING' | 'AI_QUESTION'
/** 크레딧 차감 항목 전체 (DB enum CreditChannel) */
export type CreditItemValue = CreditChannelValue | AiCreditItemValue
export type CreditTransactionTypeValue = 'CHARGE' | 'USE' | 'REFUND' | 'ADMIN_ADJUST'
export type NotificationJobTypeValue = 'CHECK_IN' | 'CHECK_OUT' | 'ABSENT_ALERT'
export type NotificationJobStatusValue = 'PENDING' | 'SENT' | 'FAILED' | 'SKIPPED_NO_CREDIT' | 'SKIPPED_DUPLICATE'

export const CREDIT_CHANNELS: CreditChannelValue[] = ['ALIMTALK', 'SMS']

export const AI_CREDIT_ITEMS: AiCreditItemValue[] = ['AI_WRITING', 'AI_QUESTION']

export const CREDIT_ITEMS: CreditItemValue[] = [...CREDIT_CHANNELS, ...AI_CREDIT_ITEMS]

export const CREDIT_ITEM_LABEL: Record<CreditItemValue, string> = {
  ALIMTALK: '알림톡',
  SMS: '문자(SMS)',
  AI_WRITING: 'AI 쓰기 평가',
  AI_QUESTION: 'AI 문제 생성',
}

/** 알림 채널 라벨 (CREDIT_ITEM_LABEL의 일부) */
export const CREDIT_CHANNEL_LABEL: Record<CreditChannelValue, string> = {
  ALIMTALK: CREDIT_ITEM_LABEL.ALIMTALK,
  SMS: CREDIT_ITEM_LABEL.SMS,
}

/** 단가 단위 (알림은 건, AI는 회) */
export const CREDIT_ITEM_UNIT: Record<CreditItemValue, string> = {
  ALIMTALK: '건',
  SMS: '건',
  AI_WRITING: '회',
  AI_QUESTION: '회',
}

export function isAiCreditItem(item: CreditItemValue): item is AiCreditItemValue {
  return item === 'AI_WRITING' || item === 'AI_QUESTION'
}

/** CreditPricing 행이 없을 때 쓰는 기본 단가 (마이그레이션 시드와 동일) */
export const DEFAULT_CREDIT_PRICING: Record<CreditItemValue, number> = {
  ALIMTALK: 15,
  SMS: 30,
  AI_WRITING: 50,
  AI_QUESTION: 100,
}

export const CREDIT_TX_TYPE_LABEL: Record<CreditTransactionTypeValue, string> = {
  CHARGE: '충전',
  USE: '사용',
  REFUND: '결제 취소',
  ADMIN_ADJUST: '관리자 조정',
}

export const NOTIFICATION_JOB_TYPE_LABEL: Record<NotificationJobTypeValue, string> = {
  CHECK_IN: '등원 알림',
  CHECK_OUT: '하원 알림',
  ABSENT_ALERT: '미등원 안내',
}

export const DEFAULT_LOW_BALANCE_THRESHOLD = 500

/** 크레딧 수치 입력 상한 (오입력 방지) */
export const CREDIT_INPUT_MAX = 10_000_000

export type CreditPricingMap = Record<CreditItemValue, number>

/** 잔액으로 쓸 수 있는 건수·횟수 */
export function estimateSendable(balance: number, perMessage: number): number {
  if (perMessage <= 0) return 0
  return Math.max(0, Math.floor(balance / perMessage))
}

export function formatCredits(value: number): string {
  return value.toLocaleString('ko-KR')
}

/** 사용 내역 한 줄 (화면·CSV 공용) */
export type CreditUsageRow = {
  id: string
  createdAt: string
  type: CreditTransactionTypeValue
  studentName: string | null
  jobType: NotificationJobTypeValue | null
  /** 차감 항목 (알림 채널 또는 AI 기능) — 충전·조정 등은 null */
  item: CreditItemValue | null
  amount: number
  balanceAfter: number
  memo: string | null
}

/** 사용 내역 분류 필터 */
export type CreditUsageFilter = 'ALL' | 'AI' | 'NOTIFICATION' | 'CHARGE'

export const CREDIT_USAGE_FILTER_LABEL: Record<CreditUsageFilter, string> = {
  ALL: '전체',
  AI: 'AI 사용',
  NOTIFICATION: '알림 발송',
  CHARGE: '충전·조정',
}

export function matchesUsageFilter(row: CreditUsageRow, filter: CreditUsageFilter): boolean {
  switch (filter) {
    case 'ALL':
      return true
    case 'AI':
      return row.item !== null && isAiCreditItem(row.item)
    case 'NOTIFICATION':
      return row.jobType !== null
    case 'CHARGE':
      return row.type !== 'USE'
  }
}
