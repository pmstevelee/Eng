import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma/client'
import { getPayment, cancelPayment, PortOneServerError } from '@/lib/portone/server'
import { CREDIT_PACKAGES } from '@/lib/pricing'
import type { CreditPackageKey } from '@/lib/pricing'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id, isDeleted: false },
      select: { id: true, role: true, academyId: true },
    })

    if (!dbUser || dbUser.role !== 'ACADEMY_OWNER') {
      return NextResponse.json({ error: '학원장만 결제를 검증할 수 있습니다' }, { status: 403 })
    }

    const body = await req.json()
    const { paymentId, packageId } = body as { paymentId: string; packageId: string }

    if (!paymentId || !packageId) {
      return NextResponse.json({ error: 'paymentId와 packageId가 필요합니다' }, { status: 400 })
    }

    if (!(packageId in CREDIT_PACKAGES)) {
      return NextResponse.json({ error: '유효하지 않은 패키지입니다' }, { status: 400 })
    }

    const pendingPayment = await prisma.payment.findUnique({
      where: { paymentId },
    })

    if (!pendingPayment) {
      return NextResponse.json({ error: '결제 정보를 찾을 수 없습니다' }, { status: 404 })
    }

    if (pendingPayment.academyId !== dbUser.academyId) {
      return NextResponse.json({ error: '권한이 없습니다' }, { status: 403 })
    }

    // 멱등성: 이미 처리된 경우
    if (pendingPayment.status === 'PAID') {
      return NextResponse.json({ success: true, alreadyPaid: true })
    }

    if (pendingPayment.status !== 'PENDING') {
      return NextResponse.json(
        { error: `결제를 진행할 수 없는 상태입니다: ${pendingPayment.status}` },
        { status: 409 },
      )
    }

    // PortOne에서 결제 정보 조회 및 검증
    let portonePayment
    try {
      portonePayment = await getPayment(paymentId)
    } catch (err) {
      if (err instanceof PortOneServerError) {
        return NextResponse.json({ error: `결제 조회 실패: ${err.message}` }, { status: 400 })
      }
      throw err
    }

    if (portonePayment.status !== 'PAID') {
      await prisma.payment.update({
        where: { paymentId },
        data: { status: 'FAILED', failureReason: `PortOne 상태: ${portonePayment.status}` },
      })
      return NextResponse.json({ error: '결제가 완료되지 않았습니다' }, { status: 422 })
    }

    const pkg = CREDIT_PACKAGES[packageId as CreditPackageKey]

    // 금액 검증
    if (portonePayment.amount.total !== pkg.price) {
      await cancelPayment(paymentId, '결제 금액 불일치 - 시스템 자동 취소').catch(console.error)
      await prisma.payment.update({
        where: { paymentId },
        data: { status: 'FAILED', failureReason: '결제 금액 불일치' },
      })
      return NextResponse.json({ error: '결제 금액이 일치하지 않습니다' }, { status: 422 })
    }

    const now = new Date()
    const expiresAt = new Date(now)
    expiresAt.setFullYear(expiresAt.getFullYear() + 1) // 12개월 후 만료

    // 트랜잭션: Payment 업데이트 + AiCredit 2건 생성
    await prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { paymentId },
        data: {
          status: 'PAID',
          pgProvider: portonePayment.channel?.pgProvider ?? 'INICIS',
          pgTxId: portonePayment.transactionId ?? paymentId,
          receiptUrl: portonePayment.receiptUrl ?? null,
          paidAt: portonePayment.paidAt ? new Date(portonePayment.paidAt) : now,
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

    return NextResponse.json({
      success: true,
      credits: {
        writing: pkg.writingCredits,
        question: pkg.questionCredits,
        expiresAt: expiresAt.toISOString(),
      },
    })
  } catch (err) {
    console.error('[billing/credits/verify]', err)
    return NextResponse.json({ error: '서버 오류가 발생했습니다' }, { status: 500 })
  }
}
