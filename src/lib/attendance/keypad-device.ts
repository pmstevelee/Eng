import 'server-only'
import { createHash, randomBytes } from 'crypto'
import { prisma } from '@/lib/prisma/client'

/** 키패드 기기 토큰 쿠키 (httpOnly) */
export const KIOSK_COOKIE = 'kiosk_device'
export const KIOSK_COOKIE_MAX_AGE = 60 * 60 * 24 * 365

/** 등록 코드 유효시간 */
export const REGISTRATION_TTL_MS = 10 * 60 * 1000

/** /api/kiosk/check 기기당 분당 요청 제한 */
export const KIOSK_RATE_LIMIT_PER_MIN = 30

export function kioskCookieOptions() {
  return {
    httpOnly: true,
    // 로컬 개발에서 휴대폰으로 http://192.168.x.x 접속해도 쿠키가 저장되도록 운영에서만 secure
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: KIOSK_COOKIE_MAX_AGE,
  }
}

/** URL·쿠키에 안전한 무작위 문자열 (토큰·등록 코드) */
export function generateSecret(bytes = 32): string {
  return randomBytes(bytes).toString('base64url')
}

/** 토큰·등록 코드 원문은 저장하지 않고 SHA-256 해시만 저장 */
export function hashSecret(secret: string): string {
  return createHash('sha256').update(secret).digest('hex')
}

export type KioskDevice = { id: string; academyId: string }

export type DeviceAuthResult =
  | { ok: true; device: KioskDevice }
  | { ok: false; reason: 'UNREGISTERED' | 'RATE_LIMITED' }

/**
 * 체크 요청용 기기 인증 — 한 번의 UPDATE로
 * ① 토큰 확인(해제된 기기 제외) ② 마지막 접속 시각 갱신 ③ 분당 요청 수 집계(고정 1분 창)를 처리한다.
 * DB 카운터라 서버 인스턴스가 여러 개여도 제한이 정확하다.
 */
export async function authenticateDeviceForCheck(token: string | undefined): Promise<DeviceAuthResult> {
  if (!token) return { ok: false, reason: 'UNREGISTERED' }
  const rows = await prisma.$queryRaw<{ id: string; academy_id: string; rate_count: number }[]>`
    UPDATE keypad_devices SET
      last_seen_at = (now() AT TIME ZONE 'UTC'),
      rate_window_start = CASE
        WHEN rate_window_start > (now() AT TIME ZONE 'UTC') - interval '1 minute' THEN rate_window_start ELSE (now() AT TIME ZONE 'UTC') END,
      rate_count = CASE
        WHEN rate_window_start > (now() AT TIME ZONE 'UTC') - interval '1 minute' THEN rate_count + 1 ELSE 1 END
    WHERE token_hash = ${hashSecret(token)} AND revoked_at IS NULL
    RETURNING id, academy_id, rate_count
  `
  const row = rows[0]
  if (!row) return { ok: false, reason: 'UNREGISTERED' }
  if (row.rate_count > KIOSK_RATE_LIMIT_PER_MIN) return { ok: false, reason: 'RATE_LIMITED' }
  return { ok: true, device: { id: row.id, academyId: row.academy_id } }
}

export type KioskDeviceInfo = {
  id: string
  name: string
  academyId: string
  academyName: string
  revoked: boolean
}

/** 키패드 화면 진입 시 기기 확인 (해제된 기기도 돌려줘서 안내 문구를 구분) */
export async function findKioskDevice(token: string | undefined): Promise<KioskDeviceInfo | null> {
  if (!token) return null
  const device = await prisma.keypadDevice.findUnique({
    where: { tokenHash: hashSecret(token) },
    select: {
      id: true,
      name: true,
      academyId: true,
      revokedAt: true,
      academy: { select: { name: true } },
    },
  })
  if (!device) return null
  return {
    id: device.id,
    name: device.name,
    academyId: device.academyId,
    academyName: device.academy.name,
    revoked: !!device.revokedAt,
  }
}

export type KeypadDeviceRow = { id: string; name: string; lastSeenAt: string | null; createdAt: string }

/** 출결 설정 — 등록된(해제되지 않은) 기기 목록 */
export async function listKeypadDevices(academyId: string): Promise<KeypadDeviceRow[]> {
  const rows = await prisma.keypadDevice.findMany({
    where: { academyId, revokedAt: null },
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true, lastSeenAt: true, createdAt: true },
  })
  return rows.map((d) => ({
    id: d.id,
    name: d.name,
    lastSeenAt: d.lastSeenAt?.toISOString() ?? null,
    createdAt: d.createdAt.toISOString(),
  }))
}

/** 등록 코드 확인 (사용 전·유효시간 내) — 기기 등록 화면 안내용 */
export async function findValidRegistration(
  code: string | undefined,
): Promise<{ name: string; academyName: string } | null> {
  if (!code || code.length > 128) return null
  const reg = await prisma.keypadRegistrationCode.findUnique({
    where: { codeHash: hashSecret(code) },
    select: { name: true, usedAt: true, expiresAt: true, academy: { select: { name: true } } },
  })
  if (!reg || reg.usedAt || reg.expiresAt.getTime() <= Date.now()) return null
  return { name: reg.name, academyName: reg.academy.name }
}
