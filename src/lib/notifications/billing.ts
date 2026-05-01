import type { Payment } from '@/generated/prisma'

export async function sendPaymentSuccess(academyId: string, payment: Payment): Promise<void> {
  console.log('[billing:notification] 결제 성공 알림', {
    academyId,
    paymentId: payment.paymentId,
    amount: payment.amount,
    paidAt: payment.paidAt,
  })
  // TODO Phase N: 카카오 알림톡 / 이메일 연동
}

export async function sendPaymentFailed(
  academyId: string,
  payment: Payment,
  retryAt: Date,
): Promise<void> {
  console.log('[billing:notification] 결제 실패 알림 — 카드 한도 확인 요청', {
    academyId,
    paymentId: payment.paymentId,
    amount: payment.amount,
    failureReason: payment.failureReason,
    retryAt,
  })
  // TODO Phase N: 카카오 알림톡 / 이메일 연동
}

export async function sendDowngradeWarning(academyId: string, daysLeft: number): Promise<void> {
  console.log('[billing:notification] 다운그레이드 예정 경고 알림', {
    academyId,
    daysLeft,
  })
  // TODO Phase N: 카카오 알림톡 / 이메일 연동
}

export async function sendDowngradeExecuted(academyId: string): Promise<void> {
  console.log('[billing:notification] FREE 플랜 다운그레이드 완료 알림', {
    academyId,
  })
  // TODO Phase N: 카카오 알림톡 / 이메일 연동
}
