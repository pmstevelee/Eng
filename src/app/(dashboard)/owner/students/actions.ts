'use server'

import { prisma } from '@/lib/prisma/client'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'
import { revalidatePath, revalidateTag } from 'next/cache'
import { getCurrentUser } from '@/lib/auth'
import { BRANCH_ALL, getOwnerAcademyIds, getSelectedBranchId } from '@/lib/branch'
import { createStudentAccount } from '@/lib/students/create-student-account'
import { isValidParentMobile, keypadCodeFor } from '@/lib/attendance/constants'

function getAdminClient() {
  return createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

// 학원장이 관리하는 본원 + 모든 지점 ID를 함께 반환 (지점 학생도 관리 가능)
async function getOwner() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ACADEMY_OWNER' || !user.academyId) return null
  const ids = await getOwnerAcademyIds(user.id)
  return { ...user, academyId: user.academyId, academyIds: ids.length > 0 ? ids : [user.academyId] }
}

export async function updateStudentClass(
  studentId: string,
  classId: string | null,
): Promise<{ error?: string }> {
  const owner = await getOwner()
  if (!owner) return { error: '권한이 없습니다.' }

  const student = await prisma.student.findFirst({
    where: { id: studentId, user: { academyId: { in: owner.academyIds } } },
    select: { classId: true, user: { select: { academyId: true } } },
  })
  if (!student) return { error: '학생을 찾을 수 없습니다.' }

  if (classId) {
    // 학생과 같은 학원(본원/지점)의 반에만 배정
    const cls = await prisma.class.findFirst({
      where: { id: classId, academyId: student.user.academyId ?? '' },
      select: { id: true },
    })
    if (!cls) return { error: '학생이 속한 학원(지점)의 반만 선택할 수 있습니다.' }
  }

  await prisma.student.update({
    where: { id: studentId },
    data: { classId },
  })

  revalidateTag(`academy-${owner.academyId}-students`)
  revalidatePath('/owner/students')
  revalidatePath(`/owner/students/${studentId}`)
  // 반 관리 목록·상세(이전 반/새 반)에도 즉시 반영
  revalidatePath('/owner/classes')
  if (student.classId) revalidatePath(`/owner/classes/${student.classId}`)
  if (classId) revalidatePath(`/owner/classes/${classId}`)
  return {}
}

export async function updateStudentStatus(
  studentId: string,
  status: 'ACTIVE' | 'ON_LEAVE' | 'WITHDRAWN',
): Promise<{ error?: string }> {
  const owner = await getOwner()
  if (!owner) return { error: '권한이 없습니다.' }

  const student = await prisma.student.findFirst({
    where: { id: studentId, user: { academyId: { in: owner.academyIds } } },
  })
  if (!student) return { error: '학생을 찾을 수 없습니다.' }

  await prisma.student.update({
    where: { id: studentId },
    // 퇴원일: 퇴원 처리 시 기록, 재원·휴원으로 되돌리면 해제
    data: {
      status,
      withdrawnAt: status === 'WITHDRAWN' ? (student.status === 'WITHDRAWN' ? student.withdrawnAt : new Date()) : null,
    },
  })

  revalidateTag(`academy-${owner.academyId}-students`)
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
    where: { id: studentId, user: { academyId: { in: owner.academyIds } } },
  })
  if (!student) return { error: '학생을 찾을 수 없습니다.' }

  await prisma.student.update({
    where: { id: studentId },
    data: { currentLevel: level },
  })

  revalidateTag(`academy-${owner.academyId}-students`)
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
    where: { id: studentId, user: { academyId: { in: owner.academyIds } } },
    select: { userId: true },
  })
  if (!student) return { error: '학생을 찾을 수 없습니다.' }

  // 학원에서 제거 (계정 유지, academyId만 해제)
  await prisma.user.update({
    where: { id: student.userId },
    data: { academyId: null },
  })

  revalidateTag(`academy-${owner.academyId}-students`)
  revalidatePath('/owner/students')
  return {}
}

// ─── 학생 직접 추가 ────────────────────────────────────────────────────────────

export async function createStudent(data: {
  name: string
  email: string
  password: string
  classId?: string
  grade?: string
  currentLevel?: number
  joinedAt?: string
}): Promise<{ error?: string; studentId?: string }> {
  const owner = await getOwner()
  if (!owner) return { error: '권한이 없습니다.' }

  // 반을 선택했으면 그 반의 학원(본원/지점), 아니면 선택된 지점(통합 보기면 본원)에 등록
  let academyId = owner.academyId
  if (data.classId) {
    const cls = await prisma.class.findFirst({
      where: { id: data.classId, academyId: { in: owner.academyIds } },
      select: { academyId: true },
    })
    if (!cls) return { error: '반을 찾을 수 없습니다.' }
    academyId = cls.academyId
  } else {
    const selectedBranchId = await getSelectedBranchId()
    if (selectedBranchId !== BRANCH_ALL && owner.academyIds.includes(selectedBranchId)) academyId = selectedBranchId
  }

  const result = await createStudentAccount({ ...data, academyId })
  if (result.studentId) {
    revalidateTag(`academy-${owner.academyId}-students`)
    revalidatePath('/owner/students')
  }
  return result
}

