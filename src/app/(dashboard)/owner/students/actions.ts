'use server'

import { prisma } from '@/lib/prisma/client'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

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

export async function updateStudentClass(
  studentId: string,
  classId: string | null,
): Promise<{ error?: string }> {
  const owner = await getOwner()
  if (!owner) return { error: '권한이 없습니다.' }

  const student = await prisma.student.findFirst({
    where: { id: studentId, user: { academyId: owner.academyId! } },
  })
  if (!student) return { error: '학생을 찾을 수 없습니다.' }

  await prisma.student.update({
    where: { id: studentId },
    data: { classId },
  })

  revalidatePath('/owner/students')
  revalidatePath(`/owner/students/${studentId}`)
  return {}
}

export async function updateStudentStatus(
  studentId: string,
  status: 'ACTIVE' | 'ON_LEAVE' | 'WITHDRAWN',
): Promise<{ error?: string }> {
  const owner = await getOwner()
  if (!owner) return { error: '권한이 없습니다.' }

  const student = await prisma.student.findFirst({
    where: { id: studentId, user: { academyId: owner.academyId! } },
  })
  if (!student) return { error: '학생을 찾을 수 없습니다.' }

  await prisma.student.update({
    where: { id: studentId },
    data: { status },
  })

  revalidatePath('/owner/students')
  revalidatePath(`/owner/students/${studentId}`)
  return {}
}

export async function updateStudentLevel(
  studentId: string,
  level: number,
): Promise<{ error?: string }> {
  const owner = await getOwner()
  if (!owner) return { error: '권한이 없습니다.' }

  const student = await prisma.student.findFirst({
    where: { id: studentId, user: { academyId: owner.academyId! } },
  })
  if (!student) return { error: '학생을 찾을 수 없습니다.' }

  await prisma.student.update({
    where: { id: studentId },
    data: { currentLevel: level },
  })

  revalidatePath('/owner/students')
  revalidatePath(`/owner/students/${studentId}`)
  return {}
}

export async function removeStudentFromAcademy(
  studentId: string,
): Promise<{ error?: string }> {
  const owner = await getOwner()
  if (!owner) return { error: '권한이 없습니다.' }

  const student = await prisma.student.findFirst({
    where: { id: studentId, user: { academyId: owner.academyId! } },
    select: { userId: true },
  })
  if (!student) return { error: '학생을 찾을 수 없습니다.' }

  // 학원에서 제거 (계정 유지, academyId만 해제)
  await prisma.user.update({
    where: { id: student.userId },
    data: { academyId: null },
  })

  revalidatePath('/owner/students')
  return {}
}

