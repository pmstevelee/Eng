import { NextResponse, type NextRequest } from 'next/server'
import { authenticateDeviceForCheck, KIOSK_COOKIE } from '@/lib/attendance/keypad-device'
import { findKioskStudents, processKioskCheck } from '@/lib/attendance/kiosk-check'
import type { KioskCheckRequest, KioskCheckResponse } from '@/lib/attendance/kiosk-types'

export const dynamic = 'force-dynamic'

/** 오프라인 재전송 입력 시각 허용 범위 */
const REPLAY_MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000
const FUTURE_TOLERANCE_MS = 2 * 60 * 1000

function json(body: KioskCheckResponse, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}

function isId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 64
}

function parseRequest(body: unknown): KioskCheckRequest | null {
  if (typeof body !== 'object' || body === null) return null
  const b = body as Record<string, unknown>
  if (typeof b.code !== 'string' || !/^\d{4}$/.test(b.code)) return null
  if (b.studentId !== undefined && !isId(b.studentId)) return null
  if (b.sessionId !== undefined && !isId(b.sessionId)) return null
  if (b.at !== undefined && (typeof b.at !== 'string' || Number.isNaN(Date.parse(b.at)))) return null
  return {
    code: b.code,
    studentId: b.studentId as string | undefined,
    sessionId: b.sessionId as string | undefined,
    at: b.at as string | undefined,
  }
}

/** 키패드 체크 — 기기 쿠키로 인증 (로그인 세션과 무관) */
export async function POST(request: NextRequest) {
  const now = Date.now()
  const serverNow = new Date(now).toISOString()

  const input = parseRequest(await request.json().catch(() => null))
  if (!input) return json({ ok: false, error: 'INVALID', serverNow }, 400)

  // 재전송분은 기기에서 입력한 시각으로 판정 (미래 시각은 지금으로, 너무 오래된 입력은 거부)
  let at = new Date(now)
  if (input.at) {
    const t = Date.parse(input.at)
    if (t < now - REPLAY_MAX_AGE_MS) return json({ ok: false, error: 'INVALID', serverNow }, 400)
    at = new Date(Math.min(t, now + FUTURE_TOLERANCE_MS))
  }

  const token = request.cookies.get(KIOSK_COOKIE)?.value
  try {
    // 기기 인증(+요청 수 집계)과 학생 후보 조회를 한 번의 왕복 시간에
    const [auth, candidates] = await Promise.all([authenticateDeviceForCheck(token), findKioskStudents(input)])
    if (!auth.ok) {
      if (auth.reason === 'RATE_LIMITED') return json({ ok: false, error: 'RATE_LIMITED', serverNow }, 429)
      // 쿠키는 지우지 않는다 — 새로고침해도 "기기 등록이 해제되었습니다"로 구분해 보여주기 위함
      return json({ ok: false, error: 'UNREGISTERED', serverNow }, 401)
    }

    const result = await processKioskCheck(auth.device, input, candidates, at, !!input.at)
    return json({ ok: true, result, serverNow })
  } catch (err) {
    console.error('[kiosk] check', err)
    return json({ ok: false, error: 'SERVER_ERROR', serverNow }, 500)
  }
}
