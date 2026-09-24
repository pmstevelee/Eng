import 'server-only'

import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'
import { prisma } from '@/lib/prisma/client'

function getAdminClient() {
  return createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

export type CreateStudentAccountInput = {
  academyId: string
  name: string
  email: string
  password: string
  classId?: string
  grade?: string
  currentLevel?: number
  joinedAt?: string
}

/**
 * 학생 계정 생성 공통 로직 (Supabase Auth → User → Student)
 * - 권한 검증은 호출하는 서버 액션에서 수행한다.
 * - 정원(maxStudents)·이메일 중복을 확인하고, Prisma 실패 시 Auth 계정을 롤백한다.
 * - 사용처: 학원장 학생 직접 추가, 상담 문의자 등록 전환
 */
export async function createStudentAccount(
  data: CreateStudentAccountInput,
): Promise<{ error?: string; studentId?: string }> {
  const name = data.name.trim()
  const email = data.email.trim()

  if (!name) return { error: '이름을 입력해주세요.' }
  if (!email) return { error: '이메일을 입력해주세요.' }
  if (data.password.length < 6) return { error: '비밀번호는 최소 6자 이상이어야 합니다.' }

  // 정원 초과 확인
  const [academy, existingCount] = await Promise.all([
    prisma.academy.findUnique({ where: { id: data.academyId }, select: { maxStudents: true } }),
    prisma.student.count({ where: { user: { academyId: data.academyId, isDeleted: false } } }),
  ])
  if (academy && existingCount >= academy.maxStudents) {
    return { error: `최대 학생 수(${academy.maxStudents}명)에 도달했습니다.` }
  }

  // 반이 같은 학원 소속인지 확인 (다른 학원 반 배정 방지)
  if (data.classId) {
    const cls = await prisma.class.findFirst({
      where: { id: data.classId, academyId: data.academyId },
      select: { id: true },
    })
    if (!cls) return { error: '선택한 반을 찾을 수 없습니다.' }
  }

  // 이메일 중복 확인
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) return { error: '이미 사용 중인 이메일입니다.' }

  // Supabase Auth 계정 생성
  const adminClient = getAdminClient()
  const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
    email,
    password: data.password,
    email_confirm: true,
  })
  if (!authData.user) {
    return { error: authError?.message ?? 'Auth 계정 생성에 실패했습니다.' }
  }

  try {
    // Prisma User + Student 생성
    const user = await prisma.user.create({
      data: {
        id: authData.user.id,
        name,
        email,
        role: 'STUDENT',
        academyId: data.academyId,
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
        ...(data.joinedAt ? { createdAt: new Date(data.joinedAt) } : {}),
      },
    })

    return { studentId: student.id }
  } catch (err) {
    // Prisma 실패 시 Auth 계정도 롤백 (User만 생성된 경우 FK 없이 남지 않도록 함께 정리)
    await prisma.user.deleteMany({ where: { id: authData.user.id } }).catch(() => null)
    await adminClient.auth.admin.deleteUser(authData.user.id)
    console.error('createStudentAccount prisma error:', err)
    return { error: '학생 생성 중 오류가 발생했습니다.' }
  }
}

/**
 * 계정 생성 이후 후속 처리가 실패했을 때 방금 만든 학생 계정을 되돌린다.
 */
export async function rollbackStudentAccount(studentId: string): Promise<void> {
  const student = await prisma.student.findUnique({ where: { id: studentId }, select: { userId: true } })
  if (!student) return
  await prisma.$transaction([
    prisma.student.delete({ where: { id: studentId } }),
    prisma.user.delete({ where: { id: student.userId } }),
  ])
  await getAdminClient().auth.admin.deleteUser(student.userId)
}
