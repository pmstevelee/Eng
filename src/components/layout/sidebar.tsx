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
  businessName?: string | null
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
  businessName,
  onToggleCollapse,
  onCloseMobile,
}: SidebarProps) {
  const pathname = usePathname()

  // 로고에 표시할 이름: businessName > academyName > '위고업잉글리시'
  const displayName = businessName || academyName || '위고업잉글리시'
  const isSuperAdmin = !academyName && !businessName

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
    const isActive =
      pathname === item.href ||
      (item.href !== '/owner' &&
        item.href !== '/teacher' &&
        item.href !== '/student' &&
        item.href !== '/admin' &&
        pathname.startsWith(item.href + '/'))

    return (
      <Link
        href={item.href}
        onClick={onClick}
        title={collapsed ? item.label : undefined}
        className={cn(
          'flex items-center gap-3 mx-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
          collapsed ? 'justify-center' : '',
          isActive
            ? 'bg-primary-700 text-white'
            : 'text-blue-200 hover:bg-primary-800 hover:text-white'
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
          'flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-blue-200 hover:bg-primary-800 hover:text-white transition-colors',
          collapsed ? 'justify-center' : 'mx-2'
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
          'hidden md:flex flex-col h-screen bg-primary-900 shrink-0 transition-all duration-200 ease-in-out',
          isCollapsed ? 'w-[68px]' : 'w-64'
        )}
      >
        {/* 로고 영역 */}
        <div className="relative flex items-center h-16 border-b border-primary-800 shrink-0 px-3">
          {isCollapsed ? (
            /* 접힌 상태: 원형 이니셜 + 위고업잉글리시 워드마크 */
            <button
              onClick={onToggleCollapse}
              title="사이드바 펼치기"
              className="flex flex-col items-center gap-1 w-full hover:opacity-80 transition-opacity"
            >
              <div className="w-8 h-8 rounded-full bg-primary-700 flex items-center justify-center text-white font-bold text-sm shrink-0">
                {displayName.charAt(0)}
              </div>
              <span className="text-[10px] text-gray-400 leading-none">위고업잉글리시</span>
            </button>
          ) : (
            /* 펼친 상태: 텍스트 이름 + 위고업잉글리시 워드마크 */
            <>
              <div className="min-w-0 flex-1">
                {isSuperAdmin ? (
                  <>
                    <p className="text-lg font-bold text-white truncate leading-tight">위고업잉글리시</p>
                    <p className="text-xs text-gray-400">Admin</p>
                  </>
                ) : (
                  <>
                    <p className="text-lg font-bold text-white truncate leading-tight">{displayName}</p>
                    <p className="text-xs text-gray-400">위고업잉글리시</p>
                  </>
                )}
              </div>
              <button
                onClick={onToggleCollapse}
                className="p-1.5 rounded-md text-blue-200 hover:bg-primary-800 hover:text-white shrink-0 transition-colors"
                title="사이드바 접기"
              >
                <ChevronLeft size={16} />
              </button>
            </>
          )}
        </div>

        {/* 내비게이션 */}
        <nav className="flex-1 py-3 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink key={item.href} item={item} collapsed={isCollapsed} />
          ))}
        </nav>

        {/* 하단: 사용자 정보 + 로그아웃 */}
        <div className="border-t border-primary-800 py-3">
          {!isCollapsed && (
            <div className="flex items-center gap-3 px-5 py-2 mb-1">
              <div className="w-8 h-8 rounded-full bg-primary-700 flex items-center justify-center text-white text-sm font-semibold shrink-0">
                {userName.charAt(0)}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-white truncate">{userName}</p>
                <p className="text-xs text-blue-200">{userRole}</p>
              </div>
            </div>
          )}
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
          'fixed inset-y-0 left-0 z-50 flex flex-col w-72 bg-primary-900 md:hidden transition-transform duration-200 ease-in-out',
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* 로고 + 닫기 */}
        <div className="flex items-center justify-between h-16 border-b border-primary-800 px-4 shrink-0">
          <div className="min-w-0">
            {isSuperAdmin ? (
              <>
                <p className="text-lg font-bold text-white truncate leading-tight">위고업잉글리시</p>
                <p className="text-xs text-gray-400">Admin</p>
              </>
            ) : (
              <>
                <p className="text-lg font-bold text-white truncate leading-tight">{displayName}</p>
                <p className="text-xs text-gray-400">위고업잉글리시</p>
              </>
            )}
          </div>
          <button
            onClick={onCloseMobile}
            className="p-1.5 rounded-md text-blue-200 hover:bg-primary-800 hover:text-white transition-colors shrink-0"
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
        <div className="border-t border-primary-800 py-3">
          <div className="flex items-center gap-3 px-5 py-2 mb-1">
            <div className="w-9 h-9 rounded-full bg-primary-700 flex items-center justify-center text-white text-sm font-semibold shrink-0">
              {userName.charAt(0)}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-white truncate">{userName}</p>
              <p className="text-xs text-blue-200">{userRole}</p>
            </div>
          </div>
          <LogoutBtn collapsed={false} onClick={onCloseMobile} />
        </div>
      </aside>
    </>
  )
}
