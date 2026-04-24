import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma/client'
import type { Role } from '@/types'
import LandingNav from '@/components/landing/nav'
import LandingFooter from '@/components/landing/footer'
import ScrollReveal from '@/components/landing/scroll-reveal'
import Counter from '@/components/landing/counter'
import RoleTabs from '@/components/landing/role-tabs'
import ReviewsCarousel from '@/components/landing/reviews-carousel'

export const metadata: Metadata = {
  title: '위고업잉글리시 — AI 영어학원 학습관리 시스템',
  description:
    '적응형 레벨 테스트, AI 맞춤 학습, 자동 성적 분석까지. 선생님은 교육에 집중하고 나머지는 위고업잉글리시가 합니다. 14일 무료 체험.',
  openGraph: {
    title: '위고업잉글리시 — AI 영어학원 학습관리 시스템',
    description: '적응형 레벨 테스트, AI 맞춤 학습, 자동 성적 분석. 14일 무료 체험.',
    siteName: '위고업잉글리시',
    locale: 'ko_KR',
    type: 'website',
  },
}

const ROLE_REDIRECT: Record<Role, string> = {
  SUPER_ADMIN: '/admin',
  ACADEMY_OWNER: '/owner',
  TEACHER: '/teacher',
  STUDENT: '/student',
}

const FEATURES = [
  {
    num: '01',
    title: '적응형 10단계 레벨 테스트',
    subtitle: '맞추면 어려운 문제, 틀리면 쉬운 문제',
    desc: '영역별(문법·어휘·읽기·쓰기) 독립 레벨 측정으로 학생의 정확한 실력을 파악합니다. CEFR 기준 Pre-A1 ~ C1+ 10단계로 정밀하게 배치합니다.',
    mockup: '적응형 레벨 테스트 결과 화면',
    flip: false,
  },
  {
    num: '02',
    title: 'AI 쓰기 평가 + 레벨업 전략',
    subtitle: '에세이의 실제 레벨을 독립 판정',
    desc: '다른 영역과 쓰기 레벨을 비교 분석하여 구체적인 레벨업 로드맵을 제시합니다. GPT-4o 기반으로 30초 내에 피드백이 완성됩니다.',
    mockup: 'AI 쓰기 평가 피드백 화면',
    flip: true,
  },
  {
    num: '03',
    title: '오늘의 미션 + 게이미피케이션',
    subtitle: '매일 AI가 설계하는 맞춤 퀘스트',
    desc: 'XP, 스트릭, 배지로 학생의 학습 동기를 자연스럽게 유지합니다. 미션 완료가 곧 레벨업 조건 달성으로 이어집니다.',
    mockup: '학생 홈 미션 카드',
    flip: false,
  },
  {
    num: '04',
    title: '실시간 분석 대시보드',
    subtitle: '데이터 기반 학원 운영',
    desc: '반별 비교, 영역별 분석, 성장률 추이, 교사 성과까지 한눈에 파악합니다. 1클릭 PDF 리포트로 학부모 상담을 준비하세요.',
    mockup: '분석 대시보드 화면',
    flip: true,
  },
]

function MockupPlaceholder({ label }: { label: string }) {
  return (
    <div
      className="bg-white rounded-2xl border border-gray-200 p-2 shadow-sm"
      style={{ transform: 'perspective(1200px) rotateY(-2deg) rotateX(1deg)' }}
    >
      <div className="bg-gray-100 rounded-xl aspect-[16/10] flex items-center justify-center">
        <div className="text-center text-gray-400 p-6">
          <div className="w-10 h-10 bg-gray-200 rounded-xl mx-auto mb-2 flex items-center justify-center">
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <div className="text-xs">스크린샷 영역</div>
          <div className="text-xs text-gray-400 mt-0.5">{label}</div>
        </div>
      </div>
    </div>
  )
}

