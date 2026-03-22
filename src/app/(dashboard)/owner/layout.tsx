import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ROLE_LABEL } from '@/components/layout/nav-items'

export default async function OwnerLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()

  if (!user || user.role !== 'ACADEMY_OWNER') redirect('/login')

  return (
    <DashboardLayout
      role="ACADEMY_OWNER"
      userId={user.authId}
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
