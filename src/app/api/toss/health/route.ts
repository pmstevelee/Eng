import { NextResponse } from 'next/server'
import { getPayment, TossServerError } from '@/lib/tosspayments/server'

export async function GET() {
  const secretKey = process.env.TOSS_SECRET_KEY
  const clientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY

  if (!secretKey || !clientKey) {
    return NextResponse.json(
      {
        ok: false,
        error: '토스페이먼츠 환경변수가 설정되지 않았습니다',
        missing: [!secretKey && 'TOSS_SECRET_KEY', !clientKey && 'NEXT_PUBLIC_TOSS_CLIENT_KEY'].filter(
          Boolean,
        ),
      },
      { status: 503 },
    )
  }

  // 존재하지 않는 orderId로 조회 → 404 응답이 오면 API 연결 성공
  try {
    await getPayment('health-check-probe')
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof TossServerError) {
      const isConnected = err.status === 404

      if (isConnected) {
        return NextResponse.json({ ok: true, note: '토스페이먼츠 API 연결 확인됨' })
      }

      return NextResponse.json({ ok: false, error: err.message }, { status: 502 })
    }

    return NextResponse.json({ ok: false, error: '알 수 없는 오류' }, { status: 500 })
  }
}
