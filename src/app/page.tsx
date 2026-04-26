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
  title: '위고업잉글리시 — 영어학원의 새로운 기준',
  description:
    'AI가 학생 데이터를 정밀 분석하고, 선생님이 직접 문제를 만들어 교육합니다. 데이터 기반으로 학생 실력을 효율적으로 향상시키는 영어학원 학습관리 시스템. 14일 무료 체험.',
  openGraph: {
    title: '위고업잉글리시 — 영어학원의 새로운 기준',
    description: 'AI 정밀 분석 + 교사 주도 교육. 데이터로 학생 실력을 향상시킵니다. 14일 무료 체험.',
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
    color: '#1865F2',
    title: '적응형 10단계 레벨 테스트',
    subtitle: '맞추면 어려운 문제, 틀리면 쉬운 문제',
    desc: '영역별(문법·어휘·읽기·쓰기·듣기) 독립 레벨 측정으로 학생의 정확한 실력을 파악합니다. CEFR 기준 Pre-A1 ~ C1+ 10단계로 정밀하게 배치합니다.',
    mockupBg: '#EEF4FF',
    mockupLabel: '적응형 레벨 테스트 결과',
    flip: false,
    detailHref: '/features/adaptive-test',
  },
  {
    num: '02',
    color: '#7854F7',
    title: 'AI 데이터 분석 + 약점 반복 제시',
    subtitle: '부족한 부분을 AI가 정확히 찾아 반복 학습',
    desc: 'AI가 학생의 오답 패턴과 영역별 점수를 정밀 분석합니다. 취약한 유형을 자동으로 감지하고 해당 문제를 반복 제시하여 실질적인 실력 향상을 이끕니다.',
    mockupBg: '#F3F0FF',
    mockupLabel: 'AI 약점 분석 리포트',
    flip: true,
    detailHref: '/features/ai-analysis',
  },
  {
    num: '03',
    color: '#0FBFAD',
    title: '교사 직접 문제 출제',
    subtitle: '선생님이 교육의 방향을 직접 설계합니다',
    desc: '교사가 직접 문제를 만들고 학습 방향을 설정합니다. AI는 보조 도구로서 문제 생성을 지원하고, 교사는 학원 특성에 맞게 커리큘럼을 자유롭게 구성합니다.',
    mockupBg: '#E8FAF8',
    mockupLabel: '교사 문제 출제 화면',
    flip: false,
    detailHref: '/features',
  },
  {
    num: '04',
    color: '#E35C20',
    title: '데이터 기반 실시간 성장 추적',
    subtitle: '숫자로 보이는 학생의 실력 향상',
    desc: '반별 비교, 영역별 분석, 성장률 추이를 한눈에 파악합니다. 선생님이 데이터에 근거해 효율적으로 지도하고, 1클릭 PDF 리포트로 학부모 상담을 준비합니다.',
    mockupBg: '#FEF3EC',
    mockupLabel: '실시간 성장 대시보드',
    flip: true,
    detailHref: '/features',
  },
]

function MockupPlaceholder({ label, bg }: { label: string; bg: string }) {
  return (
    <div
      className="rounded-2xl border border-gray-200 p-2 shadow-sm overflow-hidden"
      style={{ background: '#fff', transform: 'perspective(1200px) rotateY(-2deg) rotateX(1deg)' }}
    >
      <div
        className="rounded-xl aspect-[16/10] flex flex-col items-center justify-center gap-3 border border-gray-100"
        style={{ background: bg }}
      >
        <div className="flex gap-2">
          {['#1865F2', '#7854F7', '#0FBFAD'].map((c) => (
            <div key={c} className="w-2 h-2 rounded-full" style={{ background: c }} />
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2 w-48">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="rounded-md h-10 animate-pulse"
              style={{ background: 'rgba(0,0,0,0.08)', animationDelay: `${i * 0.12}s` }}
            />
          ))}
        </div>
        <div className="text-xs text-gray-400 mt-1">{label}</div>
      </div>
    </div>
  )
}

