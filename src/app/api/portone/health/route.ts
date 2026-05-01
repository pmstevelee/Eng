import { NextResponse } from 'next/server'
import { getPayment, PortOneServerError } from '@/lib/portone/server'

export async function GET() {
  const secret = process.env.PORTONE_API_SECRET
  const storeId = process.env.NEXT_PUBLIC_PORTONE_STORE_ID

  if (!secret || !storeId) {
    return NextResponse.json(
      {
        ok: false,
        error: '포트원 환경변수가 설정되지 않았습니다',
        missing: [
          !secret && 'PORTONE_API_SECRET',
          !storeId && 'NEXT_PUBLIC_PORTONE_STORE_ID',
        ].filter(Boolean),
      },
      { status: 503 },
    )
  }

  // 존재하지 않는 paymentId로 조회 → 404 응답이 오면 API 연결 성공
  try {
    await getPayment('health-check-probe')
    return NextResponse.json({ ok: true, storeId })
  } catch (err) {
    if (err instanceof PortOneServerError) {
      const isConnected =
        err.message.includes('PaymentNotFoundError') ||
        err.message.includes('404') ||
        err.message.includes('존재하지 않는')

      if (isConnected) {
        return NextResponse.json({ ok: true, storeId, note: '포트원 API 연결 확인됨' })
      }

      return NextResponse.json(
        { ok: false, error: err.message, storeId },
        { status: 502 },
      )
    }

    return NextResponse.json(
      { ok: false, error: '알 수 없는 오류', storeId },
      { status: 500 },
    )
  }
}
