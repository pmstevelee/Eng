'use client'

import PortOne from '@portone/browser-sdk/v2'
import type {
  BillingKeyPaymentClientParams,
  BillingKeyPaymentResult,
  OneTimePaymentClientParams,
  PaymentClientError,
} from './types'

const STORE_ID = process.env.NEXT_PUBLIC_PORTONE_STORE_ID!
const CHANNEL_KEY_INICIS = process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY_INICIS!

// ─── 빌링키 발급 (정기구독 가입용) ────────────────────────────────────────────
// KG이니시스 카드 UI를 열어 빌링키를 발급합니다.
// 성공 시 서버에서 payWithBillingKey로 초회 결제를 처리해야 합니다.

export async function requestPaymentWithBillingKey(
  params: BillingKeyPaymentClientParams,
): Promise<BillingKeyPaymentResult | PaymentClientError> {
  try {
    const response = await PortOne.requestIssueBillingKey({
      storeId: STORE_ID,
      channelKey: params.channelKey ?? CHANNEL_KEY_INICIS,
      billingKeyMethod: 'CARD',
      issueId: params.paymentId,
      issueName: params.orderName,
      customer: params.customer
        ? {
            customerId: params.customer.customerId,
            fullName: params.customer.fullName,
            email: params.customer.email,
            phoneNumber: params.customer.phoneNumber,
          }
        : undefined,
      redirectUrl: params.redirectUrl,
      customData: params.customData,
    })

    if (!response) {
      return { code: 'NO_RESPONSE', message: '결제 응답이 없습니다' }
    }

    if (response.code) {
      return {
        code: response.code,
        message: response.message ?? '빌링키 발급 실패',
      }
    }

    return {
      paymentId: params.paymentId,
      billingKey: response.billingKey,
    }
  } catch (err) {
    return {
      code: 'UNKNOWN_ERROR',
      message: err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다',
    }
  }
}

// ─── 1회성 결제 (크레딧 패키지, 연간 결제 등) ────────────────────────────────

export async function requestOneTimePayment(
  params: OneTimePaymentClientParams,
): Promise<{ paymentId: string; txId: string } | PaymentClientError> {
  try {
    const response = await PortOne.requestPayment({
      storeId: STORE_ID,
      channelKey: params.channelKey ?? CHANNEL_KEY_INICIS,
      paymentId: params.paymentId,
      orderName: params.orderName,
      totalAmount: params.totalAmount,
      currency: 'KRW',
      payMethod: 'CARD',
      customer: params.customer
        ? {
            customerId: params.customer.customerId,
            fullName: params.customer.fullName,
            email: params.customer.email,
            phoneNumber: params.customer.phoneNumber,
          }
        : undefined,
      redirectUrl: params.redirectUrl,
      customData: params.customData,
      // 미사용 결제수단 필드 명시 (SDK discriminated union 요구사항)
      card: {},
    } as Parameters<typeof PortOne.requestPayment>[0])

    if (!response) {
      return { code: 'NO_RESPONSE', message: '결제 응답이 없습니다' }
    }

    if (response.code) {
      return {
        code: response.code,
        message: response.message ?? '결제 실패',
      }
    }

    return {
      paymentId: response.paymentId,
      txId: response.txId,
    }
  } catch (err) {
    return {
      code: 'UNKNOWN_ERROR',
      message: err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다',
    }
  }
}

// ─── 결제 결과 타입 가드 ──────────────────────────────────────────────────────

export function isPaymentError(
  result: BillingKeyPaymentResult | { paymentId: string; txId: string } | PaymentClientError,
): result is PaymentClientError {
  return 'code' in result && !('billingKey' in result) && !('txId' in result)
}
