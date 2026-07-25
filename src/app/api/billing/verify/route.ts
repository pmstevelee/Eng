import { NextRequest, NextResponse } from 'next/server'

// ─── DEPRECATED ────────────────────────────────────────────────────────────
// 포트원 기반 결제 흐름(클라이언트가 이미 발급받은 billingKey를 서버로 넘겨
// 검증+즉시결제하는 방식)을 위한 라우트였으나, 코드베이스 내 어디에서도
// 호출되지 않는 것으로 확인됨(구독 카드 등록은 /owner/billing/toss-success
// 페이지가 authKey→billingKey 발급과 결제를 서버에서 원자적으로 처리함).
// 토스페이먼츠는 클라이언트가 billingKey를 독립적으로 보유하는 구조가 아니라
// 이 라우트가 하려던 패턴 자체가 적용되지 않는다. 파일은 삭제하지 않고
// 무해한 스텁으로 남겨둔다.

export async function POST(_req: NextRequest): Promise<NextResponse> {
  return NextResponse.json(
    {
      ok: false,
      deprecated: true,
      message: '이 엔드포인트는 폐기되었습니다. /owner/billing/toss-success 플로우를 사용하세요.',
    },
    { status: 410 },
  )
}
