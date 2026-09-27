import 'server-only'

import { Prisma } from '@/generated/prisma'
import { prisma } from '@/lib/prisma/client'
import {
  CREDIT_CHANNELS,
  DEFAULT_CREDIT_PRICING,
  DEFAULT_LOW_BALANCE_THRESHOLD,
  type CreditChannelValue,
  type CreditPricingMap,
} from './constants'

// 알림 크레딧 지갑 — 잔액 변경은 모두 여기 함수로만 (서버 트랜잭션 + 조건부 UPDATE)
// raw SQL은 $queryRawUnsafe + $1..$n (Prisma.sql 조각은 서버액션 번들에서 깨질 수 있음)

type Tx = Prisma.TransactionClient

/** 원격 DB 왕복을 고려한 대화형 트랜잭션 제한 시간 */
const TX_OPTIONS = { maxWait: 10_000, timeout: 20_000 }

/** 지점은 본원 지갑을 함께 쓴다 */
export async function walletAcademyIdOf(academyId: string): Promise<string> {
  const academy = await prisma.academy.findUnique({ where: { id: academyId }, select: { parentAcademyId: true } })
  return academy?.parentAcademyId ?? academyId
}

export async function getCreditPricing(): Promise<CreditPricingMap> {
  const rows = await prisma.creditPricing.findMany({ select: { channel: true, creditPerMessage: true } })
  const map: CreditPricingMap = { ...DEFAULT_CREDIT_PRICING }
  for (const r of rows) if (CREDIT_CHANNELS.includes(r.channel)) map[r.channel] = r.creditPerMessage
  return map
}

export type WalletSummary = { balance: number; lowBalanceThreshold: number }

export async function getWallet(walletAcademyId: string): Promise<WalletSummary> {
  const wallet = await prisma.creditWallet.findUnique({
    where: { academyId: walletAcademyId },
    select: { balance: true, lowBalanceThreshold: true },
  })
  return wallet ?? { balance: 0, lowBalanceThreshold: DEFAULT_LOW_BALANCE_THRESHOLD }
}

/** 잔액 증가 (지갑이 없으면 생성) → 증가 후 잔액 */
async function addBalance(tx: Tx, academyId: string, amount: number): Promise<number> {
  const rows = await tx.$queryRawUnsafe<{ balance: number }[]>(
    `INSERT INTO credit_wallets (id, academy_id, balance, updated_at)
     VALUES (gen_random_uuid()::text, $1, $2, now())
     ON CONFLICT (academy_id) DO UPDATE SET balance = credit_wallets.balance + EXCLUDED.balance, updated_at = now()
     RETURNING balance`,
    academyId,
    amount,
  )
  return rows[0].balance
}

/** 잔액이 amount 이상일 때만 차감 → 차감 후 잔액, 부족하면 null (잔액은 절대 음수가 되지 않음) */
async function subtractBalance(tx: Tx, academyId: string, amount: number): Promise<number | null> {
  const rows = await tx.$queryRawUnsafe<{ balance: number }[]>(
    `UPDATE credit_wallets SET balance = balance - $2, updated_at = now()
     WHERE academy_id = $1 AND balance >= $2
     RETURNING balance`,
    academyId,
    amount,
  )
  return rows[0]?.balance ?? null
}

function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002'
}

// ─── 발송 차감 ─────────────────────────────────────────────────────────────────

export type ChargeJobResult = { ok: true; balanceAfter: number; lowBalance: boolean } | { ok: false }

/**
 * 알림 발송 성공 건 차감 (USE) + 작업 정산 표시. 잔액이 모자라면 차감하지 않는다.
 * 같은 작업이 두 번 정산되지 않도록 settledAt IS NULL 조건으로 먼저 선점한다.
 */
export async function chargeNotificationJob(params: {
  jobId: string
  walletAcademyId: string
  channel: CreditChannelValue
  credits: number
}): Promise<ChargeJobResult> {
  const { jobId, walletAcademyId, channel, credits } = params
  return prisma.$transaction(async (tx) => {
    const claimed = await tx.notificationJob.updateMany({
      where: { id: jobId, settledAt: null },
      data: { settledAt: new Date(), channel },
    })
    if (claimed.count === 0) return { ok: false }

    const balanceAfter = await subtractBalance(tx, walletAcademyId, credits)
    if (balanceAfter === null) {
      await tx.notificationJob.update({
        where: { id: jobId },
        data: { errorMessage: '발송 후 잔액이 부족해 크레딧을 차감하지 못했습니다.' },
      })
      return { ok: false }
    }
    await tx.creditTransaction.create({
      data: {
        academyId: walletAcademyId,
        type: 'USE',
        amount: -credits,
        balanceAfter,
        notificationJobId: jobId,
      },
    })
    const wallet = await tx.creditWallet.findUnique({
      where: { academyId: walletAcademyId },
      select: { lowBalanceThreshold: true },
    })
    return { ok: true, balanceAfter, lowBalance: balanceAfter <= (wallet?.lowBalanceThreshold ?? 0) }
  }, TX_OPTIONS)
}

