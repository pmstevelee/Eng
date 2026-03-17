'use client'

import { useState, useEffect } from 'react'
import { Sidebar } from './sidebar'
import { Header } from './header'
import { NAV_ITEMS } from './nav-items'
import type { Role } from '@/types'

type DashboardRole = Exclude<Role, 'SUPER_ADMIN'>

interface DashboardLayoutProps {
  children: React.ReactNode
  role: DashboardRole
  userName: string
  userEmail: string
  userRole: string
  academyName?: string | null
}

export function DashboardLayout({
  children,
  role,
  userName,
  userEmail,
  userRole,
  academyName,
}: DashboardLayoutProps) {
  const navItems = NAV_ITEMS[role]

  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isMobileOpen, setIsMobileOpen] = useState(false)

  // 사이드바 접기 상태를 localStorage에 저장
  useEffect(() => {
    const stored = localStorage.getItem('sidebar-collapsed')
    if (stored !== null) setIsCollapsed(stored === 'true')
  }, [])

  const handleToggleCollapse = () => {
    const next = !isCollapsed
    setIsCollapsed(next)
    localStorage.setItem('sidebar-collapsed', String(next))
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar
        navItems={navItems}
        isCollapsed={isCollapsed}
        isMobileOpen={isMobileOpen}
        userName={userName}
        userRole={userRole}
        academyName={academyName}
        onToggleCollapse={handleToggleCollapse}
        onCloseMobile={() => setIsMobileOpen(false)}
      />

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header
          academyName={academyName}
          userName={userName}
          userEmail={userEmail}
          userRole={userRole}
          onOpenMobileSidebar={() => setIsMobileOpen(true)}
        />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  )
}
