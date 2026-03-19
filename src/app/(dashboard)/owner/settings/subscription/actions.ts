'use server'

import { prisma } from '@/lib/prisma/client'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

const PLAN_PRICES: Record<string, { monthly: number; yearly: number }> = {
  BASIC: { monthly: 49000, yearly: 490000 },
  STANDARD: { monthly: 89000, yearly: 890000 },
  PREMIUM: { monthly: 149000, yearly: 1490000 },
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

  const amount = period === 'MONTHLY' ? prices.monthly : prices.yearly
  const now = new Date()
  const expiresAt = new Date(now)
  if (period === 'MONTHLY') {
    expiresAt.setMonth(expiresAt.getMonth() + 1)
  } else {
    expiresAt.setFullYear(expiresAt.getFullYear() + 1)
  }

  await prisma.subscription.create({
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
  })

  revalidatePath('/owner/settings/subscription')
  return { success: true }
}
