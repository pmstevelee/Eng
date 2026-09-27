import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma/client'
import { chargeCreditsForPayment, readCreditPaymentMeta, walletAcademyIdOf } from '@/lib/credits/wallet'
import { confirmPayment, TossServerError } from '@/lib/tosspayments/server'
import { writeAuditLog } from '@/lib/webhooks/handler'

interface PageProps {
  searchParams: Promise<{ paymentKey?: string; orderId?: string; amount?: string }>
}

const back = (error: string) => `/owner/credits?error=${encodeURIComponent(error)}`

/**
 * 토스페이먼츠 결제 승인 → 알림 크레딧 충전.
 * 같은 결제가 웹훅으로도 들어오지만 chargeCreditsForPayment가 paymentId 기준 1회만 충전한다.
 */
export default async function NotificationCreditTossSuccessPage({ searchParams }: PageProps) {
  const { paymentKey, orderId, amount } = await searchParams
  if (!paymentKey || !orderId || !amount) redirect(back('결제 정보가 올바르지 않습니다.'))

  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (user.role !== 'ACADEMY_OWNER' || !user.academyId) redirect(back('권한이 없습니다.'))

  const walletAcademyId = await walletAcademyIdOf(user.academyId)
  const payment = await prisma.payment.findUnique({
    where: { paymentId: orderId },
    select: { academyId: true, type: true, status: true, amount: true, metadata: true },
  })
  if (!payment || payment.academyId !== walletAcademyId || payment.type !== 'NOTIFICATION_CREDIT') {
    redirect(back('결제 정보를 찾을 수 없습니다.'))
  }
  const meta = readCreditPaymentMeta(payment.metadata)

  // 새로고침·웹훅 선처리 등으로 이미 승인된 결제
  if (payment.status === 'PAID') {
    await chargeCreditsForPayment(orderId)
    redirect('/owner/credits')
  }
  if (payment.status !== 'PENDING' || !meta) {
    redirect(back(`결제를 진행할 수 없는 상태입니다: ${payment.status}`))
  }

  const requestedAmount = Number(amount)
  if (requestedAmount !== payment.amount) {
    await prisma.payment.update({
      where: { paymentId: orderId },
      data: { status: 'FAILED', failureReason: '결제 금액 불일치' },
    })
    redirect(back('결제 금액이 일치하지 않습니다.'))
  }

  let paidAt: Date
  let receiptUrl: string | null
  try {
    const toss = await confirmPayment({ paymentKey, orderId, amount: requestedAmount })
    if (toss.status !== 'DONE' || toss.totalAmount !== payment.amount) {
      await prisma.payment.update({
        where: { paymentId: orderId },
        data: { status: 'FAILED', failureReason: `토스 상태: ${toss.status}` },
      })
      redirect(back('결제 승인에 실패했습니다.'))
    }
    paidAt = toss.approvedAt ? new Date(toss.approvedAt) : new Date()
    receiptUrl = toss.receipt?.url ?? null
  } catch (err) {
    if (err instanceof TossServerError) {
      await prisma.payment
        .update({ where: { paymentId: orderId }, data: { status: 'FAILED', failureReason: err.message } })
        .catch(() => {})
      redirect(back(err.message))
    }
    // Next.js redirect는 내부적으로 throw이므로 그대로 전파
    throw err
  }

  // 결제 PAID 처리와 충전을 한 트랜잭션으로
  const result = await chargeCreditsForPayment(orderId, {
    status: 'PAID',
    pgProvider: 'TOSSPAYMENTS',
    pgTxId: paymentKey,
    receiptUrl,
    paidAt,
  })
  if (result.status === 'CHARGED') {
    await writeAuditLog({
      actorType: 'USER',
      actorId: user.id,
      action: 'NOTIFICATION_CREDIT_CHARGED',
      target: `Payment:${orderId}`,
      metadata: { credits: result.credits, balanceAfter: result.balanceAfter },
    }).catch(() => {})
  }
  redirect(`/owner/credits?charged=${meta.credits}`)
}
