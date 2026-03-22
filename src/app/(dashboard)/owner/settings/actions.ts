'use server'

import { prisma } from '@/lib/prisma/client'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { randomBytes } from 'crypto'

export async function withdrawAcademy(
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
    select: { id: true, email: true, role: true, academyId: true },
  })
  if (!user || user.role !== 'ACADEMY_OWNER') return { error: '권한이 없습니다.' }
  if (!user.academyId) return { error: '학원 정보를 찾을 수 없습니다.' }

  // 비밀번호 확인
  const { error: pwError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password,
  })
  if (pwError) return { error: '비밀번호가 올바르지 않습니다.' }

  const academyId = user.academyId

  // Supabase Auth 삭제를 위해 학원 소속 사용자 ID 수집
  const academyUsers = await prisma.user.findMany({
    where: { academyId },
    select: { id: true },
  })
  const userIds = academyUsers.map((u) => u.id)

  try {
    // 외래키 의존 순서대로 전체 삭제
    await prisma.$transaction([
      // 1. 문제 응답 (TestSession, Question 의존)
      prisma.questionResponse.deleteMany({
        where: { session: { student: { user: { academyId } } } },
      }),
      // 2. 테스트 세션 (Test, Student 의존)
      prisma.testSession.deleteMany({
        where: { student: { user: { academyId } } },
      }),
      // 3. 스킬 평가
      prisma.skillAssessment.deleteMany({
        where: { student: { user: { academyId } } },
      }),
      // 4. 학습 경로
      prisma.learningPath.deleteMany({
        where: { student: { user: { academyId } } },
      }),
      // 5. 교사 코멘트
      prisma.teacherComment.deleteMany({
        where: { student: { user: { academyId } } },
      }),
      // 6. 리포트
      prisma.report.deleteMany({
        where: { student: { user: { academyId } } },
      }),
      // 7. 출석
      prisma.attendance.deleteMany({
        where: { student: { user: { academyId } } },
      }),
      // 8. 배지 획득
      prisma.badgeEarning.deleteMany({
        where: { student: { user: { academyId } } },
      }),
      // 9. 수강 등록
      prisma.enrollment.deleteMany({ where: { academyId } }),
      // 10. 학생
      prisma.student.deleteMany({ where: { user: { academyId } } }),
      // 11. 알림
      prisma.notification.deleteMany({ where: { academyId } }),
      // 12. 반
      prisma.class.deleteMany({ where: { academyId } }),
      // 13. 테스트
      prisma.test.deleteMany({ where: { academyId } }),
      // 14. 문제 (학원 전용)
      prisma.question.deleteMany({ where: { academyId } }),
      // 15. 배지
      prisma.badge.deleteMany({ where: { academyId } }),
      // 16. 구독 이력
      prisma.subscription.deleteMany({ where: { academyId } }),
      // 17. ownerId FK 해제 후 사용자 삭제
      prisma.academy.update({ where: { id: academyId }, data: { ownerId: null } }),
      // 18. 학원 소속 전체 사용자 삭제
      prisma.user.deleteMany({ where: { academyId } }),
      // 19. 학원 삭제
      prisma.academy.delete({ where: { id: academyId } }),
    ])
  } catch {
    return { error: '탈퇴 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' }
  }

  // Supabase Auth 계정 삭제
  const adminClient = await createAdminClient()
  for (const uid of userIds) {
    await adminClient.auth.admin.deleteUser(uid)
  }

  redirect('/login')
}

export async function updateAcademyInfo(
  formData: FormData,
): Promise<{ error?: string; success?: boolean }> {
  const businessName = (formData.get('businessName') as string)?.trim()
  const address = (formData.get('address') as string)?.trim()
  const phone = (formData.get('phone') as string)?.trim()

  if (!businessName) return { error: '상호명을 입력해주세요.' }

  const supabase = await createClient()
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()
  if (!authUser) return { error: '인증이 필요합니다.' }

  const user = await prisma.user.findUnique({
    where: { id: authUser.id, isDeleted: false },
    select: { id: true, role: true, academyId: true },
  })
  if (!user || user.role !== 'ACADEMY_OWNER' || !user.academyId) return { error: '권한이 없습니다.' }

  await prisma.academy.update({
    where: { id: user.academyId },
    data: {
      businessName: businessName || null,
      address: address || null,
      phone: phone || null,
    },
  })

  revalidatePath('/owner/settings/academy')
  revalidatePath('/owner')
  return { success: true }
}

export async function updateNotificationSettings(settings: {
  newTeacherJoin: boolean
  newStudentJoin: boolean
  testCompleted: boolean
  subscriptionExpiring: boolean
}): Promise<{ error?: string; success?: boolean }> {
  const supabase = await createClient()
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()
  if (!authUser) return { error: '인증이 필요합니다.' }

  const user = await prisma.user.findUnique({
    where: { id: authUser.id, isDeleted: false },
    select: { id: true, role: true, academyId: true },
  })
  if (!user || user.role !== 'ACADEMY_OWNER' || !user.academyId) return { error: '권한이 없습니다.' }

  const academy = await prisma.academy.findUnique({
    where: { id: user.academyId },
    select: { settingsJson: true },
  })

  const currentSettings =
    academy?.settingsJson && typeof academy.settingsJson === 'object'
      ? (academy.settingsJson as Record<string, unknown>)
      : {}

  await prisma.academy.update({
    where: { id: user.academyId },
    data: {
      settingsJson: {
        ...currentSettings,
        notifications: {
          newTeacherJoin: settings.newTeacherJoin,
          newStudentJoin: settings.newStudentJoin,
          testCompleted: settings.testCompleted,
          subscriptionExpiring: true, // 항상 ON
        },
      },
    },
  })

  revalidatePath('/owner/settings/notifications')
  return { success: true }
}

export async function regenerateInviteCode(): Promise<{ error?: string; code?: string }> {
  const supabase = await createClient()
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()
  if (!authUser) return { error: '인증이 필요합니다.' }

  const user = await prisma.user.findUnique({
    where: { id: authUser.id, isDeleted: false },
    select: { id: true, role: true, academyId: true },
  })
  if (!user || user.role !== 'ACADEMY_OWNER' || !user.academyId) return { error: '권한이 없습니다.' }

  const newCode = randomBytes(4).toString('hex').toUpperCase()

  const academy = await prisma.academy.update({
    where: { id: user.academyId },
    data: { inviteCode: newCode },
    select: { inviteCode: true },
  })

  revalidatePath('/owner/settings')
  return { code: academy.inviteCode }
}
