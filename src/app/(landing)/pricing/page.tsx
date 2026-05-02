import type { Metadata } from 'next'
import ScrollReveal from '@/components/landing/scroll-reveal'
import Link from 'next/link'

export const metadata: Metadata = {
  title: '요금제',
  description: 'Free부터 Premium까지. 학원 규모에 맞는 요금제를 선택하세요. 14일 무료 체험.',
}

const CHECK = (
  <svg className="w-4 h-4 text-accent-green mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
  </svg>
)

const PLANS = [
  {
    name: 'Free',
    nameKo: '무료 체험',
    target: '도입 검토 중인 학원, 1인 공부방',
    price: null,
    priceDesc: '14일 무료',
    priceNote: '카드 등록 없음',
    highlight: false,
    badge: null,
    features: [
      { text: '학생 최대 10명 / 교사 1개' },
      { text: '레벨 테스트 학생당 1회 (재시험 불가)' },
      { text: '자작 문제뱅크 최대 100문항' },
      { text: '공용 문제뱅크 읽기 전용 (450+ 문항)' },
      { text: '단원 테스트 월 3회' },
      { text: 'AI 쓰기 평가 월 5회 맛보기' },
      { text: 'AI 문제 생성 월 3회 맛보기' },
      { text: 'AI 약점 분석 요약본만' },
      { text: '기본 PDF 리포트 (월 5회 제한)' },
      { text: '게임화/XP/스트릭 기본 기능' },
      { text: '스토리지 1GB / 데이터 30일 보관' },
    ],
    locked: ['학부모 알림톡'],
    cta: '무료로 시작하기',
    ctaHref: '/register/owner',
    ctaStyle: 'border border-gray-300 text-gray-700 hover:bg-gray-50',
  },
  {
    name: 'Starter',
    nameKo: '스타터',
    target: '1인 공부방, 소형 교습소 (10~20명)',
    price: 19900,
    priceUnit: '월 / 학원',
    priceDesc: '학생 10명 기준',
    priceNote: '학생당 월 1,990원',
    highlight: false,
    badge: '신규 권장',
    badgeColor: 'bg-accent-green',
    features: [
      { text: '학생 최대 20명 / 교사 2개' },
      { text: '적응형 레벨 테스트 무제한' },
      { text: '자작 문제뱅크 무제한' },
      { text: '공용 문제뱅크 읽기 전용 (450+ 문항)' },
      { text: '단원 테스트 무제한' },
      { text: 'AI 쓰기 평가 월 50회 (초과 1회당 60원)' },
      { text: 'AI 문제 생성 월 30회 (초과 1회당 100원)' },
      { text: 'AI 약점 분석 상세' },
      { text: 'PDF 리포트 무제한 · 템플릿 3종' },
      { text: '학부모 알림톡 월 100건' },
      { text: '게임화/XP/스트릭 전체 기능' },
      { text: '공용 음원 라이브러리 사용' },
      { text: '스토리지 10GB / 데이터 1년 보관' },
    ],
    cta: '14일 무료 체험',
    ctaHref: '/register/owner',
    ctaStyle: 'border border-gray-300 text-gray-700 hover:bg-gray-50',
  },
  {
    name: 'Standard',
    nameKo: '스탠다드',
    target: '중형 영어학원 (30~50명)',
    price: 49900,
    priceUnit: '월 / 학원',
    priceDesc: '학생 30명 기준',
    priceNote: '학생당 월 1,663원',
    highlight: true,
    badge: '가장 인기',
    badgeColor: 'bg-primary-700',
    features: [
      { text: '학생 최대 50명 / 교사 5개' },
      { text: '레벨 테스트 무제한 + 정기 재시험 자동 스케줄' },
      { text: '자작 문제뱅크 무제한' },
      { text: '공용 문제뱅크 전체 사용 + 기여 가능' },
      { text: '단원 테스트 무제한 + 자동 출제' },
      { text: 'AI 쓰기 평가 월 200회 (초과 1회당 50원)' },
      { text: 'AI 문제 생성 월 100회 (초과 1회당 80원)' },
      { text: 'AI 유사 문제 생성 (오답 기반)' },
      { text: 'AI 약점 분석 상세 + 반별 비교' },
      { text: '고급 분석 대시보드 (성장률·영역별·반별)' },
      { text: 'PDF 리포트 무제한 · 템플릿 8종 · 로고 커스텀' },
      { text: '학부모 알림톡 월 500건 + 주간/월간 자동 발송' },
      { text: '듣기 풀 라이브러리 + 자동 채점' },
      { text: 'AI 추천 커리큘럼 (학생별)' },
      { text: '스토리지 50GB / 데이터 3년 보관' },
    ],
    cta: '14일 무료 체험',
    ctaHref: '/register/owner',
    ctaStyle: 'bg-primary-700 text-white hover:bg-primary-800',
  },
  {
    name: 'Premium',
    nameKo: '프리미엄',
    target: '대형 학원, 다지점, 프랜차이즈 (50명+)',
    price: 129000,
    priceUnit: '월 / 학원',
    priceDesc: '학생 100명 기준',
    priceNote: '학생당 월 1,290원',
    highlight: false,
    badge: null,
    features: [
      { text: '학생 무제한 / 교사 무제한' },
      { text: 'Standard 모든 기능 포함' },
      { text: 'AI 쓰기 평가 월 1,000회 (공정 사용 정책)' },
      { text: 'AI 문제 생성 월 500회 (공정 사용 정책)' },
      { text: '다지점/분원 통합 관리 대시보드' },
      { text: '학부모 알림톡 월 2,000건' },
      { text: '화이트라벨 (학원 자체 브랜드)' },
      { text: '우선 기능 요청권 + 신기능 베타 참여' },
      { text: 'AI 초과 사용 별도 협의 (대량 할인)' },
      { text: '스토리지 500GB / 데이터 무제한 보관' },
    ],
    cta: '도입 상담 받기',
    ctaHref: '/contact',
    ctaStyle: 'border border-primary-700 text-primary-700 hover:bg-primary-50',
  },
]

