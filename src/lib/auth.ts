import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma/client'

/**
 * React cache()로 감싸서 같은 요청(렌더링 트리) 안에서
 * 레이아웃 → 페이지로 이어지는 중복 호출을 방지합니다.
 * 두 번째 호출부터는 네트워크/DB 없이 캐시에서 즉시 반환.
 */
export const getCurrentUser = cache(async () => {
  const supabase = await createClient()
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()

  if (!authUser) return null

  const user = await prisma.user.findUnique({
    where: { id: authUser.id, isDeleted: false },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      academyId: true,
      academy: { select: { name: true, businessName: true } },
    },
  })

  return user ? { ...user, authId: authUser.id } : null
})
