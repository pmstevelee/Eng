'use server'

import { cookies } from 'next/headers'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma/client'

function generateInviteCode(): string {
  // 혼동하기 쉬운 문자(I, O, 0, 1) 제외
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 8 }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join('')
}

const PLAN_LIMITS = {
  BASIC: { maxStudents: 30, maxTeachers: 3 },
  STANDARD: { maxStudents: 100, maxTeachers: 10 },
  PREMIUM: { maxStudents: 300, maxTeachers: 30 },
}

export type RegisterOwnerData = {
  name: string
  email: string
  password: string
  phone: string
  businessName: string
  academyAddress: string
  academyPhone: string
  agreedTerms: boolean
  agreedPrivacy: boolean
  agreedMarketing: boolean
  planType: 'BASIC' | 'STANDARD' | 'PREMIUM'
}

export type RegisterOwnerResult = { error: string } | { inviteCode: string }

export async function registerOwner(data: RegisterOwnerData): Promise<RegisterOwnerResult> {
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

  const adminClient = await createAdminClient()

  // Supabase Auth 사용자 생성 (이메일 인증 없이)
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
  const inviteCode = generateInviteCode()
  const limits = PLAN_LIMITS[data.planType]
  const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)

  try {
    await prisma.$transaction(async (tx) => {
      const academy = await tx.academy.create({
        data: {
          name: data.businessName,
          businessName: data.businessName,
          address: data.academyAddress || null,
          phone: data.academyPhone || null,
          inviteCode,
          subscriptionStatus: 'TRIAL',
          subscriptionPlan: data.planType,
          trialEndsAt,
          maxStudents: limits.maxStudents,
          maxTeachers: limits.maxTeachers,
        },
      })

      const user = await tx.user.create({
        data: {
          id: userId,
          role: 'ACADEMY_OWNER',
          name: data.name,
          email: data.email,
          phone: data.phone || null,
          academyId: academy.id,
          agreedTerms: data.agreedTerms,
          agreedPrivacy: data.agreedPrivacy,
          agreedMarketing: data.agreedMarketing,
        },
      })

      await tx.academy.update({
        where: { id: academy.id },
        data: { ownerId: user.id },
      })
    })

    // 세션 설정
    const supabase = await createClient()
    await supabase.auth.signInWithPassword({ email: data.email, password: data.password })

    const cookieStore = await cookies()
    cookieStore.set('user-role', 'ACADEMY_OWNER', {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
    })

    return { inviteCode }
  } catch (err) {
    // Auth 롤백
    await adminClient.auth.admin.deleteUser(userId)
    console.error('[registerOwner]', err)
    return { error: '가입 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' }
  }
}
