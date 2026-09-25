import 'server-only'

import { headers } from 'next/headers'

/** 알림·공유 링크용 절대 URL 기준 (APP_BASE_URL 우선, 없으면 현재 요청 호스트) */
export function appBaseUrl(): string {
  const configured = process.env.APP_BASE_URL?.replace(/\/$/, '')
  if (configured) return configured
  const h = headers()
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'login.wegoupenglish.com'
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')
  return `${proto}://${host}`
}
