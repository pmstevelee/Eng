'use server'

import { prisma } from '@/lib/prisma/client'
import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'
import { revalidatePath, revalidateTag } from 'next/cache'

function getAdminClient() {
  return createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
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

  revalidateTag(`academy-${owner.academyId}-students`)
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
    where: { id: studentId, user: { academyId: owner.academyId! } },
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
    where: { id: studentId, user: { academyId: owner.academyId! } },
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
  grade?: number
  currentLevel?: number
}): Promise<{ error?: string; studentId?: string }> {
  const owner = await getOwner()
  if (!owner) return { error: '권한이 없습니다.' }

  if (!data.name.trim()) return { error: '이름을 입력해주세요.' }
  if (!data.email.trim()) return { error: '이메일을 입력해주세요.' }
  if (data.password.length < 6) return { error: '비밀번호는 최소 6자 이상이어야 합니다.' }

  // 정원 초과 확인
  const [academy, existingCount] = await Promise.all([
    prisma.academy.findUnique({ where: { id: owner.academyId! }, select: { maxStudents: true } }),
    prisma.student.count({ where: { user: { academyId: owner.academyId!, isDeleted: false } } }),
  ])
  if (academy && existingCount >= academy.maxStudents) {
    return { error: `최대 학생 수(${academy.maxStudents}명)에 도달했습니다.` }
  }

  // 이메일 중복 확인
  const existing = await prisma.user.findUnique({ where: { email: data.email.trim() } })
  if (existing) return { error: '이미 사용 중인 이메일입니다.' }

  // Supabase Auth 계정 생성
  const adminClient = getAdminClient()
  const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
    email: data.email.trim(),
    password: data.password,
    email_confirm: true,
  })
  if (authError || !authData.user) {
    return { error: authError?.message ?? 'Auth 계정 생성에 실패했습니다.' }
  }

  try {
    // Prisma User + Student 생성
    const user = await prisma.user.create({
      data: {
        id: authData.user.id,
        name: data.name.trim(),
        email: data.email.trim(),
        role: 'STUDENT',
        academyId: owner.academyId!,
        agreedTerms: true,
        agreedPrivacy: true,
      },
    })

    const student = await prisma.student.create({
      data: {
        userId: user.id,
        classId: data.classId || null,
        grade: data.grade ?? null,
        currentLevel: data.currentLevel ?? 1,
        status: 'ACTIVE',
      },
    })

    revalidateTag(`academy-${owner.academyId}-students`)
    revalidatePath('/owner/students')
    return { studentId: student.id }
  } catch (err) {
    // Prisma 실패 시 Auth 계정도 롤백
    await adminClient.auth.admin.deleteUser(authData.user.id)
    console.error('createStudent prisma error:', err)
    return { error: '학생 생성 중 오류가 발생했습니다.' }
  }
}

// ─── 학생 정보 수정 ────────────────────────────────────────────────────────────

export async function updateStudentProfile(
  studentId: string,
  data: { name: string; email: string; grade?: number; password?: string },
): Promise<{ error?: string }> {
  const owner = await getOwner()
  if (!owner) return { error: '권한이 없습니다.' }

  if (!data.name.trim()) return { error: '이름을 입력해주세요.' }
  if (!data.email.trim()) return { error: '이메일을 입력해주세요.' }
  if (data.password !== undefined && data.password.length > 0 && data.password.length < 6) {
    return { error: '비밀번호는 최소 6자 이상이어야 합니다.' }
  }

  const student = await prisma.student.findFirst({
    where: { id: studentId, user: { academyId: owner.academyId! } },
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
      data: { grade: data.grade ?? null },
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
    where: { id: studentId, user: { academyId: owner.academyId! } },
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
