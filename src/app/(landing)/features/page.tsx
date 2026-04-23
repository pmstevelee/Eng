import type { Metadata } from 'next'
import ScrollReveal from '@/components/landing/scroll-reveal'
import Link from 'next/link'

export const metadata: Metadata = {
  title: '기능소개',
  description: '적응형 레벨 테스트, AI 맞춤 학습, 자동 채점, 실시간 분석 대시보드까지. 위고업잉글리시의 모든 기능을 소개합니다.',
}

const FEATURES = [
  {
    icon: '🎯',
    color: 'bg-primary-100 text-primary-700',
    title: '적응형 10단계 레벨 테스트',
    subtitle: '맞추면 어려운 문제, 틀리면 쉬운 문제',
    desc: '문법·어휘·읽기·쓰기 4개 영역을 독립적으로 측정하는 CEFR 기반 10단계 배치 시험입니다. AI가 학생의 답변에 따라 실시간으로 난이도를 조절하여 최적의 레벨을 빠르게 측정합니다.',
    details: ['Pre-A1 ~ C1+ 10단계 정밀 측정', '영역별 독립 레벨 산출', '평균 25문항으로 정확한 배치', '1년 이내 동일 문제 재출제 방지'],
  },
  {
    icon: '🤖',
    color: 'bg-purple-100 text-purple-600',
    title: 'AI 맞춤 학습 추천',
    subtitle: '학생의 약점을 AI가 분석해 매일 최적 문제 제공',
    desc: '오답 패턴, 풀이 시간, 영역별 성취도를 종합 분석하여 오늘 꼭 풀어야 할 문제를 AI가 선별합니다. 쓰기 영역은 GPT-4o 기반으로 즉시 피드백과 개선 방향을 제시합니다.',
    details: ['영역별 약점 자동 분석', 'AI 에세이 즉시 채점·피드백', '일일 맞춤 문제 큐레이션', '오답 자동 복습 스케줄링'],
  },
  {
    icon: '🏆',
    color: 'bg-yellow-100 text-yellow-600',
    title: '게이미피케이션 & 일일 미션',
    subtitle: '매일 AI가 설계하는 맞춤 퀘스트',
    desc: 'XP 포인트, 연속 학습 스트릭, 레벨업 배지로 학생의 내재적 학습 동기를 자연스럽게 높입니다. 일일 미션을 완료하면 승급 조건이 쌓이며 레벨업 로드맵을 확인할 수 있습니다.',
    details: ['XP·스트릭·배지 시스템', '레벨업 진행 시각화', '일일 미션 완료 알림', '주간 학습 리포트'],
  },
  {
    icon: '📊',
    color: 'bg-teal-100 text-teal-700',
    title: '실시간 분석 대시보드',
    subtitle: '데이터 기반 학원 운영',
    desc: '학원장과 교사가 각자의 역할에 맞는 분석 뷰를 제공합니다. 반별 비교, 영역별 성취도, 교사 성과, 수익 추이까지 한 화면에서 확인하고 PDF로 내보낼 수 있습니다.',
    details: ['반별·학생별 성적 비교', '영역별 성취도 히트맵', '교사 성과 분석', '1클릭 PDF 리포트'],
  },
  {
    icon: '📝',
    color: 'bg-orange-100 text-orange-600',
    title: '문제 뱅크 & 자동 출제',
    subtitle: '450+ 검증된 문제, AI로 무한 확장',
    desc: '전문가가 검수한 공용 문제 뱅크와 AI가 생성하는 유사 문제를 활용하여 매번 신선한 테스트를 구성합니다. 교사가 직접 문제를 추가하거나 AI에게 생성을 요청할 수 있습니다.',
    details: ['450+ 공용 검증 문제', 'AI 유사 문제 자동 생성', '학원 전용 문제 추가', '영역·레벨·난이도 필터'],
  },
  {
    icon: '👥',
    color: 'bg-green-100 text-green-700',
    title: '반 관리 & 초대 시스템',
    subtitle: '초대코드 하나로 간편하게 시작',
    desc: '학원장이 초대코드를 발급하면 교사와 학생이 즉시 가입할 수 있습니다. 반 생성, 수강 배정, 권한 관리까지 몇 번의 클릭으로 완료됩니다.',
    details: ['역할별 초대코드 발급', '반 생성·배정 자동화', 'ACADEMY_OWNER / TEACHER / STUDENT 3단계 권한', '탈퇴 시 데이터 완전 삭제'],
  },
]

function MockupPlaceholder({ label }: { label: string }) {
  return (
    <div className="bg-gray-100 rounded-2xl aspect-[16/10] flex items-center justify-center border border-gray-200">
      <div className="text-center text-gray-400 p-8">
        <div className="w-10 h-10 bg-gray-200 rounded-xl mx-auto mb-2 flex items-center justify-center">
          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <div className="text-sm">스크린샷 영역</div>
        <div className="text-xs mt-1 text-gray-400">{label}</div>
      </div>
    </div>
  )
}

