import type { Metadata } from 'next'

// 비회원 레벨테스트 공개 페이지 (응시 링크·결과 리포트) — 검색 노출 금지
export const metadata: Metadata = {
  title: '영어 레벨테스트',
  robots: { index: false, follow: false },
}

export default function PlacementLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-[100dvh] bg-gray-50">{children}</div>
}
