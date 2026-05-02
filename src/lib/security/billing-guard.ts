import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit } from './rate-limit'

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    '0.0.0.0'
  )
}

/** 결제 API 공통 가드: IP당 분당 30회 제한 */
export function billingRateGuard(req: NextRequest): NextResponse | null {
  const ip = getClientIp(req)
  const result = checkRateLimit(`billing:${ip}`, { windowMs: 60_000, max: 30 })

  if (!result.allowed) {
    return NextResponse.json(
      { error: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.' },
      {
        status: 429,
        headers: {
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
          'Retry-After': String(Math.ceil((result.resetAt - Date.now()) / 1000)),
        },
      },
    )
  }

  return null
}
