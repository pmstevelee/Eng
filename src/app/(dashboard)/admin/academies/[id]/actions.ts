'use server'

import { prisma } from '@/lib/prisma/client'
import { revalidatePath, revalidateTag } from 'next/cache'
import { redirect } from 'next/navigation'
import { getPlanTypeLimits, isSelectablePlanType } from '@/lib/plan-types'
import { getCurrentUser } from '@/lib/auth'
import { deleteOrphanAuthAccounts } from '@/lib/account/multi-academy'

async function requireAdmin() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (!user || user.role !== 'SUPER_ADMIN') redirect('/login')
}

export async function extendSubscription(formData: FormData) {
  await requireAdmin()

  const academyId = formData.get('academyId') as string
  const months = parseInt(formData.get('months') as string, 10)
  if (!academyId || isNaN(months)) return

  const academy = await prisma.academy.findUnique({
    where: { id: academyId },
    select: { subscriptionExpiresAt: true },
  })
  if (!academy) return

  const base = academy.subscriptionExpiresAt && academy.subscriptionExpiresAt > new Date()
    ? academy.subscriptionExpiresAt
    : new Date()
  const newExpiry = new Date(base)
  newExpiry.setMonth(newExpiry.getMonth() + months)

  await prisma.academy.update({
    where: { id: academyId },
    data: {
      subscriptionExpiresAt: newExpiry,
      subscriptionStatus: 'ACTIVE',
    },
  })

  revalidatePath(`/admin/academies/${academyId}`)
  revalidatePath('/admin/academies')
  // 학원장 구독 페이지·학생 단어학습 접근 캐시 무효화
  revalidateTag(`academy-${academyId}-subscription`)
}

export async function changePlan(formData: FormData) {
  await requireAdmin()

  const academyId = formData.get('academyId') as string
  const plan = formData.get('plan') as string
  if (!academyId || !plan) return

  // 실제 판매 요금제(무료/스타터/스탠다드/프리미엄)만 허용
  if (!isSelectablePlanType(plan)) return

  const newPlan = plan
  const limits = getPlanTypeLimits(newPlan)

  await prisma.academy.update({
    where: { id: academyId },
    data: {
      subscriptionPlan: newPlan,
      planType: newPlan,
      // 플랜에 맞춰 정원(교사/학생 한도)도 함께 적용
      maxStudents: limits.maxStudents,
      maxTeachers: limits.maxTeachers,
    },
  })

  revalidatePath(`/admin/academies/${academyId}`)
  revalidatePath('/admin/academies')
  // 학원장 구독 페이지·학생 단어학습 접근 캐시 무효화
  revalidateTag(`academy-${academyId}-subscription`)
}

export async function suspendAcademy(formData: FormData) {
  await requireAdmin()

  const academyId = formData.get('academyId') as string
  if (!academyId) return

  await prisma.academy.update({
    where: { id: academyId },
    data: { subscriptionStatus: 'CANCELLED' },
  })

  revalidatePath(`/admin/academies/${academyId}`)
  revalidatePath('/admin/academies')
  // 정지 즉시 학생 단어학습 접근이 막히도록 캐시 무효화
  revalidateTag(`academy-${academyId}-subscription`)
}

export async function deleteAcademy(
  formData: FormData,
): Promise<{ error: string } | void> {
  await requireAdmin()

  const academyId = formData.get('academyId') as string
  if (!academyId) return { error: '학원 ID가 없습니다.' }

  // Supabase Auth 삭제를 위해 학원 소속 사용자 ID 수집
  const academyUsers = await prisma.user.findMany({
    where: { academyId },
    select: { authId: true },
  })
  const authIds = academyUsers.map((u) => u.authId)

  try {
    // 외래키 의존 순서대로 전체 하드 삭제
    await prisma.$transaction([
      prisma.questionResponse.deleteMany({
        where: { session: { student: { user: { academyId } } } },
      }),
      prisma.testSession.deleteMany({
        where: { student: { user: { academyId } } },
      }),
      prisma.skillAssessment.deleteMany({
        where: { student: { user: { academyId } } },
      }),
      prisma.learningPath.deleteMany({
        where: { student: { user: { academyId } } },
      }),
      prisma.teacherComment.deleteMany({
        where: { student: { user: { academyId } } },
      }),
      prisma.report.deleteMany({
        where: { student: { user: { academyId } } },
      }),
      prisma.attendance.deleteMany({
        where: { student: { user: { academyId } } },
      }),
      prisma.badgeEarning.deleteMany({
        where: { student: { user: { academyId } } },
      }),
      prisma.enrollment.deleteMany({ where: { academyId } }),
      prisma.student.deleteMany({ where: { user: { academyId } } }),
      prisma.notification.deleteMany({ where: { academyId } }),
      prisma.class.deleteMany({ where: { academyId } }),
      prisma.test.deleteMany({ where: { academyId } }),
      prisma.question.deleteMany({ where: { academyId } }),
      prisma.badge.deleteMany({ where: { academyId } }),
      prisma.subscription.deleteMany({ where: { academyId } }),
      prisma.academy.update({ where: { id: academyId }, data: { ownerId: null } }),
      prisma.user.deleteMany({ where: { academyId } }),
      prisma.academy.delete({ where: { id: academyId } }),
    ])
  } catch {
    return { error: '삭제 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' }
  }

  // Supabase Auth 계정 삭제 — 다른 학원에도 가입된 교사·학생 계정은 유지
  await deleteOrphanAuthAccounts(authIds)

  redirect('/admin/academies')
}
