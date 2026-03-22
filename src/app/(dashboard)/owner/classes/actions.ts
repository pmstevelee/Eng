'use server'

import { prisma } from '@/lib/prisma/client'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { Prisma } from '@/generated/prisma'

// ─── Shared types ─────────────────────────────────────────────────────────────

export type ScheduleData = {
  days: string[]
  startTime: string
  endTime: string
  room: string
}

export type ClassInput = {
  name: string
  levelStart: number
  levelEnd: number
  teacherId: string | null
  schedule: ScheduleData
}

// ─── Auth helper ──────────────────────────────────────────────────────────────

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

function buildLevelRange(start: number, end: number): string {
  return start === end ? `Level ${start}` : `Level ${start}-${end}`
}

// ─── Class CRUD ───────────────────────────────────────────────────────────────

export async function createClass(
  input: ClassInput,
): Promise<{ error?: string; id?: string }> {
  const owner = await getOwner()
  if (!owner) return { error: '권한이 없습니다.' }

  const cls = await prisma.class.create({
    data: {
      academyId: owner.academyId!,
      name: input.name,
      levelRange: buildLevelRange(input.levelStart, input.levelEnd),
      teacherId: input.teacherId || null,
      scheduleJson: input.schedule as unknown as Prisma.InputJsonValue,
    },
  })

  revalidatePath('/owner/classes')
  return { id: cls.id }
}

export async function updateClass(
  classId: string,
  input: ClassInput,
): Promise<{ error?: string }> {
  const owner = await getOwner()
  if (!owner) return { error: '권한이 없습니다.' }

  const cls = await prisma.class.findFirst({
    where: { id: classId, academyId: owner.academyId! },
  })
  if (!cls) return { error: '반을 찾을 수 없습니다.' }

  await prisma.class.update({
    where: { id: classId },
    data: {
      name: input.name,
      levelRange: buildLevelRange(input.levelStart, input.levelEnd),
      teacherId: input.teacherId || null,
      scheduleJson: input.schedule as unknown as Prisma.InputJsonValue,
    },
  })

  revalidatePath('/owner/classes')
  revalidatePath(`/owner/classes/${classId}`)
  return {}
}

export async function toggleClassActive(classId: string): Promise<{ error?: string }> {
  const owner = await getOwner()
  if (!owner) return { error: '권한이 없습니다.' }

  const cls = await prisma.class.findFirst({
    where: { id: classId, academyId: owner.academyId! },
  })
  if (!cls) return { error: '반을 찾을 수 없습니다.' }

  await prisma.class.update({
    where: { id: classId },
    data: { isActive: !cls.isActive },
  })

  revalidatePath('/owner/classes')
  return {}
}

export async function deleteClass(classId: string): Promise<{ error?: string }> {
  const owner = await getOwner()
  if (!owner) return { error: '권한이 없습니다.' }

  const cls = await prisma.class.findFirst({
    where: { id: classId, academyId: owner.academyId! },
  })
  if (!cls) return { error: '반을 찾을 수 없습니다.' }

  await prisma.$transaction([
    prisma.student.updateMany({ where: { classId }, data: { classId: null } }),
    prisma.class.delete({ where: { id: classId } }),
  ])

  revalidatePath('/owner/classes')
  return {}
}

// ─── Student management ───────────────────────────────────────────────────────

export async function addStudentToClass(
  studentId: string,
  classId: string,
): Promise<{ error?: string }> {
  const owner = await getOwner()
  if (!owner) return { error: '권한이 없습니다.' }

  const [cls, student] = await Promise.all([
    prisma.class.findFirst({ where: { id: classId, academyId: owner.academyId! } }),
    prisma.student.findFirst({
      where: { id: studentId, user: { academyId: owner.academyId! } },
    }),
  ])
  if (!cls) return { error: '반을 찾을 수 없습니다.' }
  if (!student) return { error: '학생을 찾을 수 없습니다.' }

  await prisma.student.update({ where: { id: studentId }, data: { classId } })

  revalidatePath(`/owner/classes/${classId}`)
  revalidatePath('/owner/students')
  return {}
}

export async function moveStudentToClass(
  studentId: string,
  fromClassId: string,
  targetClassId: string,
): Promise<{ error?: string }> {
  const owner = await getOwner()
  if (!owner) return { error: '권한이 없습니다.' }

  await prisma.student.updateMany({
    where: { id: studentId, user: { academyId: owner.academyId! } },
    data: { classId: targetClassId },
  })

  revalidatePath(`/owner/classes/${fromClassId}`)
  revalidatePath(`/owner/classes/${targetClassId}`)
  revalidatePath('/owner/students')
  return {}
}

export async function removeStudentFromClass(
  studentId: string,
  classId: string,
): Promise<{ error?: string }> {
  const owner = await getOwner()
  if (!owner) return { error: '권한이 없습니다.' }

  await prisma.student.updateMany({
    where: { id: studentId, user: { academyId: owner.academyId! } },
    data: { classId: null },
  })

  revalidatePath(`/owner/classes/${classId}`)
  revalidatePath('/owner/students')
  return {}
}

// ─── Auto-assign ──────────────────────────────────────────────────────────────

export async function applyAutoAssign(
  assignments: Array<{ studentId: string; classId: string }>,
): Promise<{ error?: string }> {
  const owner = await getOwner()
  if (!owner) return { error: '권한이 없습니다.' }

  await prisma.$transaction(
    assignments.map(({ studentId, classId }) =>
      prisma.student.updateMany({
        where: { id: studentId, user: { academyId: owner.academyId! } },
        data: { classId },
      }),
    ),
  )

  revalidatePath('/owner/classes')
  revalidatePath('/owner/students')
  return {}
}
