'use client'

import { useState } from 'react'
import { Menu, Bell, ChevronDown, LogOut } from 'lucide-react'
import { signOut } from '@/app/(auth)/login/actions'

interface HeaderProps {
  academyName?: string | null
  userName: string
  userEmail: string
  userRole: string
  onOpenMobileSidebar: () => void
}

export function Header({
  academyName,
  userName,
  userEmail,
  userRole,
  onOpenMobileSidebar,
}: HeaderProps) {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)

  return (
    <header className="flex items-center justify-between h-16 px-4 border-b bg-card shrink-0">
      {/* 왼쪽: 모바일 메뉴 버튼 + 학원명 */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onOpenMobileSidebar}
          className="p-1.5 rounded-md hover:bg-muted text-muted-foreground md:hidden shrink-0"
          aria-label="메뉴 열기"
        >
          <Menu size={20} />
        </button>
        {academyName && (
          <span className="text-sm font-medium text-muted-foreground hidden md:block truncate">
            {academyName}
          </span>
        )}
      </div>

      {/* 오른쪽: 알림 + 사용자 */}
      <div className="flex items-center gap-1 shrink-0">
        {/* 알림 버튼 */}
        <button
          className="p-2 rounded-md hover:bg-muted text-muted-foreground relative"
          title="알림"
        >
          <Bell size={19} />
        </button>

        {/* 사용자 드롭다운 */}
        <div className="relative">
          <button
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            className="flex items-center gap-2 pl-2 pr-1 py-1.5 rounded-md hover:bg-muted transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm font-semibold shrink-0">
              {userName.charAt(0)}
            </div>
            <div className="hidden md:block text-left">
              <p className="text-sm font-medium leading-none max-w-28 truncate">{userName}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{userRole}</p>
            </div>
            <ChevronDown size={14} className="text-muted-foreground hidden md:block" />
          </button>

          {isUserMenuOpen && (
            <>
              {/* 백드롭 */}
              <div
                className="fixed inset-0 z-10"
                onClick={() => setIsUserMenuOpen(false)}
              />
              {/* 드롭다운 메뉴 */}
              <div className="absolute right-0 top-full mt-1 w-52 rounded-lg border bg-card shadow-lg z-20 overflow-hidden">
                <div className="px-4 py-3 border-b">
                  <p className="text-sm font-semibold truncate">{userName}</p>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{userEmail}</p>
                  <span className="inline-block mt-1.5 text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                    {userRole}
                  </span>
                </div>
                <div className="p-1">
                  <form action={signOut}>
                    <button
                      type="submit"
                      onClick={() => setIsUserMenuOpen(false)}
                      className="flex items-center gap-2 w-full px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground rounded-md transition-colors"
                    >
                      <LogOut size={15} />
                      로그아웃
                    </button>
                  </form>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
