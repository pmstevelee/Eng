import type { Metadata } from 'next'

// 학부모 공유 학습 리포트 (로그인 불필요, 토큰으로만 접근) — 검색 노출 금지
export const metadata: Metadata = {
  title: '학습 리포트',
  robots: { index: false, follow: false },
}

export default function ParentReportLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-[100dvh] bg-gray-50">{children}</div>
}
