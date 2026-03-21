/**
 * 시스템 배지 초기 데이터 생성 API
 * GET /api/dev-seed-badges
 */
import { NextResponse } from 'next/server'
import { seedSystemBadges } from '@/app/(dashboard)/student/_actions/gamification'

export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: '개발 환경에서만 사용 가능합니다.' }, { status: 403 })
  }
  try {
    const result = await seedSystemBadges()
    return NextResponse.json({ ok: true, message: `배지 ${result.created}개 생성/갱신 완료!` })
  } catch (err) {
    console.error('badge seed error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