export default function FeaturesPage() {
  return (
    <div className="bg-white">
      {/* Hero */}
      <section className="bg-gradient-to-b from-primary-50 to-white py-20 text-center px-6">
        <ScrollReveal>
          <div className="inline-flex items-center gap-2 bg-primary-100 text-primary-700 text-xs font-semibold px-4 py-2 rounded-full mb-6">
            모든 기능 무료 체험 가능
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-primary-900 mb-4">
            영어학원 운영의
            <br />
            모든 것을 담았습니다
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            레벨 측정부터 학습 추천, 채점 자동화, 학원 분석까지.
            <br />
            위고업잉글리시 하나로 학원 운영의 핵심을 모두 해결합니다.
          </p>
        </ScrollReveal>
      </section>

      {/* Feature grid */}
      <section className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-24">
            {FEATURES.map((f, i) => (
              <ScrollReveal key={f.title} delay={i * 80}>
                <div className="border border-gray-200 rounded-xl p-6 hover:border-primary-200 hover:shadow-sm transition-all">
                  <div className={`w-12 h-12 rounded-xl ${f.color} flex items-center justify-center text-2xl mb-4`}>
                    {f.icon}
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-1">{f.title}</h3>
                  <p className="text-sm text-primary-700 font-medium mb-3">{f.subtitle}</p>
                  <p className="text-sm text-gray-600 leading-relaxed mb-4">{f.desc}</p>
                  <ul className="space-y-2">
                    {f.details.map((d) => (
                      <li key={d} className="flex items-center gap-2 text-xs text-gray-500">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary-600 flex-shrink-0" />
                        {d}
                      </li>
                    ))}
                  </ul>
                </div>
              </ScrollReveal>
            ))}
          </div>

          {/* Deep dive: alternating layout */}
          <div className="space-y-24">
            {/* Feature 1 */}
            <ScrollReveal>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
                <div>
                  <div className="inline-flex items-center gap-2 bg-primary-100 text-primary-700 text-xs font-semibold px-3 py-1.5 rounded-full mb-4">
                    핵심 기능
                  </div>
                  <h2 className="text-3xl font-bold text-gray-900 mb-4">
                    10단계 적응형 레벨 테스트
                  </h2>
                  <p className="text-gray-600 leading-relaxed mb-6">
                    전통적인 획일적 시험 대신, AI가 학생의 답변에 따라 실시간으로 문제 난이도를 조절합니다.
                    25문항으로 Pre-A1부터 C1+까지 정밀하게 배치합니다.
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    {['문법', '어휘', '읽기', '쓰기'].map((area, i) => {
                      const colors = ['bg-grammar/10 text-grammar', 'bg-vocabulary/10 text-vocabulary', 'bg-reading/10 text-reading', 'bg-writing/10 text-writing']
                      return (
                        <div key={area} className={`${colors[i]} rounded-xl p-3 text-center text-sm font-semibold`}>
                          {area}
                        </div>
                      )
                    })}
                  </div>
                </div>
                <MockupPlaceholder label="적응형 레벨 테스트 결과 화면" />
              </div>
            </ScrollReveal>

            {/* Feature 2 */}
            <ScrollReveal>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
                <div className="order-2 md:order-1">
                  <MockupPlaceholder label="AI 쓰기 평가 피드백 화면" />
                </div>
                <div className="order-1 md:order-2">
                  <div className="inline-flex items-center gap-2 bg-purple-100 text-purple-700 text-xs font-semibold px-3 py-1.5 rounded-full mb-4">
                    AI 기술
                  </div>
                  <h2 className="text-3xl font-bold text-gray-900 mb-4">
                    AI 쓰기 평가 & 레벨업 전략
                  </h2>
                  <p className="text-gray-600 leading-relaxed mb-6">
                    GPT-4o 기반 AI가 에세이를 즉시 채점하고 구체적인 개선 방향을 제시합니다.
                    다른 영역 레벨과 비교 분석하여 맞춤 레벨업 로드맵을 생성합니다.
                  </p>
                  <ul className="space-y-3">
                    {['즉각적인 AI 피드백 (30초 이내)', '문법·표현·구성 영역별 점수', '레벨업 목표 달성을 위한 개선 제안', '교사의 추가 코멘트 병행 가능'].map((item) => (
                      <li key={item} className="flex items-start gap-2.5 text-sm text-gray-700">
                        <svg className="w-4 h-4 text-accent-green mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-gradient-to-b from-white to-primary-50 py-20 text-center px-6">
        <ScrollReveal>
          <h2 className="text-3xl font-bold text-primary-900 mb-4">모든 기능을 직접 체험해보세요</h2>
          <p className="text-gray-600 mb-8">14일 무료 체험 · 카드 등록 없음 · 언제든 해지</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/register/owner"
              className="bg-primary-700 text-white font-bold px-8 py-4 rounded-xl text-lg hover:bg-primary-800 transition-colors"
            >
              14일 무료 체험 시작
            </Link>
            <Link
              href="/contact"
              className="border border-primary-700 text-primary-700 font-bold px-8 py-4 rounded-xl text-lg hover:bg-primary-50 transition-colors"
            >
              도입 상담 받기
            </Link>
          </div>
        </ScrollReveal>
      </section>
    </div>
  )
}
