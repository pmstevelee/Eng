import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { getOwnerBranches, getSelectedBranchId, BRANCH_ALL } from '@/lib/branch'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ROLE_LABEL } from '@/components/layout/nav-items'
import type { BranchOption } from '@/components/layout/branch-switcher'

export default async function OwnerLayout({ children }: { children: React.ReactNode }) {
  const layoutStart = performance.now()

  const authStart = performance.now()
  const user = await getCurrentUser()
  console.log(`  [세션/유저] getCurrentUser: ${(performance.now() - authStart).toFixed(0)}ms`)

  if (!user || user.role !== 'ACADEMY_OWNER') redirect('/api/auth/clear-session')

  // 다지점 데이터 로드
  const [branchData, selectedBranchId] = await Promise.all([
    getOwnerBranches(user.id).catch((err) => {
      console.error('[OwnerLayout] getOwnerBranches failed:', err)
      return null
    }),
    getSelectedBranchId(),
  ])

  // 지점 선택기에 표시할 옵션 (다지점 플랜만)
  let branchOptions: BranchOption[] | undefined
  if (branchData?.canManage) {
    branchOptions = [
      { id: branchData.hq.id, label: '본원', isHq: true },
      ...branchData.branches.map((b) => ({
        id: b.id,
        label: b.branchName ?? b.name,
        isHq: false,
      })),
    ]
  }

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
      branches={branchOptions}
      selectedBranchId={selectedBranchId ?? BRANCH_ALL}
    >
      {children}
    </DashboardLayout>
  )
}
