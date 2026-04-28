'use client'

import { useState, useCallback, useSyncExternalStore } from 'react'
import { Sidebar } from './sidebar'
import { Header } from './header'
import { NAV_ITEMS } from './nav-items'
import type { Role } from '@/types'

interface DashboardLayoutProps {
  children: React.ReactNode
  role: Role
  userId: string
  userName: string
  userEmail: string
  userRole: string
  academyName?: string | null
  businessName?: string | null
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

export function DashboardLayout({
  children,
  role,
  userId,
  userName,
  userEmail,
  userRole,
  academyName,
  businessName,
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

  const handleCloseMobile = useCallback(() => setIsMobileOpen(false), [])
  const handleOpenMobile = useCallback(() => setIsMobileOpen(true), [])

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-gray-50">
      <Sidebar
        navItems={navItems}
        isCollapsed={isCollapsed}
        isMobileOpen={isMobileOpen}
        userName={userName}
        userRole={userRole}
        academyName={academyName}
        businessName={businessName}
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
