'use server'

import { redirect } from 'next/navigation'
import { revalidateTag } from 'next/cache'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma/client'
import { resolveJoinAccount, setSessionProfileCookies } from '@/lib/account/multi-academy'

export type RegisterTeacherData = {
  name: string
  email: string
  password: string
  phone: string
  academyId: string
  agreedTerms: boolean
  agreedPrivacy: boolean
  agreedMarketing: boolean
}

export async function registerTeacher(
  data: RegisterTeacherData
): Promise<{ error: string } | undefined> {
  // 이메일 확인: 처음 가입이면 새 계정, 다른 학원에 이미 가입된 교사면
  // 비밀번호 확인 후 같은 계정에 이 학원 프로필만 추가한다
  let account: Awaited<ReturnType<typeof resolveJoinAccount>>
  try {
    account = await resolveJoinAccount({
      email: data.email,
      password: data.password,
      academyId: data.academyId,
      role: 'TEACHER',
    })
  } catch {
    return { error: 'DB 연결 오류가 발생했습니다.' }
  }
  if ('error' in account) return account

  // 학원장 화면 캐시 무효화에 쓰는 본원 ID (지점 가입이면 본원)
  let hqId = data.academyId

  // 교사 정원 체크
  try {
    const academy = await prisma.academy.findUnique({
      where: { id: data.academyId },
      select: { maxTeachers: true, parentAcademyId: true },
    })
    if (!academy) return { error: '학원 정보를 찾을 수 없습니다.' }
    hqId = academy.parentAcademyId ?? data.academyId

    const currentCount = await prisma.user.count({
      where: { academyId: data.academyId, role: 'TEACHER', isDeleted: false },
    })
    if (currentCount >= academy.maxTeachers) {
      return {
        error: `이 학원의 교사 정원(${academy.maxTeachers}명)이 가득 찼습니다. 학원장에게 문의하세요.`,
      }
    }
  } catch {
    return { error: '정원 확인 중 오류가 발생했습니다.' }
  }

  const adminClient = await createAdminClient()

  let authId: string
  let userId: string
  if (account.kind === 'link') {
    authId = account.authId
    userId = account.profileId
  } else {
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
    authId = authData.user.id
    userId = authId
  }

  try {
    await prisma.user.create({
      data: {
        id: userId,
        authId,
        role: 'TEACHER',
        name: data.name,
        email: data.email,
        phone: data.phone || null,
        academyId: data.academyId,
        agreedTerms: data.agreedTerms,
        agreedPrivacy: data.agreedPrivacy,
        agreedMarketing: data.agreedMarketing,
      },
    })

    const supabase = await createClient()
    await supabase.auth.signInWithPassword({ email: data.email, password: data.password })

    // 방금 가입한 학원으로 바로 들어가도록 현재 학원 프로필 지정
    await setSessionProfileCookies('TEACHER', userId)
  } catch (err) {
    // 새로 만든 Auth 계정만 롤백 (기존 계정에 학원을 추가하던 경우는 계정을 유지)
    if (account.kind === 'new') await adminClient.auth.admin.deleteUser(authId)
    console.error('[registerTeacher]', err)
    return { error: '가입 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' }
  }

  // 기존 계정이면 학원 전환 목록에 새 학원이 바로 보이도록 계정 캐시 무효화
  revalidateTag(`user-${authId}`)
  // 학원장 교사/학생 목록·대시보드 캐시가 새 가입자를 즉시 반영하도록 무효화
  revalidateTag(`academy-${data.academyId}-teachers`)
  revalidateTag(`owner-${hqId}-dashboard`)
  revalidateTag(`academy-${hqId}-analytics`)

  redirect('/teacher')
}
