import Link from 'next/link'
import { CalendarDays, ListChecks } from 'lucide-react'
import { cn } from '@/lib/utils'

/** 상담관리 상단 탭: 문의 목록 / 상담 일정 */
export function ConsultationTabs({ basePath, active }: { basePath: string; active: 'leads' | 'schedule' }) {
  const tabs = [
    { key: 'leads', label: '문의 목록', href: basePath, icon: ListChecks },
    { key: 'schedule', label: '상담 일정', href: `${basePath}/schedule`, icon: CalendarDays },
  ] as const

  return (
    <nav className="flex gap-1 border-b border-gray-200" aria-label="상담관리 메뉴">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          aria-current={active === t.key ? 'page' : undefined}
          className={cn(
            'h-11 px-4 -mb-px inline-flex items-center gap-1.5 border-b-2 text-sm font-medium transition-colors',
            active === t.key
              ? 'border-primary-700 text-primary-700'
              : 'border-transparent text-gray-500 hover:text-gray-900',
          )}
        >
          <t.icon size={16} />
          {t.label}
        </Link>
      ))}
    </nav>
  )
}