const FAQ_ITEMS = [
  {
    q: '무료 체험 기간에는 어떤 기능을 쓸 수 있나요?',
    a: '14일 무료 체험 기간 동안 Free 플랜의 모든 기능을 사용하실 수 있습니다. 체험 기간 종료 후 자동으로 요금이 청구되지 않으며, 직접 구독을 시작하셔야 합니다.',
  },
  {
    q: 'AI 쓰기 평가·문제 생성 한도를 초과하면 어떻게 되나요?',
    a: '초과 사용분은 건당 소액 과금됩니다. Starter는 쓰기 60원/문제 100원, Standard는 쓰기 50원/문제 80원입니다. 크레딧 패키지를 미리 충전해두면 초과 비용을 예측 가능하게 관리할 수 있습니다.',
  },
  {
    q: '공용 문제뱅크 "기여"는 무엇인가요?',
    a: 'Standard 이상 플랜에서 학원이 직접 만든 문제를 공용 풀에 공유할 수 있습니다. 기여한 문제가 다른 학원에 사용되면 AI 크레딧 인센티브를 드립니다.',
  },
  {
    q: '결제는 어떻게 이루어지나요?',
    a: '현재 수동 입금 확인 방식으로 운영됩니다. 구독 신청 후 관리자 확인을 거쳐 서비스가 활성화됩니다. 카드 자동 결제는 추후 지원 예정입니다.',
  },
  {
    q: '연간 구독 시 할인이 있나요?',
    a: '연간 구독 시 월 구독 대비 20% 할인이 적용됩니다. 도입 상담 시 안내드립니다.',
  },
  {
    q: '학생 수가 플랜 한도를 초과하면 어떻게 되나요?',
    a: '한도 초과 시 추가 학생을 등록할 수 없고, 알림을 드립니다. 상위 플랜으로 업그레이드하거나 도입 상담을 통해 맞춤 요금제를 이용하실 수 있습니다.',
  },
]

const COMPARE_ROWS: [string, string, string, string, string][] = [
  ['학생 수',          '최대 10명',    '최대 20명',    '최대 50명',    '무제한'],
  ['교사 계정',        '1개',          '2개',          '5개',          '무제한'],
  ['레벨 테스트',      '1회/학생',     '무제한',       '무제한+자동',  '무제한+자동'],
  ['자작 문제뱅크',    '100문항',      '무제한',       '무제한',       '무제한'],
  ['공용 문제뱅크',    '읽기 전용',    '읽기 전용',    '전체+기여',    '전체+기여'],
  ['단원 테스트',      '월 3회',       '무제한',       '무제한+자동',  '무제한+자동'],
  ['AI 쓰기 평가',     '월 5회',       '월 50회',      '월 200회',     '월 1,000회'],
  ['AI 문제 생성',     '월 3회',       '월 30회',      '월 100회',     '월 500회'],
  ['AI 유사 문제',     '—',            '—',            '✓',            '✓'],
  ['AI 약점 분석',     '요약만',       '상세',         '상세+반별비교','상세+반별비교'],
  ['고급 분석 대시보드','—',           '—',            '✓',            '✓'],
  ['PDF 리포트',       '월 5회',       '무제한(3종)',   '무제한(8종+로고)', '무제한(8종+로고)'],
  ['학부모 알림톡',    '❌',           '월 100건',     '월 500건+자동',  '월 2,000건'],
  ['다지점 통합',      '—',            '—',            '—',            '✓'],
  ['화이트라벨',       '—',            '—',            '—',            '✓'],
  ['스토리지',         '1GB',          '10GB',         '50GB',         '500GB'],
  ['데이터 보관',      '30일',         '1년',          '3년',          '무제한'],
]

