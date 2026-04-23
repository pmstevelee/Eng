import type { Metadata } from 'next'
import ScrollReveal from '@/components/landing/scroll-reveal'
import Link from 'next/link'

export const metadata: Metadata = {
  title: '도입사례',
  description: '위고업잉글리시를 도입한 영어학원의 실제 변화를 확인하세요.',
}

const REVIEWS = [
  {
    academy: '강남 A+ 영어학원',
    type: '중고등 전문',
    students: '학생 80명',
    duration: '6개월 사용',
    stats: [
      { label: '행정시간 절감', value: '65%' },
      { label: '학생 만족도', value: '4.8/5' },
      { label: '레벨업 달성률', value: '72%' },
    ],
    quote: '레벨 테스트를 수동으로 진행하고 결과를 엑셀에 정리하던 시간이 완전히 사라졌습니다. 이제 선생님들이 수업 준비에만 집중할 수 있어요. 학부모 상담 자료도 클릭 한 번에 나오니 정말 편합니다.',
    author: '원장 김○○',
    avatar: 'K',
    color: 'bg-primary-100 text-primary-700',
  },
  {
    academy: '분당 스마트잉글리시',
    type: '초등 전문',
    students: '학생 45명',
    duration: '4개월 사용',
    stats: [
      { label: '학습 참여율 향상', value: '40%' },
      { label: '학부모 만족도', value: '4.9/5' },
      { label: '주간 학습 완료율', value: '88%' },
    ],
    quote: '아이들이 일일 미션을 스스로 찾아서 합니다. AI가 맞춤 문제를 내주니 너무 어렵거나 쉽지 않고 딱 맞는 수준이에요. 부모님들도 앱으로 학습 현황을 바로 확인하셔서 만족도가 높아졌습니다.',
    author: '원장 박○○',
    avatar: '박',
    color: 'bg-accent-green/10 text-accent-green',
  },
  {
    academy: '노원 탑클래스어학원',
    type: '성인·대입 전문',
    students: '학생 120명',
    duration: '8개월 사용',
    stats: [
      { label: '첨삭 시간 절감', value: '70%' },
      { label: '에세이 제출률', value: '94%' },
      { label: '평균 레벨 상승', value: '1.8단계' },
    ],
    quote: '에세이 첨삭이 가장 큰 고민이었는데, AI가 즉시 피드백을 줘서 학생들이 오래 기다리지 않아도 됩니다. 레벨업 기준도 명확해서 학생과 학부모 모두 목표가 생겼어요.',
    author: '원장 이○○',
    avatar: '이',
    color: 'bg-accent-purple/10 text-accent-purple',
  },
  {
    academy: '마포 글로벌영어학원',
    type: '유아·초등 전문',
    students: '학생 35명',
    duration: '3개월 사용',
    stats: [
      { label: '등록 유지율', value: '95%' },
      { label: '학생 스트릭 평균', value: '21일' },
      { label: '교사 만족도', value: '4.7/5' },
    ],
    quote: '게이미피케이션 요소가 어린 학생들에게 정말 잘 맞아요. 배지와 레벨업을 목표로 매일 접속하는 습관이 생겼습니다. 원어민 교사들도 AI 피드백 덕분에 개별 지도 시간이 늘었다고 하네요.',
    author: '원장 최○○',
    avatar: '최',
    color: 'bg-accent-gold/10 text-accent-gold',
  },
  {
    academy: '수원 잉글리시마스터',
    type: '중등 전문',
    students: '학생 60명',
    duration: '5개월 사용',
    stats: [
      { label: '성적 향상 학생', value: '78%' },
      { label: '오답 복습률', value: '91%' },
      { label: '수업 준비 시간 절감', value: '50%' },
    ],
    quote: '오답 복습 시스템이 특히 인상적이에요. 학생들이 틀렸던 유형의 문제를 자동으로 다시 풀게 해주는데, 성적 향상이 데이터로 바로 보입니다. 교사들도 수업 준비 부담이 크게 줄었다고 합니다.',
    author: '원장 정○○',
    avatar: '정',
    color: 'bg-teal-100 text-teal-700',
  },
  {
    academy: '일산 에이스영어',
    type: '전 연령 종합',
    students: '학생 95명',
    duration: '7개월 사용',
    stats: [
      { label: '신규 등록 증가', value: '25%' },
      { label: '학부모 재등록률', value: '89%' },
      { label: '교사 이직률 감소', value: '60%' },
    ],
    quote: '도입 후 가장 크게 달라진 것은 선생님들의 업무 만족도입니다. 행정 업무가 줄고 교육에 집중할 수 있게 되면서 선생님들이 더 오래 함께하고 싶어합니다. 학원 분위기가 전반적으로 좋아졌어요.',
    author: '원장 강○○',
    avatar: '강',
    color: 'bg-orange-100 text-orange-600',
  },
]

export default function ReviewsPage() {
  return (
    <div className="bg-white">
      {/* Hero */}
      <section className="bg-gradient-to-b from-primary-50 to-white py-20 text-center px-6">
        <ScrollReveal>
          <h1 className="text-4xl md:text-5xl font-bold text-primary-900 mb-4">
            실제 학원의
            <br />
            실제 변화
          </h1>
          <p className="text-lg text-gray-600 max-w-xl mx-auto">
            전국 영어학원이 위고업잉글리시로 어떻게 달라졌는지 확인해보세요.
          </p>
        </ScrollReveal>
      </section>

      {/* Stats bar */}
      <section className="bg-primary-900 py-10 px-6">
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center text-white">
          {[
            { value: '50+', label: '도입 학원' },
            { value: '3,200+', label: '총 학생 수' },
            { value: '4.8/5', label: '평균 만족도' },
            { value: '65%', label: '평균 행정 절감' },
          ].map(({ value, label }) => (
            <div key={label}>
              <div className="text-2xl font-bold mb-1">{value}</div>
              <div className="text-sm text-white/60">{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Reviews grid */}
      <section className="py-24 px-6">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {REVIEWS.map((review, i) => (
            <ScrollReveal key={review.academy} delay={i * 80}>
              <div className="border border-gray-200 rounded-2xl p-6 flex flex-col h-full hover:shadow-sm transition-all">
                {/* Header */}
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-10 h-10 rounded-xl ${review.color} flex items-center justify-center font-bold text-sm flex-shrink-0`}>
                    {review.avatar}
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900 text-sm">{review.academy}</div>
                    <div className="text-xs text-gray-500">{review.type} · {review.students} · {review.duration}</div>
                  </div>
                </div>

                {/* Stars */}
                <div className="flex gap-0.5 mb-4">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <svg key={j} className="w-4 h-4 text-accent-gold" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-2 mb-4">
                  {review.stats.map((stat) => (
                    <div key={stat.label} className="bg-gray-50 rounded-xl p-2 text-center">
                      <div className="text-sm font-bold text-gray-900">{stat.value}</div>
                      <div className="text-xs text-gray-500 leading-tight mt-0.5">{stat.label}</div>
                    </div>
                  ))}
                </div>

                <p className="text-sm text-gray-600 leading-relaxed flex-1 mb-4">
                  &ldquo;{review.quote}&rdquo;
                </p>
                <div className="text-xs font-medium text-gray-500">— {review.author}</div>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-gradient-to-b from-white to-primary-50 py-20 text-center px-6">
        <ScrollReveal>
          <h2 className="text-3xl font-bold text-primary-900 mb-4">우리 학원도 시작해보세요</h2>
          <p className="text-gray-600 mb-8">14일 무료 체험 · 카드 등록 없음 · 설치 5분</p>
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
