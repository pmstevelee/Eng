import { NextResponse } from 'next/server'

// ─── DEPRECATED ────────────────────────────────────────────────────────────
// 결제 시스템이 포트원에서 토스페이먼츠 직접 연동으로 전환되면서
// 이 헬스체크는 더 이상 의미가 없다. /api/toss/health 를 사용한다.
// 파일은 삭제하지 않고 무해한 스텁으로 남겨둔다.

export async function GET() {
  return NextResponse.json(
    { ok: false, deprecated: true, message: '이 엔드포인트는 폐기되었습니다. /api/toss/health 를 사용하세요.' },
    { status: 410 },
  )
}
