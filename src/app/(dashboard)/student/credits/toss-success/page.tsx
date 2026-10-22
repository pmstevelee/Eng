import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma/client'
import { chargeStudentCreditsForPayment } from '@/lib/student-credits/wallet'
import { confirmPayment, TossServerError } from '@/lib/tosspayments/server'

interface PageProps {
  searchParams: Promise<{ paymentKey?: string; orderId?: string; amount?: string }>
}

const back = (error: string) => `/student/credits?error=${encodeURIComponent(error)}`

/**
 * 토스페이먼츠 결제 승인 → 학생 크레딧 충전.
 * 같은 결제가 웹훅으로도 들어오지만 chargeStudentCreditsForPayment가 orderId 기준 1회만 충전한다.
 */
export default async function StudentCreditTossSuccessPage({ searchParams }: PageProps) {
  const { paymentKey, orderId, amount } = await searchParams
  if (!paymentKey || !orderId || !amount) redirect(back('결제 정보가 올바르지 않습니다.'))

  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (user.role !== 'STUDENT' || !user.student) redirect(back('권한이 없습니다.'))

  const payment = await prisma.studentPayment.findUnique({
    where: { orderId },
    select: { studentId: true, status: true, amount: true, credits: true },
  })
  if (!payment || payment.studentId !== user.student.id) redirect(back('결제 정보를 찾을 수 없습니다.'))

  // 새로고침·웹훅 선처리 등으로 이미 승인된 결제
  if (payment.status === 'PAID') {
    await chargeStudentCreditsForPayment(orderId)
    redirect('/student/credits')
  }
  if (payment.status !== 'PENDING') redirect(back(`결제를 진행할 수 없는 상태입니다: ${payment.status}`))

  const requestedAmount = Number(amount)
  if (requestedAmount !== payment.amount) {
    await prisma.studentPayment.update({
      where: { orderId },
      data: { status: 'FAILED', failureReason: '결제 금액 불일치' },
    })
    redirect(back('결제 금액이 일치하지 않습니다.'))
  }

  let paidAt: Date
  let receiptUrl: string | null
  try {
    const toss = await confirmPayment({ paymentKey, orderId, amount: requestedAmount })
    if (toss.status !== 'DONE' || toss.totalAmount !== payment.amount) {
      await prisma.studentPayment.update({
        where: { orderId },
        data: { status: 'FAILED', failureReason: `토스 상태: ${toss.status}` },
      })
      redirect(back('결제 승인에 실패했습니다.'))
    }
    paidAt = toss.approvedAt ? new Date(toss.approvedAt) : new Date()
    receiptUrl = toss.receipt?.url ?? null
  } catch (err) {
    if (err instanceof TossServerError) {
      await prisma.studentPayment
        .update({ where: { orderId }, data: { status: 'FAILED', failureReason: err.message } })
        .catch(() => {})
      redirect(back(err.message))
    }
    // Next.js redirect는 내부적으로 throw이므로 그대로 전파
    throw err
  }

  // 결제 PAID 처리와 충전을 한 트랜잭션으로
  await chargeStudentCreditsForPayment(orderId, {
    status: 'PAID',
    pgTxId: paymentKey,
    receiptUrl,
    paidAt,
  })
  redirect(`/student/credits?charged=${payment.credits}`)
}
