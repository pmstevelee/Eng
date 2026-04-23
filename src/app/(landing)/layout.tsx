import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import LandingNav from '@/components/landing/nav'
import LandingFooter from '@/components/landing/footer'

export const metadata: Metadata = {
  title: {
    template: '%s | 위고업잉글리시',
    default: '위고업잉글리시 — AI 영어학원 학습관리 시스템',
  },
  description: 'AI 기반 적응형 레벨 테스트, 맞춤 학습, 자동 성적 분석. 위고업잉글리시와 함께 영어학원 운영을 혁신하세요.',
  openGraph: {
    siteName: '위고업잉글리시',
    locale: 'ko_KR',
    type: 'website',
  },
}

export default function LandingLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <LandingNav />
      <main>{children}</main>
      <LandingFooter />
    </>
  )
}
