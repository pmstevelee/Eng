import type { Metadata } from 'next'
import ScrollReveal from '@/components/landing/scroll-reveal'
import Link from 'next/link'

export const metadata: Metadata = {
  title: '요금제',
  description: '학생당 월 1,663원부터. 무료 체험 후 합리적인 요금으로 위고업잉글리시를 시작하세요.',
}

const PLANS = [
  {
    name: 'Free',
    nameKo: '무료 체험',
    price: null,
    priceDesc: '14일 무료',
    priceNote: '카드 등록 없음',
    highlight: false,
    badge: null,
    features: [
      '학생 최대 10명',
      '레벨 테스트 무제한',
      '기본 문제 뱅크 (100문항)',
      '교사 계정 1개',
      '기본 성적 리포트',
      '이메일 지원',
    ],
    cta: '무료로 시작하기',
    ctaHref: '/register/owner',
    ctaStyle: 'border border-gray-300 text-gray-700 hover:bg-gray-50',
  },
  {
    name: 'Standard',
    nameKo: '스탠다드',
    price: 49900,
    priceUnit: '월 / 학원',
    priceDesc: '학생 30명 기준',
    priceNote: '학생당 월 1,663원',
    highlight: true,
    badge: '가장 인기',
    features: [
      '학생 최대 50명',
      '레벨 테스트 + 단원 테스트 무제한',
      '전체 문제 뱅크 (450+ 문항)',
      '교사 계정 5개',
      'AI 쓰기 평가 월 200회',
      'AI 유사 문제 생성 월 100회',
      '고급 분석 대시보드',
      'PDF 리포트 무제한',
      '카카오톡 지원',
    ],
    cta: '14일 무료 체험',
    ctaHref: '/register/owner',
    ctaStyle: 'bg-primary-700 text-white hover:bg-primary-800',
  },
  {
    name: 'Premium',
    nameKo: '프리미엄',
    price: 129000,
    priceUnit: '월 / 학원',
    priceDesc: '학생 100명 기준',
    priceNote: '학생당 월 1,290원',
    highlight: false,
    badge: null,
    features: [
      '학생 무제한',
      'Standard 모든 기능 포함',
      'AI 쓰기 평가 무제한',
      'AI 문제 생성 무제한',
      '교사 계정 무제한',
      'API 연동 지원',
      '전담 CS 매니저',
      '오프라인 교육 지원',
      'SLA 99.9% 보장',
    ],
    cta: '도입 상담 받기',
    ctaHref: '/contact',
    ctaStyle: 'border border-primary-700 text-primary-700 hover:bg-primary-50',
  },
]

const FAQ_ITEMS = [
  {
    q: '무료 체험 기간에는 어떤 기능을 쓸 수 있나요?',
    a: '14일 무료 체험 기간 동안 선택한 플랜의 모든 기능을 제한 없이 사용하실 수 있습니다. 체험 기간 종료 후 자동으로 요금이 청구되지 않으며, 직접 구독을 시작하셔야 합니다.',
  },
  {
    q: '학생 수가 플랜 한도를 초과하면 어떻게 되나요?',
    a: '한도 초과 시 추가 학생을 등록할 수 없고, 알림을 드립니다. 상위 플랜으로 업그레이드하거나 도입 상담을 통해 맞춤 요금제를 이용하실 수 있습니다.',
  },
  {
    q: '결제는 어떻게 이루어지나요?',
    a: '현재 수동 입금 확인 방식으로 운영됩니다. 구독 신청 후 관리자 확인을 거쳐 서비스가 활성화됩니다. 카드 자동 결제는 추후 지원 예정입니다.',
  },
  {
    q: '연간 구독 시 할인이 있나요?',
    a: '연간 구독 시 월 구독 대비 20% 할인이 적용됩니다. 도입 상담 시 안내드립니다.',
  },
]

