'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma/client'
import { getAttendanceScope } from './access'
import {
  generateSecret,
  hashSecret,
  KIOSK_COOKIE,
  kioskCookieOptions,
  REGISTRATION_TTL_MS,
} from './keypad-device'

const NO_PERMISSION = '권한이 없습니다.'
const DEVICE_NAME_MAX = 30

async function getOwnerScope() {
  const scope = await getAttendanceScope()
  return scope?.role === 'ACADEMY_OWNER' ? scope : null
}

/** [기기 추가] — 10분 유효 일회용 등록 코드 발급 (원문은 응답으로만 전달, DB에는 해시) */
export async function createKeypadRegistration(
  academyId: string,
  name: string,
): Promise<{ error?: string; code?: string; expiresAt?: string }> {
  const scope = await getOwnerScope()
  if (!scope || !scope.academyIds.includes(academyId)) return { error: NO_PERMISSION }
  const trimmed = name.trim()
  if (!trimmed) return { error: '기기 이름을 입력해주세요.' }
  if (trimmed.length > DEVICE_NAME_MAX) return { error: `기기 이름은 ${DEVICE_NAME_MAX}자 이내로 입력해주세요.` }

  const code = generateSecret(24)
  const expiresAt = new Date(Date.now() + REGISTRATION_TTL_MS)
  try {
    await prisma.keypadRegistrationCode.create({
      data: { academyId, name: trimmed, codeHash: hashSecret(code), expiresAt, createdById: scope.userId },
    })
    return { code, expiresAt: expiresAt.toISOString() }
  } catch (err) {
    console.error('[kiosk] createKeypadRegistration', err)
    return { error: '등록 코드를 만들지 못했습니다. 잠시 후 다시 시도해주세요.' }
  }
}

/** [해제] — revokedAt 기록 (해당 기기의 다음 입력부터 401) */
export async function revokeKeypadDevice(deviceId: string): Promise<{ error?: string }> {
  const scope = await getOwnerScope()
  if (!scope) return { error: NO_PERMISSION }
  const result = await prisma.keypadDevice.updateMany({
    where: { id: deviceId, academyId: { in: scope.academyIds }, revokedAt: null },
    data: { revokedAt: new Date() },
  })
  if (result.count === 0) return { error: '기기를 찾을 수 없습니다.' }
  revalidatePath('/owner/attendance/settings')
  return {}
}

/**
 * /kiosk/register — 등록 코드를 사용 처리하고 기기 토큰을 쿠키로 발급.
 * 로그인 세션과 무관하게 동작한다 (코드 자체가 학원장이 발급한 일회용 권한).
 */
export async function registerKeypadDevice(code: string): Promise<{ error: string }> {
  if (!code || code.length > 128) return { error: '등록 코드가 올바르지 않습니다.' }
  const codeHash = hashSecret(code)
  const now = new Date()

  // 동시에 두 번 눌러도 한 번만 사용되도록 조건부 갱신
  const used = await prisma.keypadRegistrationCode.updateMany({
    where: { codeHash, usedAt: null, expiresAt: { gt: now } },
    data: { usedAt: now },
  })
  if (used.count === 0) {
    return { error: '만료되었거나 이미 사용된 등록 코드입니다. 학원장 화면에서 QR을 다시 만들어주세요.' }
  }
  const reg = await prisma.keypadRegistrationCode.findUnique({
    where: { codeHash },
    select: { academyId: true, name: true },
  })
  if (!reg) return { error: '등록 코드가 올바르지 않습니다.' }

  const cookieStore = cookies()
  const previous = cookieStore.get(KIOSK_COOKIE)?.value
  const token = generateSecret(32)
  await prisma.$transaction([
    // 이 기기에 이전 등록이 남아 있으면 해제 (같은 태블릿을 다시 등록하는 경우)
    ...(previous
      ? [
          prisma.keypadDevice.updateMany({
            where: { tokenHash: hashSecret(previous), revokedAt: null },
            data: { revokedAt: now },
          }),
        ]
      : []),
    prisma.keypadDevice.create({
      data: { academyId: reg.academyId, name: reg.name, tokenHash: hashSecret(token), lastSeenAt: now },
    }),
  ])

  cookieStore.set(KIOSK_COOKIE, token, kioskCookieOptions())
  revalidatePath('/owner/attendance/settings')
  redirect('/kiosk')
}
