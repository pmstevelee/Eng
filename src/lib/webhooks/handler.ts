import 'server-only'
import { prisma } from '@/lib/prisma/client'
import {
  PaymentStatus,
  PaymentType,
  SubscriptionStatus,
  Plan,
  AuditActorType,
} from '@/generated/prisma'
import { getPayment } from '@/lib/portone/server'
import { sendSlackRecurringFailAlert, sendSlackPaymentAlert } from '@/lib/notifications/slack'
import type { PortOneWebhookEvent } from '@/lib/portone/types'

// ─── 감사 로그 헬퍼 ───────────────────────────────────────────────────────────

export async function writeAuditLog(params: {
  actorType: AuditActorType
  actorId?: string
  action: string
  target: string
  metadata?: Record<string, unknown>
  ip?: string
  userAgent?: string
}): Promise<void> {
  await prisma.paymentAuditLog.create({
    data: {
      actorType: params.actorType,
      actorId: params.actorId,
      action: params.action,
      target: params.target,
      ip: params.ip,
      userAgent: params.userAgent,
      // Prisma JSON 필드는 null 또는 InputJsonValue만 허용
      ...(params.metadata ? { metadata: params.metadata as object } : {}),
    },
  })
}

// ─── 이벤트 디스패처 ──────────────────────────────────────────────────────────

export async function dispatchWebhookEvent(event: PortOneWebhookEvent): Promise<void> {
  switch (event.type) {
    case 'Transaction.Paid':
      await handlePaid(event.data.paymentId!)
      break
    case 'Transaction.Failed':
      await handleFailed(event.data.paymentId!)
      break
    case 'Transaction.Cancelled':
      await handleCancelled(event.data.paymentId!, false)
      break
    case 'Transaction.PartialCancelled':
      await handleCancelled(event.data.paymentId!, true)
      break
    case 'Transaction.VirtualAccountIssued':
      await handleVirtualAccountIssued(event.data.paymentId!)
      break
    case 'Transaction.VirtualAccountDeposited':
      await handlePaid(event.data.paymentId!)
      break
    case 'BillingKey.Issued':
      await handleBillingKeyIssued(event.data.billingKey!)
      break
    case 'BillingKey.Failed':
      await handleBillingKeyFailed(event.data.billingKey ?? 'unknown')
      break
    case 'BillingKey.Deleted':
      await handleBillingKeyDeleted(event.data.billingKey!)
      break
    default:
      // 미처리 이벤트 타입 — 무시
      break
  }
}

// ─── Transaction.Paid / VirtualAccountDeposited ───────────────────────────────

async function handlePaid(paymentId: string): Promise<void> {
  const payment = await prisma.payment.findUnique({
    where: { paymentId },
    include: { subscription: { include: { academy: true } } },
  })

  if (!payment) return

  // 멱등성: 이미 PAID면 무시
  if (payment.status === PaymentStatus.PAID) return

  // 포트원에서 실제 결제 정보 조회 후 금액 재검증
  const portonePayment = await getPayment(paymentId)
  if (portonePayment.status !== 'PAID' && portonePayment.status !== 'VIRTUAL_ACCOUNT_ISSUED') {
    return
  }

  if (portonePayment.amount.total !== payment.amount) {
    await writeAuditLog({
      actorType: AuditActorType.WEBHOOK,
      action: 'PAYMENT_AMOUNT_MISMATCH',
      target: `Payment:${paymentId}`,
      metadata: { expected: payment.amount, actual: portonePayment.amount.total },
    })
    return
  }

  // Payment → PAID
  await prisma.payment.update({
    where: { paymentId },
    data: {
      status: PaymentStatus.PAID,
      pgTxId: portonePayment.transactionId,
      receiptUrl: portonePayment.receiptUrl,
      paidAt: new Date(),
    },
  })

  await writeAuditLog({
    actorType: AuditActorType.WEBHOOK,
    action: 'PAYMENT_PAID',
    target: `Payment:${paymentId}`,
    metadata: { amount: payment.amount, type: payment.type },
  })

  // 결제 유형별 후처리
  const subscription = payment.subscription
  const academyName = subscription.academy.businessName ?? subscription.academy.name

  switch (payment.type) {
    case PaymentType.SUBSCRIPTION:
    case PaymentType.ANNUAL:
      await activateOrRenewSubscription(subscription.id, payment.type)
      break

    case PaymentType.CREDIT_PACKAGE:
      // credit verify 라우트에서 이미 크레딧 지급 — 웹훅은 감사 로그만
      break

    case PaymentType.STUDENT_OVERAGE:
    case PaymentType.STORAGE_OVERAGE:
    case PaymentType.OVERAGE_AI_WRITING:
    case PaymentType.OVERAGE_AI_QUESTION:
      // 초과결제 완료 → 차단 해제
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: { overageBlocked: false },
      })
      break
  }

  // 슬랙 알림: 10만원 이상 결제
  if (payment.amount >= 100000) {
    await sendSlackPaymentAlert({
      academyName,
      amount: payment.amount,
      paymentId,
      type: payment.type,
    })
  }
}

// ─── Transaction.Failed ───────────────────────────────────────────────────────

