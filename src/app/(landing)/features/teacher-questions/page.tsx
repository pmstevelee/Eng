import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import ScrollReveal from '@/components/landing/scroll-reveal'

export const metadata: Metadata = {
  title: '교사 직접 문제 출제 | EduLevel',
  description: '교사가 직접 문제를 만들고 학습 방향을 설정합니다. AI는 보조 도구로서 문제 생성을 지원하고, 교사는 학원 특성에 맞게 커리큘럼을 자유롭게 구성합니다.',
}

const CORE_FEATURES = [
  {
    title: '직관적인 문제 출제 에디터',
    desc: '객관식·주관식·서술형 등 다양한 유형의 문제를 쉽고 빠르게 만들 수 있는 전용 편집기를 제공합니다.',
    color: '#0FBFAD',
    bg: '#E8FAF8',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    ),
    items: ['객관식·주관식·서술형 지원', '해설 및 힌트 추가', '문제 미리보기 기능', '임시저장 및 버전 관리'],
  },
  {
    title: 'AI 보조 문제 생성',
    desc: '교사가 설정한 영역·레벨·난이도를 기반으로 AI가 초안을 생성합니다. 교사는 검토 후 수정해 최종 완성합니다.',
    color: '#7854F7',
    bg: '#F3F0FF',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
    items: ['영역·레벨·난이도 설정 후 생성', 'GPT-4o 기반 자연스러운 문장', '유사 문제 변형 자동 생성', '교사 검토 후 최종 승인'],
  },
  {
    title: '학원 전용 문제 뱅크',
    desc: '교사가 만든 문제는 학원 전용 문제 뱅크에 저장됩니다. 다른 교사와 공유하거나 테스트에 즉시 활용할 수 있습니다.',
    color: '#1865F2',
    bg: '#EEF4FF',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
    items: ['학원 전용 문제 저장소', '영역·레벨·난이도 필터 검색', '교사 간 문제 공유', '사용 이력 및 정답률 통계'],
  },
  {
    title: '즉시 테스트 출제 & 배포',
    desc: '만든 문제를 즉시 단원 테스트나 과제로 배포할 수 있습니다. 학생별 또는 반 전체에 한 번에 적용됩니다.',
    color: '#1FAF54',
    bg: '#E8F8EF',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
      </svg>
    ),
    items: ['단원 테스트·과제 즉시 배포', '반 전체 또는 개별 학생 지정', '시험 시작·종료 시간 설정', '자동 채점 및 결과 분석'],
  },
]

const HOW_IT_WORKS = [
  {
    step: '01',
    title: '영역·레벨 설정',
    desc: '출제할 영역(문법·어휘·읽기·쓰기·듣기)과 레벨(1~10단계), 난이도를 먼저 설정합니다. 학원 수준과 수업 목표에 맞게 조정할 수 있습니다.',
    color: '#0FBFAD',
  },
  {
    step: '02',
    title: '문제 직접 작성 또는 AI 생성',
    desc: '교사가 직접 문제를 작성하거나 AI에게 초안 생성을 요청합니다. AI 생성 후에도 교사가 자유롭게 수정할 수 있습니다.',
    color: '#7854F7',
  },
  {
    step: '03',
    title: '미리보기 검토',
    desc: '학생이 보게 될 화면과 동일한 미리보기로 문제를 최종 확인합니다. 오탈자, 보기 순서, 해설까지 실시간 검토됩니다.',
    color: '#1865F2',
  },
  {
    step: '04',
    title: '저장 & 뱅크 등록',
    desc: '완성된 문제는 학원 전용 문제 뱅크에 저장됩니다. 영역·레벨·태그로 분류되어 이후에도 재활용이 가능합니다.',
    color: '#E35C20',
  },
  {
    step: '05',
    title: '테스트 구성 및 배포',
    desc: '뱅크에서 문제를 선택하거나 방금 만든 문제를 바로 테스트로 구성합니다. 반 전체 또는 특정 학생에게 즉시 배포합니다.',
    color: '#E91E8A',
  },
  {
    step: '06',
    title: '결과 분석 & 피드백',
    desc: '학생들이 테스트를 마치면 자동 채점과 함께 문항별 정답률이 집계됩니다. 취약 문제를 파악해 다음 수업에 반영합니다.',
    color: '#1FAF54',
  },
]

