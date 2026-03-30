import { cache } from 'react'
import { unstable_cache } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma/client'

/**
 * unstable_cache로 감싸서 요청 간에도 DB 조회 결과를 재사용합니다.
 * 로그인한 유저 정보(role, name, academyId)는 자주 바뀌지 않으므로
 * 30초 TTL 캐시가 안전하며, 로그아웃 시 태그로 즉시 무효화할 수 있습니다.
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
    { revalidate: 30, tags: [`user-${userId}`] },
  )()

/**
 * React cache()로 감싸서 같은 요청(렌더링 트리) 안에서
 * 레이아웃 → 페이지로 이어지는 중복 호출을 방지합니다.
 *
 * getUser(): Supabase Auth 서버에 요청하여 토큰 진위 검증 (보안 강화)
 * getCachedDbUser(): 30초 in-memory 캐시 → 두 번째 요청부터 DB 왕복 없이 즉시 반환
 *
 * 결과: 첫 로드 ~50ms(DB), 이후 페이지 이동 ~2ms(캐시 히트)
 */
export const getCurrentUser = cache(async () => {
  const supabase = await createClient()
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()

  if (!authUser) return null

  const user = await getCachedDbUser(authUser.id)

  return user ? { ...user, authId: authUser.id } : null
})
