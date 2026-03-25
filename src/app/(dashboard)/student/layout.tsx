import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ROLE_LABEL } from '@/components/layout/nav-items'

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const layoutStart = performance.now()

  const authStart = performance.now()
  const user = await getCurrentUser()
  console.log(`  [세션/유저] getCurrentUser: ${(performance.now() - authStart).toFixed(0)}ms`)

  if (!user || user.role !== 'STUDENT') redirect('/login')

  const totalTime = performance.now() - layoutStart
  console.log(`📊 [StudentLayout] 전체: ${totalTime.toFixed(0)}ms`)
  if (totalTime > 200) console.log(`⚠️ SLOW LAYOUT: ${totalTime.toFixed(0)}ms`)

  return (
    <DashboardLayout
      role="STUDENT"
      userId={user.authId}
      userName={user.name}
      userEmail={user.email}
      userRole={ROLE_LABEL.STUDENT}
      academyName={user.academy?.name}
      businessName={user.academy?.businessName}
    >
      {children}
    </DashboardLayout>
  )
}
