'use server'

import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma/client'
import { getCurrentUser } from '@/lib/auth'
import { setSessionProfileCookies } from '@/lib/account/multi-academy'
import type { Role } from '@/types'

const ROLE_REDIRECT: Record<Role, string> = {
  SUPER_ADMIN: '/admin',
  ACADEMY_OWNER: '/owner',
  TEACHER: '/teacher',
  STUDENT: '/student',
}

/**
 * 여러 학원에 가입된 교사·학생이 사용할 학원(프로필)을 바꾼다.
 * 같은 로그인 계정의 프로필만 선택할 수 있다.
 */
export async function switchAcademyProfile(profileId: string): Promise<{ error: string } | void> {
  const user = await getCurrentUser()
  if (!user) return { error: '로그인이 필요합니다.' }
  if (!user.academies.some((a) => a.profileId === profileId)) {
    return { error: '선택한 학원을 찾을 수 없습니다.' }
  }

  const role = user.role as Role
  await Promise.all([
    setSessionProfileCookies(role, profileId),
    // 다른 기기에서 로그인할 때도 마지막으로 쓴 학원으로 들어가도록
    prisma.user
      .update({ where: { id: profileId }, data: { lastLoginAt: new Date() } })
      .catch((err) => console.error('[switchAcademyProfile] lastLoginAt 업데이트 실패:', err)),
  ])

  redirect(ROLE_REDIRECT[role])
}
