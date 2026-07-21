import { redirect } from 'next/navigation'
import { cache } from 'react'
import { getCurrentUser } from '@/lib/auth'

/**
 * 학생 페이지 전용 인증 헬퍼.
 * - getCurrentUser: 요청 단위 메모이즈(cache) + 인메모리 토큰 캐시로 ~0ms.
 * - studentId는 getCurrentUser의 user 캐시에 포함되어 별도 DB 왕복 없음.
 * - 같은 렌더 트리 안에서 여러 번 불려도 React cache()로 단일 실행.
 */
export const requireStudent = cache(async () => {
  const user = await getCurrentUser()
  if (!user || user.role !== 'STUDENT' || !user.student) redirect('/login')

  return {
    user,
    userId: user.id,
    authId: user.authId,
    studentId: user.student.id,
  }
})
