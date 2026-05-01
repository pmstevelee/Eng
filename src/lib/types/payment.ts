import {
  Plan,
  BillingCycle,
  SubscriptionStatus,
  PaymentType,
  PaymentStatus,
  CreditType,
  ScheduleStatus,
} from '@/generated/prisma'

// ─── 재-export (편의용) ───────────────────────────────────────────────────────
export { Plan, BillingCycle, SubscriptionStatus, PaymentType, PaymentStatus, CreditType, ScheduleStatus }

// ─── 포트원 결제 요청 ─────────────────────────────────────────────────────────

export interface PaymentRequest {
  academyId: string
  subscriptionId: string
  type: PaymentType
  amount: number
  orderName: string
  customerName: string
  customerEmail: string
  billingKey?: string
}

export interface PaymentVerifyResult {
  paymentId: string
  status: PaymentStatus
  amount: number
  paidAt: Date | null
  pgTxId: string | null
  receiptUrl: string | null
  failureReason: string | null
}

// ─── 빌링키 발급 ─────────────────────────────────────────────────────────────

export interface BillingKeyIssueRequest {
  academyId: string
  subscriptionId: string
  cardNumber: string
  cardExpiryYear: string
  cardExpiryMonth: string
  cardBirthOrBusinessNumber: string
  cardPasswordTwoDigits: string
  customerName: string
  customerEmail: string
}

export interface BillingKeyIssueResult {
  billingKey: string
  cardCompany: string | null
  cardNumberMasked: string | null
  issuedAt: Date
}

// ─── 포트원 웹훅 ──────────────────────────────────────────────────────────────

export type PortoneWebhookType =
  | 'Transaction.Paid'
  | 'Transaction.Failed'
  | 'Transaction.Cancelled'
  | 'Transaction.PartialCancelled'
  | 'BillingKey.Issued'
  | 'BillingKey.Deleted'
  | 'Schedule.Executed'
  | 'Schedule.Failed'

export interface WebhookPayload {
  type: PortoneWebhookType
  timestamp: string
  data: {
    paymentId?: string
    billingKey?: string
    scheduleId?: string
    transactionId?: string
  }
}

// ─── 구독 상태 요약 ────────────────────────────────────────────────────────────

export interface SubscriptionSummary {
  id: string
  academyId: string
  plan: Plan
  billingCycle: BillingCycle
  status: SubscriptionStatus
  currentPeriodStart: Date
  currentPeriodEnd: Date
  cancelAtPeriodEnd: boolean
  trialEndsAt: Date | null
  hasBillingKey: boolean
}

// ─── 사용량 현황 ──────────────────────────────────────────────────────────────

export interface UsageSummary {
  aiWritingCount: number
  aiWritingLimit: number
  aiQuestionCount: number
  aiQuestionLimit: number
  storageUsedMb: number
  storageLimitMb: number
  studentCount: number
  studentLimit: number
}

// ─── 크레딧 잔액 ──────────────────────────────────────────────────────────────

export interface CreditBalance {
  type: CreditType
  total: number
  expiringSoon: number  // 30일 내 만료 예정
}

// ─── 결제 스케줄 상태 ─────────────────────────────────────────────────────────

export interface ScheduleSummary {
  id: string
  subscriptionId: string
  scheduledAt: Date
  type: PaymentType
  amount: number
  status: ScheduleStatus
  retryCount: number
}
