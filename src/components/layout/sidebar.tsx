'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronLeft, ChevronRight, LogOut, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { signOut } from '@/app/(auth)/login/actions'
import type { NavItem } from './nav-items'

interface SidebarProps {
  navItems: NavItem[]
  isCollapsed: boolean
  isMobileOpen: boolean
  userName: string
  userRole: string
  academyName?: string | null
  onToggleCollapse: () => void
  onCloseMobile: () => void
}

export function Sidebar({
  navItems,
  isCollapsed,
  isMobileOpen,
  userName,
  userRole,
  academyName,
  onToggleCollapse,
  onCloseMobile,
}: SidebarProps) {
  const pathname = usePathname()

  const NavLink = ({
    item,
    collapsed,
    onClick,
  }: {
    item: NavItem
    collapsed: boolean
    onClick?: () => void
  }) => {
    const Icon = item.icon
    // 정확한 경로 또는 하위 경로 활성화 체크
    const isActive =
      pathname === item.href ||
      (item.href !== '/owner' &&
        item.href !== '/teacher' &&
        item.href !== '/student' &&
        pathname.startsWith(item.href + '/')) ||
      (pathname === item.href)

    return (
      <Link
        href={item.href}
        onClick={onClick}
        title={collapsed ? item.label : undefined}
        className={cn(
          'flex items-center gap-3 mx-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
          collapsed ? 'justify-center' : '',
          isActive
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
        )}
      >
        <Icon size={18} className="shrink-0" />
        {!collapsed && <span className="truncate">{item.label}</span>}
      </Link>
    )
  }

  const LogoutBtn = ({
    collapsed,
    onClick,
  }: {
    collapsed: boolean
    onClick?: () => void
  }) => (
    <form action={signOut}>
      <button
        type="submit"
        onClick={onClick}
        title={collapsed ? '로그아웃' : undefined}
        className={cn(
          'flex items-center gap-3 w-full mx-2 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors',
          collapsed ? 'justify-center mx-0 w-auto' : ''
        )}
      >
        <LogOut size={18} className="shrink-0" />
        {!collapsed && <span>로그아웃</span>}
      </button>
    </form>
  )

  return (
    <>
      {/* ── 데스크톱 사이드바 ─────────────────────── */}
      <aside
        className={cn(
          'hidden md:flex flex-col h-screen border-r bg-card shrink-0 transition-all duration-200 ease-in-out',
          isCollapsed ? 'w-[68px]' : 'w-60'
        )}
      >
        {/* 로고 영역 */}
        <div
          className={cn(
            'flex items-center h-16 border-b shrink-0 px-3',
            isCollapsed ? 'justify-center' : 'justify-between gap-2'
          )}
        >
          {!isCollapsed && (
            <div className="min-w-0">
              <p className="text-sm font-bold tracking-tight">IVY LMS</p>
              {academyName && (
                <p className="text-xs text-muted-foreground truncate">{academyName}</p>
              )}
            </div>
          )}
          <button
            onClick={onToggleCollapse}
            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground shrink-0"
            title={isCollapsed ? '사이드바 펼치기' : '사이드바 접기'}
          >
            {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        {/* 내비게이션 */}
        <nav className="flex-1 py-3 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink key={item.href} item={item} collapsed={isCollapsed} />
          ))}
        </nav>

        {/* 하단 로그아웃 */}
        <div className={cn('border-t py-3', isCollapsed ? 'flex justify-center' : '')}>
          <LogoutBtn collapsed={isCollapsed} />
        </div>
      </aside>

      {/* ── 모바일 오버레이 백드롭 ───────────────── */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      {/* ── 모바일 사이드바 ──────────────────────── */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex flex-col w-72 border-r bg-card md:hidden transition-transform duration-200 ease-in-out',
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* 로고 + 닫기 */}
        <div className="flex items-center justify-between h-16 border-b px-4 shrink-0">
          <div className="min-w-0">
            <p className="text-sm font-bold tracking-tight">IVY LMS</p>
            {academyName && (
              <p className="text-xs text-muted-foreground truncate">{academyName}</p>
            )}
          </div>
          <button
            onClick={onCloseMobile}
            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground shrink-0"
            aria-label="닫기"
          >
            <X size={18} />
          </button>
        </div>

        {/* 내비게이션 */}
        <nav className="flex-1 py-3 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink key={item.href} item={item} collapsed={false} onClick={onCloseMobile} />
          ))}
        </nav>

        {/* 사용자 정보 + 로그아웃 */}
        <div className="border-t p-4 shrink-0">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm font-semibold shrink-0">
              {userName.charAt(0)}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{userName}</p>
              <p className="text-xs text-muted-foreground">{userRole}</p>
            </div>
          </div>
          <LogoutBtn collapsed={false} onClick={onCloseMobile} />
        </div>
      </aside>
    </>
  )
}
