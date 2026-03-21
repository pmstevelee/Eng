'use client'

import { useState } from 'react'
import { Menu, ChevronDown, LogOut } from 'lucide-react'
import { signOut } from '@/app/(auth)/login/actions'
import { NotificationBell } from './notification-bell'

interface HeaderProps {
  academyName?: string | null
  userName: string
  userEmail: string
  userRole: string
  userId: string
  onOpenMobileSidebar: () => void
}

export function Header({
  academyName,
  userName,
  userEmail,
  userRole,
  userId,
  onOpenMobileSidebar,
}: HeaderProps) {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)

  return (
    <header className="flex items-center justify-between h-16 px-4 md:px-6 border-b border-gray-200 bg-white shrink-0">
      {/* 왼쪽: 모바일 메뉴 + 학원명 */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onOpenMobileSidebar}
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 md:hidden shrink-0 transition-colors"
          aria-label="메뉴 열기"
        >
          <Menu size={20} />
        </button>
        {academyName && (
          <span className="text-sm font-medium text-gray-500 hidden md:block truncate">
            {academyName}
          </span>
        )}
      </div>

      {/* 오른쪽: 알림 + 사용자 */}
      <div className="flex items-center gap-1 shrink-0">
        {/* 알림 벨 */}
        <NotificationBell userId={userId} />

        {/* 사용자 드롭다운 */}
        <div className="relative">
          <button
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            className="flex items-center gap-2 pl-2 pr-1.5 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-primary-700 flex items-center justify-center text-white text-sm font-semibold shrink-0">
              {userName.charAt(0)}
            </div>
            <div className="hidden md:block text-left">
              <p className="text-sm font-medium text-gray-900 leading-none max-w-28 truncate">{userName}</p>
              <p className="text-xs text-gray-500 mt-0.5">{userRole}</p>
            </div>
            <ChevronDown size={14} className="text-gray-400 hidden md:block" />
          </button>

          {isUserMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setIsUserMenuOpen(false)}
              />
              <div className="absolute right-0 top-full mt-1 w-52 rounded-xl border border-gray-200 bg-white shadow-lg z-20 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100">
                  <p className="text-sm font-semibold text-gray-900 truncate">{userName}</p>
                  <p className="text-xs text-gray-500 truncate mt-0.5">{userEmail}</p>
                  <span className="inline-block mt-2 text-xs bg-primary-100 text-primary-700 px-2.5 py-0.5 rounded-full font-medium">
                    {userRole}
                  </span>
                </div>
                <div className="p-1">
                  <form action={signOut}>
                    <button
                      type="submit"
                      onClick={() => setIsUserMenuOpen(false)}
                      className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-500 hover:bg-gray-50 hover:text-gray-900 rounded-lg transition-colors"
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
