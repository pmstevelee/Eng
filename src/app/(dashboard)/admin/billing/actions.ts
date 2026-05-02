'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma/client'
import { getCurrentUser } from '@/lib/auth'
import { cancelPayment } from '@/lib/portone/server'
import { payWithBillingKey } from '@/lib/portone/server'
import { writeAuditLog } from '@/lib/webhooks/handler'
import {
  PaymentStatus,
  PaymentType,
  SubscriptionStatus,
  Plan,
  AuditActorType,
} from '@/generated/prisma'

async function requireSuperAdmin() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'SUPER_ADMIN') throw new Error('권한 없음')
  return user
}

// ─── 강제 재시도 ───────────────────────────────────────────────────────────────

export async function forceRetryPayment(subscriptionId: string): Promise<{ error?: string }> {
  const admin = await requireSuperAdmin()

  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    include: { billingKey: true, academy: true, payments: { orderBy: { createdAt: 'desc' }, take: 1 } },
  })

  if (!subscription?.billingKey) return { error: '빌링키가 없습니다' }

  const lastPayment = subscription.payments[0]
  if (!lastPayment) return { error: '기존 결제 내역이 없습니다' }

  const portonePaymentId = crypto.randomUUID()
  const academyName = subscription.academy.businessName ?? subscription.academy.name

  await prisma.payment.create({
    data: {
      subscriptionId: subscription.id,
      academyId: subscription.academyId,
      paymentId: portonePaymentId,
      type: lastPayment.type,
      amount: lastPayment.amount,
      status: PaymentStatus.PENDING,
    },
  })

  try {
    const result = await payWithBillingKey({
      paymentId: portonePaymentId,
      billingKey: subscription.billingKey.portoneBillingKey,
      orderName: `${academyName} 재시도 결제 (관리자)`,
      amount: lastPayment.amount,
      customData: { adminForced: true, adminId: admin.id },
    })

    await prisma.payment.update({
      where: { paymentId: portonePaymentId },
      data: {
        status: PaymentStatus.PAID,
        pgTxId: result.transactionId,
        receiptUrl: result.receiptUrl,
        paidAt: new Date(),
      },
    })

    if (lastPayment.type === PaymentType.SUBSCRIPTION || lastPayment.type === PaymentType.ANNUAL) {
      const nextEnd = new Date(subscription.currentPeriodEnd)
      nextEnd.setMonth(nextEnd.getMonth() + 1)
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: { status: SubscriptionStatus.ACTIVE, currentPeriodEnd: nextEnd },
      })
    }

    await writeAuditLog({
      actorType: AuditActorType.ADMIN,
      actorId: admin.id,
      action: 'ADMIN_FORCE_RETRY',
      target: `Payment:${portonePaymentId}`,
      metadata: { subscriptionId, originalPaymentId: lastPayment.paymentId },
    })

    revalidatePath('/admin/billing')
    return {}
  } catch (err) {
    await prisma.payment.update({
      where: { paymentId: portonePaymentId },
      data: { status: PaymentStatus.FAILED, failureReason: String(err) },
    })
    return { error: err instanceof Error ? err.message : '재시도 실패' }
  }
}

// ─── 환불 처리 ─────────────────────────────────────────────────────────────────

export async function refundPayment(
  paymentId: string,
  reason: string,
): Promise<{ error?: string }> {
  if (!reason.trim()) return { error: '환불 사유를 입력해 주세요' }

  const admin = await requireSuperAdmin()

  const payment = await prisma.payment.findUnique({ where: { paymentId } })
  if (!payment) return { error: '결제를 찾을 수 없습니다' }
  if (payment.status !== PaymentStatus.PAID) return { error: '완료된 결제만 환불 가능합니다' }

  try {
    await cancelPayment(paymentId, reason)

    await prisma.payment.update({
      where: { paymentId },
      data: { status: PaymentStatus.REFUNDED, canceledAt: new Date() },
    })

    await writeAuditLog({
      actorType: AuditActorType.ADMIN,
      actorId: admin.id,
      action: 'ADMIN_REFUND',
      target: `Payment:${paymentId}`,
      metadata: { reason, amount: payment.amount },
    })

    revalidatePath('/admin/billing')
    return {}
  } catch (err) {
    return { error: err instanceof Error ? err.message : '환불 실패' }
  }
}

// ─── 구독 수동 활성화 ──────────────────────────────────────────────────────────

