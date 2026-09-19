'use server'

import { prisma } from '@/lib/prisma/client'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'

async function requireAdmin() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (!user || user.role !== 'SUPER_ADMIN') redirect('/login')
}

export async function confirmPayment(formData: FormData) {
  await requireAdmin()

  const subscriptionId = formData.get('subscriptionId') as string
  if (!subscriptionId) return

  const sub = await prisma.subscriptionHistory.findUnique({
    where: { id: subscriptionId },
    select: { academyId: true, plan: true, expiresAt: true, startedAt: true },
  })
  if (!sub) return

  await prisma.$transaction([
    prisma.subscriptionHistory.update({
      where: { id: subscriptionId },
      data: { status: 'PAID' },
    }),
    prisma.academy.update({
      where: { id: sub.academyId },
      data: {
        subscriptionStatus: 'ACTIVE',
        subscriptionPlan: sub.plan,
        subscriptionStartedAt: sub.startedAt,
        subscriptionExpiresAt: sub.expiresAt,
      },
    }),
  ])

  revalidatePath('/admin/subscriptions')
  revalidatePath('/admin/academies')
}
