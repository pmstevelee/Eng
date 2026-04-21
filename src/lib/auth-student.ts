import { redirect } from 'next/navigation'
import { unstable_cache } from 'next/cache'
import { cache } from 'react'
import { prisma } from '@/lib/prisma/client'
import { getCurrentUser } from '@/lib/auth'

// 학생 record(studentId) 60초 캐싱 — gamification.ts/learn/actions.ts와
// 동일한 캐시 키로 통일하여 교차 페이지에서도 같은 엔트리 재사용
const getCachedStudentRecord = (userId: string) =>
  unstable_cache(
    () =>
      prisma.user.findUnique({
        where: { id: userId, isDeleted: false },
        select: { id: true, role: true, student: { select: { id: true } } },
      }),
    ['student-record', userId],
    { revalidate: 60, tags: [`user-${userId}`] },
  )()

/**
 * 학생 페이지 전용 인증 헬퍼.
 * - getCurrentUser: 요청 단위 메모이즈(cache) + 인메모리 토큰 캐시로 ~0ms.
 * - getCachedStudentRecord: 60초 unstable_cache로 studentId를 DB 왕복 없이 재사용.
 * - 같은 렌더 트리 안에서 여러 번 불려도 React cache()로 단일 실행.
 */
export const requireStudent = cache(async () => {
  const user = await getCurrentUser()
  if (!user || user.role !== 'STUDENT') redirect('/login')

  const dbUser = await getCachedStudentRecord(user.id)
  if (!dbUser?.student) redirect('/login')

  return {
    user,
    userId: user.id,
    authId: user.authId,
    studentId: dbUser.student.id,
  }
})
