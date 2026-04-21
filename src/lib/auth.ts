import { cache } from 'react'
import { unstable_cache } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma/client'

/**
 * Supabase `auth.getUser()`는 네트워크 왕복 검증(~200–400ms)이 있어
 * 페이지 네비게이션마다 반복 호출하면 체감 속도가 크게 저하된다.
 * access_token(JWT) 해시 기반 short-TTL 인메모리 캐시로 같은 토큰의
 * 재검증을 스킵한다. 60초 후 재검증 → 토큰 revoke 반영 지연 ≤60s.
 */
type AuthUserCacheEntry = { userId: string; expiresAt: number }
const authUserCache = new Map<string, AuthUserCacheEntry>()
const AUTH_TTL_MS = 60_000

function pruneAuthCache(now: number) {
  if (authUserCache.size < 128) return
  authUserCache.forEach((v, k) => {
    if (v.expiresAt <= now) authUserCache.delete(k)
  })
}

/**
 * unstable_cache로 감싸서 요청 간에도 DB 조회 결과를 재사용합니다.
 * 로그인한 유저 정보(role, name, academyId)는 자주 바뀌지 않으므로
 * 60초 TTL 캐시가 안전하며, 로그아웃 시 태그로 즉시 무효화할 수 있습니다.
 */
const getCachedDbUser = (userId: string) =>
  unstable_cache(
    () =>
      prisma.user.findUnique({
        where: { id: userId, isDeleted: false },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          academyId: true,
          academy: { select: { name: true, businessName: true } },
        },
      }),
    ['current-user', userId],
    { revalidate: 60, tags: [`user-${userId}`] },
  )()

/**
 * React cache()로 감싸서 같은 요청(렌더링 트리) 안에서
 * 레이아웃 → 페이지로 이어지는 중복 호출을 방지합니다.
 *
 * 1차: 쿠키의 access_token으로 인메모리 캐시 확인 (히트 시 0ms)
 * 2차(캐시 미스): supabase.auth.getUser() 네트워크 검증 후 60초 캐싱
 * 3차: getCachedDbUser로 DB 조회 (60초 unstable_cache)
 */
export const getCurrentUser = cache(async () => {
  const supabase = await createClient()

  // Supabase SSR 쿠키에서 access_token을 추출 (토큰을 캐시 키로 사용)
  // Supabase는 {ref}-auth-token 형태로 세션 JSON 쿠키를 저장하며,
  // 용량 큰 세션은 여러 조각(.0, .1)으로 분할한다.
  const { data: { session } } = await supabase.auth.getSession()
  const accessToken = session?.access_token

  if (!accessToken) return null

  const now = Date.now()
  const cached = authUserCache.get(accessToken)
  let verifiedUserId: string | undefined

  if (cached && cached.expiresAt > now) {
    verifiedUserId = cached.userId
  } else {
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) return null
    verifiedUserId = authUser.id
    pruneAuthCache(now)
    authUserCache.set(accessToken, { userId: authUser.id, expiresAt: now + AUTH_TTL_MS })
  }

  const user = await getCachedDbUser(verifiedUserId)
  return user ? { ...user, authId: verifiedUserId } : null
})
