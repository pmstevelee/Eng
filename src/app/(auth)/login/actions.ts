'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma/client'
import {
  primeAuthCache,
  invalidateAuthCache,
  getAccountProfilesCached,
  pickActiveProfile,
} from '@/lib/auth'
import { ACTIVE_PROFILE_COOKIE, setSessionProfileCookies } from '@/lib/account/multi-academy'
import { logActivity } from '@/lib/activity-log'
import { ACTIVITY_ACTIONS } from '@/lib/constants/activity-actions'
import type { Role } from '@/types'

const ROLE_REDIRECT: Record<Role, string> = {
  SUPER_ADMIN: '/admin',
  ACADEMY_OWNER: '/owner',
  TEACHER: '/teacher',
  STUDENT: '/student',
}

export async function signIn(formData: FormData): Promise<{ error: string } | undefined> {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const supabase = await createClient()
  const signInStart = performance.now()

  let authUserId: string
  let accessToken: string | undefined
  try {
    const res = await supabase.auth.signInWithPassword({ email, password })
    if (res.error || !res.data.user) {
      return { error: '이메일 또는 비밀번호가 올바르지 않습니다.' }
    }
    authUserId = res.data.user.id
    accessToken = res.data.session?.access_token
  } catch {
    return { error: '네트워크 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' }
  }
  const authMs = Math.round(performance.now() - signInStart)

  // 인증 캐시를 미리 채워서 다음 요청(/student 등)에서
  // supabase.auth.getUser() 네트워크 호출(~300-500ms)을 스킵한다.
  if (accessToken) primeAuthCache(accessToken, authUserId)

  let role: Role | null = null
  let academyId: string | null = null
  let profileId: string
  try {
    // getCurrentUser와 같은 캐시를 사용해 로그인 시 조회 결과를
    // 이어지는 대시보드 렌더에서 그대로 재사용한다 (DB 왕복 1회 절약).
    // 여러 학원에 가입된 계정이면 이 기기에서 마지막으로 쓴 학원(없으면 최근 로그인 학원)으로 들어간다.
    const dbStart = performance.now()
    const profiles = await getAccountProfilesCached(authUserId)
    console.log(
      `📊 [signIn] auth: ${authMs}ms | db(user): ${Math.round(performance.now() - dbStart)}ms`,
    )

    const cookieStore = await cookies()
    const user = pickActiveProfile(profiles, cookieStore.get(ACTIVE_PROFILE_COOKIE)?.value)

    if (!user) {
      await supabase.auth.signOut()
      return { error: '등록되지 않은 사용자입니다. 관리자에게 문의하세요.' }
    }

    role = user.role as Role
    academyId = user.academyId
    profileId = user.id
  } catch (err) {
    console.error('[signIn] DB 연결 오류:', err)
    await supabase.auth.signOut()
    return { error: 'DB 연결 오류가 발생했습니다. Vercel 환경변수(DATABASE_URL)를 확인해 주세요.' }
  }

  await setSessionProfileCookies(role, profileId)

  // redirect 전에 완료를 기다린다. Vercel 서버리스는 응답 후 함수가 동결되어
  // fire-and-forget 쓰기가 유실될 수 있다. (두 쓰기는 병렬 처리, 실패는 각자 처리)
  await Promise.all([
    logActivity({ userId: profileId, role, academyId, action: ACTIVITY_ACTIONS.LOGIN }),
    prisma.user
      .update({ where: { id: profileId }, data: { lastLoginAt: new Date() } })
      .catch((err) => console.error('[signIn] lastLoginAt 업데이트 실패:', err)),
  ])

  redirect(ROLE_REDIRECT[role])
}

export async function findId(
  name: string,
  phone: string,
): Promise<{ email: string } | { error: string }> {
  if (!name.trim() || !phone.trim()) {
    return { error: '이름과 전화번호를 모두 입력해 주세요.' }
  }

  const normalizedPhone = phone.replace(/[-\s]/g, '')

  try {
    const user = await prisma.user.findFirst({
      where: {
        name: name.trim(),
        phone: { in: [normalizedPhone, phone.trim()] },
        isDeleted: false,
        isActive: true,
      },
      select: { email: true },
    })

    if (!user) {
      return { error: '입력하신 정보와 일치하는 계정을 찾을 수 없습니다.' }
    }

    return { email: user.email }
  } catch {
    return { error: '오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' }
  }
}

export async function signOut(): Promise<void> {
  // scope: 'local'을 사용해 Supabase Auth 서버 호출(~300-500ms)을 생략한다.
  // 어차피 쿠키 삭제로 클라이언트는 즉시 무효화되며, 토큰은 1시간 후 자연 만료된다.
  try {
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.access_token) invalidateAuthCache(session.access_token)
    await supabase.auth.signOut({ scope: 'local' })
  } catch {
    // 어떤 이유로든 실패해도 쿠키 삭제 + 리다이렉트로 진행
  }

  const cookieStore = await cookies()
  cookieStore.delete('user-role')

  redirect('/login')
}
