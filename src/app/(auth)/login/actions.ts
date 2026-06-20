'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma/client'
import { primeAuthCache, invalidateAuthCache } from '@/lib/auth'
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

  let role: Role | null = null
  try {
    const user = await prisma.user.findUnique({
      where: { id: authUserId },
      select: { role: true },
    })

    if (!user) {
      await supabase.auth.signOut()
      return { error: '등록되지 않은 사용자입니다. 관리자에게 문의하세요.' }
    }

    role = user.role as Role
  } catch (err) {
    console.error('[signIn] DB 연결 오류:', err)
    await supabase.auth.signOut()
    return { error: 'DB 연결 오류가 발생했습니다. Vercel 환경변수(DATABASE_URL)를 확인해 주세요.' }
  }

  const cookieStore = await cookies()
  cookieStore.set('user-role', role, {
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7일
  })

  // 인증 캐시를 미리 채워서 다음 요청(/student 등)에서
  // supabase.auth.getUser() 네트워크 호출(~300-500ms)을 스킵한다.
  if (accessToken) primeAuthCache(accessToken, authUserId)

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
