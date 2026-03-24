'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
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
  const pathname = usePathname()

  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isMobileOpen, setIsMobileOpen] = useState(false)

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
        onCloseMobile={() => setIsMobileOpen(false)}
      />

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header
          academyName={academyName}
          userName={userName}
          userEmail={userEmail}
          userRole={userRole}
          userId={userId}
          onOpenMobileSidebar={() => setIsMobileOpen(true)}
        />
        <main key={pathname} className="flex-1 min-h-0 overflow-y-auto p-4 md:p-6 bg-gray-50 page-enter">{children}</main>
      </div>
    </div>
  )
}
