'use server'

import { prisma } from '@/lib/prisma/client'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

const PLAN_PRICES: Record<string, { monthly: number; yearly: number }> = {
  BASIC: { monthly: 300000, yearly: 3000000 },
  STANDARD: { monthly: 500000, yearly: 5000000 },
  PREMIUM: { monthly: 800000, yearly: 8000000 },
}

const PLAN_LABEL: Record<string, string> = {
  BASIC: '베이직',
  STANDARD: '스탠다드',
  PREMIUM: '프리미엄',
}

const PERIOD_LABEL: Record<string, string> = {
  MONTHLY: '월간',
  YEARLY: '연간',
}

export async function createPendingSubscription(
  plan: 'BASIC' | 'STANDARD' | 'PREMIUM',
  period: 'MONTHLY' | 'YEARLY',
): Promise<{ error: string } | { success: true }> {
  const supabase = await createClient()
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()
  if (!authUser) return { error: '인증이 필요합니다.' }

  const user = await prisma.user.findUnique({
    where: { id: authUser.id, isDeleted: false },
    select: { role: true, academyId: true },
  })
  if (!user || user.role !== 'ACADEMY_OWNER') return { error: '권한이 없습니다.' }
  if (!user.academyId) return { error: '학원 정보를 찾을 수 없습니다.' }

  const prices = PLAN_PRICES[plan]
  if (!prices) return { error: '유효하지 않은 플랜입니다.' }

  const existing = await prisma.subscription.findFirst({
    where: { academyId: user.academyId, status: 'PENDING' },
  })
  if (existing) return { error: '이미 처리 중인 구독 신청이 있습니다. 관리자 확인을 기다려 주세요.' }

  const amount = period === 'MONTHLY' ? prices.monthly : prices.yearly
  const now = new Date()
  const expiresAt = new Date(now)
  if (period === 'MONTHLY') {
    expiresAt.setMonth(expiresAt.getMonth() + 1)
  } else {
    expiresAt.setFullYear(expiresAt.getFullYear() + 1)
  }

  const academy = await prisma.academy.findUnique({
    where: { id: user.academyId },
    select: { name: true, businessName: true },
  })
  const academyDisplayName = academy?.businessName ?? academy?.name ?? '학원'

  const adminUsers = await prisma.user.findMany({
    where: { role: 'SUPER_ADMIN', isDeleted: false },
    select: { id: true },
  })

  await prisma.$transaction([
    prisma.subscription.create({
      data: {
        academyId: user.academyId,
        plan,
        amount,
        period,
        startedAt: now,
        expiresAt,
        paymentMethod: '무통장입금',
        status: 'PENDING',
      },
    }),
    ...adminUsers.map((admin) =>
      prisma.notification.create({
        data: {
          userId: admin.id,
          type: 'INFO',
          title: '구독 신청 접수',
          message: `${academyDisplayName}이(가) ${PLAN_LABEL[plan]} ${PERIOD_LABEL[period]} 구독을 신청했습니다. 입금 확인 후 활성화해주세요.`,
        },
      }),
    ),
  ])

  revalidatePath('/owner/settings/subscription')
  return { success: true }
}
