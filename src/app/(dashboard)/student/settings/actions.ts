'use server'

import { prisma } from '@/lib/prisma/client'
import { cookies } from 'next/headers'
import { revalidateTag } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { ACTIVE_PROFILE_COOKIE, deleteAuthIfNoProfiles } from '@/lib/account/multi-academy'

export async function withdrawStudent(
  formData: FormData,
): Promise<{ error: string } | void> {
  const password = formData.get('password') as string
  if (!password) return { error: '비밀번호를 입력해주세요.' }

  const user = await getCurrentUser()
  if (!user || user.role !== 'STUDENT') return { error: '권한이 없습니다.' }

  // 비밀번호 확인
  const supabase = await createClient()
  const { error: pwError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password,
  })
  if (pwError) return { error: '비밀번호가 올바르지 않습니다.' }

  const userId = user.id
  const studentId = user.student?.id

  try {
    await prisma.$transaction([
      // 1. 문제 응답 삭제 (학생 세션 의존)
      ...(studentId
        ? [
            prisma.questionResponse.deleteMany({
              where: { session: { studentId } },
            }),
            // 2. 테스트 세션 삭제
            prisma.testSession.deleteMany({ where: { studentId } }),
            // 3. 스킬 평가 삭제
            prisma.skillAssessment.deleteMany({ where: { studentId } }),
            // 4. 학습 경로 삭제
            prisma.learningPath.deleteMany({ where: { studentId } }),
            // 5. 교사 코멘트 삭제
            prisma.teacherComment.deleteMany({ where: { studentId } }),
            // 6. 리포트 삭제
            prisma.report.deleteMany({ where: { studentId } }),
            // 7. 출석 삭제
            prisma.attendance.deleteMany({ where: { studentId } }),
            // 8. 배지 획득 삭제
            prisma.badgeEarning.deleteMany({ where: { studentId } }),
            // 9. 수강 등록 삭제
            prisma.enrollment.deleteMany({ where: { studentId } }),
            // 10. 학생 레코드 삭제
            prisma.student.delete({ where: { id: studentId } }),
          ]
        : []),
      // 11. 알림 삭제
      prisma.notification.deleteMany({ where: { userId } }),
      // 12. 사용자 삭제
      prisma.user.delete({ where: { id: userId } }),
    ])
  } catch {
    return { error: '탈퇴 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' }
  }

  // 다른 학원에도 가입된 계정이면 이 학원 프로필만 삭제하고 남은 학원으로 이동,
  // 마지막 학원이었다면 Supabase Auth 계정까지 삭제
  if (user.academies.length > 1) {
    revalidateTag(`user-${user.authId}`)
    const cookieStore = await cookies()
    cookieStore.delete(ACTIVE_PROFILE_COOKIE)
    redirect('/')
  }

  await deleteAuthIfNoProfiles(user.authId)

  redirect('/login')
}
