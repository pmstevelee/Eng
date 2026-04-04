'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma/client'

export type RegisterStudentData = {
  name: string
  email: string
  password: string
  grade: string
  academyId: string
  agreedTerms: boolean
  agreedPrivacy: boolean
  agreedMarketing: boolean
}

export async function registerStudent(
  data: RegisterStudentData
): Promise<{ error: string } | undefined> {
  // 이메일 중복 체크
  try {
    const existing = await prisma.user.findUnique({
      where: { email: data.email },
      select: { id: true },
    })
    if (existing) return { error: '이미 사용 중인 이메일입니다.' }
  } catch {
    return { error: 'DB 연결 오류가 발생했습니다.' }
  }

  // 학생 정원 체크
  try {
    const academy = await prisma.academy.findUnique({
      where: { id: data.academyId },
      select: { maxStudents: true },
    })
    if (!academy) return { error: '학원 정보를 찾을 수 없습니다.' }

    const currentCount = await prisma.user.count({
      where: { academyId: data.academyId, role: 'STUDENT', isDeleted: false },
    })
    if (currentCount >= academy.maxStudents) {
      return {
        error: `이 학원의 학생 정원(${academy.maxStudents}명)이 가득 찼습니다. 학원장에게 문의하세요.`,
      }
    }
  } catch {
    return { error: '정원 확인 중 오류가 발생했습니다.' }
  }

  const adminClient = await createAdminClient()

  const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
    email: data.email,
    password: data.password,
    email_confirm: true,
  })

  if (authError || !authData.user) {
    if (authError?.message?.includes('already been registered')) {
      return { error: '이미 사용 중인 이메일입니다.' }
    }
    return { error: '계정 생성 중 오류가 발생했습니다.' }
  }

  const userId = authData.user.id

  try {
    await prisma.$transaction(async (tx) => {
      await tx.user.create({
        data: {
          id: userId,
          role: 'STUDENT',
          name: data.name,
          email: data.email,
          academyId: data.academyId,
          agreedTerms: data.agreedTerms,
          agreedPrivacy: data.agreedPrivacy,
          agreedMarketing: data.agreedMarketing,
        },
      })

      await tx.student.create({
        data: {
          userId,
          grade: data.grade || null,
        },
      })
    })

    const supabase = await createClient()
    await supabase.auth.signInWithPassword({ email: data.email, password: data.password })

    const cookieStore = await cookies()
    cookieStore.set('user-role', 'STUDENT', {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
    })
  } catch (err) {
    await adminClient.auth.admin.deleteUser(userId)
    console.error('[registerStudent]', err)
    return { error: '가입 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' }
  }

  redirect('/student')
}
