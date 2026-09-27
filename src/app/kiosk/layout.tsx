import type { Metadata, Viewport } from 'next'

export const metadata: Metadata = {
  title: '출결 키패드 | 위고업잉글리시',
  robots: { index: false, follow: false },
}

// 태블릿에서 두 번 탭 확대·핀치 확대로 화면이 틀어지지 않도록 고정
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#0C2340',
}

/** 키패드 전용 레이아웃 — 사이드바·로그인과 무관 */
export default function KioskLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-[100dvh] bg-gray-50 text-gray-900 select-none">{children}</div>
}
