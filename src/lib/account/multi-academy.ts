import 'server-only'

import { randomUUID } from 'crypto'
import { cookies } from 'next/headers'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { prisma } from '@/lib/prisma/client'
import type { Role } from '@/types'

/**
 * 다중 학원 가입 지원
 *
 * 로그인 계정(Supabase Auth, 이메일 1개)은 하나이고, 학원마다 users 행(프로필)을
 * 따로 만든다. users.auth_id가 같은 계정의 프로필을 묶는다.
 * - 학습 기록·반·레벨은 프로필(학원)별로 분리된다.
 * - 역할 혼합은 허용하지 않는다(같은 계정의 프로필은 모두 같은 역할).
 * - 현재 사용 중인 학원 프로필은 ACTIVE_PROFILE_COOKIE에 users.id로 기억한다.
 */

export const ACTIVE_PROFILE_COOKIE = 'active-profile'

const COOKIE_OPTIONS = {
  path: '/',
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 60 * 60 * 24 * 7, // 7일
}

const ROLE_NAME: Record<Role, string> = {
  SUPER_ADMIN: '관리자',
  ACADEMY_OWNER: '학원장',
  TEACHER: '교사',
  STUDENT: '학생',
}

/** Supabase Auth는 이메일을 소문자로 저장하므로 대소문자 구분 없이 비교한다. */
export function emailEquals(email: string) {
  return { equals: email.trim(), mode: 'insensitive' as const }
}

function getServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

/** 세션 쿠키를 건드리지 않고 비밀번호만 확인한다. */
async function verifyPassword(email: string, password: string): Promise<string | null> {
  const client = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
  const { data, error } = await client.auth.signInWithPassword({ email: email.trim(), password })
  if (error || !data.user) return null
  return data.user.id
}

export type JoinAccountResult =
  | { error: string }
  /** 처음 가입하는 이메일 — Auth 계정을 새로 만든다 */
  | { kind: 'new' }
  /** 이미 다른 학원에 가입된 계정 — 비밀번호 확인 후 이 학원 프로필만 추가한다 */
  | { kind: 'link'; authId: string; profileId: string }

/**
 * 초대코드 가입 시 이메일이 이미 있으면 기존 계정에 학원 프로필을 추가할 수 있는지 판정한다.
 * 기존 계정의 비밀번호가 맞아야만 연결한다(남의 이메일로 프로필을 붙이는 것을 막는다).
 */
export async function resolveJoinAccount(input: {
  email: string
  password: string
  academyId: string
  role: Extract<Role, 'STUDENT' | 'TEACHER'>
}): Promise<JoinAccountResult> {
  const profiles = await prisma.user.findMany({
    where: { email: emailEquals(input.email) },
    select: { authId: true, academyId: true, role: true, isDeleted: true },
  })
  if (profiles.length === 0) return { kind: 'new' }

  const sameAcademy = profiles.find((p) => p.academyId === input.academyId)
  if (sameAcademy) {
    return {
      error: sameAcademy.isDeleted
        ? '이 학원에서 탈퇴 처리된 계정입니다. 학원에 문의해 주세요.'
        : '이미 이 학원에 가입된 계정입니다. 로그인해 주세요.',
    }
  }

  const otherRole = profiles.find((p) => p.role !== input.role)
  if (otherRole) {
    return {
      error: `이미 ${ROLE_NAME[otherRole.role as Role]} 계정으로 사용 중인 이메일입니다. 다른 역할로는 가입할 수 없습니다.`,
    }
  }

  const authId = await verifyPassword(input.email, input.password)
  if (!authId || !profiles.some((p) => p.authId === authId)) {
    return {
      error:
        '이미 다른 학원에 가입된 이메일입니다. 기존 계정의 비밀번호를 입력하면 이 학원에 추가로 가입됩니다.',
    }
  }

  return { kind: 'link', authId, profileId: randomUUID() }
}

/**
 * 학원장이 교사·학생을 직접 추가할 때: 다른 학원에서 쓰는 이메일이면
 * 비밀번호를 알 수 없으므로 초대코드로 본인이 추가 가입하도록 안내한다.
 */
export async function findEmailInUse(email: string, exceptAuthId?: string): Promise<string | null> {
  const existing = await prisma.user.findFirst({
    where: {
      email: emailEquals(email),
      ...(exceptAuthId ? { authId: { not: exceptAuthId } } : {}),
    },
    select: { id: true },
  })
  if (!existing) return null
  return '이미 다른 학원에서 사용 중인 이메일입니다. 해당 회원에게 초대코드로 이 학원에 추가 가입하도록 안내해 주세요.'
}

/** 같은 로그인 계정에 이 프로필 말고 다른 학원 프로필이 있는지 */
export async function countOtherProfiles(authId: string, exceptUserId: string): Promise<number> {
  return prisma.user.count({ where: { authId, id: { not: exceptUserId } } })
}

/**
 * 학원장이 교사·학생의 이메일/비밀번호를 바꿀 수 있는지 확인한다.
 * 다른 학원에서도 쓰는 계정이면 로그인 정보는 본인만 변경할 수 있다.
 */
export async function assertCredentialEditable(userId: string): Promise<{ authId: string } | { error: string }> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { authId: true } })
  if (!user) return { error: '회원을 찾을 수 없습니다.' }
  if ((await countOtherProfiles(user.authId, userId)) > 0) {
    return {
      error: '다른 학원에도 가입된 계정이라 이메일·비밀번호는 본인만 변경할 수 있습니다.',
    }
  }
  return { authId: user.authId }
}

/**
 * 프로필(users 행)을 지운 뒤 호출한다. 남은 학원 프로필이 없을 때만 Auth 계정을 삭제한다.
 */
export async function deleteAuthIfNoProfiles(authId: string): Promise<void> {
  const remaining = await prisma.user.count({ where: { authId } })
  if (remaining > 0) return
  await getServiceClient().auth.admin.deleteUser(authId)
}

/** 학원 삭제 등 여러 프로필을 지운 뒤 일괄 정리 */
export async function deleteOrphanAuthAccounts(authIds: string[]): Promise<void> {
  const unique = Array.from(new Set(authIds))
  if (unique.length === 0) return
  const stillUsed = await prisma.user.findMany({
    where: { authId: { in: unique } },
    select: { authId: true },
  })
  const used = new Set(stillUsed.map((u) => u.authId))
  const client = getServiceClient()
  await Promise.all(
    unique.filter((id) => !used.has(id)).map((id) => client.auth.admin.deleteUser(id)),
  )
}

/** 로그인·가입·학원 전환 후 역할/현재 학원 쿠키 설정 */
export async function setSessionProfileCookies(role: Role, profileId: string): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set('user-role', role, COOKIE_OPTIONS)
  cookieStore.set(ACTIVE_PROFILE_COOKIE, profileId, COOKIE_OPTIONS)
}