export default async function Home() {
  // 미들웨어에서 도메인별 분기 처리됨:
  // - wegoupenglish.com → 이 페이지(랜딩) 렌더링
  // - login.wegoupenglish.com / localhost → /login 으로 리다이렉트
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    const profile = await prisma.user.findUnique({
      where: { id: user.id },
      select: { role: true },
    })
    if (profile) redirect(ROLE_REDIRECT[profile.role as Role])
    redirect('/login')
  }

  return (
    <>
      <LandingNav />
      <main>
        {/* ── Section 1: Hero ─────────────────────────────── */}
        <section className="bg-gradient-to-b from-primary-50 to-white min-h-[90vh] flex flex-col items-center justify-center text-center px-6 pt-16 pb-12">
          <ScrollReveal>
            <div className="inline-flex items-center gap-2 bg-primary-100 text-primary-700 text-xs font-semibold px-4 py-2 rounded-full mb-8">
              🚀 지금 무료 체험 중
            </div>
            <h1 className="text-5xl md:text-6xl font-bold text-primary-900 leading-tight mb-6">
              AI가 가르치는
              <br />
              영어학원의 새로운 기준
            </h1>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-10">
              적응형 레벨 테스트, AI 맞춤 학습, 자동 성적 분석까지.
              <br />
              선생님은 교육에 집중하고, 나머지는 위고업잉글리시가 합니다.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-4">
              <Link
                href="/register/owner"
                className="bg-primary-700 text-white px-8 py-4 rounded-xl text-lg font-bold shadow-sm hover:bg-primary-800 transition-all hover:-translate-y-0.5"
              >
                14일 무료 체험 시작
              </Link>
              <Link
                href="/features"
                className="text-primary-700 border border-primary-700 px-8 py-4 rounded-xl text-lg font-bold hover:bg-primary-50 transition-colors"
              >
                기능 둘러보기 →
              </Link>
            </div>
            <p className="text-sm text-gray-400">
              카드 등록 없이 시작 · 14일 후 자동 결제 없음 · 언제든 해지
            </p>
          </ScrollReveal>

          {/* Hero mockup */}
          <ScrollReveal className="w-full max-w-4xl mt-16" delay={200}>
            <div
              className="bg-white rounded-2xl border border-gray-200 p-3 shadow-sm"
              style={{ transform: 'perspective(1600px) rotateX(4deg)' }}
            >
              <div className="bg-gray-50 rounded-xl aspect-[16/9] flex items-center justify-center border border-gray-100">
                <div className="text-center text-gray-400 p-8">
                  <div className="flex gap-2 justify-center mb-4">
                    {['bg-accent-red', 'bg-accent-gold', 'bg-accent-green'].map((c) => (
                      <div key={c} className={`w-3 h-3 rounded-full ${c}`} />
                    ))}
                  </div>
                  <div className="grid grid-cols-3 gap-3 w-80">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="bg-gray-200 rounded-lg h-16 animate-pulse" style={{ animationDelay: `${i * 0.15}s` }} />
                    ))}
                  </div>
                  <div className="mt-3 text-xs text-gray-400">LMS 대시보드 스크린샷 영역</div>
                </div>
              </div>
            </div>
          </ScrollReveal>
        </section>

        {/* ── Section 2: 핵심 가치 ─────────────────────────── */}
        <section className="bg-white py-24 px-6">
          <div className="max-w-6xl mx-auto">
            <ScrollReveal>
              <h2 className="text-3xl font-bold text-gray-900 text-center mb-4">
                왜 위고업잉글리시인가요?
              </h2>
              <p className="text-gray-500 text-center mb-16 max-w-xl mx-auto">
                영어학원이 진짜 필요한 것에만 집중했습니다.
              </p>
            </ScrollReveal>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                {
                  emoji: '🎯',
                  bg: 'bg-primary-100',
                  color: 'text-primary-700',
                  title: '정밀한 레벨 측정',
                  desc: '적응형 배치 시험으로 10단계 CEFR 레벨을 정확하게 측정합니다. 맞추면 어려운 문제, 틀리면 쉬운 문제가 자동 출제됩니다.',
                },
                {
                  emoji: '🤖',
                  bg: 'bg-purple-100',
                  color: 'text-purple-600',
                  title: 'AI 맞춤형 학습',
                  desc: '학생의 약점을 AI가 분석하여 매일 맞춤 문제를 추천합니다. 쓰기 평가도 AI가 즉시 피드백합니다.',
                },
                {
                  emoji: '📊',
                  bg: 'bg-green-100',
                  color: 'text-green-700',
                  title: '자동화된 학원 운영',
                  desc: '성적 분석, 리포트 생성, 출석 관리까지. 선생님의 행정 업무를 60% 줄여드립니다.',
                },
              ].map((card, i) => (
                <ScrollReveal key={card.title} delay={i * 100}>
                  <div className="border border-gray-200 rounded-xl p-8 hover:border-primary-200 hover:shadow-sm transition-all text-center">
                    <div className={`w-16 h-16 rounded-2xl ${card.bg} flex items-center justify-center text-3xl mx-auto mb-5`}>
                      {card.emoji}
                    </div>
                    <h3 className={`text-lg font-bold mb-3 ${card.color}`}>{card.title}</h3>
                    <p className="text-sm text-gray-600 leading-relaxed">{card.desc}</p>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── Section 3: 역할별 혜택 ───────────────────────── */}
        <section className="bg-gray-50 py-24 px-6">
          <div className="max-w-6xl mx-auto">
            <ScrollReveal>
              <h2 className="text-3xl font-bold text-gray-900 text-center mb-4">
                모두를 위한 솔루션
              </h2>
              <p className="text-gray-500 text-center mb-16 max-w-xl mx-auto">
                학원장, 교사, 학생 모두의 경험을 최적화했습니다.
              </p>
            </ScrollReveal>
            <RoleTabs />
          </div>
        </section>

        {/* ── Section 4: 기능 쇼케이스 ────────────────────── */}
        <section className="bg-white py-24 px-6">
          <div className="max-w-6xl mx-auto">
            <ScrollReveal>
              <h2 className="text-3xl font-bold text-gray-900 text-center mb-4">
                주요 기능
              </h2>
              <p className="text-gray-500 text-center mb-20 max-w-xl mx-auto">
                학원 운영에 꼭 필요한 기능만 담았습니다.
              </p>
            </ScrollReveal>
            <div className="space-y-24">
              {FEATURES.map((f) => (
                <ScrollReveal key={f.num}>
                  <div className={`grid grid-cols-1 md:grid-cols-2 gap-12 items-center ${f.flip ? 'md:[&>*:first-child]:order-2' : ''}`}>
                    <div>
                      <div className="text-5xl font-bold text-primary-100 mb-2 leading-none">{f.num}</div>
                      <h3 className="text-2xl font-bold text-gray-900 mb-2">{f.title}</h3>
                      <p className="text-primary-700 font-semibold text-sm mb-4">{f.subtitle}</p>
                      <p className="text-gray-600 leading-relaxed">{f.desc}</p>
                      <Link href="/features" className="inline-flex items-center gap-1 text-sm text-primary-700 font-semibold mt-5 hover:underline">
                        자세히 보기 →
                      </Link>
                    </div>
                    <MockupPlaceholder label={f.mockup} />
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── Section 5: 숫자로 보는 ───────────────────────── */}
        <section className="bg-primary-900 text-white py-20 px-6">
          <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { target: 450, suffix: '+', label: '공용 문제 뱅크', unit: '' },
              { target: 10, suffix: '단계', label: 'CEFR 기반 레벨 체계', unit: '' },
              { target: 4, suffix: '영역', label: '문법·어휘·읽기·쓰기', unit: '' },
              { target: 60, suffix: '%', label: '교사 행정 업무 절감', unit: '' },
            ].map((stat) => (
              <div key={stat.label}>
                <div className="text-4xl md:text-5xl font-bold mb-2">
                  <Counter target={stat.target} suffix={stat.suffix} />
                </div>
                <div className="text-sm text-white/60">{stat.label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Section 6: 요금제 미리보기 ───────────────────── */}
        <section className="bg-white py-24 px-6">
          <div className="max-w-5xl mx-auto">
            <ScrollReveal>
              <h2 className="text-3xl font-bold text-gray-900 text-center mb-2">
                합리적인 요금, 무료로 시작하세요
              </h2>
              <p className="text-gray-500 text-center mb-16">
                학생당 월 1,663원부터. 모든 플랜 14일 무료 체험.
              </p>
            </ScrollReveal>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              {[
                {
                  name: 'Free',
                  price: '무료 14일',
                  highlight: false,
                  badge: null,
                  features: ['학생 최대 10명', '기본 레벨 테스트', '문제 뱅크 100문항', '교사 계정 1개', '기본 성적 리포트'],
                  cta: '무료 시작',
                  href: '/register/owner',
                },
                {
                  name: 'Standard',
                  price: '월 49,900원',
                  highlight: true,
                  badge: '가장 인기',
                  features: ['학생 최대 50명', '레벨·단원 테스트 무제한', '전체 문제 뱅크 450+', 'AI 쓰기 평가 월 200회', '고급 분석 대시보드'],
                  cta: '14일 무료 체험',
                  href: '/register/owner',
                },
                {
                  name: 'Premium',
                  price: '월 129,000원',
                  highlight: false,
                  badge: null,
                  features: ['학생 무제한', 'AI 쓰기·문제 무제한', '교사 계정 무제한', '전담 CS 매니저', 'SLA 99.9% 보장'],
                  cta: '도입 상담',
                  href: '/contact',
                },
              ].map((plan, i) => (
                <ScrollReveal key={plan.name} delay={i * 100}>
                  <div
                    className={`rounded-2xl border p-6 flex flex-col h-full relative ${
                      plan.highlight ? 'border-primary-700 ring-1 ring-primary-700' : 'border-gray-200'
                    }`}
                  >
                    {plan.badge && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <span className="bg-primary-700 text-white text-xs font-bold px-3 py-1 rounded-full">
                          {plan.badge}
                        </span>
                      </div>
                    )}
                    <div className="text-sm text-gray-500 mb-1">{plan.name}</div>
                    <div className="text-xl font-bold text-gray-900 mb-4">{plan.price}</div>
                    <ul className="space-y-2.5 flex-1 mb-6">
                      {plan.features.map((f) => (
                        <li key={f} className="flex items-center gap-2 text-sm text-gray-700">
                          <svg className="w-4 h-4 text-accent-green flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          {f}
                        </li>
                      ))}
                    </ul>
                    <Link
                      href={plan.href}
                      className={`block text-center text-sm font-bold py-3 rounded-xl transition-colors ${
                        plan.highlight
                          ? 'bg-primary-700 text-white hover:bg-primary-800'
                          : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {plan.cta}
                    </Link>
                  </div>
                </ScrollReveal>
              ))}
            </div>
            <ScrollReveal>
              <p className="text-center text-sm text-gray-500">
                더 자세한 비교가 필요하신가요?{' '}
                <Link href="/pricing" className="text-primary-700 font-semibold hover:underline">
                  전체 요금제 비교 →
                </Link>
              </p>
            </ScrollReveal>
          </div>
        </section>

        {/* ── Section 7: 후기 ──────────────────────────────── */}
        <section className="bg-gray-50 py-24 px-6">
          <div className="max-w-5xl mx-auto">
            <ScrollReveal>
              <h2 className="text-3xl font-bold text-gray-900 text-center mb-4">
                학원 현장의 목소리
              </h2>
              <p className="text-gray-500 text-center mb-12">
                전국 50+ 학원이 선택한 이유를 들어보세요.
              </p>
            </ScrollReveal>
            <ReviewsCarousel />
            <ScrollReveal>
              <p className="text-center mt-8">
                <Link href="/reviews" className="text-primary-700 text-sm font-semibold hover:underline">
                  더 많은 도입 사례 보기 →
                </Link>
              </p>
            </ScrollReveal>
          </div>
        </section>

        {/* ── Section 8: 최종 CTA ──────────────────────────── */}
        <section className="bg-gradient-to-b from-white to-primary-50 py-24 px-6 text-center">
          <ScrollReveal>
            <h2 className="text-4xl font-bold text-primary-900 mb-4">지금 바로 시작하세요</h2>
            <p className="text-lg text-gray-600 mb-10">
              카드 등록 없이 14일 무료 체험. 모든 기능을 사용해보세요.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-6">
              <Link
                href="/register/owner"
                className="bg-primary-700 text-white px-10 py-4 rounded-xl text-lg font-bold hover:bg-primary-800 transition-all hover:-translate-y-0.5 shadow-sm"
              >
                14일 무료 체험 시작
              </Link>
              <Link
                href="/contact"
                className="border border-primary-700 text-primary-700 px-10 py-4 rounded-xl text-lg font-bold hover:bg-primary-50 transition-colors"
              >
                도입 상담 받기
              </Link>
            </div>
            <p className="text-sm text-gray-400">
              설치 필요 없음 · 5분 안에 시작 · 언제든 해지
            </p>
          </ScrollReveal>
        </section>
      </main>
      <LandingFooter />
    </>
  )
}
