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

async function tossRequest<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      Authorization: getAuthHeader(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  const data = await res.json()

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

// 빌링키 발급 (authKey + customerKey → billingKey)
export async function issueBillingKey(
  authKey: string,
  customerKey: string,
): Promise<TossBillingKeyInfo> {
  return tossRequest<TossBillingKeyInfo>('/v1/billing/authorizations/issue', {
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
  return tossRequest<TossPaymentResult>(`/v1/billing/${params.billingKey}`, {
    customerKey: params.customerKey,
    amount: params.amount,
    orderId: params.orderId,
    orderName: params.orderName,
    customerEmail: params.customerEmail,
    customerName: params.customerName,
    currency: 'KRW',
  })
}

// 결제 취소
export async function cancelPayment(
  paymentKey: string,
  cancelReason: string,
): Promise<unknown> {
  const res = await fetch(`${BASE_URL}/v1/payments/${paymentKey}/cancel`, {
    method: 'POST',
    headers: {
      Authorization: getAuthHeader(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ cancelReason }),
  })

  const data = await res.json()
  if (!res.ok) {
    throw new TossServerError(data.message ?? '결제 취소 실패', data.code, res.status)
  }

  return data
}
