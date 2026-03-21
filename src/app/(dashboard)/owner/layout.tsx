import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma/client'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ROLE_LABEL } from '@/components/layout/nav-items'

export default async function OwnerLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()

  if (!authUser) redirect('/login')

  const user = await prisma.user.findUnique({
    where: { id: authUser.id },
    select: {
      name: true,
      email: true,
      role: true,
      academy: { select: { name: true, businessName: true } },
    },
  })

  if (!user || user.role !== 'ACADEMY_OWNER') redirect('/login')

  return (
    <DashboardLayout
      role="ACADEMY_OWNER"
      userId={authUser.id}
      userName={user.name}
      userEmail={user.email}
      userRole={ROLE_LABEL.ACADEMY_OWNER}
      academyName={user.academy?.name}
      businessName={user.academy?.businessName}
    >
      {children}
    </DashboardLayout>
  )
}