async function handleFailed(paymentId: string): Promise<void> {
  const payment = await prisma.payment.findUnique({
    where: { paymentId },
    include: { subscription: { include: { academy: true } } },
  })
  if (!payment || payment.status === PaymentStatus.FAILED) return

  await prisma.payment.update({
    where: { paymentId },
    data: { status: PaymentStatus.FAILED },
  })

  await writeAuditLog({
    actorType: AuditActorType.WEBHOOK,
    action: 'PAYMENT_FAILED',
    target: `Payment:${paymentId}`,
    metadata: { type: payment.type },
  })

  if (payment.type === PaymentType.SUBSCRIPTION || payment.type === PaymentType.ANNUAL) {
    // 재시도 큐 등록 (24시간 후)
    const retryAt = new Date(Date.now() + 24 * 60 * 60 * 1000)
    await prisma.paymentSchedule.create({
      data: {
        subscriptionId: payment.subscriptionId,
        scheduledAt: retryAt,
        type: payment.type,
        amount: payment.amount,
        retryCount: 0,
        metadata: { sourcePaymentId: paymentId, reason: 'webhook_failed' },
      },
    })

    const academyName =
      payment.subscription.academy.businessName ?? payment.subscription.academy.name
    await sendSlackRecurringFailAlert({
      academyName,
      amount: payment.amount,
      paymentId,
      reason: payment.failureReason ?? '알 수 없음',
      retryAt,
    })
  }
}

// ─── Transaction.Cancelled / PartialCancelled ────────────────────────────────

async function handleCancelled(paymentId: string, partial: boolean): Promise<void> {
  const payment = await prisma.payment.findUnique({
    where: { paymentId },
    include: { subscription: true },
  })
  if (!payment) return

  const newStatus = partial ? PaymentStatus.PARTIAL_CANCELED : PaymentStatus.CANCELED

  // 이미 해당 상태면 무시
  if (payment.status === newStatus || payment.status === PaymentStatus.CANCELED) return

  await prisma.payment.update({
    where: { paymentId },
    data: { status: newStatus, canceledAt: new Date() },
  })

  await writeAuditLog({
    actorType: AuditActorType.WEBHOOK,
    action: partial ? 'PAYMENT_PARTIAL_CANCELLED' : 'PAYMENT_CANCELLED',
    target: `Payment:${paymentId}`,
    metadata: { type: payment.type },
  })

  if (!partial && payment.type === PaymentType.SUBSCRIPTION) {
    // 구독 환불 → 다운그레이드 (cancel 라우트에서도 처리하지만 웹훅이 ground truth)
    await prisma.subscription.update({
      where: { id: payment.subscriptionId },
      data: {
        status: SubscriptionStatus.CANCELLED,
        plan: Plan.FREE,
      },
    })
  }

  if (!partial && payment.type === PaymentType.CREDIT_PACKAGE) {
    // 크레딧 패키지 환불 → 해당 결제로 지급한 크레딧 삭제
    await prisma.aiCredit.deleteMany({ where: { paymentId } })
  }
}

// ─── Transaction.VirtualAccountIssued ─────────────────────────────────────────

async function handleVirtualAccountIssued(paymentId: string): Promise<void> {
  // 가상계좌 발급 — Payment 상태를 PENDING 유지, 메타 업데이트
  await writeAuditLog({
    actorType: AuditActorType.WEBHOOK,
    action: 'VIRTUAL_ACCOUNT_ISSUED',
    target: `Payment:${paymentId}`,
  })
}

// ─── BillingKey.Issued ────────────────────────────────────────────────────────

async function handleBillingKeyIssued(billingKey: string): Promise<void> {
  await writeAuditLog({
    actorType: AuditActorType.WEBHOOK,
    action: 'BILLING_KEY_ISSUED',
    target: `BillingKey:${billingKey}`,
  })
}

// ─── BillingKey.Failed ────────────────────────────────────────────────────────

async function handleBillingKeyFailed(billingKey: string): Promise<void> {
  await writeAuditLog({
    actorType: AuditActorType.WEBHOOK,
    action: 'BILLING_KEY_FAILED',
    target: `BillingKey:${billingKey}`,
  })
}

// ─── BillingKey.Deleted ───────────────────────────────────────────────────────

async function handleBillingKeyDeleted(billingKey: string): Promise<void> {
  // DB에서도 삭제 (cancel 라우트가 먼저 삭제했을 수 있으므로 없으면 무시)
  await prisma.billingKey
    .delete({ where: { portoneBillingKey: billingKey } })
    .catch(() => undefined)

  await writeAuditLog({
    actorType: AuditActorType.WEBHOOK,
    action: 'BILLING_KEY_DELETED',
    target: `BillingKey:${billingKey}`,
  })
}

// ─── 구독 활성화/갱신 내부 헬퍼 ───────────────────────────────────────────────

async function activateOrRenewSubscription(
  subscriptionId: string,
  paymentType: PaymentType,
): Promise<void> {
  const subscription = await prisma.subscription.findUnique({ where: { id: subscriptionId } })
  if (!subscription) return

  const isAnnual = paymentType === PaymentType.ANNUAL

  const nextStart = subscription.currentPeriodEnd
  const nextEnd = new Date(nextStart)
  if (isAnnual) {
    nextEnd.setFullYear(nextEnd.getFullYear() + 1)
  } else {
    nextEnd.setMonth(nextEnd.getMonth() + 1)
  }

  // 이미 ACTIVE이고 기간이 미래면 갱신, 아니면 활성화
  await prisma.subscription.update({
    where: { id: subscriptionId },
    data: {
      status: SubscriptionStatus.ACTIVE,
      currentPeriodStart: nextStart,
      currentPeriodEnd: nextEnd,
    },
  })

  await writeAuditLog({
    actorType: AuditActorType.WEBHOOK,
    action: 'SUBSCRIPTION_RENEWED',
    target: `Subscription:${subscriptionId}`,
    metadata: { nextPeriodEnd: nextEnd.toISOString() },
  })
}
