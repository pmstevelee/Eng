'use server'

import { prisma } from '@/lib/prisma/client'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

async function requireAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { role: true },
  })
  if (!dbUser || dbUser.role !== 'SUPER_ADMIN') redirect('/login')
}

export async function confirmPayment(formData: FormData) {
  await requireAdmin()

  const subscriptionId = formData.get('subscriptionId') as string
  if (!subscriptionId) return

  const sub = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    select: { academyId: true, plan: true, expiresAt: true, startedAt: true },
  })
  if (!sub) return

  await prisma.$transaction([
    prisma.subscription.update({
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
