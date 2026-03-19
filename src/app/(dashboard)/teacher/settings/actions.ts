'use server'

import { prisma } from '@/lib/prisma/client'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function withdrawTeacher(
  formData: FormData,
): Promise<{ error: string } | void> {
  const password = formData.get('password') as string
  if (!password) return { error: '비밀번호를 입력해주세요.' }

  const supabase = await createClient()
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()
  if (!authUser) return { error: '인증이 필요합니다.' }

  const user = await prisma.user.findUnique({
    where: { id: authUser.id, isDeleted: false },
    select: { id: true, email: true, role: true },
  })
  if (!user || user.role !== 'TEACHER') return { error: '권한이 없습니다.' }

  // 비밀번호 확인
  const { error: pwError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password,
  })
  if (pwError) return { error: '비밀번호가 올바르지 않습니다.' }

  const userId = user.id

  try {
    await prisma.$transaction([
      // 1. 이 교사가 만든 테스트의 세션에 대한 문제 응답 삭제
      //    이 교사가 만든 문제에 대한 문제 응답 삭제
      prisma.questionResponse.deleteMany({
        where: {
          OR: [
            { session: { test: { createdBy: userId } } },
            { question: { createdBy: userId } },
          ],
        },
      }),
      // 2. 이 교사가 만든 테스트의 세션 삭제
      prisma.testSession.deleteMany({
        where: { test: { createdBy: userId } },
      }),
      // 3. 이 교사가 만든 테스트 삭제
      prisma.test.deleteMany({ where: { createdBy: userId } }),
      // 4. 이 교사가 만든 문제 삭제
      prisma.question.deleteMany({ where: { createdBy: userId } }),
      // 5. 이 교사가 작성한 코멘트 삭제
      prisma.teacherComment.deleteMany({ where: { teacherId: userId } }),
      // 6. 알림 삭제
      prisma.notification.deleteMany({ where: { userId } }),
      // 7. 담당 반에서 교사 참조 해제
      prisma.class.updateMany({
        where: { teacherId: userId },
        data: { teacherId: null },
      }),
      // 8. 생성한 리포트의 생성자 참조 해제
      prisma.report.updateMany({
        where: { generatedBy: userId },
        data: { generatedBy: null },
      }),
      // 9. 사용자 삭제
      prisma.user.delete({ where: { id: userId } }),
    ])
  } catch {
    return { error: '탈퇴 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' }
  }

  // Supabase Auth 계정 삭제
  const adminClient = await createAdminClient()
  await adminClient.auth.admin.deleteUser(userId)

  redirect('/login')
}
