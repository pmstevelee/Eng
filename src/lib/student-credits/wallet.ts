import 'server-only'

import { Prisma } from '@/generated/prisma'
import { prisma } from '@/lib/prisma/client'
import { kstMonthStart, todayKst } from '@/lib/attendance/time'
import { getCreditPricing } from '@/lib/credits/wallet'
import { STUDENT_FREE_FLASHCARD_WORDS_PER_MONTH, parseStudentPaidFeatures } from './constants'

// 학생 개인 크레딧 지갑 — 잔액 변경은 모두 여기 함수로만 (트랜잭션 + 조건부 UPDATE, 잔액은 음수가 되지 않음)
// 학원 통합 크레딧(lib/credits/wallet.ts)과 같은 방식이지만 테이블이 완전히 분리돼 있다.

type Tx = Prisma.TransactionClient
const TX_OPTIONS = { maxWait: 10_000, timeout: 20_000 }

function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002'
}

async function addBalance(tx: Tx, studentId: string, amount: number): Promise<number> {
  const rows = await tx.$queryRawUnsafe<{ balance: number }[]>(
    `INSERT INTO student_credit_wallets (id, student_id, balance, updated_at)
     VALUES (gen_random_uuid()::text, $1, $2, now())
     ON CONFLICT (student_id) DO UPDATE SET balance = student_credit_wallets.balance + EXCLUDED.balance, updated_at = now()
     RETURNING balance`,
    studentId,
    amount,
  )
  return rows[0].balance
}

async function subtractBalance(tx: Tx, studentId: string, amount: number): Promise<number | null> {
  const rows = await tx.$queryRawUnsafe<{ balance: number }[]>(
    `UPDATE student_credit_wallets SET balance = balance - $2, updated_at = now()
     WHERE student_id = $1 AND balance >= $2
     RETURNING balance`,
    studentId,
    amount,
  )
  return rows[0]?.balance ?? null
}

// ─── 기능 허용 여부 ────────────────────────────────────────────────────────────

/** 학원이 학생 결제·AI 플래시카드를 허용하는지 (settingsJson.studentPaidFeatures) */
export async function isStudentAiFlashcardEnabled(academyId: string | null | undefined): Promise<boolean> {
  if (!academyId) return false
  const academy = await prisma.academy.findUnique({ where: { id: academyId }, select: { settingsJson: true } })
  return parseStudentPaidFeatures(academy?.settingsJson).aiFlashcard
}

// ─── 잔액 · 사용 ───────────────────────────────────────────────────────────────

export async function getStudentBalance(studentId: string): Promise<number> {
  const wallet = await prisma.studentCreditWallet.findUnique({ where: { studentId }, select: { balance: true } })
  return wallet?.balance ?? 0
}

export interface StudentFlashcardQuota {
  usedFreeThisMonth: number
  freeLimit: number
  remainingFree: number
  creditBalance: number
  creditPerWord: number
  maxWords: number
}

export async function getStudentFlashcardQuota(studentId: string): Promise<StudentFlashcardQuota> {
  const [agg, balance, pricing] = await Promise.all([
    prisma.studentAiFlashcardUsage.aggregate({
      where: { studentId, createdAt: { gte: kstMonthStart(todayKst()) } },
      _sum: { freeCount: true },
    }),
    getStudentBalance(studentId),
    getCreditPricing(),
  ])
  const usedFreeThisMonth = agg._sum.freeCount ?? 0
  const freeLimit = STUDENT_FREE_FLASHCARD_WORDS_PER_MONTH
  const remainingFree = Math.max(0, freeLimit - usedFreeThisMonth)
  const creditPerWord = pricing.AI_FLASHCARD
  return {
    usedFreeThisMonth,
    freeLimit,
    remainingFree,
    creditBalance: balance,
    creditPerWord,
    maxWords: remainingFree + (creditPerWord > 0 ? Math.floor(balance / creditPerWord) : 0),
  }
}

/**
 * 학생이 AI로 만든 단어 수를 기록하고 무료 한도를 넘은 만큼 학생 크레딧을 차감한다 (AI 응답을 받은 뒤 호출).
 * 동시에 다른 요청으로 잔액이 먼저 소진됐으면 차감 없이 기록만 남긴다.
 */
