import { NextRequest, NextResponse } from 'next/server'

// ─── DEPRECATED ────────────────────────────────────────────────────────────
// 크레딧 결제가 포트원 인앱 결제(requestOneTimePayment) + 이 라우트에서
// 검증하는 방식에서, 토스페이먼츠 리다이렉트 결제(requestPayment) +
// /owner/billing/credits/toss-success 페이지에서 승인·크레딧 지급하는 방식으로
// 전환되면서 이 엔드포인트는 더 이상 호출되지 않는다.
// 파일은 삭제하지 않고 무해한 스텁으로 남겨둔다.

export async function POST(_req: NextRequest): Promise<NextResponse> {
  return NextResponse.json(
    {
      ok: false,
      deprecated: true,
      message: '이 엔드포인트는 폐기되었습니다. /owner/billing/credits/toss-success 플로우를 사용하세요.',
    },
    { status: 410 },
  )
}