export default function PricingPage() {
  return (
    <div className="bg-white">
      {/* Hero */}
      <section className="py-20 text-center px-6 bg-gray-50 border-b border-gray-200">
        <ScrollReveal>
          <h1 className="text-4xl md:text-5xl font-bold text-primary-900 mb-4">
            학원 규모에 맞는<br />요금제를 선택하세요
          </h1>
          <p className="text-lg text-gray-600">
            모든 플랜 14일 무료 체험 · 카드 등록 없음 · 언제든 변경 가능
          </p>
        </ScrollReveal>
      </section>

      {/* Plans */}
      <section className="py-16 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {PLANS.map((plan, i) => (
              <ScrollReveal key={plan.name} delay={i * 80}>
                <div
                  className={`rounded-2xl border p-6 flex flex-col h-full relative ${
                    plan.highlight
                      ? 'border-primary-700 shadow-sm ring-1 ring-primary-700'
                      : 'border-gray-200'
                  }`}
                >
                  {plan.badge && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className={`${plan.badgeColor ?? 'bg-primary-700'} text-white text-xs font-bold px-4 py-1 rounded-full whitespace-nowrap`}>
                        {plan.badge}
                      </span>
                    </div>
                  )}

                  <div className="mb-5">
                    <div className="text-xs font-semibold text-gray-400 mb-0.5 uppercase tracking-wide">{plan.name}</div>
                    <div className="text-lg font-bold text-gray-900 mb-1">{plan.nameKo}</div>
                    <div className="text-xs text-gray-500 mb-3 leading-relaxed">{plan.target}</div>

                    {plan.price ? (
                      <>
                        <div className="flex items-baseline gap-1 mb-0.5">
                          <span className="text-2xl font-bold text-gray-900">
                            {plan.price.toLocaleString()}원
                          </span>
                          <span className="text-xs text-gray-500">{plan.priceUnit}</span>
                        </div>
                        <div className="text-xs text-gray-500">{plan.priceDesc}</div>
                        <div className="text-xs font-semibold text-primary-700 mt-0.5">{plan.priceNote}</div>
                      </>
                    ) : (
                      <>
                        <div className="text-2xl font-bold text-gray-900 mb-0.5">{plan.priceDesc}</div>
                        <div className="text-xs text-gray-500">{plan.priceNote}</div>
                      </>
                    )}
                  </div>

                  <ul className="space-y-2.5 flex-1 mb-6">
                    {plan.features.map((f) => (
                      <li key={f.text} className="flex items-start gap-2 text-xs text-gray-700 leading-relaxed">
                        {CHECK}
                        {f.text}
                      </li>
                    ))}
                    {plan.locked?.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-xs text-gray-400 leading-relaxed">
                        <svg className="w-4 h-4 mt-0.5 flex-shrink-0 text-gray-300" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
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
        <div className="max-w-5xl mx-auto">
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
                    <th className="text-center px-4 py-4 text-gray-700 font-semibold">Starter</th>
                    <th className="text-center px-4 py-4 text-primary-700 font-semibold">Standard</th>
                    <th className="text-center px-4 py-4 text-gray-700 font-semibold">Premium</th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARE_ROWS.map(([feature, free, starter, std, prem], i) => (
                    <tr key={feature} className={i % 2 === 0 ? '' : 'bg-gray-50/50'}>
                      <td className="px-6 py-3 text-gray-700">{feature}</td>
                      <td className="text-center px-4 py-3 text-gray-500 text-xs">{free}</td>
                      <td className="text-center px-4 py-3 text-gray-700 text-xs">{starter}</td>
                      <td className="text-center px-4 py-3 text-primary-700 font-medium text-xs">{std}</td>
                      <td className="text-center px-4 py-3 text-gray-700 text-xs">{prem}</td>
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
      <section className="bg-gray-50 border-t border-gray-200 py-20 text-center px-6">
        <ScrollReveal>
          <h2 className="text-3xl font-bold text-primary-900 mb-4">지금 바로 시작하세요</h2>
          <p className="text-gray-600 mb-8">카드 등록 없이 14일 무료 체험. 언제든 플랜을 변경할 수 있습니다.</p>
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
