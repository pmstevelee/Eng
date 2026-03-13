'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma/client'
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

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error || !data.user) {
    return { error: '이메일 또는 비밀번호가 올바르지 않습니다.' }
  }

  let role: Role | null = null
  try {
    const user = await prisma.user.findUnique({
      where: { id: data.user.id },
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

  redirect(ROLE_REDIRECT[role])
}

export async function signOut(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()

  const cookieStore = await cookies()
  cookieStore.delete('user-role')

  redirect('/login')
}
