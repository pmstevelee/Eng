// 문법학습 관리 상단 탭 — 반 배정 / 코스 템플릿(학원장) / 검수 대기

import Link from 'next/link'
import { cn } from '@/lib/utils'

export type GrammarManageRole = 'TEACHER' | 'ACADEMY_OWNER'
export type GrammarManageTab = 'classes' | 'courses' | 'questions'

export function grammarManageBase(role: GrammarManageRole): string {
  return role === 'TEACHER' ? '/teacher/grammar' : '/owner/grammar'
}

export function GrammarManageNav({
  role,
  active,
  pendingCount,
}: {
  role: GrammarManageRole
  active: GrammarManageTab
  pendingCount?: number
}) {
  const base = grammarManageBase(role)
  const tabs: { key: GrammarManageTab; label: string; href: string }[] = [
    { key: 'classes', label: '반 배정', href: base },
    ...(role === 'ACADEMY_OWNER' ? [{ key: 'courses' as const, label: '코스 템플릿', href: `${base}/courses` }] : []),
    { key: 'questions', label: '검수 대기', href: `${base}/questions` },
  ]
  return (
    <nav className="-mb-px flex gap-1 overflow-x-auto border-b border-gray-200" aria-label="문법학습 관리 메뉴">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          aria-current={active === t.key ? 'page' : undefined}
          className={cn(
            'flex min-h-[44px] shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 text-sm font-medium transition-colors',
            active === t.key
              ? 'border-[#1865F2] text-[#1865F2]'
              : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700',
          )}
        >
          {t.label}
          {t.key === 'questions' && pendingCount !== undefined && pendingCount > 0 && (
            <span className="rounded-full bg-[#FFF4D6] px-2 py-0.5 text-xs font-semibold text-[#B37A00]">{pendingCount}</span>
          )}
        </Link>
      ))}
    </nav>
  )
}

export function GrammarManageHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
      {description && <p className="mt-1 text-sm text-gray-500">{description}</p>}
    </div>
  )
}
