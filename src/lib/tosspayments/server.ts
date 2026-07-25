import 'server-only'

const SECRET_KEY = process.env.TOSS_SECRET_KEY!
const BASE_URL = 'https://api.tosspayments.com'

function getAuthHeader() {
  if (!SECRET_KEY) throw new TossServerError('TOSS_SECRET_KEY 환경변수가 설정되지 않았습니다')
  const encoded = Buffer.from(`${SECRET_KEY}:`).toString('base64')
  return `Basic ${encoded}`
}

export class TossServerError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly status?: number,
  ) {
    super(message)
    this.name = 'TossServerError'
  }
}

async function tossRequest<T>(
  path: string,
  method: 'POST' | 'GET' | 'DELETE',
  body?: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: getAuthHeader(),
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  // DELETE 성공 시 빈 본문(204/200)일 수 있음
  const text = await res.text()
  const data = text ? JSON.parse(text) : {}

  if (!res.ok) {
    throw new TossServerError(
      data.message ?? '토스페이먼츠 API 오류',
      data.code,
      res.status,
    )
  }

  return data as T
}

export interface TossBillingKeyInfo {
  billingKey: string
  customerKey: string
  authenticatedAt: string
  method: string
  card: {
    issuerCode: string
    acquirerCode: string
    number: string
    cardType: string
    ownerType: string
  }
  cardCompany: string
  cardNumber: string
}

export interface TossPaymentResult {
  paymentKey: string
  orderId: string
  orderName: string
  status: string
  approvedAt: string
  totalAmount: number
  method: string
  card: {
    issuerCode: string
    acquirerCode: string
    number: string
    cardType: string
    ownerType: string
    approveNo: string
  } | null
  receipt: { url: string } | null
  failure: { code: string; message: string } | null
}

export interface TossCancelDetail {
  cancelAmount: number
  cancelReason: string
  canceledAt: string
  transactionKey: string
  receiptKey?: string | null
}

export interface TossPayment {
  paymentKey: string
  orderId: string
  orderName: string
  status: 'READY' | 'IN_PROGRESS' | 'DONE' | 'CANCELED' | 'PARTIAL_CANCELED' | 'ABORTED' | 'EXPIRED'
  totalAmount: number
  balanceAmount: number
  approvedAt: string | null
  method: string | null
  card: {
    issuerCode: string
    acquirerCode: string
    number: string
    cardType: string
    ownerType: string
    approveNo: string
  } | null
  receipt: { url: string } | null
  cancels: TossCancelDetail[] | null
  failure: { code: string; message: string } | null
}

export interface TossWebhookEvent {
  eventType:
    | 'PAYMENT_STATUS_CHANGED'
    | 'CANCEL_STATUS_CHANGED'
    | 'DEPOSIT_CALLBACK'
    | 'BILLING_DELETED'
    | 'METHOD_UPDATED'
    | 'CUSTOMER_STATUS_CHANGED'
    | string
  createdAt: string
  data: {
    paymentKey?: string
    orderId?: string
    status?: string
    billingKey?: string
    mId?: string
    [key: string]: unknown
  }
}

// 빌링키 발급 (authKey + customerKey → billingKey)
export async function issueBillingKey(
  authKey: string,
  customerKey: string,
): Promise<TossBillingKeyInfo> {
  return tossRequest<TossBillingKeyInfo>('/v1/billing/authorizations/issue', 'POST', {
    authKey,
    customerKey,
  })
}

// 빌링키로 결제 승인
export async function payWithBillingKey(params: {
  billingKey: string
  customerKey: string
  orderId: string
  orderName: string
  amount: number
  customerEmail?: string
  customerName?: string
}): Promise<TossPaymentResult> {
  return tossRequest<TossPaymentResult>(`/v1/billing/${params.billingKey}`, 'POST', {
    customerKey: params.customerKey,
    amount: params.amount,
    orderId: params.orderId,
    orderName: params.orderName,
    customerEmail: params.customerEmail,
    customerName: params.customerName,
    currency: 'KRW',
  })
}

// 결제 조회 (주문번호 기준) — 웹훅 검증 등 서버 측 재조회용
export async function getPayment(orderId: string): Promise<TossPayment> {
  return tossRequest<TossPayment>(`/v1/payments/orders/${orderId}`, 'GET')
}

// 1회성 결제 승인 (카드 결제창 리다이렉트 후 최종 확정) — 크레딧 패키지 등
export async function confirmPayment(params: {
  paymentKey: string
  orderId: string
  amount: number
}): Promise<TossPayment> {
  return tossRequest<TossPayment>('/v1/payments/confirm', 'POST', {
    paymentKey: params.paymentKey,
    orderId: params.orderId,
    amount: params.amount,
  })
}

// 결제 취소 (전체/부분). cancelAmount 생략 시 전액 취소.
export async function cancelPayment(
  paymentKey: string,
  cancelReason: string,
  cancelAmount?: number,
): Promise<TossPayment> {
  return tossRequest<TossPayment>(`/v1/payments/${paymentKey}/cancel`, 'POST', {
    cancelReason,
    ...(cancelAmount !== undefined ? { cancelAmount } : {}),
  })
}

// 빌링키 삭제 (구독 해지 시 재사용 방지)
export async function deleteBillingKey(billingKey: string): Promise<void> {
  await tossRequest<unknown>(`/v1/billing/${billingKey}`, 'DELETE')
}
