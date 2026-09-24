'use client'

import { useState, useCallback, useEffect, useSyncExternalStore } from 'react'
import { usePathname } from 'next/navigation'
import { getOverdueFollowUpCount } from '@/lib/consultation/follow-up-actions'
import { Sidebar } from './sidebar'
import { Header } from './header'
import { NAV_ITEMS } from './nav-items'
import type { Role } from '@/types'
import type { BranchOption } from './branch-switcher'

interface DashboardLayoutProps {
  children: React.ReactNode
  role: Role
  userId: string
  userName: string
  userEmail: string
  userRole: string
  academyName?: string | null
  businessName?: string | null
  branches?: BranchOption[]
  selectedBranchId?: string
}

// localStorage 동기 구독: SSR/첫 렌더는 false, 클라이언트는 즉시 저장값 사용 → 깜빡임 최소화
function subscribeStorage(cb: () => void) {
  window.addEventListener('storage', cb)
  return () => window.removeEventListener('storage', cb)
}
function getCollapsedSnapshot() {
  return localStorage.getItem('sidebar-collapsed') === 'true'
}
function getCollapsedServerSnapshot() {
  return false
}

const CONSULTATION_HREF: Partial<Record<Role, string>> = {
  ACADEMY_OWNER: '/owner/consultations',
  TEACHER: '/teacher/consultations',
}

/**
 * 상담관리 메뉴 배지(기한 지난 할 일 수).
 * 레이아웃 렌더를 막지 않도록 마운트 후 비동기로 조회하고, 상담관리 화면 이동 시 갱신한다.
 */
function useConsultationBadge(role: Role): Record<string, number> {
  const pathname = usePathname()
  const href = CONSULTATION_HREF[role]
  // 상담관리 안에서는 경로가 바뀔 때마다, 밖에서는 최초 1회만 조회
  const refreshKey = href && pathname.startsWith(href) ? pathname : 'outside'
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!href) return
    let canceled = false
    getOverdueFollowUpCount()
      .then((n) => {
        if (!canceled) setCount(n)
      })
      .catch(() => {})
    return () => {
      canceled = true
    }
  }, [href, refreshKey])

  return href && count > 0 ? { [href]: count } : {}
}

export function DashboardLayout({
  children,
  role,
  userId,
  userName,
  userEmail,
  userRole,
  academyName,
  businessName,
  branches,
  selectedBranchId,
}: DashboardLayoutProps) {
  const navItems = NAV_ITEMS[role]

  // 외부 저장소(localStorage)를 동기 구독하여 hydration mismatch 없이 즉시 올바른 값 사용
  const storedCollapsed = useSyncExternalStore(
    subscribeStorage,
    getCollapsedSnapshot,
    getCollapsedServerSnapshot,
  )
  const [overrideCollapsed, setOverrideCollapsed] = useState<boolean | null>(null)
  const isCollapsed = overrideCollapsed ?? storedCollapsed

  const [isMobileOpen, setIsMobileOpen] = useState(false)

  const handleToggleCollapse = useCallback(() => {
    const next = !isCollapsed
    setOverrideCollapsed(next)
    try { localStorage.setItem('sidebar-collapsed', String(next)) } catch {}
  }, [isCollapsed])

  const navBadges = useConsultationBadge(role)

  const handleCloseMobile = useCallback(() => setIsMobileOpen(false), [])
  const handleOpenMobile = useCallback(() => setIsMobileOpen(true), [])

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-gray-50">
      <Sidebar
        navItems={navItems}
        badges={navBadges}
        isCollapsed={isCollapsed}
        isMobileOpen={isMobileOpen}
        userName={userName}
        userRole={userRole}
        academyName={academyName}
        businessName={businessName}
        branches={branches}
        selectedBranchId={selectedBranchId}
        onToggleCollapse={handleToggleCollapse}
        onCloseMobile={handleCloseMobile}
      />

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header
          academyName={businessName || academyName}
          userName={userName}
          userEmail={userEmail}
          userRole={userRole}
          userId={userId}
          onOpenMobileSidebar={handleOpenMobile}
        />
        <main className="flex-1 min-h-0 overflow-y-auto p-4 md:p-6 bg-gray-50">{children}</main>
      </div>
    </div>
  )
}
