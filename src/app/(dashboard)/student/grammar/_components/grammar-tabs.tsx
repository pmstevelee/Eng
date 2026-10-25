'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const TABS = [
  { label: '홈', href: '/student/grammar', exact: true },
  { label: '커리큘럼 지도', href: '/student/grammar/map', exact: false },
  { label: '복습', href: '/student/grammar/review', exact: false },
  { label: '오답노트', href: '/student/grammar/wrong-notes', exact: false },
  { label: '자유 연습', href: '/student/learn/domain/grammar', exact: false },
] as const

export function GrammarTabs() {
  const pathname = usePathname()

  return (
    <nav aria-label="문법학습 메뉴" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex min-w-max gap-1 border-b border-gray-200">
        {TABS.map((tab) => {
          const active = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href)
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  '-mb-px flex min-h-[44px] items-center whitespace-nowrap border-b-2 px-4 text-sm font-semibold transition-colors',
                  active
                    ? 'border-[#1865F2] text-[#1865F2]'
                    : 'border-transparent text-gray-500 hover:text-gray-900',
                )}
              >
                {tab.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
