import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ROLE_LABEL } from '@/components/layout/nav-items'

export default async function OwnerLayout({ children }: { children: React.ReactNode }) {
  const layoutStart = performance.now()

  const authStart = performance.now()
  const user = await getCurrentUser()
  console.log(`  [세션/유저] getCurrentUser: ${(performance.now() - authStart).toFixed(0)}ms`)

  if (!user || user.role !== 'ACADEMY_OWNER') redirect('/login')

  const totalTime = performance.now() - layoutStart
  console.log(`📊 [OwnerLayout] 전체: ${totalTime.toFixed(0)}ms`)
  if (totalTime > 200) console.log(`⚠️ SLOW LAYOUT: ${totalTime.toFixed(0)}ms`)

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
