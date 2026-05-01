import 'server-only'
import * as PortOne from '@portone/server-sdk'
import * as Webhook from '@portone/server-sdk/webhook'
import type {
  PortOnePayment,
  PortOneBillingKey,
  PortOneCancelResult,
  PortOneWebhookEvent,
  PayWithBillingKeyParams,
} from './types'

const API_SECRET = process.env.PORTONE_API_SECRET
const STORE_ID = process.env.NEXT_PUBLIC_PORTONE_STORE_ID
const WEBHOOK_SECRET = process.env.PORTONE_WEBHOOK_SECRET

function getClient() {
  if (!API_SECRET) throw new PortOneServerError('PORTONE_API_SECRET 환경변수가 설정되지 않았습니다')
  return PortOne.PortOneClient({ secret: API_SECRET, storeId: STORE_ID })
}

export class PortOneServerError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly cause?: unknown,
  ) {
    super(message)
    this.name = 'PortOneServerError'
  }
}

// ─── 빌링키 발급 (API 카드 자격증명 방식) ─────────────────────────────────────
// 브라우저 SDK를 거치지 않고 카드번호/유효기간으로 직접 빌링키를 발급합니다.

export async function issueBillingKey(params: {
  channelKey: string
  cardCredential: {
    number: string
    expiryYear: string
    expiryMonth: string
    birthOrBusinessRegistrationNumber?: string
    passwordTwoDigits?: string
  }
  customer?: {
    customerId?: string
    fullName?: string
    email?: string
    phoneNumber?: string
  }
  customData?: Record<string, unknown>
}): Promise<{ billingKey: string }> {
  const client = getClient()

  try {
    const result = await client.payment.billingKey.issueBillingKey({
      channelKey: params.channelKey,
      method: {
        card: {
          credential: {
            number: params.cardCredential.number,
            expiryYear: params.cardCredential.expiryYear,
            expiryMonth: params.cardCredential.expiryMonth,
            birthOrBusinessRegistrationNumber:
              params.cardCredential.birthOrBusinessRegistrationNumber,
            passwordTwoDigits: params.cardCredential.passwordTwoDigits,
          },
        },
      },
      customer: params.customer,
      customData: params.customData ? JSON.stringify(params.customData) : undefined,
    })

    return { billingKey: result.billingKeyInfo.billingKey }
  } catch (err) {
    throw wrapError('빌링키 발급 실패', err)
  }
}

// ─── 브라우저 SDK 빌링키 발급+결제 확인 (서버 검증용) ──────────────────────────
// 브라우저에서 requestIssueBillingKeyAndPay 호출 후 받은 billingIssueToken을 서버에서 확인합니다.

export async function confirmBillingKeyIssueAndPay(params: {
  billingIssueToken: string
  paymentId?: string
  expectedAmount?: number
}): Promise<{ paymentId: string; billingKey: string }> {
  const client = getClient()

  try {
    const result = await client.payment.billingKey.confirmBillingKeyIssueAndPay({
      billingIssueToken: params.billingIssueToken,
      paymentId: params.paymentId,
      totalAmount: params.expectedAmount,
      currency: params.expectedAmount !== undefined ? 'KRW' : undefined,
    })

    return {
      paymentId: result.paymentId,
      billingKey: result.billingKey,
    }
  } catch (err) {
    throw wrapError('빌링키 발급 및 결제 확인 실패', err)
  }
}

// ─── 등록된 빌링키로 결제 (정기 결제 자동 청구용) ─────────────────────────────

export async function payWithBillingKey(
  params: PayWithBillingKeyParams,
): Promise<PortOnePayment> {
  const client = getClient()

  try {
    const result = await client.payment.payWithBillingKey({
      paymentId: params.paymentId,
      billingKey: params.billingKey,
      orderName: params.orderName,
      amount: { total: params.amount },
      currency: 'KRW',
      customer: params.customer,
      customData: params.customData ? JSON.stringify(params.customData) : undefined,
    })

    return result as unknown as PortOnePayment
  } catch (err) {
    throw wrapError('빌링키 결제 실패', err)
  }
}

// ─── 결제 단건 조회 (서버 검증용) ────────────────────────────────────────────

export async function getPayment(paymentId: string): Promise<PortOnePayment> {
  const client = getClient()

  try {
    const result = await client.payment.getPayment({ paymentId })
    return result as unknown as PortOnePayment
  } catch (err) {
    throw wrapError('결제 조회 실패', err)
  }
}

// ─── 결제 취소 (전체/부분) ────────────────────────────────────────────────────

export async function cancelPayment(
  paymentId: string,
  reason: string,
  amount?: number,
): Promise<PortOneCancelResult> {
  const client = getClient()

  try {
    const result = await client.payment.cancelPayment({
      paymentId,
      reason,
      amount,
    })

    return result as unknown as PortOneCancelResult
  } catch (err) {
    throw wrapError('결제 취소 실패', err)
  }
}

// ─── 빌링키 삭제 (구독 해지 시) ──────────────────────────────────────────────

export async function deleteBillingKey(billingKey: string): Promise<PortOneBillingKey> {
  const client = getClient()

  try {
    const result = await client.payment.billingKey.deleteBillingKey({ billingKey })
    return result as unknown as PortOneBillingKey
  } catch (err) {
    throw wrapError('빌링키 삭제 실패', err)
  }
}

// ─── 빌링키 정보 조회 ────────────────────────────────────────────────────────

export async function getBillingKeyInfo(billingKey: string): Promise<PortOneBillingKey> {
  const client = getClient()

  try {
    const result = await client.payment.billingKey.getBillingKeyInfo({ billingKey })
    return result as unknown as PortOneBillingKey
  } catch (err) {
    throw wrapError('빌링키 조회 실패', err)
  }
}

// ─── 웹훅 검증 ────────────────────────────────────────────────────────────────

export async function verifyWebhook(
  body: string,
  headers: Record<string, string | string[] | undefined>,
): Promise<PortOneWebhookEvent> {
  if (!WEBHOOK_SECRET) {
    throw new PortOneServerError('PORTONE_WEBHOOK_SECRET 환경변수가 설정되지 않았습니다')
  }

  try {
    const event = await Webhook.verify(WEBHOOK_SECRET, body, headers)
    return event as unknown as PortOneWebhookEvent
  } catch (err) {
    throw wrapError('웹훅 검증 실패', err)
  }
}

// ─── 결제 금액 검증 (클라이언트 결제 후 서버 검증용) ─────────────────────────

export async function verifyPaymentAmount(
  paymentId: string,
  expectedAmount: number,
): Promise<PortOnePayment> {
  const payment = await getPayment(paymentId)

  if (payment.status !== 'PAID') {
    throw new PortOneServerError(
      `결제 상태가 유효하지 않습니다: ${payment.status}`,
      'INVALID_PAYMENT_STATUS',
    )
  }

  if (payment.amount.total !== expectedAmount) {
    throw new PortOneServerError(
      `결제 금액 불일치: 예상 ${expectedAmount}원, 실제 ${payment.amount.total}원`,
      'AMOUNT_MISMATCH',
    )
  }

  return payment
}

// ─── 내부 헬퍼 ────────────────────────────────────────────────────────────────

function wrapError(message: string, err: unknown): PortOneServerError {
  if (err instanceof PortOneServerError) return err

  if (err instanceof Error) {
    return new PortOneServerError(`${message}: ${err.message}`, undefined, err)
  }

  return new PortOneServerError(message, undefined, err)
}