export default async function Home() {
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
        <section className="bg-white min-h-[90vh] flex flex-col items-center justify-center text-center px-6 pt-16 pb-12 border-b border-gray-100">
          <ScrollReveal>
            <div className="inline-flex items-center gap-2 border border-primary-200 text-primary-700 text-xs font-semibold px-4 py-2 rounded-full mb-8 bg-primary-50">
              14일 무료 체험 진행 중
            </div>
            <h1 className="text-5xl md:text-6xl font-bold text-gray-900 leading-tight mb-6">
              영어학원의{' '}
              <span style={{ color: '#1865F2' }}>새로운 기준</span>
            </h1>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-4 leading-relaxed">
              AI가 학생 데이터를 정밀 분석하고,{' '}
              <strong className="text-gray-800">선생님이 올바른 교육 방향을 제시합니다.</strong>
            </p>
            <p className="text-base text-gray-500 max-w-xl mx-auto mb-6 leading-relaxed">
              부족한 부분은 AI가 반복 제시하고, 선생님이 직접 문제를 만들어 학습시킵니다.
              <br />
              데이터에 근거한 효율적인 교육으로 학생 실력을 실질적으로 향상시킵니다.
            </p>
            <div className="flex flex-wrap justify-center gap-2 mb-8">
              {[
                { label: '문법', color: '#1865F2' },
                { label: '어휘', color: '#7854F7' },
                { label: '읽기', color: '#0FBFAD' },
                { label: '쓰기', color: '#E35C20' },
                { label: '듣기', color: '#E91E8A' },
              ].map((d) => (
                <span
                  key={d.label}
                  className="text-xs font-bold px-3 py-1 rounded-full"
                  style={{ background: d.color + '18', color: d.color }}
                >
                  {d.label}
                </span>
              ))}
            </div>
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

          {/* Hero 색상 강조 블록 */}
          <ScrollReveal className="w-full max-w-4xl mt-16" delay={200}>
            <div
              className="bg-white rounded-2xl border border-gray-200 p-3 shadow-sm"
              style={{ transform: 'perspective(1600px) rotateX(4deg)' }}
            >
              <div className="bg-gray-50 rounded-xl aspect-[16/9] flex items-center justify-center border border-gray-100 overflow-hidden">
                <div className="w-full h-full p-6 flex flex-col gap-4">
                  <div className="flex gap-1.5">
                    {['#1865F2', '#7854F7', '#0FBFAD', '#E35C20', '#E91E8A'].map((c) => (
                      <div key={c} className="w-2.5 h-2.5 rounded-full" style={{ background: c }} />
                    ))}
                    <span className="text-xs text-gray-400 ml-2">위고업잉글리시 LMS</span>
                  </div>
                  <div className="grid grid-cols-5 gap-2 flex-1">
                    {[
                      { label: '문법', color: '#1865F2', pct: 78 },
                      { label: '어휘', color: '#7854F7', pct: 62 },
                      { label: '읽기', color: '#0FBFAD', pct: 85 },
                      { label: '쓰기', color: '#E35C20', pct: 54 },
                      { label: '듣기', color: '#E91E8A', pct: 70 },
                    ].map((d) => (
                      <div key={d.label} className="bg-white rounded-xl border border-gray-200 p-3 flex flex-col gap-2">
                        <div className="text-xs font-semibold" style={{ color: d.color }}>{d.label}</div>
                        <div className="flex-1 flex items-end">
                          <div className="w-full rounded-full bg-gray-100 h-2">
                            <div
                              className="h-2 rounded-full"
                              style={{ width: `${d.pct}%`, background: d.color }}
                            />
                          </div>
                        </div>
                        <div className="text-sm font-bold text-gray-700">{d.pct}점</div>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="bg-gray-200 rounded-lg h-8 animate-pulse" style={{ animationDelay: `${i * 0.15}s` }} />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </ScrollReveal>
        </section>

        {/* ── Section 2: AI 철학 강조 ──────────────────────── */}
        <section className="py-20 px-6" style={{ background: '#0C2340' }}>
          <div className="max-w-4xl mx-auto text-center">
            <ScrollReveal>
              <p className="text-sm font-semibold mb-4" style={{ color: '#0FBFAD' }}>
                AI가 보조하고, 선생님이 가르칩니다
              </p>
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-6 leading-tight">
                모든 것을 AI에 맡기지 않습니다.{' '}
                <br />
                <span style={{ color: '#FFB100' }}>AI는 분석하고, 선생님은 가르칩니다.</span>
              </h2>
              <p className="text-gray-300 text-lg max-w-2xl mx-auto leading-relaxed">
                생성된 학습 데이터를 AI가 정밀하게 분석하여 학생의 부족한 부분을 반복 제시합니다.
                선생님은 데이터를 바탕으로 올바른 교육 방향을 제시하고 직접 문제를 만들어 학습시킵니다.
              </p>
            </ScrollReveal>
            <ScrollReveal delay={150}>
              <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-px bg-white/10 rounded-2xl overflow-hidden">
                {[
                  {
                    step: '1단계',
                    color: '#7854F7',
                    title: 'AI 정밀 분석',
                    desc: '학생의 오답 패턴과 영역별 데이터를 AI가 정밀하게 분석합니다',
                  },
                  {
                    step: '2단계',
                    color: '#1865F2',
                    title: '교사 방향 설정',
                    desc: '분석 결과를 바탕으로 선생님이 올바른 교육 방향과 문제를 직접 설계합니다',
                  },
                  {
                    step: '3단계',
                    color: '#0FBFAD',
                    title: 'AI 반복 학습',
                    desc: '부족한 영역을 AI가 반복 제시하며 학생 실력을 체계적으로 향상시킵니다',
                  },
                ].map((item) => (
                  <div key={item.step} className="bg-white/5 p-8 text-left">
                    <div
                      className="text-xs font-bold px-3 py-1 rounded-full inline-block mb-4"
                      style={{ background: item.color + '33', color: item.color }}
                    >
                      {item.step}
                    </div>
                    <h3 className="text-white font-bold text-lg mb-2">{item.title}</h3>
                    <p className="text-gray-400 text-sm leading-relaxed">{item.desc}</p>
                  </div>
                ))}
              </div>
            </ScrollReveal>
          </div>
        </section>

        {/* ── Section 3: 핵심 가치 ─────────────────────────── */}
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                {
                  color: '#1865F2',
                  bg: '#EEF4FF',
                  label: 'Grammar · 정밀 측정',
                  title: '10단계 레벨 정밀 측정',
                  desc: '적응형 배치 시험으로 문법·어휘·읽기·쓰기·듣기 5영역을 독립 측정합니다. CEFR 기준 Pre-A1 ~ C1+ 10단계로 학생의 정확한 실력을 파악합니다.',
                },
                {
                  color: '#7854F7',
                  bg: '#F3F0FF',
                  label: 'AI · 데이터 분석',
                  title: 'AI 약점 분석 및 반복 제시',
                  desc: '학생의 오답 패턴을 AI가 분석하여 취약한 유형을 자동 감지합니다. 부족한 영역의 문제를 반복적으로 제시해 실질적인 실력 향상을 이끕니다.',
                },
                {
                  color: '#0FBFAD',
                  bg: '#E8FAF8',
                  label: 'Teacher · 교사 주도',
                  title: '선생님이 직접 출제하는 커리큘럼',
                  desc: '교사가 직접 문제를 만들고 학원 특성에 맞게 학습 방향을 설계합니다. AI는 문제 생성을 보조하고, 교육의 주도권은 항상 선생님에게 있습니다.',
                },
                {
                  color: '#E35C20',
                  bg: '#FEF3EC',
                  label: 'Data · 성장 추적',
                  title: '데이터로 보이는 학생 성장',
                  desc: '성적 분석, 성장률 추이, 반별 비교를 한눈에 파악합니다. 데이터에 근거한 효율적인 교육으로 선생님의 행정 업무를 60% 줄입니다.',
                },
              ].map((card, i) => (
                <ScrollReveal key={card.title} delay={i * 80}>
                  <div
                    className="rounded-2xl p-8 border border-transparent hover:border-gray-200 transition-all"
                    style={{ background: card.bg }}
                  >
                    <div
                      className="text-xs font-bold px-3 py-1 rounded-full inline-block mb-5"
                      style={{ background: card.color + '22', color: card.color }}
                    >
                      {card.label}
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 mb-3">{card.title}</h3>
                    <p className="text-sm text-gray-600 leading-relaxed">{card.desc}</p>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── Section 4: 역할별 혜택 ───────────────────────── */}
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

        {/* ── Section 5: 기능 쇼케이스 ────────────────────── */}
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
                      <div
                        className="text-5xl font-bold mb-2 leading-none"
                        style={{ color: f.color + '33' }}
                      >
                        {f.num}
                      </div>
                      <h3 className="text-2xl font-bold text-gray-900 mb-2">{f.title}</h3>
                      <p className="font-semibold text-sm mb-4" style={{ color: f.color }}>{f.subtitle}</p>
                      <p className="text-gray-600 leading-relaxed">{f.desc}</p>
                      <Link href={f.detailHref} className="inline-flex items-center gap-1 text-sm font-semibold mt-5 hover:underline" style={{ color: f.color }}>
                        자세히 보기 →
                      </Link>
                    </div>
                    <MockupPlaceholder label={f.mockupLabel} bg={f.mockupBg} />
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── Section 6: 숫자로 보는 ───────────────────────── */}
        <section className="py-20 px-6" style={{ background: '#0C2340' }}>
          <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { target: 450, suffix: '+', label: '공용 문제 뱅크', color: '#1865F2' },
              { target: 10, suffix: '단계', label: 'CEFR 기반 레벨 체계', color: '#7854F7' },
              { target: 5, suffix: '영역', label: '문법·어휘·읽기·쓰기·듣기', color: '#0FBFAD' },
              { target: 60, suffix: '%', label: '교사 행정 업무 절감', color: '#FFB100' },
            ].map((stat) => (
              <div key={stat.label}>
                <div className="text-4xl md:text-5xl font-bold mb-2" style={{ color: stat.color }}>
                  <Counter target={stat.target} suffix={stat.suffix} />
                </div>
                <div className="text-sm text-white/60">{stat.label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Section 7: 요금제 미리보기 ───────────────────── */}
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
                          <span className="w-4 h-4 rounded-full bg-accent-green flex-shrink-0 flex items-center justify-center text-white text-[10px] font-bold">
                            ✓
                          </span>
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

        {/* ── Section 8: 후기 ──────────────────────────────── */}
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

        {/* ── Section 9: 최종 CTA ──────────────────────────── */}
        <section className="bg-white py-24 px-6 text-center border-t border-gray-100">
          <ScrollReveal>
            <div className="flex justify-center gap-2 mb-8">
              {['#1865F2', '#7854F7', '#0FBFAD', '#E35C20', '#E91E8A'].map((c) => (
                <div key={c} className="w-3 h-3 rounded-full" style={{ background: c }} />
              ))}
            </div>
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              지금 바로 <span style={{ color: '#1865F2' }}>시작</span>하세요
            </h2>
            <p className="text-lg text-gray-600 mb-10 max-w-lg mx-auto">
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
