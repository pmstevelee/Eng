import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma/client'
import { PlansClient } from './plans-client'
import type { Plan } from '@/generated/prisma'

export default async function PlansPage() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ACADEMY_OWNER') redirect('/login')

  let currentPlan: Plan = 'FREE'

  if (user.academyId) {
    const subscription = await prisma.subscription.findUnique({
      where: { academyId: user.academyId },
      select: { plan: true, status: true },
    })
    if (subscription && subscription.status === 'ACTIVE') {
      currentPlan = subscription.plan
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <PlansClient currentPlan={currentPlan} />
    </div>
  )
}
