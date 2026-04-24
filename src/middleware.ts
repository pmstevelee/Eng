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

// 랜딩 도메인 목록 (마케팅 사이트)
const LANDING_HOSTS = ['wegoupenglish.com', 'www.wegoupenglish.com']

// 앱 도메인 목록 (LMS 로그인/대시보드)
const APP_HOSTS = ['login.wegoupenglish.com']

function getHostType(host: string): 'landing' | 'app' | 'dev' {
  if (LANDING_HOSTS.includes(host)) return 'landing'
  if (APP_HOSTS.includes(host)) return 'app'
  return 'dev' // localhost, vercel preview 등
}

export async function middleware(request: NextRequest) {
  const startTime = performance.now()
  const { pathname } = request.nextUrl
  const host = request.headers.get('host') ?? ''
  const hostType = getHostType(host)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function logAndReturn(response: any): any {
    const elapsed = Math.round(performance.now() - startTime)
    const label = `[${request.method} ${pathname}]`
    if (elapsed >= 200) {
      console.log(`⚠️ SLOW: ${label} ${elapsed}ms`)
    } else {
      console.log(`${label} ${elapsed}ms`)
    }
    try { response.headers.set('X-Response-Time', `${elapsed}ms`) } catch {}
    return response
  }

  const { supabaseResponse, user } = await updateSession(request)

  // ── 랜딩 도메인 (wegoupenglish.com) ──────────────────────────────────────
  // 로그인된 사용자는 앱 도메인으로 이동, 나머지는 랜딩 페이지 그대로 제공
  if (hostType === 'landing') {
    if (user) {
      const role = request.cookies.get('user-role')?.value as Role | undefined
      const dest = (role && ROLE_REDIRECT[role]) ? ROLE_REDIRECT[role] : '/login'
      return logAndReturn(
        NextResponse.redirect(new URL(`https://login.wegoupenglish.com${dest}`, request.url)),
      )
    }
    // 비로그인 → 랜딩 페이지 그대로 서빙
    return logAndReturn(supabaseResponse)
  }

  // ── 앱 도메인 또는 개발 환경 (login.wegoupenglish.com / localhost) ────────

  // 루트(/) 접속 시 처리
  if (pathname === '/') {
    if (user) {
      const role = request.cookies.get('user-role')?.value as Role | undefined
      if (role && ROLE_REDIRECT[role]) {
        return logAndReturn(NextResponse.redirect(new URL(ROLE_REDIRECT[role], request.url)))
      }
    }
    // 비로그인 → 로그인 페이지로
    return logAndReturn(NextResponse.redirect(new URL('/login', request.url)))
  }

  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p))

  // 미인증 사용자가 보호된 경로 접근 시 → 로그인 페이지로
  if (isProtected && !user) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    loginUrl.searchParams.set('redirect', pathname)
    return logAndReturn(NextResponse.redirect(loginUrl))
  }

  // 로그인된 사용자가 /login 접근 시 → 역할별 대시보드로
  if (user && pathname === '/login') {
    const role = request.cookies.get('user-role')?.value as Role | undefined
    if (role && ROLE_REDIRECT[role]) {
      return logAndReturn(NextResponse.redirect(new URL(ROLE_REDIRECT[role], request.url)))
    }
  }

  // 역할별 접근 제어: 자신의 역할 경로만 접근 가능
  if (user && isProtected) {
    const role = request.cookies.get('user-role')?.value as Role | undefined
    if (role) {
      const allowedPrefix = ROLE_REDIRECT[role]
      if (!pathname.startsWith(allowedPrefix)) {
        return logAndReturn(NextResponse.redirect(new URL(allowedPrefix, request.url)))
      }
    }
  }

  return logAndReturn(supabaseResponse)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
