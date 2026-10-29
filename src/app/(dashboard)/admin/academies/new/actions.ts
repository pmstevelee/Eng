'use server'

import { randomInt } from 'crypto'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma/client'
import { createAdminClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth'
import { findEmailInUse } from '@/lib/account/multi-academy'
import { getPlanTypeLimits, isSelectablePlanType } from '@/lib/plan-types'

const LOGIN_URL = 'https://login.wegoupenglish.com'
const TRIAL_DAYS = 14

// 혼동하기 쉬운 문자(I, O, 0, 1, l) 제외
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const PASSWORD_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'

function randomString(chars: string, length: number): string {
  return Array.from({ length }, () => chars[randomInt(chars.length)]).join('')
}

async function generateUniqueInviteCode(): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const code = randomString(CODE_CHARS, 8)
    const exists = await prisma.academy.findUnique({ where: { inviteCode: code }, select: { id: true } })
    if (!exists) return code
  }
  throw new Error('초대코드 생성 실패')
}

export type CreateOwnerInput = {
  ownerName: string
  email: string
  /** 비워두면 임시 비밀번호를 자동으로 만든다 */
  password: string
  ownerPhone: string
  businessName: string
  academyAddress: string
  academyPhone: string
  planType: string
  /** TRIAL: 14일 무료 체험, ACTIVE: 바로 유료 활성 */
  startMode: 'TRIAL' | 'ACTIVE'
  /** ACTIVE일 때 이용 개월 수 */
  months: number
}

export type CreatedOwnerAccount = {
  academyId: string
  ownerName: string
  businessName: string
  email: string
  password: string
  inviteCode: string
  loginUrl: string
  planType: string
  statusText: string
}

export type CreateOwnerResult = { ok: true; account: CreatedOwnerAccount } | { ok: false; error: string }

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * 본사 관리자가 학원장 계정 + 학원을 직접 만들어 분배한다.
 * 이메일 인증 없이 바로 로그인 가능하며, 관리자 세션은 그대로 유지한다.
 */
export async function createOwnerAccount(input: CreateOwnerInput): Promise<CreateOwnerResult> {
  const admin = await getCurrentUser()
  if (!admin || admin.role !== 'SUPER_ADMIN') redirect('/login')

  const ownerName = input.ownerName.trim()
  const email = input.email.trim().toLowerCase()
  const businessName = input.businessName.trim()
  const password = input.password.trim() || randomString(PASSWORD_CHARS, 10)

  if (!ownerName) return { ok: false, error: '학원장 이름을 입력해주세요.' }
  if (!EMAIL_PATTERN.test(email)) return { ok: false, error: '올바른 이메일(아이디)을 입력해주세요.' }
  if (!businessName) return { ok: false, error: '학원명을 입력해주세요.' }
  if (password.length < 8) return { ok: false, error: '비밀번호는 8자 이상이어야 합니다.' }
  if (!isSelectablePlanType(input.planType)) return { ok: false, error: '요금제를 다시 선택해주세요.' }
  if (input.startMode === 'ACTIVE' && (!Number.isInteger(input.months) || input.months < 1 || input.months > 36)) {
    return { ok: false, error: '이용 기간을 다시 선택해주세요.' }
  }

  try {
    const emailInUse = await findEmailInUse(email)
    if (emailInUse) return { ok: false, error: '이미 사용 중인 이메일입니다. 다른 이메일을 입력해주세요.' }
  } catch {
    return { ok: false, error: 'DB 연결 오류가 발생했습니다.' }
  }

  const adminClient = await createAdminClient()
  const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (authError || !authData.user) {
    if (authError?.message?.includes('already been registered')) {
      return { ok: false, error: '이미 가입된 이메일입니다. 다른 이메일을 입력해주세요.' }
    }
    console.error('[createOwnerAccount] auth', authError)
    return { ok: false, error: '계정 생성 중 오류가 발생했습니다.' }
  }

  const userId = authData.user.id
  const planType = input.planType
  const limits = getPlanTypeLimits(planType)
  const now = new Date()
  const trialEndsAt = new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000)
  const expiresAt = new Date(now)
  expiresAt.setMonth(expiresAt.getMonth() + input.months)
  const isActive = input.startMode === 'ACTIVE'

  try {
    const inviteCode = await generateUniqueInviteCode()
    const academy = await prisma.$transaction(async (tx) => {
      const created = await tx.academy.create({
        data: {
          name: businessName,
          businessName,
          address: input.academyAddress.trim() || null,
          phone: input.academyPhone.trim() || null,
          inviteCode,
          subscriptionStatus: isActive ? 'ACTIVE' : 'TRIAL',
          subscriptionPlan: planType,
          planType,
          trialEndsAt: isActive ? now : trialEndsAt,
          ...(isActive ? { subscriptionStartedAt: now, subscriptionExpiresAt: expiresAt } : {}),
          maxStudents: limits.maxStudents,
          maxTeachers: limits.maxTeachers,
        },
      })

      await tx.user.create({
        data: {
          id: userId,
          authId: userId,
          role: 'ACADEMY_OWNER',
          name: ownerName,
          email,
          phone: input.ownerPhone.trim() || null,
          academyId: created.id,
          // 약관 동의는 학원장이 첫 이용 시 본사와 별도 계약으로 처리
          agreedTerms: true,
          agreedPrivacy: true,
          agreedMarketing: false,
        },
      })

      await tx.academy.update({ where: { id: created.id }, data: { ownerId: userId } })
      return created
    })

    revalidatePath('/admin/academies')
    revalidatePath('/admin')

    const dateText = (d: Date) => d.toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })
    return {
      ok: true,
      account: {
        academyId: academy.id,
        ownerName,
        businessName,
        email,
        password,
        inviteCode,
        loginUrl: LOGIN_URL,
        planType,
        statusText: isActive
          ? `이용 중 (${input.months}개월, ${dateText(expiresAt)}까지)`
          : `무료 체험 (${dateText(trialEndsAt)}까지)`,
      },
    }
  } catch (err) {
    await prisma.user.deleteMany({ where: { id: userId } }).catch(() => null)
    await adminClient.auth.admin.deleteUser(userId)
    console.error('[createOwnerAccount]', err)
    return { ok: false, error: '학원 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' }
  }
}