const COMPARISONS = [
  {
    label: '기존 방식',
    items: [
      { text: '교재 문제를 그대로 복사해서 사용', bad: true },
      { text: '수작업으로 문제지 편집 및 인쇄', bad: true },
      { text: '채점에 수업 시간 상당량 소모', bad: true },
      { text: '문제 재사용 시 별도 관리 필요', bad: true },
      { text: '학원 특성에 맞는 맞춤 출제 어려움', bad: true },
    ],
  },
  {
    label: 'EduLevel 교사 출제',
    items: [
      { text: '학원 특성에 맞는 완전 맞춤 출제', bad: false },
      { text: '클릭 몇 번으로 온라인 배포', bad: false },
      { text: '자동 채점으로 교사 시간 절약', bad: false },
      { text: '문제 뱅크에 저장해 언제든 재활용', bad: false },
      { text: 'AI 보조로 문제 생성 시간 80% 단축', bad: false },
    ],
  },
]

const QUESTION_TYPES = [
  { type: '객관식', desc: '보기 4~5개 중 정답 선택', color: '#1865F2', count: '가장 많이 사용' },
  { type: '주관식', desc: '단어·문장 직접 입력', color: '#0FBFAD', count: '어휘·문법 집중' },
  { type: '서술형', desc: '자유롭게 작성하는 에세이', color: '#E35C20', count: 'AI 자동 채점' },
  { type: '빈칸 채우기', desc: '문장 내 빈칸 완성', color: '#7854F7', count: '문법·어휘 훈련' },
  { type: '순서 배열', desc: '단어·문장 순서 정렬', color: '#E91E8A', count: '쓰기·읽기 활용' },
]

