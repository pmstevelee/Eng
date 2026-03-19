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
