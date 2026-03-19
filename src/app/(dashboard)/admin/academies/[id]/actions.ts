'use server'

import { prisma } from '@/lib/prisma/client'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

async function requireAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { role: true },
  })
  if (!dbUser || dbUser.role !== 'SUPER_ADMIN') redirect('/login')
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
}

export async function changePlan(formData: FormData) {
  await requireAdmin()

  const academyId = formData.get('academyId') as string
  const plan = formData.get('plan') as string
  if (!academyId || !plan) return

  const validPlans = ['BASIC', 'STANDARD', 'PREMIUM', 'ENTERPRISE']
  if (!validPlans.includes(plan)) return

  await prisma.academy.update({
    where: { id: academyId },
    data: {
      subscriptionPlan: plan as 'BASIC' | 'STANDARD' | 'PREMIUM' | 'ENTERPRISE',
      planType: plan as 'BASIC' | 'STANDARD' | 'PREMIUM' | 'ENTERPRISE',
    },
  })

  revalidatePath(`/admin/academies/${academyId}`)
  revalidatePath('/admin/academies')
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
    select: { id: true },
  })
  const userIds = academyUsers.map((u) => u.id)

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

  // Supabase Auth 계정 일괄 삭제
  const adminClient = await createAdminClient()
  for (const uid of userIds) {
    await adminClient.auth.admin.deleteUser(uid)
  }

  redirect('/admin/academies')
}