export default function TeacherQuestionsPage() {
  return (
    <div className="bg-white">

      {/* ── Hero ──────────────────────────────────────────── */}
      <section className="pt-20 pb-16 px-6 bg-[#E8FAF8]">
        <div className="max-w-6xl mx-auto">
          <ScrollReveal>
            <Link
              href="/features"
              className="inline-flex items-center gap-1.5 text-sm font-medium mb-6 hover:underline"
              style={{ color: '#0FBFAD' }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              기능소개로 돌아가기
            </Link>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div>
                <div
                  className="inline-flex items-center gap-2 text-white text-xs font-bold px-4 py-2 rounded-full mb-5"
                  style={{ background: '#0FBFAD' }}
                >
                  핵심 기능 03
                </div>
                <h1 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-4 leading-tight">
                  교사 직접
                  <br />
                  <span style={{ color: '#0FBFAD' }}>문제 출제</span>
                </h1>
                <p className="text-lg font-semibold mb-4" style={{ color: '#0FBFAD' }}>
                  선생님이 교육의 방향을 직접 설계합니다
                </p>
                <p className="text-gray-600 leading-relaxed text-base mb-8">
                  교사가 직접 문제를 만들고 학습 방향을 설정합니다.
                  AI는 보조 도구로서 문제 생성을 지원하고, 교사는 학원 특성에 맞게
                  커리큘럼을 자유롭게 구성합니다.
                </p>
                <div className="flex flex-col sm:flex-row gap-4">
                  <Link
                    href="/register/owner"
                    className="inline-flex items-center justify-center gap-2 text-white font-bold px-7 py-3.5 rounded-xl text-base transition-colors"
                    style={{ background: '#0FBFAD' }}
                  >
                    14일 무료 체험 시작
                  </Link>
                  <Link
                    href="/contact"
                    className="inline-flex items-center justify-center gap-2 font-bold px-7 py-3.5 rounded-xl text-base transition-colors border"
                    style={{ borderColor: '#0FBFAD', color: '#0FBFAD' }}
                  >
                    도입 문의하기
                  </Link>
                </div>
              </div>

              {/* Hero Visual: SVG mockup */}
              <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border-b border-gray-100">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
                  <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
                  <div className="flex-1 bg-gray-100 rounded-md h-5 ml-2" />
                </div>
                <div className="relative w-full aspect-[16/10]">
                  <Image
                    src="/images/teacher-questions-mockup.svg"
                    alt="교사 문제 출제 화면"
                    fill
                    className="object-cover object-left-top"
                    sizes="(max-width: 768px) 100vw, 50vw"
                    priority
                  />
                </div>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ── Stats ─────────────────────────────────────────── */}
      <section className="py-12 px-6 border-b border-gray-100">
        <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6">
          {[
            { value: '5가지', label: '문제 유형 지원', color: '#0FBFAD' },
            { value: '80%', label: 'AI 보조로 출제 시간 단축', color: '#7854F7' },
            { value: '450+', label: '공용 검증 문제 뱅크', color: '#1865F2' },
            { value: '자동', label: '채점 및 결과 분석', color: '#E35C20' },
          ].map((stat) => (
            <ScrollReveal key={stat.label}>
              <div className="text-center py-4">
                <div className="text-3xl lg:text-4xl font-bold mb-1" style={{ color: stat.color }}>
                  {stat.value}
                </div>
                <div className="text-sm text-gray-500">{stat.label}</div>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </section>

      {/* ── 4가지 핵심 기능 ────────────────────────────────── */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <ScrollReveal>
            <div className="text-center mb-14">
              <h2 className="text-3xl font-bold text-gray-900 mb-3">4가지 핵심 출제 기능</h2>
              <p className="text-gray-500 max-w-xl mx-auto">
                교사가 주도하는 교육 환경. AI는 보조하고, 교사가 최종 결정합니다.
              </p>
            </div>
          </ScrollReveal>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {CORE_FEATURES.map((feature, i) => (
              <ScrollReveal key={feature.title} delay={i * 70}>
                <div className="rounded-xl border border-gray-200 p-5 hover:border-gray-300 hover:shadow-sm transition-all h-full">
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center mb-4"
                    style={{ background: feature.bg, color: feature.color }}
                  >
                    {feature.icon}
                  </div>
                  <div className="text-base font-bold text-gray-900 mb-2">{feature.title}</div>
                  <p className="text-xs text-gray-500 leading-relaxed mb-4">{feature.desc}</p>
                  <ul className="space-y-1.5">
                    {feature.items.map((item) => (
                      <li key={item} className="flex items-center gap-2 text-xs text-gray-600">
                        <div
                          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                          style={{ background: feature.color }}
                        />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── 출제 화면 상세 시각화 ─────────────────────────── */}
      <section className="py-20 px-6 bg-[#E8FAF8]">
        <div className="max-w-6xl mx-auto">
          <ScrollReveal>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-14 items-center">
              <div>
                <div
                  className="inline-flex items-center gap-2 text-white text-xs font-bold px-3 py-1.5 rounded-full mb-5"
                  style={{ background: '#0FBFAD' }}
                >
                  출제 에디터
                </div>
                <h2 className="text-3xl font-bold text-gray-900 mb-5">
                  문제 출제부터 배포까지
                  <br />
                  한 화면에서 완성
                </h2>
                <p className="text-gray-600 leading-relaxed mb-6">
                  복잡한 설정 없이 영역과 레벨만 선택하면 즉시 문제를 작성할 수 있습니다.
                  AI 보조 버튼 하나로 초안이 생성되고, 교사가 수정해 완성합니다.
                  작성과 동시에 학생 화면 미리보기가 옆에 표시됩니다.
                </p>
                <ul className="space-y-3">
                  {[
                    { text: '실시간 학생 화면 미리보기 제공', color: '#0FBFAD' },
                    { text: 'AI 초안 생성 → 교사 검토 → 저장 3단계', color: '#0FBFAD' },
                    { text: '완성 즉시 테스트로 배포 가능', color: '#0FBFAD' },
                    { text: '문제 난이도·태그 자동 추천', color: '#0FBFAD' },
                  ].map((item) => (
                    <li key={item.text} className="flex items-start gap-3 text-sm text-gray-700">
                      <svg
                        className="w-4 h-4 mt-0.5 flex-shrink-0"
                        style={{ color: '#1FAF54' }}
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      {item.text}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Full mockup image */}
              <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border-b border-gray-100">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
                  <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
                  <div className="flex-1 bg-white rounded-md h-5 ml-2 border border-gray-200 flex items-center px-3">
                    <span className="text-xs text-gray-400">위고업잉글리시 · 문제 출제</span>
                  </div>
                </div>
                <div className="relative w-full aspect-[16/10]">
                  <Image
                    src="/images/teacher-questions-mockup.svg"
                    alt="교사 문제 출제 에디터 화면"
                    fill
                    className="object-cover object-left-top"
                    sizes="(max-width: 768px) 100vw, 50vw"
                  />
                </div>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ── 지원 문제 유형 ────────────────────────────────── */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <ScrollReveal>
            <div className="text-center mb-14">
              <h2 className="text-3xl font-bold text-gray-900 mb-3">5가지 문제 유형 지원</h2>
              <p className="text-gray-500 max-w-xl mx-auto">
                영역과 학습 목표에 따라 가장 효과적인 유형의 문제를 선택하세요.
              </p>
            </div>
          </ScrollReveal>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {QUESTION_TYPES.map((qt, i) => (
              <ScrollReveal key={qt.type} delay={i * 60}>
                <div className="rounded-xl border border-gray-200 p-5 text-center hover:shadow-sm transition-all">
                  <div
                    className="w-10 h-10 rounded-full mx-auto mb-3 flex items-center justify-center text-white text-sm font-bold"
                    style={{ background: qt.color }}
                  >
                    {i + 1}
                  </div>
                  <div className="text-sm font-bold text-gray-900 mb-1">{qt.type}</div>
                  <div className="text-xs text-gray-500 mb-3">{qt.desc}</div>
                  <div
                    className="text-xs font-semibold px-2.5 py-1 rounded-full inline-block"
                    style={{ background: qt.color + '18', color: qt.color }}
                  >
                    {qt.count}
                  </div>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── 작동 방식 ─────────────────────────────────────── */}
      <section className="py-20 px-6 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <ScrollReveal>
            <div className="text-center mb-14">
              <h2 className="text-3xl font-bold text-gray-900 mb-3">문제 출제는 어떻게 이루어지나요?</h2>
              <p className="text-gray-500 max-w-xl mx-auto">
                설정부터 배포까지, 평균 3분이면 충분합니다.
              </p>
            </div>
          </ScrollReveal>
          <div className="relative">
            <div className="hidden lg:block absolute top-8 left-0 right-0 h-0.5 bg-gray-200 mx-24" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {HOW_IT_WORKS.map((step, i) => (
                <ScrollReveal key={step.step} delay={i * 80}>
                  <div className="relative rounded-xl border border-gray-200 bg-white p-6 hover:shadow-sm transition-all">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white mb-4 relative z-10"
                      style={{ background: step.color }}
                    >
                      {step.step}
                    </div>
                    <h3 className="text-base font-bold text-gray-900 mb-2">{step.title}</h3>
                    <p className="text-sm text-gray-500 leading-relaxed">{step.desc}</p>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── AI 보조 문제 생성 시각화 ──────────────────────── */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <ScrollReveal>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-14 items-start">
              <div>
                <div
                  className="inline-flex items-center gap-2 text-white text-xs font-bold px-3 py-1.5 rounded-full mb-5"
                  style={{ background: '#7854F7' }}
                >
                  AI 보조 생성
                </div>
                <h2 className="text-3xl font-bold text-gray-900 mb-5">
                  AI가 초안을 만들고,
                  <br />
                  교사가 완성합니다
                </h2>
                <p className="text-gray-600 leading-relaxed mb-6">
                  GPT-4o 기반 AI가 교사의 설정(영역·레벨·난이도)에 맞는 문제 초안을 생성합니다.
                  교사는 내용을 검토하고 수정한 뒤 최종 승인만 하면 됩니다.
                  교육의 주도권은 항상 교사에게 있습니다.
                </p>
                <ul className="space-y-3">
                  {[
                    '설정값 기반 맞춤 문제 초안 자동 생성',
                    '생성 후 자유로운 수정·편집 가능',
                    '유사 변형 문제 추가 생성 요청 가능',
                    '교사 최종 승인 없이는 배포 불가',
                    '생성 이력 및 AI 기여도 통계 제공',
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-3 text-sm text-gray-700">
                      <svg
                        className="w-4 h-4 flex-shrink-0"
                        style={{ color: '#1FAF54' }}
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              {/* AI Flow Mockup */}
              <div className="space-y-4">
                {/* Step 1: Teacher sets params */}
                <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ background: '#0FBFAD' }}>1</div>
                    <div className="text-sm font-bold text-gray-900">교사가 조건 설정</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { label: '문법', color: '#1865F2' },
                      { label: 'Level 5', color: '#0FBFAD' },
                      { label: '보통', color: '#FFB100' },
                      { label: '객관식', color: '#7854F7' },
                    ].map((tag) => (
                      <span
                        key={tag.label}
                        className="text-xs font-bold px-3 py-1 rounded-full"
                        style={{ background: tag.color + '18', color: tag.color }}
                      >
                        {tag.label}
                      </span>
                    ))}
                    <div className="flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full text-white" style={{ background: '#7854F7' }}>
                      ✦ AI 생성 요청
                    </div>
                  </div>
                </div>

                {/* Step 2: AI generates */}
                <div className="rounded-2xl border border-purple-200 bg-[#F5F0FF] shadow-sm p-5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ background: '#7854F7' }}>AI</div>
                    <div>
                      <div className="text-sm font-bold text-purple-900">AI가 초안 생성 완료</div>
                      <div className="text-xs text-purple-400">약 8초 소요</div>
                    </div>
                  </div>
                  <div className="bg-white rounded-xl p-4 border border-purple-100">
                    <div className="text-xs font-semibold text-gray-500 mb-2">생성된 문제 초안</div>
                    <div className="text-sm text-gray-800 mb-3">
                      Choose the correct form of the verb to complete the sentence.
                    </div>
                    <div className="text-sm text-gray-600 mb-3">
                      By the time we arrived, she _____ for two hours.
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {['① had been waiting', '② was waiting', '③ has waited', '④ waits'].map((opt, i) => (
                        <div
                          key={opt}
                          className={`text-xs px-3 py-2 rounded-lg border ${i === 0 ? 'border-green-200 bg-green-50 text-green-700 font-semibold' : 'border-gray-100 bg-gray-50 text-gray-600'}`}
                        >
                          {opt}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Step 3: Teacher approves */}
                <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ background: '#1FAF54' }}>3</div>
                    <div className="text-sm font-bold text-gray-900">교사 검토 후 저장</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 bg-gray-50 rounded-lg p-2.5 border border-gray-100 text-xs text-gray-500">
                      수정 없이 바로 사용 가능한 수준입니다.
                    </div>
                    <button className="px-4 py-2.5 rounded-lg text-xs font-bold text-white flex-shrink-0" style={{ background: '#0FBFAD' }}>
                      저장 &amp; 배포 →
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ── 기존 방식과 비교 ──────────────────────────────── */}
      <section className="py-20 px-6 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <ScrollReveal>
            <div className="text-center mb-14">
              <h2 className="text-3xl font-bold text-gray-900 mb-3">기존 방식과 무엇이 다른가요?</h2>
              <p className="text-gray-500 max-w-xl mx-auto">
                교재 의존에서 벗어나 학원만의 커리큘럼을 직접 설계하세요.
              </p>
            </div>
          </ScrollReveal>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {COMPARISONS.map((col, ci) => (
              <ScrollReveal key={col.label} delay={ci * 100}>
                <div
                  className={`rounded-xl border p-6 h-full ${ci === 1 ? 'border-teal-200 bg-[#E8FAF8]' : 'border-gray-200 bg-gray-50'}`}
                >
                  <div className={`text-base font-bold mb-5 ${ci === 1 ? 'text-teal-700' : 'text-gray-500'}`}>
                    {ci === 1 && (
                      <span
                        className="inline-flex items-center gap-1.5 text-white text-xs px-2.5 py-1 rounded-full mr-2"
                        style={{ background: '#0FBFAD' }}
                      >
                        추천
                      </span>
                    )}
                    {col.label}
                  </div>
                  <div className="space-y-3">
                    {col.items.map((item) => (
                      <div key={item.text} className="flex items-start gap-3">
                        <div
                          className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${item.bad ? 'bg-red-100' : 'bg-green-100'}`}
                        >
                          {item.bad ? (
                            <svg className="w-3 h-3 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                          ) : (
                            <svg className="w-3 h-3 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>
                        <div className={`text-sm font-medium ${item.bad ? 'text-gray-500' : 'text-gray-900'}`}>
                          {item.text}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────── */}
      <section className="py-20 px-6" style={{ background: '#0C2340' }}>
        <ScrollReveal>
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl font-bold text-white mb-4">
              교사가 설계하고, AI가 보조하고,
              <br />
              학생이 성장합니다
            </h2>
            <p className="text-white/60 mb-8">
              14일 무료 체험 · 카드 등록 없음 · 언제든 해지 가능
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/register/owner"
                className="inline-flex items-center justify-center gap-2 font-bold px-8 py-4 rounded-xl text-base transition-colors text-white"
                style={{ background: '#0FBFAD' }}
              >
                14일 무료 체험 시작
              </Link>
              <Link
                href="/features"
                className="inline-flex items-center justify-center gap-2 border border-white/30 text-white font-bold px-8 py-4 rounded-xl text-base hover:bg-white/10 transition-colors"
              >
                다른 기능 보기
              </Link>
            </div>
          </div>
        </ScrollReveal>
      </section>

    </div>
  )
}