// ─── 학생 정보 수정 ────────────────────────────────────────────────────────────

export async function updateStudentProfile(
  studentId: string,
  data: { name: string; email: string; grade?: string; password?: string; parentPhone?: string },
): Promise<{ error?: string }> {
  const owner = await getOwner()
  if (!owner) return { error: '권한이 없습니다.' }

  if (!data.name.trim()) return { error: '이름을 입력해주세요.' }
  if (!data.email.trim()) return { error: '이메일을 입력해주세요.' }
  if (data.password !== undefined && data.password.length > 0 && data.password.length < 6) {
    return { error: '비밀번호는 최소 6자 이상이어야 합니다.' }
  }
  // 학부모 휴대폰: 숫자만 저장, 빈 값이면 삭제 (undefined면 변경하지 않음)
  const parentPhone = data.parentPhone === undefined ? undefined : data.parentPhone.replace(/\D/g, '')
  if (parentPhone && !isValidParentMobile(parentPhone)) {
    return { error: '학부모 휴대폰 번호는 010으로 시작하는 11자리로 입력해주세요.' }
  }

  const student = await prisma.student.findFirst({
    where: { id: studentId, user: { academyId: { in: owner.academyIds } } },
    select: { userId: true, user: { select: { email: true } } },
  })
  if (!student) return { error: '학생을 찾을 수 없습니다.' }

  const emailChanged = data.email.trim() !== student.user.email
  const passwordChanged = data.password && data.password.length >= 6

  if (emailChanged || passwordChanged) {
    if (emailChanged) {
      const duplicate = await prisma.user.findUnique({ where: { email: data.email.trim() } })
      if (duplicate) return { error: '이미 사용 중인 이메일입니다.' }
    }

    const adminClient = getAdminClient()
    const updatePayload: { email?: string; password?: string } = {}
    if (emailChanged) updatePayload.email = data.email.trim()
    if (passwordChanged) updatePayload.password = data.password

    const { error: authError } = await adminClient.auth.admin.updateUserById(student.userId, updatePayload)
    if (authError) return { error: '계정 정보 변경에 실패했습니다: ' + authError.message }
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: student.userId },
      data: { name: data.name.trim(), email: data.email.trim() },
    }),
    prisma.student.update({
      where: { id: studentId },
      data: {
        grade: data.grade ?? null,
        ...(parentPhone !== undefined && {
          parentPhone: parentPhone || null,
          keypadCode: keypadCodeFor(parentPhone),
        }),
      },
    }),
  ])

  revalidateTag(`academy-${owner.academyId}-students`)
  revalidatePath('/owner/students')
  revalidatePath(`/owner/students/${studentId}`)
  return {}
}

// ─── 학생 완전 삭제(탈퇴) ───────────────────────────────────────────────────────

export async function deleteStudent(studentId: string): Promise<{ error?: string }> {
  const owner = await getOwner()
  if (!owner) return { error: '권한이 없습니다.' }

  const student = await prisma.student.findFirst({
    where: { id: studentId, user: { academyId: { in: owner.academyIds } } },
    select: { userId: true },
  })
  if (!student) return { error: '학생을 찾을 수 없습니다.' }

  try {
    // 관련 데이터 순서대로 삭제 (FK 제약조건 순서 준수)
    await prisma.$transaction(async (tx) => {
      // TestSession의 QuestionResponse 먼저 삭제
      const sessions = await tx.testSession.findMany({
        where: { studentId },
        select: { id: true },
      })
      if (sessions.length > 0) {
        await tx.questionResponse.deleteMany({
          where: { sessionId: { in: sessions.map((s) => s.id) } },
        })
      }
      await tx.testSession.deleteMany({ where: { studentId } })
      await tx.skillAssessment.deleteMany({ where: { studentId } })
      await tx.learningPath.deleteMany({ where: { studentId } })
      await tx.teacherComment.deleteMany({ where: { studentId } })
      await tx.report.deleteMany({ where: { studentId } })
      await tx.attendance.deleteMany({ where: { studentId } })
      await tx.badgeEarning.deleteMany({ where: { studentId } })
      await tx.dailyMission.deleteMany({ where: { studentId } })
      await tx.studentStreak.deleteMany({ where: { studentId } })
      await tx.enrollment.deleteMany({ where: { studentId } })
      await tx.student.delete({ where: { id: studentId } })
      await tx.notification.deleteMany({ where: { userId: student.userId } })
      await tx.user.delete({ where: { id: student.userId } })
    })

    // Supabase Auth 삭제
    const adminClient = getAdminClient()
    await adminClient.auth.admin.deleteUser(student.userId)

    revalidateTag(`academy-${owner.academyId}-students`)
    revalidatePath('/owner/students')
    return {}
  } catch (err) {
    console.error('deleteStudent error:', err)
    return { error: '학생 삭제 중 오류가 발생했습니다.' }
  }
}
