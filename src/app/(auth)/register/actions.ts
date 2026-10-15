'use server'

import { prisma } from '@/lib/prisma/client'

export type VerifyInviteCodeResult =
  | { error: string }
  | { academyId: string; businessName: string }

export async function verifyInviteCode(code: string): Promise<VerifyInviteCodeResult> {
  const normalized = code.replace(/[-\s]/g, '').toUpperCase()

  if (normalized.length !== 8) {
    return { error: '초대 코드는 8자리입니다.' }
  }

  try {
    const academy = await prisma.academy.findFirst({
      where: { inviteCode: normalized, isDeleted: false },
      select: { id: true, businessName: true, name: true },
    })

    if (!academy) {
      return { error: '유효하지 않은 초대 코드입니다. 다시 확인해 주세요.' }
    }

    return {
      academyId: academy.id,
      businessName: academy.businessName ?? academy.name,
    }
  } catch {
    return { error: '코드 확인 중 오류가 발생했습니다.' }
  }
}

/** 초대 코드가 없는 개인 학습자가 가입할 기본 학원(위고업잉글리시) */
const DEFAULT_ACADEMY_NAME = '위고업잉글리시'

export async function getDefaultInviteCode(): Promise<{ error: string } | { code: string }> {
  try {
    const academy = await prisma.academy.findFirst({
      where: { businessName: DEFAULT_ACADEMY_NAME, parentAcademyId: null, isDeleted: false },
      select: { inviteCode: true },
      orderBy: { createdAt: 'asc' },
    })
    if (!academy) return { error: '기본 초대 코드를 찾을 수 없습니다. 관리자에게 문의하세요.' }

    const code = academy.inviteCode.toUpperCase()
    return { code: code.length === 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : code }
  } catch {
    return { error: '초대 코드를 불러오는 중 오류가 발생했습니다.' }
  }
}
