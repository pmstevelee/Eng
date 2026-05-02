import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma/client'

const PAYMENT_TYPE_LABELS: Record<string, string> = {
  SUBSCRIPTION: '구독 결제',
  OVERAGE_AI_WRITING: 'AI 쓰기평가 초과',
  OVERAGE_AI_QUESTION: 'AI 문제생성 초과',
  CREDIT_PACKAGE: 'AI 크레딧 충전',
  ANNUAL: '연간 구독',
  STUDENT_OVERAGE: '학생 초과',
  STORAGE_OVERAGE: '스토리지 초과',
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ paymentId: string }> },
) {
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
      select: { id: true, role: true, academyId: true, name: true, email: true },
    })

    if (!dbUser) {
      return NextResponse.json({ error: '사용자 정보를 찾을 수 없습니다' }, { status: 401 })
    }

    const { paymentId } = await params

    const payment = await prisma.payment.findUnique({
      where: { paymentId },
      include: {
        subscription: {
          include: { academy: { select: { name: true, businessName: true } } },
        },
      },
    })

    if (!payment) {
      return NextResponse.json({ error: '결제 정보를 찾을 수 없습니다' }, { status: 404 })
    }

    if (payment.academyId !== dbUser.academyId) {
      return NextResponse.json({ error: '권한이 없습니다' }, { status: 403 })
    }

    // PortOne 영수증 URL이 있으면 리다이렉트
    if (payment.receiptUrl) {
      return NextResponse.redirect(payment.receiptUrl)
    }

    // 자체 HTML 영수증 생성
    const academy = payment.subscription?.academy
    const academyName = academy?.businessName ?? academy?.name ?? '학원'
    const paidAt = payment.paidAt
      ? new Date(payment.paidAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
      : '-'
    const typeLabel = PAYMENT_TYPE_LABELS[payment.type] ?? payment.type
    const statusLabel =
      payment.status === 'PAID'
        ? '결제 완료'
        : payment.status === 'REFUNDED'
          ? '환불 완료'
          : payment.status === 'PARTIAL_CANCELED'
            ? '부분 환불'
            : payment.status

    const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>영수증 - ${payment.paymentId}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, 'Malgun Gothic', sans-serif; background: #f7f8f9; display: flex; justify-content: center; padding: 40px 16px; }
    .receipt { background: white; border: 1px solid #e5e7eb; border-radius: 12px; width: 100%; max-width: 480px; padding: 32px; }
    .header { text-align: center; margin-bottom: 32px; border-bottom: 2px solid #1865F2; padding-bottom: 20px; }
    .logo { font-size: 20px; font-weight: 800; color: #1865F2; margin-bottom: 4px; }
    .title { font-size: 14px; color: #6b7280; }
    .section { margin-bottom: 20px; }
    .label { font-size: 12px; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px; }
    .value { font-size: 15px; color: #111827; font-weight: 500; }
    .amount { font-size: 28px; font-weight: 800; color: #1865F2; }
    .divider { border: none; border-top: 1px solid #f3f4f6; margin: 20px 0; }
    .status { display: inline-block; padding: 4px 12px; border-radius: 9999px; font-size: 13px; font-weight: 600; background: #d1fae5; color: #065f46; }
    .footer { text-align: center; font-size: 12px; color: #9ca3af; margin-top: 24px; }
    @media print { body { background: white; padding: 0; } .receipt { border: none; box-shadow: none; } }
  </style>
</head>
<body>
  <div class="receipt">
    <div class="header">
      <div class="logo">위고업잉글리시</div>
      <div class="title">전자 영수증</div>
    </div>

    <div class="section">
      <div class="label">거래 번호</div>
      <div class="value" style="font-size:13px;color:#6b7280;">${payment.paymentId}</div>
    </div>

    <div class="section">
      <div class="label">결제 상품</div>
      <div class="value">${typeLabel}</div>
    </div>

    <div class="section">
      <div class="label">결제 금액</div>
      <div class="amount">${payment.amount.toLocaleString('ko-KR')}원</div>
    </div>

    <hr class="divider" />

    <div class="section">
      <div class="label">결제 일시</div>
      <div class="value">${paidAt}</div>
    </div>

    <div class="section">
      <div class="label">결제 상태</div>
      <span class="status">${statusLabel}</span>
    </div>

    <div class="section">
      <div class="label">학원명</div>
      <div class="value">${academyName}</div>
    </div>

    ${payment.pgTxId ? `<div class="section"><div class="label">PG 거래번호</div><div class="value" style="font-size:12px;color:#6b7280;">${payment.pgTxId}</div></div>` : ''}

    <div class="footer">
      <p>위고업잉글리시 | 이 영수증은 전자 발행된 영수증입니다.</p>
      <p style="margin-top:4px;">문의: support@wegupenglish.com</p>
    </div>

    <div style="text-align:center;margin-top:20px;">
      <button onclick="window.print()" style="padding:8px 20px;background:#1865F2;color:white;border:none;border-radius:8px;cursor:pointer;font-size:14px;">인쇄</button>
    </div>
  </div>
</body>
</html>`

    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  } catch (err) {
    console.error('[billing/receipt]', err)
    return NextResponse.json({ error: '서버 오류가 발생했습니다' }, { status: 500 })
  }
}
