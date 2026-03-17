import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma/client'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ROLE_LABEL } from '@/components/layout/nav-items'

export default async function TeacherLayout({ children }: { children: React.ReactNode }) {
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
      academy: { select: { name: true } },
    },
  })

  if (!user || user.role !== 'TEACHER') redirect('/login')

  return (
    <DashboardLayout
      role="TEACHER"
      userName={user.name}
      userEmail={user.email}
      userRole={ROLE_LABEL.TEACHER}
      academyName={user.academy?.name}
    >
      {children}
    </DashboardLayout>
  )
}