// ─── 충전 · 결제 취소 ──────────────────────────────────────────────────────────

export type CreditPaymentMeta = { creditPackageId: string; name: string; credits: number }

export function readCreditPaymentMeta(value: Prisma.JsonValue | null): CreditPaymentMeta | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const { creditPackageId, name, credits } = value as Record<string, unknown>
  if (typeof creditPackageId !== 'string' || typeof name !== 'string') return null
  if (typeof credits !== 'number' || !Number.isInteger(credits) || credits <= 0) return null
  return { creditPackageId, name, credits }
}

export type ChargeResult = { status: 'CHARGED'; credits: number; balanceAfter: number } | { status: 'ALREADY' }

/**
 * 결제 완료된 알림 크레딧 충전 (CHARGE). 결제 승인 페이지와 토스 웹훅 양쪽에서 호출되며,
 * (paymentId, CHARGE) unique로 같은 결제가 두 번 충전되지 않는다.
 * paid를 넘기면 Payment를 PAID로 바꾸는 작업도 같은 트랜잭션에서 처리한다.
 */
export async function chargeCreditsForPayment(
  orderId: string,
  paid?: Prisma.PaymentUpdateManyMutationInput,
): Promise<ChargeResult> {
  const payment = await prisma.payment.findUnique({
    where: { paymentId: orderId },
    select: { academyId: true, type: true, metadata: true },
  })
  if (!payment || payment.type !== 'NOTIFICATION_CREDIT') throw new Error('알림 크레딧 결제가 아닙니다.')
  const meta = readCreditPaymentMeta(payment.metadata)
  if (!meta) throw new Error('결제에 충전 상품 정보가 없습니다.')

  try {
    return await prisma.$transaction(async (tx) => {
      if (paid) await tx.payment.updateMany({ where: { paymentId: orderId }, data: paid })
      const balanceAfter = await addBalance(tx, payment.academyId, meta.credits)
      await tx.creditTransaction.create({
        data: {
          academyId: payment.academyId,
          type: 'CHARGE',
          amount: meta.credits,
          balanceAfter,
          paymentId: orderId,
          memo: `${meta.name} 패키지`,
        },
      })
      return { status: 'CHARGED' as const, credits: meta.credits, balanceAfter }
    }, TX_OPTIONS)
  } catch (err) {
    if (isUniqueViolation(err)) return { status: 'ALREADY' }
    throw err
  }
}

/**
 * 충전 결제 전액 취소 시 충전분 회수 (REFUND). 이미 사용한 크레딧이 있으면 남은 잔액까지만 회수한다.
 * 충전된 적 없는 결제거나 이미 회수했으면 아무것도 하지 않는다.
 */
export async function refundCreditsForPayment(orderId: string): Promise<void> {
  const charge = await prisma.creditTransaction.findUnique({
    where: { paymentId_type: { paymentId: orderId, type: 'CHARGE' } },
    select: { academyId: true, amount: true },
  })
  if (!charge) return

  try {
    await prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRawUnsafe<{ balance: number }[]>(
        `SELECT balance FROM credit_wallets WHERE academy_id = $1 FOR UPDATE`,
        charge.academyId,
      )
      const current = rows[0]?.balance ?? 0
      const take = Math.min(current, charge.amount)
      const balanceAfter = take > 0 ? await subtractBalance(tx, charge.academyId, take) : current
      await tx.creditTransaction.create({
        data: {
          academyId: charge.academyId,
          type: 'REFUND',
          amount: -take,
          balanceAfter: balanceAfter ?? current,
          paymentId: orderId,
          memo: take < charge.amount ? `결제 취소 (사용분 ${charge.amount - take} 제외 회수)` : '결제 취소',
        },
      })
    }, TX_OPTIONS)
  } catch (err) {
    if (!isUniqueViolation(err)) throw err
  }
}

// ─── 관리자 수동 조정 ──────────────────────────────────────────────────────────

export async function adjustCreditsByAdmin(params: {
  walletAcademyId: string
  delta: number
  memo: string
  actorId: string
}): Promise<{ balanceAfter: number } | { error: string }> {
  const { walletAcademyId, delta, memo, actorId } = params
  return prisma.$transaction(async (tx) => {
    const balanceAfter =
      delta >= 0 ? await addBalance(tx, walletAcademyId, delta) : await subtractBalance(tx, walletAcademyId, -delta)
    if (balanceAfter === null) return { error: '차감할 크레딧이 잔액보다 많습니다.' }
    await tx.creditTransaction.create({
      data: { academyId: walletAcademyId, type: 'ADMIN_ADJUST', amount: delta, balanceAfter, memo, actorId },
    })
    return { balanceAfter }
  }, TX_OPTIONS)
}
