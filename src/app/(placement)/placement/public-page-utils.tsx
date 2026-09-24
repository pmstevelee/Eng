import { headers } from 'next/headers'
import type { LucideIcon } from 'lucide-react'
import { checkRateLimit } from '@/lib/security/rate-limit'

/** 공개 페이지 조회 제한: IP당 분당 60회 */
export function isPageRateLimited(scope: string): boolean {
  const h = headers()
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || 'unknown'
  return !checkRateLimit(`placement:view:${scope}:${ip}`, { max: 60 }).allowed
}

/** 만료·완료·오류 등 안내 화면 */
export function NoticeScreen({
  icon: Icon,
  iconClassName,
  title,
  description,
  academyName,
}: {
  icon: LucideIcon
  iconClassName: string
  title: string
  description: string
  academyName?: string
}) {
  return (
    <main className="mx-auto max-w-md px-4 py-16 text-center">
      {academyName && <p className="text-sm font-semibold text-gray-500 mb-6">{academyName}</p>}
      <div className={`mx-auto w-14 h-14 rounded-full flex items-center justify-center mb-4 ${iconClassName}`}>
        <Icon size={26} />
      </div>
      <h1 className="text-xl font-bold text-gray-900">{title}</h1>
      <p className="mt-2 text-sm text-gray-500 whitespace-pre-line">{description}</p>
    </main>
  )
}
