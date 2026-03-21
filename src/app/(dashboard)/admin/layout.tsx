import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma/client'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ROLE_LABEL } from '@/components/layout/nav-items'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()

  if (!authUser) redirect('/login')

  const user = await prisma.user.findUnique({
    where: { id: authUser.id },
    select: { name: true, email: true, role: true },
  })

  if (!user || user.role !== 'SUPER_ADMIN') redirect('/login')

  return (
    <DashboardLayout
      role="SUPER_ADMIN"
      userId={authUser.id}
      userName={user.name}
      userEmail={user.email}
      userRole={ROLE_LABEL.SUPER_ADMIN}
    >
      {children}
    </DashboardLayout>
  )
}
