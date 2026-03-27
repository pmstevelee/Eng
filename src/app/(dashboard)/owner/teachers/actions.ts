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

// ─── 교사 직접 추가 ────────────────────────────────────────────────────────────

export async function createTeacher(data: {
  name: string
  email: string
  password: string
}): Promise<{ error?: string; teacherId?: string }> {
  const owner = await getOwner()
  if (!owner) return { error: '권한이 없습니다.' }

  if (!data.name.trim()) return { error: '이름을 입력해주세요.' }
  if (!data.email.trim()) return { error: '이메일을 입력해주세요.' }
  if (data.password.length < 6) return { error: '비밀번호는 최소 6자 이상이어야 합니다.' }

  // 정원 초과 확인
  const [academy, existingCount] = await Promise.all([
    prisma.academy.findUnique({ where: { id: owner.academyId! }, select: { maxTeachers: true } }),
    prisma.user.count({ where: { academyId: owner.academyId!, role: 'TEACHER', isDeleted: false } }),
  ])
  if (academy && existingCount >= academy.maxTeachers) {
    return { error: `최대 교사 수(${academy.maxTeachers}명)에 도달했습니다.` }
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
    const user = await prisma.user.create({
      data: {
        id: authData.user.id,
        name: data.name.trim(),
        email: data.email.trim(),
        role: 'TEACHER',
        academyId: owner.academyId!,
        agreedTerms: true,
        agreedPrivacy: true,
      },
    })

    revalidateTag(`academy-${owner.academyId}-teachers`)
    revalidatePath('/owner/teachers')
    return { teacherId: user.id }
  } catch (err) {
    // Prisma 실패 시 Auth 계정도 롤백
    await adminClient.auth.admin.deleteUser(authData.user.id)
    console.error('createTeacher prisma error:', err)
    return { error: '교사 생성 중 오류가 발생했습니다.' }
  }
}

// ─── 교사 정보 수정 ────────────────────────────────────────────────────────────

export async function updateTeacherProfile(
  teacherId: string,
  data: { name: string; email: string; password?: string },
): Promise<{ error?: string }> {
  const owner = await getOwner()
  if (!owner) return { error: '권한이 없습니다.' }

  if (!data.name.trim()) return { error: '이름을 입력해주세요.' }
  if (!data.email.trim()) return { error: '이메일을 입력해주세요.' }
  if (data.password !== undefined && data.password.length > 0 && data.password.length < 6) {
    return { error: '비밀번호는 최소 6자 이상이어야 합니다.' }
  }

  const teacher = await prisma.user.findFirst({
    where: { id: teacherId, academyId: owner.academyId!, role: 'TEACHER', isDeleted: false },
    select: { id: true, email: true },
  })
  if (!teacher) return { error: '교사를 찾을 수 없습니다.' }

  // 이메일·비밀번호 변경이 있으면 Supabase Auth 업데이트
  const emailChanged = data.email.trim() !== teacher.email
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

    const { error: authError } = await adminClient.auth.admin.updateUserById(teacherId, updatePayload)
    if (authError) return { error: '계정 정보 변경에 실패했습니다: ' + authError.message }
  }

  await prisma.user.update({
    where: { id: teacherId },
    data: { name: data.name.trim(), email: data.email.trim() },
  })

  revalidateTag(`academy-${owner.academyId}-teachers`)
  revalidatePath('/owner/teachers')
  revalidatePath(`/owner/teachers/${teacherId}`)
  return {}
}

// ─── 교사 완전 삭제(탈퇴) ───────────────────────────────────────────────────────

export async function deleteTeacher(teacherId: string): Promise<{ error?: string }> {
  const owner = await getOwner()
  if (!owner) return { error: '권한이 없습니다.' }

  const teacher = await prisma.user.findFirst({
    where: { id: teacherId, academyId: owner.academyId!, role: 'TEACHER', isDeleted: false },
    select: { id: true },
  })
  if (!teacher) return { error: '교사를 찾을 수 없습니다.' }

  try {
    await prisma.$transaction(async (tx) => {
      // 담당 반 해제
      await tx.class.updateMany({
        where: { teacherId, academyId: owner.academyId! },
        data: { teacherId: null },
      })

      // 교사가 만든 테스트 관련 데이터 삭제 (FK 순서 준수)
      const tests = await tx.test.findMany({
        where: { createdBy: teacherId },
        select: { id: true },
      })
      if (tests.length > 0) {
        const testIds = tests.map((t) => t.id)
        const sessions = await tx.testSession.findMany({
          where: { testId: { in: testIds } },
          select: { id: true },
        })
        if (sessions.length > 0) {
          await tx.questionResponse.deleteMany({
            where: { sessionId: { in: sessions.map((s) => s.id) } },
          })
        }
        await tx.testSession.deleteMany({ where: { testId: { in: testIds } } })
        await tx.test.deleteMany({ where: { id: { in: testIds } } })
      }

      // 교사가 만든 문제 삭제
      await tx.question.deleteMany({ where: { createdBy: teacherId } })

      // 교사가 작성한 코멘트 삭제
      await tx.teacherComment.deleteMany({ where: { teacherId } })

      // 교사가 생성한 리포트 처리 (generatedBy nullable → null로 처리)
      await tx.report.updateMany({
        where: { generatedBy: teacherId },
        data: { generatedBy: null },
      })

      // 교사의 공지사항 삭제
      await tx.announcement.deleteMany({ where: { authorId: teacherId } })

      // 알림 삭제
      await tx.notification.deleteMany({ where: { userId: teacherId } })

      // User 삭제
      await tx.user.delete({ where: { id: teacherId } })
    })

    // Supabase Auth 삭제
    const adminClient = getAdminClient()
    await adminClient.auth.admin.deleteUser(teacherId)

    revalidateTag(`academy-${owner.academyId}-teachers`)
    revalidatePath('/owner/teachers')
    return {}
  } catch (err) {
    console.error('deleteTeacher error:', err)
    return { error: '교사 삭제 중 오류가 발생했습니다.' }
  }
}