export async function recordStudentFlashcardUsage(
  studentId: string,
  wordCount: number,
): Promise<{ freeCount: number; creditsUsed: number }> {
  if (wordCount <= 0) return { freeCount: 0, creditsUsed: 0 }
  const quota = await getStudentFlashcardQuota(studentId)
  const freeCount = Math.min(wordCount, quota.remainingFree)
  const paidWords = wordCount - freeCount
  const credits = paidWords * quota.creditPerWord

  return prisma.$transaction(async (tx) => {
    let creditsUsed = 0
    if (credits > 0) {
      const balanceAfter = await subtractBalance(tx, studentId, credits)
      if (balanceAfter !== null) {
        creditsUsed = credits
        await tx.studentCreditTransaction.create({
          data: {
            studentId,
            type: 'USE',
            amount: -credits,
            balanceAfter,
            memo: `AI 플래시카드 ${paidWords}단어`,
          },
        })
      } else {
        console.error('[student-credits] 크레딧 차감 실패 (잔액 부족 경합)', { studentId, paidWords })
      }
    }
    await tx.studentAiFlashcardUsage.create({ data: { studentId, wordCount, freeCount, creditsUsed } })
    return { freeCount, creditsUsed }
  }, TX_OPTIONS)
}

// ─── 충전 · 결제 취소 ──────────────────────────────────────────────────────────

export type StudentChargeResult = { status: 'CHARGED'; credits: number; balanceAfter: number } | { status: 'ALREADY' }

/**
 * 결제 완료된 학생 충전 (CHARGE). 결제 승인 페이지와 토스 웹훅 양쪽에서 호출되며
 * (orderId, CHARGE) unique로 같은 결제가 두 번 충전되지 않는다. paid를 넘기면 결제 PAID 처리도 같은 트랜잭션에서 한다.
 */
export async function chargeStudentCreditsForPayment(
  orderId: string,
  paid?: Prisma.StudentPaymentUpdateManyMutationInput,
): Promise<StudentChargeResult> {
  const payment = await prisma.studentPayment.findUnique({
    where: { orderId },
    select: { studentId: true, credits: true, packageKey: true },
  })
  if (!payment) throw new Error('학생 충전 결제를 찾을 수 없습니다.')

  try {
    return await prisma.$transaction(async (tx) => {
      if (paid) await tx.studentPayment.updateMany({ where: { orderId }, data: paid })
      const balanceAfter = await addBalance(tx, payment.studentId, payment.credits)
      await tx.studentCreditTransaction.create({
        data: {
          studentId: payment.studentId,
          type: 'CHARGE',
          amount: payment.credits,
          balanceAfter,
          orderId,
          memo: '크레딧 충전',
        },
      })
      return { status: 'CHARGED' as const, credits: payment.credits, balanceAfter }
    }, TX_OPTIONS)
  } catch (err) {
    if (isUniqueViolation(err)) return { status: 'ALREADY' }
    throw err
  }
}

/** 충전 결제 전액 취소 시 충전분 회수 (REFUND) — 이미 쓴 만큼은 제외하고 남은 잔액까지만 */
export async function refundStudentCreditsForPayment(orderId: string): Promise<void> {
  const charge = await prisma.studentCreditTransaction.findUnique({
    where: { orderId_type: { orderId, type: 'CHARGE' } },
    select: { studentId: true, amount: true },
  })
  if (!charge) return

  try {
    await prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRawUnsafe<{ balance: number }[]>(
        `SELECT balance FROM student_credit_wallets WHERE student_id = $1 FOR UPDATE`,
        charge.studentId,
      )
      const current = rows[0]?.balance ?? 0
      const take = Math.min(current, charge.amount)
      const balanceAfter = take > 0 ? await subtractBalance(tx, charge.studentId, take) : current
      await tx.studentCreditTransaction.create({
        data: {
          studentId: charge.studentId,
          type: 'REFUND',
          amount: -take,
          balanceAfter: balanceAfter ?? current,
          orderId,
          memo: take < charge.amount ? `결제 취소 (사용분 ${charge.amount - take} 제외 회수)` : '결제 취소',
        },
      })
    }, TX_OPTIONS)
  } catch (err) {
    if (!isUniqueViolation(err)) throw err
  }
}
