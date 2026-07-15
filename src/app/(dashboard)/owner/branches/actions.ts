'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma/client'
import { getCurrentUser } from '@/lib/auth'
import { canManageBranches, BRANCH_COOKIE, BRANCH_ALL } from '@/lib/branch'

async function getOwnerHq() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ACADEMY_OWNER') return null
  const hq = await prisma.academy.findFirst({
    where: { ownerId: user.id, parentAcademyId: null, isDeleted: false },
    include: { subscription: { select: { plan: true } } },
  })
  if (!hq) return null
  // Subscription 레코드가 없으면 Academy.subscriptionPlan으로 fallback
  const planStr = hq.subscription?.plan ?? hq.subscriptionPlan
  return { user, hq, planStr }
}

export async function createBranch(formData: {
  name: string
  branchName: string
  address?: string
  phone?: string
}): Promise<{ error?: string; success?: boolean }> {
  const ctx = await getOwnerHq()
  if (!ctx) return { error: '권한이 없습니다.' }

  if (!canManageBranches(ctx.planStr)) {
    return { error: '다지점 관리는 스탠다드 이상 플랜에서 사용 가능합니다.' }
  }

  if (!formData.name?.trim()) return { error: '지점명을 입력해 주세요.' }
  if (!formData.branchName?.trim()) return { error: '지점 표시명을 입력해 주세요.' }

  const branchCount = await prisma.academy.count({
    where: { parentAcademyId: ctx.hq.id, isDeleted: false },
  })

  await prisma.academy.create({
    data: {
      name: formData.name.trim(),
      branchName: formData.branchName.trim(),
      address: formData.address?.trim() || null,
      phone: formData.phone?.trim() || null,
      parentAcademyId: ctx.hq.id,
      ownerId: ctx.user.id,
      branchOrder: branchCount + 1,
      maxStudents: ctx.hq.maxStudents,
      maxTeachers: ctx.hq.maxTeachers,
      subscriptionStatus: ctx.hq.subscriptionStatus,
      subscriptionPlan: ctx.hq.subscriptionPlan,
      trialEndsAt: ctx.hq.trialEndsAt,
    },
  })

  revalidatePath('/owner/branches')
  revalidateTag(`user-${ctx.user.id}`)
  revalidateTag(`owner-${ctx.user.id}-branches`)
  return { success: true }
}

export async function updateBranch(
  branchId: string,
  formData: { name: string; branchName: string; address?: string; phone?: string },
): Promise<{ error?: string; success?: boolean }> {
  const ctx = await getOwnerHq()
  if (!ctx) return { error: '권한이 없습니다.' }

  if (!canManageBranches(ctx.planStr)) return { error: '권한이 없습니다.' }

  const branch = await prisma.academy.findFirst({
    where: { id: branchId, parentAcademyId: ctx.hq.id, isDeleted: false },
  })
  if (!branch) return { error: '지점을 찾을 수 없습니다.' }

  if (!formData.name?.trim()) return { error: '지점명을 입력해 주세요.' }
  if (!formData.branchName?.trim()) return { error: '지점 표시명을 입력해 주세요.' }

  await prisma.academy.update({
    where: { id: branchId },
    data: {
      name: formData.name.trim(),
      branchName: formData.branchName.trim(),
      address: formData.address?.trim() || null,
      phone: formData.phone?.trim() || null,
    },
  })

  revalidatePath('/owner/branches')
  revalidateTag(`owner-${ctx.user.id}-branches`)
  return { success: true }
}

export async function deleteBranch(branchId: string): Promise<{ error?: string; success?: boolean }> {
  const ctx = await getOwnerHq()
  if (!ctx) return { error: '권한이 없습니다.' }

  if (!canManageBranches(ctx.planStr)) return { error: '권한이 없습니다.' }

  const branch = await prisma.academy.findFirst({
    where: { id: branchId, parentAcademyId: ctx.hq.id, isDeleted: false },
    include: {
      _count: {
        select: { users: { where: { isDeleted: false } } },
      },
    },
  })
  if (!branch) return { error: '지점을 찾을 수 없습니다.' }
  if (branch._count.users > 0) {
    return { error: `소속 구성원이 ${branch._count.users}명 있습니다. 먼저 구성원을 이동하거나 탈퇴 처리해 주세요.` }
  }

  await prisma.academy.update({
    where: { id: branchId },
    data: { isDeleted: true, deletedAt: new Date() },
  })

  revalidatePath('/owner/branches')
  revalidateTag(`owner-${ctx.user.id}-branches`)
  return { success: true }
}

export async function setSelectedBranch(branchId: string): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set(BRANCH_COOKIE, branchId, {
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
    sameSite: 'lax',
  })
  revalidatePath('/owner', 'layout')
}

export async function clearSelectedBranch(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set(BRANCH_COOKIE, BRANCH_ALL, { path: '/', maxAge: 60 * 60 * 24 * 30, sameSite: 'lax' })
  revalidatePath('/owner', 'layout')
}
