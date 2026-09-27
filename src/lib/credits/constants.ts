// 알림 크레딧 공용 상수·타입 (서버·클라이언트 공용)

export type CreditChannelValue = 'ALIMTALK' | 'SMS'
export type CreditTransactionTypeValue = 'CHARGE' | 'USE' | 'REFUND' | 'ADMIN_ADJUST'
export type NotificationJobTypeValue = 'CHECK_IN' | 'CHECK_OUT' | 'ABSENT_ALERT'
export type NotificationJobStatusValue = 'PENDING' | 'SENT' | 'FAILED' | 'SKIPPED_NO_CREDIT' | 'SKIPPED_DUPLICATE'

export const CREDIT_CHANNELS: CreditChannelValue[] = ['ALIMTALK', 'SMS']

export const CREDIT_CHANNEL_LABEL: Record<CreditChannelValue, string> = {
  ALIMTALK: '알림톡',
  SMS: '문자(SMS)',
}

/** CreditPricing 행이 없을 때 쓰는 기본 단가 (마이그레이션 시드와 동일) */
export const DEFAULT_CREDIT_PRICING: Record<CreditChannelValue, number> = {
  ALIMTALK: 15,
  SMS: 30,
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

export type CreditPricingMap = Record<CreditChannelValue, number>

/** 잔액으로 보낼 수 있는 알림톡 건수 */
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
  channel: CreditChannelValue | null
  amount: number
  balanceAfter: number
  memo: string | null
}
