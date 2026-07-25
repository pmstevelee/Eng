import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma/client'
import { confirmPayment, TossServerError } from '@/lib/tosspayments/server'
import { CREDIT_PACKAGES } from '@/lib/pricing'
import type { CreditPackageKey } from '@/lib/pricing'

interface PageProps {
  searchParams: Promise<{ paymentKey?: string; orderId?: string; amount?: string }>
}

export default async function CreditsTossSuccessPage({ searchParams }: PageProps) {
  const params = await searchParams
  const { paymentKey, orderId, amount } = params

  if (!paymentKey || !orderId || !amount) {
    redirect('/owner/billing/credits?error=' + encodeURIComponent('결제 정보가 올바르지 않습니다'))
  }

  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) redirect('/login')

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id, isDeleted: false },
    select: { id: true, role: true, academyId: true },
  })

  if (!dbUser || dbUser.role !== 'ACADEMY_OWNER' || !dbUser.academyId) {
    redirect('/owner/billing/credits?error=' + encodeURIComponent('권한이 없습니다'))
  }

  const pendingPayment = await prisma.payment.findUnique({ where: { paymentId: orderId } })

  if (!pendingPayment || pendingPayment.academyId !== dbUser.academyId) {
    redirect('/owner/billing/credits?error=' + encodeURIComponent('결제 정보를 찾을 수 없습니다'))
  }

  if (pendingPayment.status === 'PAID') {
    // 이미 처리된 결제 (중복 리다이렉트 등) — 조용히 크레딧 페이지로
    redirect('/owner/billing/credits')
  }

  if (pendingPayment.status !== 'PENDING' || pendingPayment.type !== 'CREDIT_PACKAGE') {
    redirect(
      '/owner/billing/credits?error=' +
        encodeURIComponent(`결제를 진행할 수 없는 상태입니다: ${pendingPayment.status}`),
    )
  }

  const requestedAmount = Number(amount)
  if (requestedAmount !== pendingPayment.amount) {
    await prisma.payment.update({
      where: { paymentId: orderId },
      data: { status: 'FAILED', failureReason: '결제 금액 불일치' },
    })
    redirect('/owner/billing/credits?error=' + encodeURIComponent('결제 금액이 일치하지 않습니다'))
  }

  const pkgEntry = (Object.entries(CREDIT_PACKAGES) as [CreditPackageKey, (typeof CREDIT_PACKAGES)[CreditPackageKey]][]).find(
    ([, pkg]) => pkg.price === pendingPayment.amount,
  )

  if (!pkgEntry) {
    redirect('/owner/billing/credits?error=' + encodeURIComponent('패키지 정보를 찾을 수 없습니다'))
  }

  const [, pkg] = pkgEntry

  try {
    const tossPayment = await confirmPayment({ paymentKey, orderId, amount: requestedAmount })

    if (tossPayment.status !== 'DONE' || tossPayment.totalAmount !== pendingPayment.amount) {
      await prisma.payment.update({
        where: { paymentId: orderId },
        data: { status: 'FAILED', failureReason: `토스 상태: ${tossPayment.status}` },
      })
      redirect('/owner/billing/credits?error=' + encodeURIComponent('결제 승인에 실패했습니다'))
    }

    const now = new Date()
    const expiresAt = new Date(now)
    expiresAt.setFullYear(expiresAt.getFullYear() + 1) // 12개월 후 만료

    await prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { paymentId: orderId },
        data: {
          status: 'PAID',
          pgProvider: 'TOSSPAYMENTS',
          pgTxId: tossPayment.paymentKey,
          receiptUrl: tossPayment.receipt?.url ?? null,
          paidAt: tossPayment.approvedAt ? new Date(tossPayment.approvedAt) : now,
        },
      })

      await tx.aiCredit.create({
        data: {
          academyId: dbUser.academyId!,
          type: 'WRITING',
          amount: pkg.writingCredits,
          expiresAt,
          paymentId: pendingPayment.id,
        },
      })

      await tx.aiCredit.create({
        data: {
          academyId: dbUser.academyId!,
          type: 'QUESTION',
          amount: pkg.questionCredits,
          expiresAt,
          paymentId: pendingPayment.id,
        },
      })
    })

    const query = new URLSearchParams({
      success: '1',
      writing: String(pkg.writingCredits),
      question: String(pkg.questionCredits),
      expiresAt: expiresAt.toISOString(),
    })
    redirect(`/owner/billing/credits?${query.toString()}`)
  } catch (err) {
    if (err instanceof TossServerError) {
      await prisma.payment
        .update({
          where: { paymentId: orderId },
          data: { status: 'FAILED', failureReason: err.message },
        })
        .catch(() => {})
      redirect('/owner/billing/credits?error=' + encodeURIComponent(err.message))
    }
    // Next.js redirect는 내부적으로 throw이므로 그대로 전파
    throw err
  }
}
