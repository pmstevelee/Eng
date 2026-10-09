import { cache } from 'react'
import { cookies } from 'next/headers'
import { unstable_cache } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma/client'
import { ACTIVE_PROFILE_COOKIE } from '@/lib/account/multi-academy'

/**
 * Supabase `auth.getUser()`는 네트워크 왕복 검증(~200–600ms)이 있어
 * 페이지 네비게이션마다 반복 호출하면 체감 속도가 크게 저하된다.
 * access_token(JWT) 해시 기반 인메모리 캐시로 같은 토큰의
 * 재검증을 스킵한다. 5분 후 재검증 → 토큰 revoke 반영 지연 ≤5분.
 * (정상 로그아웃은 access_token 자체가 변경되어 즉시 무효화됨)
 */
type AuthUserCacheEntry = { userId: string; expiresAt: number }
// Server Action(action 레이어)과 RSC 렌더(rsc 레이어)는 webpack 레이어가 달라
// 같은 모듈이라도 인스턴스가 분리된다. 모듈 스코프 Map을 쓰면 로그인 액션에서
// primeAuthCache()로 채운 캐시를 이어지는 대시보드 렌더가 보지 못해 매번
// supabase.auth.getUser() 네트워크 왕복이 발생한다. Prisma 싱글턴과 같은 이유로
// globalThis에 붙여 두 레이어가 하나의 캐시를 공유하게 한다.
const globalForAuth = globalThis as unknown as {
  __authUserCache: Map<string, AuthUserCacheEntry> | undefined
}
const authUserCache = globalForAuth.__authUserCache ?? new Map<string, AuthUserCacheEntry>()
globalForAuth.__authUserCache = authUserCache
const AUTH_TTL_MS = 5 * 60_000

function pruneAuthCache(now: number) {
  if (authUserCache.size < 128) return
  authUserCache.forEach((v, k) => {
    if (v.expiresAt <= now) authUserCache.delete(k)
  })
}

/**
 * 로그인 직후 access_token으로 인증 캐시를 미리 채워서
 * 첫 대시보드 진입 시 supabase.auth.getUser() 네트워크 왕복(~300-500ms)을 건너뛴다.
 */
export function primeAuthCache(accessToken: string, userId: string) {
  const now = Date.now()
  pruneAuthCache(now)
  authUserCache.set(accessToken, { userId, expiresAt: now + AUTH_TTL_MS })
}

/**
 * 로그아웃 시 토큰을 캐시에서 즉시 제거하여 stale 인증을 방지한다.
 */
export function invalidateAuthCache(accessToken: string) {
  authUserCache.delete(accessToken)
}

/**
 * unstable_cache로 감싸서 요청 간에도 DB 조회 결과를 재사용합니다.
 * 로그인한 유저 정보(role, name, academyId)는 자주 바뀌지 않으므로
 * 60초 TTL 캐시가 안전하며, 로그아웃 시 태그로 즉시 무효화할 수 있습니다.
 *
 * 한 로그인 계정(authId)이 여러 학원 프로필(users 행)을 가질 수 있으므로
 * 계정의 프로필 전체를 한 번에 조회하고, 현재 학원은 메모리에서 고른다.
 * student.id까지 함께 조회해 학생 페이지에서 별도의 student-record
 * DB 왕복 없이 studentId를 바로 사용할 수 있게 한다.
 */
const getCachedProfiles = (authId: string) =>
  unstable_cache(
    () =>
      prisma.user.findMany({
        where: { authId, isDeleted: false },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          academyId: true,
          academy: { select: { name: true, businessName: true } },
          student: { select: { id: true } },
        },
        // 최근 로그인(학원 전환 포함)한 프로필이 앞에 오도록
        orderBy: [{ lastLoginAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'asc' }],
      }),
    ['current-user-v3', authId],
    { revalidate: 60, tags: [`user-${authId}`] },
  )()

/**
 * 로그인 직후 유저 캐시를 미리 채우기 위한 헬퍼.
 * 로그인 액션에서 호출하면 이어지는 대시보드 렌더에서
 * getCurrentUser의 DB 조회가 캐시 히트로 처리된다.
 */
export const getAccountProfilesCached = getCachedProfiles

/** 쿠키에 기억된 프로필이 이 계정 것이면 그것을, 아니면 최근 사용한 프로필을 고른다. */
export function pickActiveProfile<T extends { id: string }>(
  profiles: T[],
  preferredId: string | undefined,
): T | null {
  if (profiles.length === 0) return null
  return profiles.find((p) => p.id === preferredId) ?? profiles[0]
}

/**
 * React cache()로 감싸서 같은 요청(렌더링 트리) 안에서
 * 레이아웃 → 페이지로 이어지는 중복 호출을 방지합니다.
 *
 * 1차: 쿠키의 access_token으로 인메모리 캐시 확인 (히트 시 0ms)
 * 2차(캐시 미스): supabase.auth.getUser() 네트워크 검증 후 60초 캐싱
 * 3차: getCachedProfiles로 계정의 학원 프로필 조회 (60초 unstable_cache)
 * 4차: active-profile 쿠키로 현재 학원 프로필 선택
 */
export const getCurrentUser = cache(async () => {
  const supabase = await createClient()

  // Supabase SSR 쿠키에서 access_token을 추출 (토큰을 캐시 키로 사용)
  // Supabase는 {ref}-auth-token 형태로 세션 JSON 쿠키를 저장하며,
  // 용량 큰 세션은 여러 조각(.0, .1)으로 분할한다.
  const t0 = performance.now()
  const { data: { session } } = await supabase.auth.getSession()
  const accessToken = session?.access_token
  const sessionMs = Math.round(performance.now() - t0)

  if (!accessToken) return null

  const now = Date.now()
  const cached = authUserCache.get(accessToken)
  let verifiedUserId: string | undefined
  let verifyMs = 0

  if (cached && cached.expiresAt > now) {
    verifiedUserId = cached.userId
  } else {
    const t1 = performance.now()
    const { data: { user: authUser } } = await supabase.auth.getUser()
    verifyMs = Math.round(performance.now() - t1)
    if (!authUser) return null
    verifiedUserId = authUser.id
    pruneAuthCache(now)
    authUserCache.set(accessToken, { userId: authUser.id, expiresAt: now + AUTH_TTL_MS })
  }

  const t2 = performance.now()
  const profiles = await getCachedProfiles(verifiedUserId)
  const dbMs = Math.round(performance.now() - t2)
  const cookieStore = await cookies()
  const user = pickActiveProfile(profiles, cookieStore.get(ACTIVE_PROFILE_COOKIE)?.value)

  if (sessionMs + verifyMs + dbMs >= 100) {
    console.log(
      `  [getCurrentUser] session ${sessionMs}ms | getUser ${verifyMs === 0 ? '캐시히트' : `${verifyMs}ms`} | db ${dbMs}ms`,
    )
  }

  if (!user) return null

  // 학원 전환 메뉴용: 같은 계정의 다른 학원 프로필 목록
  const academies = profiles.map((p) => ({
    profileId: p.id,
    academyId: p.academyId,
    academyName: p.academy?.businessName ?? p.academy?.name ?? '학원',
  }))

  return { ...user, authId: verifiedUserId, academies }
})
