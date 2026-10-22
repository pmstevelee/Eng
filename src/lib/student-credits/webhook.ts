import 'server-only'

import { prisma } from '@/lib/prisma/client'
import { getPayment } from '@/lib/tosspayments/server'
import { chargeStudentCreditsForPayment, refundStudentCreditsForPayment } from './wallet'

// 토스 웹훅 중 학원 결제(payments)에 없는 orderId — 학생 충전 결제(student_payments)인지 확인해 처리한다.
// 웹훅 payload는 신뢰하지 않고 getPayment()로 토스에 재조회한 상태·금액만 반영한다.

/** 학생 결제였으면 true (처리 여부와 무관) */
export async function handleStudentPaymentPaid(orderId: string): Promise<boolean> {
  const payment = await prisma.studentPayment.findUnique({
    where: { orderId },
    select: { status: true, amount: true },
  })
  if (!payment) return false

  // 승인 페이지에서 PAID 처리 후 충전이 실패했을 수 있어 충전만 다시 확인 (중복 충전은 unique로 차단)
  if (payment.status === 'PAID') {
    await chargeStudentCreditsForPayment(orderId)
    return true
  }
  if (payment.status !== 'PENDING') return true

  const toss = await getPayment(orderId)
  if (toss.status !== 'DONE' || toss.totalAmount !== payment.amount) {
    console.error('[student-credits] 웹훅 결제 검증 실패', { orderId, status: toss.status, amount: toss.totalAmount })
    return true
  }
  await chargeStudentCreditsForPayment(orderId, {
    status: 'PAID',
    pgTxId: toss.paymentKey,
    receiptUrl: toss.receipt?.url ?? null,
    paidAt: toss.approvedAt ? new Date(toss.approvedAt) : new Date(),
  })
  return true
}

export async function handleStudentPaymentCancelled(orderId: string, partial: boolean): Promise<boolean> {
  const payment = await prisma.studentPayment.findUnique({ where: { orderId }, select: { status: true } })
  if (!payment) return false
  const newStatus = partial ? 'PARTIAL_CANCELED' : 'CANCELED'
  if (payment.status === newStatus || payment.status === 'CANCELED') return true

  await prisma.studentPayment.update({ where: { orderId }, data: { status: newStatus, canceledAt: new Date() } })
  // 전액 취소만 충전분 회수 (부분 취소는 관리자가 확인 후 조정)
  if (!partial) await refundStudentCreditsForPayment(orderId)
  return true
}

export async function handleStudentPaymentFailed(orderId: string): Promise<boolean> {
  const payment = await prisma.studentPayment.findUnique({ where: { orderId }, select: { status: true } })
  if (!payment) return false
  if (payment.status === 'PENDING') {
    await prisma.studentPayment.update({ where: { orderId }, data: { status: 'FAILED' } })
  }
  return true
}
