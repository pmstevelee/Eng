import { NextRequest, NextResponse } from 'next/server'

// ─── DEPRECATED ────────────────────────────────────────────────────────────
// 결제 시스템이 포트원(PortOne) 기반에서 토스페이먼츠 직접 연동으로 전환되면서
// 이 엔드포인트는 더 이상 사용되지 않는다. 실제 웹훅은 /api/webhooks/toss 를 사용한다.
// 파일은 삭제하지 않고 무해한 스텁으로 남겨둔다 (기존 PG 대시보드에 등록된
// 웹훅 URL이 아직 이 경로를 가리키고 있을 가능성 대비).

export async function POST(_req: NextRequest): Promise<NextResponse> {
  return NextResponse.json(
    { ok: false, deprecated: true, message: '이 웹훅 엔드포인트는 폐기되었습니다. /api/webhooks/toss 를 사용하세요.' },
    { status: 410 },
  )
}
