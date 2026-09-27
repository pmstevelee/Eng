import { NextRequest, NextResponse } from 'next/server'

// ─── DEPRECATED ────────────────────────────────────────────────────────────
// AI 전용 크레딧 패키지(CREDIT_PACKAGE)는 알림·AI 통합 크레딧으로 대체되었다.
// 충전은 /owner/credits 화면의 startCreditCheckout 서버액션(NOTIFICATION_CREDIT 결제)으로 진행한다.
// 파일은 삭제하지 않고 무해한 스텁으로 남겨둔다.

export async function POST(_req: NextRequest): Promise<NextResponse> {
  return NextResponse.json(
    { error: 'AI 크레딧은 통합 크레딧으로 바뀌었습니다. 크레딧 화면에서 충전해주세요.', deprecated: true },
    { status: 410 },
  )
}