export async function manualActivateSubscription(
  subscriptionId: string,
  reason: string,
): Promise<{ error?: string }> {
  if (!reason.trim()) return { error: '활성화 사유를 입력해 주세요' }

  const admin = await requireSuperAdmin()

  const subscription = await prisma.subscription.findUnique({ where: { id: subscriptionId } })
  if (!subscription) return { error: '구독을 찾을 수 없습니다' }

  const nextEnd = new Date()
  nextEnd.setMonth(nextEnd.getMonth() + 1)

  await prisma.subscription.update({
    where: { id: subscriptionId },
    data: {
      status: SubscriptionStatus.ACTIVE,
      currentPeriodStart: new Date(),
      currentPeriodEnd: nextEnd,
    },
  })

  await writeAuditLog({
    actorType: AuditActorType.ADMIN,
    actorId: admin.id,
    action: 'ADMIN_MANUAL_ACTIVATE',
    target: `Subscription:${subscriptionId}`,
    metadata: { reason, nextEnd: nextEnd.toISOString() },
  })

  revalidatePath('/admin/billing')
  return {}
}

// ─── 대시보드 데이터 ───────────────────────────────────────────────────────────

export async function getBillingDashboardData() {
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  const [
    paidThisMonth,
    activeSubscriptions,
    trialSubscriptions,
    pastDueSubscriptions,
    failedSchedules,
    unprocessedWebhooks,
    recentPayments,
    auditLogs,
  ] = await Promise.all([
    // 이번 달 결제 완료 합계
    prisma.payment.aggregate({
      where: { status: PaymentStatus.PAID, paidAt: { gte: monthStart } },
      _sum: { amount: true },
      _count: true,
    }),

    // 활성 구독 (플랜별)
    prisma.subscription.groupBy({
      by: ['plan'],
      where: { status: SubscriptionStatus.ACTIVE },
      _count: true,
    }),

    // 무료체험 구독 수
    prisma.subscription.count({ where: { status: SubscriptionStatus.TRIAL } }),

    // PAST_DUE 구독 (3일 이상)
    prisma.subscription.findMany({
      where: {
        status: SubscriptionStatus.PAST_DUE,
        updatedAt: { lte: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000) },
      },
      include: { academy: true },
      orderBy: { updatedAt: 'asc' },
      take: 20,
    }),

    // 실패한 재시도 스케줄 (PENDING)
    prisma.paymentSchedule.findMany({
      where: { status: 'PENDING', scheduledAt: { lte: now } },
      include: { subscription: { include: { academy: true } } },
      orderBy: { scheduledAt: 'asc' },
      take: 20,
    }),

    // 미처리 웹훅 이벤트
    prisma.webhookEvent.count({ where: { status: 'FAILED' } }),

    // 최근 결제 내역
    prisma.payment.findMany({
      where: { createdAt: { gte: thirtyDaysAgo } },
      include: { subscription: { include: { academy: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),

    // 최근 감사 로그
    prisma.paymentAuditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 30,
    }),
  ])

  // 전환률: 지난 30일 내 TRIAL → ACTIVE
  const newActiveFromTrial = await prisma.subscription.count({
    where: {
      status: SubscriptionStatus.ACTIVE,
      createdAt: { gte: thirtyDaysAgo },
      plan: { not: Plan.FREE },
    },
  })
  const trialCreated = await prisma.subscription.count({
    where: { createdAt: { gte: thirtyDaysAgo } },
  })
  const conversionRate = trialCreated > 0 ? (newActiveFromTrial / trialCreated) * 100 : 0

  // AI 초과 결제 매출
  const overageRevenue = await prisma.payment.aggregate({
    where: {
      status: PaymentStatus.PAID,
      paidAt: { gte: monthStart },
      type: {
        in: [
          PaymentType.OVERAGE_AI_WRITING,
          PaymentType.OVERAGE_AI_QUESTION,
          PaymentType.STUDENT_OVERAGE,
          PaymentType.STORAGE_OVERAGE,
        ],
      },
    },
    _sum: { amount: true },
  })

  const mrr = paidThisMonth._sum.amount ?? 0
  const overageAmount = overageRevenue._sum.amount ?? 0
  const overageRatio = mrr > 0 ? (overageAmount / mrr) * 100 : 0

  return {
    mrr,
    paidCount: paidThisMonth._count,
    activeByPlan: activeSubscriptions,
    trialCount: trialSubscriptions,
    conversionRate,
    overageRatio,
    pastDueSubscriptions,
    failedSchedules,
    unprocessedWebhooks,
    recentPayments,
    auditLogs,
  }
}

// ─── 결제 검색 ─────────────────────────────────────────────────────────────────

export async function searchPayments(query: string) {
  if (!query.trim()) return []

  return prisma.payment.findMany({
    where: {
      OR: [
        { paymentId: { contains: query, mode: 'insensitive' } },
        { academyId: { contains: query, mode: 'insensitive' } },
        { subscription: { academy: { name: { contains: query, mode: 'insensitive' } } } },
        { subscription: { academy: { businessName: { contains: query, mode: 'insensitive' } } } },
      ],
    },
    include: { subscription: { include: { academy: true } } },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })
}
