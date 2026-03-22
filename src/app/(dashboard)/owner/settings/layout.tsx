'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navItems = [
  { label: '학원 정보', href: '/owner/settings/academy' },
  { label: '초대 코드', href: '/owner/settings/invite' },
  { label: '알림 설정', href: '/owner/settings/notifications' },
  { label: '구독 관리', href: '/owner/settings/subscription' },
  { label: '계정 탈퇴', href: '/owner/settings/withdraw' },
]

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="space-y-6">
      {/* 페이지 헤더 */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">설정</h1>
        <p className="text-sm text-gray-500 mt-1">학원 및 계정 설정을 관리합니다</p>
      </div>

      <div className="flex gap-8 items-start">
        {/* 사이드 네비게이션 */}
        <aside className="w-44 flex-shrink-0">
          <nav className="space-y-0.5">
            {navItems.map((item) => {
              const isActive = pathname.startsWith(item.href)
              const isWithdraw = item.href === '/owner/settings/withdraw'
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`
                    block px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                    ${
                      isActive
                        ? isWithdraw
                          ? 'bg-red-50 text-red-600'
                          : 'text-primary-700'
                        : isWithdraw
                          ? 'text-gray-500 hover:bg-red-50 hover:text-red-600'
                          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    }
                  `}
                  style={
                    isActive && !isWithdraw
                      ? { color: '#1865F2', backgroundColor: '#EFF4FF' }
                      : {}
                  }
                >
                  {item.label}
                </Link>
              )
            })}
          </nav>
        </aside>

        {/* 콘텐츠 영역 */}
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </div>
  )
}
