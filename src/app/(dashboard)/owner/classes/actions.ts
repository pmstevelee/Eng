'use server'

import { prisma } from '@/lib/prisma/client'
import { revalidatePath } from 'next/cache'
import type { Prisma } from '@/generated/prisma'
import { getCurrentUser } from '@/lib/auth'
import { revalidateTeacherClassViews } from '@/lib/students/revalidate-teacher-views'
import { BRANCH_ALL, getOwnerAcademyIds, getSelectedBranchId } from '@/lib/branch'

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

// 학원장이 관리하는 본원 + 모든 지점 ID를 함께 반환 (지점 반·학생도 관리 가능)
async function getOwner() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ACADEMY_OWNER' || !user.academyId) return null
  const ids = await getOwnerAcademyIds(user.id)
  return { ...user, academyId: user.academyId, academyIds: ids.length > 0 ? ids : [user.academyId] }
}

// 반과 같은 학원(본원/지점) 소속 학생인지 확인
async function findStudentInAcademy(studentId: string, academyId: string) {
  return prisma.student.findFirst({
    where: { id: studentId, user: { academyId, isDeleted: false } },
    select: { id: true, classId: true },
  })
}

function buildLevelRange(start: number, end: number): string {
  return start === end ? `Level ${start}` : `Level ${start}-${end}`
}

// 교사 대시보드는 교사 소속 학원의 반만 표시하므로 같은 학원 교사만 담당 지정
async function isTeacherOfAcademy(teacherId: string, academyId: string) {
  const teacher = await prisma.user.findFirst({
    where: { id: teacherId, academyId, role: 'TEACHER', isDeleted: false },
    select: { id: true },
  })
  return !!teacher
}

// ─── Class CRUD ───────────────────────────────────────────────────────────────

export async function createClass(
  input: ClassInput,
): Promise<{ error?: string; id?: string }> {
  const owner = await getOwner()
  if (!owner) return { error: '권한이 없습니다.' }

  // 특정 지점을 선택한 상태면 해당 지점에, 통합 보기면 본원에 생성
  const selectedBranchId = await getSelectedBranchId()
  const academyId =
    selectedBranchId !== BRANCH_ALL && owner.academyIds.includes(selectedBranchId)
      ? selectedBranchId
      : owner.academyId
  if (input.teacherId && !(await isTeacherOfAcademy(input.teacherId, academyId))) {
    return { error: '반과 같은 학원(지점) 소속 교사만 담당으로 지정할 수 있습니다.' }
  }

  const cls = await prisma.class.create({
    data: {
      academyId,
      name: input.name,
      levelRange: buildLevelRange(input.levelStart, input.levelEnd),
      teacherId: input.teacherId || null,
      scheduleJson: input.schedule as unknown as Prisma.InputJsonValue,
    },
  })

  await revalidateTeacherClassViews([cls.id])
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
    where: { id: classId, academyId: { in: owner.academyIds } },
  })
  if (!cls) return { error: '반을 찾을 수 없습니다.' }
  if (input.teacherId && !(await isTeacherOfAcademy(input.teacherId, cls.academyId))) {
    return { error: '반과 같은 학원(지점) 소속 교사만 담당으로 지정할 수 있습니다.' }
  }

  await prisma.class.update({
    where: { id: classId },
    data: {
      name: input.name,
      levelRange: buildLevelRange(input.levelStart, input.levelEnd),
      teacherId: input.teacherId || null,
      scheduleJson: input.schedule as unknown as Prisma.InputJsonValue,
    },
  })

  // 이전·새 담당 교사 화면 모두 갱신
  await revalidateTeacherClassViews([classId], [cls.teacherId])
  revalidatePath('/owner/classes')
  revalidatePath(`/owner/classes/${classId}`)
  return {}
}

export async function toggleClassActive(classId: string): Promise<{ error?: string }> {
  const owner = await getOwner()
  if (!owner) return { error: '권한이 없습니다.' }

  const cls = await prisma.class.findFirst({
    where: { id: classId, academyId: { in: owner.academyIds } },
  })
  if (!cls) return { error: '반을 찾을 수 없습니다.' }

  await prisma.class.update({
    where: { id: classId },
    data: { isActive: !cls.isActive },
  })

  await revalidateTeacherClassViews([classId])
  revalidatePath('/owner/classes')
  return {}
}

