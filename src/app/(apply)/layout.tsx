import type { Metadata, Viewport } from 'next'

// 외부 상담신청 공개 페이지 — 학부모가 휴대폰(QR·링크)으로 접속. 검색 노출 금지
export const metadata: Metadata = {
  title: '상담 신청',
  robots: { index: false, follow: false },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#FFFFFF',
}

export default function ApplyLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-[100dvh] bg-gray-50">{children}</div>
}