export default function PricingPage() {
  return (
    <div className="bg-white">
      {/* Hero */}
      <section className="bg-gradient-to-b from-primary-50 to-white py-20 text-center px-6">
        <ScrollReveal>
          <h1 className="text-4xl md:text-5xl font-bold text-primary-900 mb-4">
            합리적인 요금,
            <br />
            무료로 시작하세요
          </h1>
          <p className="text-lg text-gray-600">
            학생당 월 1,663원부터. 모든 플랜 14일 무료 체험.
          </p>
        </ScrollReveal>
      </section>

      {/* Plans */}
      <section className="py-16 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {PLANS.map((plan, i) => (
              <ScrollReveal key={plan.name} delay={i * 100}>
                <div
                  className={`rounded-2xl border p-8 flex flex-col h-full relative ${
                    plan.highlight
                      ? 'border-primary-700 shadow-sm ring-1 ring-primary-700'
                      : 'border-gray-200'
                  }`}
                >
                  {plan.badge && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="bg-primary-700 text-white text-xs font-bold px-4 py-1 rounded-full">
                        {plan.badge}
                      </span>
                    </div>
                  )}

                  <div className="mb-6">
                    <div className="text-sm font-semibold text-gray-500 mb-1">{plan.name}</div>
                    <div className="text-xl font-bold text-gray-900 mb-3">{plan.nameKo}</div>
                    {plan.price ? (
                      <>
                        <div className="flex items-baseline gap-1 mb-1">
                          <span className="text-3xl font-bold text-gray-900">
                            {plan.price.toLocaleString()}원
                          </span>
                          <span className="text-sm text-gray-500">{plan.priceUnit}</span>
                        </div>
                        <div className="text-xs text-gray-500">{plan.priceDesc}</div>
                        <div className="text-xs font-semibold text-primary-700 mt-1">{plan.priceNote}</div>
                      </>
                    ) : (
                      <>
                        <div className="text-3xl font-bold text-gray-900 mb-1">{plan.priceDesc}</div>
                        <div className="text-xs text-gray-500">{plan.priceNote}</div>
                      </>
                    )}
                  </div>

                  <ul className="space-y-3 flex-1 mb-8">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5 text-sm text-gray-700">
                        <svg className="w-4 h-4 text-accent-green mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        {f}
                      </li>
                    ))}
                  </ul>

                  <Link
                    href={plan.ctaHref}
                    className={`block text-center font-bold py-3 rounded-xl transition-colors text-sm ${plan.ctaStyle}`}
                  >
                    {plan.cta}
                  </Link>
                </div>
              </ScrollReveal>
            ))}
          </div>

          <ScrollReveal>
            <p className="text-center text-sm text-gray-500 mt-8">
              더 많은 학생 또는 맞춤 계약이 필요하신가요?{' '}
              <Link href="/contact" className="text-primary-700 font-semibold hover:underline">
                도입 상담 →
              </Link>
            </p>
          </ScrollReveal>
        </div>
      </section>

      {/* Feature comparison table */}
      <section className="py-16 px-6 bg-gray-50">
        <div className="max-w-4xl mx-auto">
          <ScrollReveal>
            <h2 className="text-2xl font-bold text-gray-900 text-center mb-10">플랜별 기능 비교</h2>
          </ScrollReveal>
          <ScrollReveal>
            <div className="overflow-x-auto">
              <table className="w-full bg-white rounded-2xl border border-gray-200 overflow-hidden text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-6 py-4 text-gray-500 font-semibold">기능</th>
                    <th className="text-center px-4 py-4 text-gray-700 font-semibold">Free</th>
                    <th className="text-center px-4 py-4 text-primary-700 font-semibold">Standard</th>
                    <th className="text-center px-4 py-4 text-gray-700 font-semibold">Premium</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['학생 수', '최대 10명', '최대 50명', '무제한'],
                    ['교사 계정', '1개', '5개', '무제한'],
                    ['레벨 테스트', '✓', '✓', '✓'],
                    ['단원 테스트', '—', '✓', '✓'],
                    ['문제 뱅크', '100문항', '450+ 문항', '450+ 문항'],
                    ['AI 쓰기 평가', '—', '월 200회', '무제한'],
                    ['AI 문제 생성', '—', '월 100회', '무제한'],
                    ['고급 분석', '—', '✓', '✓'],
                    ['PDF 리포트', '—', '무제한', '무제한'],
                    ['전담 매니저', '—', '—', '✓'],
                  ].map(([feature, free, std, prem], i) => (
                    <tr key={feature} className={i % 2 === 0 ? '' : 'bg-gray-50/50'}>
                      <td className="px-6 py-3.5 text-gray-700">{feature}</td>
                      <td className="text-center px-4 py-3.5 text-gray-500">{free}</td>
                      <td className="text-center px-4 py-3.5 text-primary-700 font-medium">{std}</td>
                      <td className="text-center px-4 py-3.5 text-gray-700">{prem}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 px-6">
        <div className="max-w-3xl mx-auto">
          <ScrollReveal>
            <h2 className="text-2xl font-bold text-gray-900 text-center mb-10">요금 관련 FAQ</h2>
          </ScrollReveal>
          <div className="space-y-4">
            {FAQ_ITEMS.map((item, i) => (
              <ScrollReveal key={i} delay={i * 60}>
                <div className="border border-gray-200 rounded-xl p-6">
                  <h3 className="font-semibold text-gray-900 mb-2">Q. {item.q}</h3>
                  <p className="text-sm text-gray-600 leading-relaxed">A. {item.a}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-gradient-to-b from-white to-primary-50 py-20 text-center px-6">
        <ScrollReveal>
          <h2 className="text-3xl font-bold text-primary-900 mb-4">지금 바로 시작하세요</h2>
          <p className="text-gray-600 mb-8">카드 등록 없이 14일 무료 체험. 모든 기능을 사용해보세요.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/register/owner" className="bg-primary-700 text-white font-bold px-8 py-4 rounded-xl text-lg hover:bg-primary-800 transition-colors">
              14일 무료 체험 시작
            </Link>
            <Link href="/contact" className="border border-primary-700 text-primary-700 font-bold px-8 py-4 rounded-xl text-lg hover:bg-primary-50 transition-colors">
              도입 상담 받기
            </Link>
          </div>
        </ScrollReveal>
      </section>
    </div>
  )
}