export async function deleteClass(classId: string): Promise<{ error?: string }> {
  const owner = await getOwner()
  if (!owner) return { error: '권한이 없습니다.' }

  const cls = await prisma.class.findFirst({
    where: { id: classId, academyId: { in: owner.academyIds } },
  })
  if (!cls) return { error: '반을 찾을 수 없습니다.' }

  await prisma.$transaction([
    prisma.student.updateMany({ where: { classId }, data: { classId: null } }),
    prisma.class.delete({ where: { id: classId } }),
  ])

  await revalidateTeacherClassViews([], [cls.teacherId])
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

  const cls = await prisma.class.findFirst({
    where: { id: classId, academyId: { in: owner.academyIds } },
    select: { academyId: true },
  })
  if (!cls) return { error: '반을 찾을 수 없습니다.' }
  const student = await findStudentInAcademy(studentId, cls.academyId)
  if (!student) return { error: '학생을 찾을 수 없습니다.' }

  await prisma.student.update({ where: { id: studentId }, data: { classId } })

  await revalidateTeacherClassViews([classId, student.classId])
  revalidatePath(`/owner/classes/${classId}`)
  if (student.classId && student.classId !== classId) revalidatePath(`/owner/classes/${student.classId}`)
  revalidatePath('/owner/students')
  revalidatePath('/owner/classes')
  return {}
}

export async function moveStudentToClass(
  studentId: string,
  fromClassId: string,
  targetClassId: string,
): Promise<{ error?: string }> {
  const owner = await getOwner()
  if (!owner) return { error: '권한이 없습니다.' }

  const target = await prisma.class.findFirst({
    where: { id: targetClassId, academyId: { in: owner.academyIds } },
    select: { academyId: true },
  })
  if (!target) return { error: '반을 찾을 수 없습니다.' }
  const student = await findStudentInAcademy(studentId, target.academyId)
  if (!student) return { error: '같은 학원(지점) 소속 반으로만 이동할 수 있습니다.' }

  await prisma.student.update({ where: { id: studentId }, data: { classId: targetClassId } })

  await revalidateTeacherClassViews([fromClassId, targetClassId, student.classId])
  revalidatePath(`/owner/classes/${fromClassId}`)
  revalidatePath(`/owner/classes/${targetClassId}`)
  revalidatePath('/owner/students')
  revalidatePath('/owner/classes')
  return {}
}

export async function removeStudentFromClass(
  studentId: string,
  classId: string,
): Promise<{ error?: string }> {
  const owner = await getOwner()
  if (!owner) return { error: '권한이 없습니다.' }

  await prisma.student.updateMany({
    where: { id: studentId, classId, user: { academyId: { in: owner.academyIds } } },
    data: { classId: null },
  })

  await revalidateTeacherClassViews([classId])
  revalidatePath(`/owner/classes/${classId}`)
  revalidatePath('/owner/students')
  revalidatePath('/owner/classes')
  return {}
}

// ─── Auto-assign ──────────────────────────────────────────────────────────────

export async function applyAutoAssign(
  assignments: Array<{ studentId: string; classId: string }>,
): Promise<{ error?: string }> {
  const owner = await getOwner()
  if (!owner) return { error: '권한이 없습니다.' }

  // 반이 속한 학원(본원/지점)과 같은 학원 학생만 배정
  const classes = await prisma.class.findMany({
    where: { id: { in: Array.from(new Set(assignments.map((a) => a.classId))) }, academyId: { in: owner.academyIds } },
    select: { id: true, academyId: true },
  })
  const classAcademy = new Map(classes.map((c) => [c.id, c.academyId]))

  const previous = await prisma.student.findMany({
    where: { id: { in: assignments.map((a) => a.studentId) } },
    select: { classId: true },
  })

  await prisma.$transaction(
    assignments
      .filter(({ classId }) => classAcademy.has(classId))
      .map(({ studentId, classId }) =>
        prisma.student.updateMany({
          where: { id: studentId, user: { academyId: classAcademy.get(classId)! } },
          data: { classId },
        }),
      ),
  )

  await revalidateTeacherClassViews([...classes.map((c) => c.id), ...previous.map((p) => p.classId)])
  revalidatePath('/owner/classes')
  revalidatePath('/owner/students')
  return {}
}
