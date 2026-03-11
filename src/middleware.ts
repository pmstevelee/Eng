import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'
import type { Role } from '@/types'

const ROLE_REDIRECT: Record<Role, string> = {
  SUPER_ADMIN: '/admin',
  ACADEMY_OWNER: '/owner',
  TEACHER: '/teacher',
  STUDENT: '/student',
}

const PROTECTED_PREFIXES = ['/admin', '/owner', '/teacher', '/student']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const { supabaseResponse, user } = await updateSession(request)

  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p))

  // 미인증 사용자가 보호된 경로 접근 시 → 로그인 페이지로
  if (isProtected && !user) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // 로그인된 사용자가 /login 접근 시 → 역할별 대시보드로
  if (user && pathname === '/login') {
    const role = request.cookies.get('user-role')?.value as Role | undefined
    if (role && ROLE_REDIRECT[role]) {
      return NextResponse.redirect(new URL(ROLE_REDIRECT[role], request.url))
    }
  }

  // 역할별 접근 제어: 자신의 역할 경로만 접근 가능
  if (user && isProtected) {
    const role = request.cookies.get('user-role')?.value as Role | undefined
    if (role) {
      const allowedPrefix = ROLE_REDIRECT[role]
      if (!pathname.startsWith(allowedPrefix)) {
        return NextResponse.redirect(new URL(allowedPrefix, request.url))
      }
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
