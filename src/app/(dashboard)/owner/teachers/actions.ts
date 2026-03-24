'use server'

import { prisma } from '@/lib/prisma/client'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath, revalidateTag } from 'next/cache'

export type TeacherPermissions = {
  canCreateQuestions: boolean
  canEditGrades: boolean
}

async function getOwner() {
  const supabase = await createClient()
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()
  if (!authUser) return null

  const user = await prisma.user.findUnique({
    where: { id: authUser.id, isDeleted: false },
    select: { id: true, role: true, academyId: true },
  })
  if (!user || user.role !== 'ACADEMY_OWNER' || !user.academyId) return null
  return user
}

export async function assignClassToTeacher(
  teacherId: string,
  classId: string,
): Promise<{ error?: string }> {
  const owner = await getOwner()
  if (!owner) return { error: '권한이 없습니다.' }

  const teacher = await prisma.user.findFirst({
    where: { id: teacherId, academyId: owner.academyId!, role: 'TEACHER', isDeleted: false },
  })
  if (!teacher) return { error: '교사를 찾을 수 없습니다.' }

  const cls = await prisma.class.findFirst({
    where: { id: classId, academyId: owner.academyId! },
  })
  if (!cls) return { error: '반을 찾을 수 없습니다.' }

  await prisma.class.update({
    where: { id: classId },
    data: { teacherId },
  })

  revalidateTag(`academy-${owner.academyId}-teachers`)
  revalidatePath('/owner/teachers')
  revalidatePath(`/owner/teachers/${teacherId}`)
  return {}
}

export async function unassignClassFromTeacher(
  teacherId: string,
  classId: string,
): Promise<{ error?: string }> {
  const owner = await getOwner()
  if (!owner) return { error: '권한이 없습니다.' }

  await prisma.class.update({
    where: { id: classId, academyId: owner.academyId! },
    data: { teacherId: null },
  })

  revalidateTag(`academy-${owner.academyId}-teachers`)
  revalidatePath('/owner/teachers')
  revalidatePath(`/owner/teachers/${teacherId}`)
  return {}
}

export async function updateTeacherPermissions(
  teacherId: string,
  permissions: TeacherPermissions,
): Promise<{ error?: string }> {
  const owner = await getOwner()
  if (!owner) return { error: '권한이 없습니다.' }

  const teacher = await prisma.user.findFirst({
    where: { id: teacherId, academyId: owner.academyId!, role: 'TEACHER', isDeleted: false },
  })
  if (!teacher) return { error: '교사를 찾을 수 없습니다.' }

  const academy = await prisma.academy.findUnique({
    where: { id: owner.academyId! },
    select: { settingsJson: true },
  })

  const currentSettings = (academy?.settingsJson as Record<string, unknown>) ?? {}
  const teacherPermissions =
    (currentSettings.teacherPermissions as Record<string, TeacherPermissions>) ?? {}
  teacherPermissions[teacherId] = permissions

  await prisma.academy.update({
    where: { id: owner.academyId! },
    data: { settingsJson: { ...currentSettings, teacherPermissions } },
  })

  revalidatePath(`/owner/teachers/${teacherId}`)
  return {}
}

export async function removeTeacherFromAcademy(
  teacherId: string,
): Promise<{ error?: string }> {
  const owner = await getOwner()
  if (!owner) return { error: '권한이 없습니다.' }

  const teacher = await prisma.user.findFirst({
    where: { id: teacherId, academyId: owner.academyId!, role: 'TEACHER', isDeleted: false },
  })
  if (!teacher) return { error: '교사를 찾을 수 없습니다.' }

  // 교사가 담당하던 반에서 제거
  await prisma.class.updateMany({
    where: { teacherId, academyId: owner.academyId! },
    data: { teacherId: null },
  })

  // 학원에서 제거 (계정 유지)
  await prisma.user.update({
    where: { id: teacherId },
    data: { academyId: null },
  })

  revalidateTag(`academy-${owner.academyId}-teachers`)
  revalidatePath('/owner/teachers')
  return {}
}
