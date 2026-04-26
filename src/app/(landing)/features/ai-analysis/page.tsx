import type { Metadata } from 'next'
import Link from 'next/link'
import ScrollReveal from '@/components/landing/scroll-reveal'

export const metadata: Metadata = {
  title: 'AI 데이터 분석 + 약점 반복 제시 | EduLevel',
  description: 'AI가 학생의 오답 패턴과 영역별 점수를 정밀 분석합니다. 취약한 유형을 자동으로 감지하고 해당 문제를 반복 제시하여 실질적인 실력 향상을 이끕니다.',
}

const ANALYSIS_FEATURES = [
  {
    title: '오답 패턴 심층 분석',
    desc: '단순 오답 개수가 아닌, 어떤 유형의 문제에서 반복적으로 실수하는지 패턴을 추출합니다.',
    color: '#7854F7',
    bg: '#F3F0FF',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    items: ['반복 실수 유형 자동 분류', '시간대별·영역별 오답 분포', '난이도별 정답률 추이', '동일 유형 누적 데이터 분석'],
  },
  {
    title: '취약 영역 자동 감지',
    desc: '5개 영역(문법·어휘·읽기·쓰기·듣기)의 세부 항목별 성취도를 비교하여 취약 포인트를 즉각 식별합니다.',
    color: '#1865F2',
    bg: '#EEF4FF',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    ),
    items: ['영역별 세부 항목 분석', '강점·약점 자동 레이블링', '임계값 이하 영역 즉시 알림', '학생별 맞춤 약점 지도 생성'],
  },
  {
    title: '약점 문제 반복 제시',
    desc: '취약 유형 문제를 일일 학습 큐에 자동 추가하여 망각 곡선에 맞게 간격 반복(Spaced Repetition)을 구현합니다.',
    color: '#1FAF54',
    bg: '#E8F8EF',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
    ),
    items: ['망각 곡선 기반 복습 스케줄', '유사 문제 자동 변형 출제', '반복 학습 진행률 시각화', '완전 학습 달성 시 자동 종료'],
  },
  {
    title: 'AI 즉시 피드백',
    desc: 'GPT-4o 기반 AI가 오답 이유를 자연어로 설명하고 올바른 개념과 풀이 전략을 즉각 제시합니다.',
    color: '#E35C20',
    bg: '#FEF3EC',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
      </svg>
    ),
    items: ['오답 원인 자연어 설명', '개념 정리 + 예문 제공', '유사 오류 방지 전략 제시', '한국어/영어 이중 피드백'],
  },
]

const HOW_IT_WORKS = [
  {
    step: '01',
    title: '데이터 수집',
    desc: '레벨 테스트, 단원 테스트, 일일 연습의 모든 답변 데이터를 실시간으로 수집합니다. 단순 정오답뿐 아니라 풀이 시간, 재답변 여부까지 기록합니다.',
    color: '#7854F7',
  },
  {
    step: '02',
    title: 'AI 패턴 분석',
    desc: '누적된 데이터를 AI가 분석하여 학생별 오답 패턴, 약점 유형, 성취 속도를 계산합니다. 영역별로 세분화된 약점 지도가 생성됩니다.',
    color: '#1865F2',
  },
  {
    step: '03',
    title: '개인화 문제 큐레이션',
    desc: '약점 분석 결과를 바탕으로 오늘 꼭 풀어야 할 문제 세트를 자동으로 구성합니다. 망각 곡선을 적용해 최적의 복습 시점을 계산합니다.',
    color: '#0FBFAD',
  },
  {
    step: '04',
    title: '반복 학습 실행',
    desc: '학생이 맞춤 문제 큐에서 연습하면, AI가 정답률 변화를 실시간으로 모니터링합니다. 취약 항목이 해소되면 다음 약점으로 자동 전환합니다.',
    color: '#E35C20',
  },
  {
    step: '05',
    title: '교사 리포트 공유',
    desc: '교사는 학생별 약점 지도와 개선 추이를 대시보드에서 한눈에 확인합니다. 수업 전 약점 현황을 파악하여 집중 지도 방향을 설정할 수 있습니다.',
    color: '#E91E8A',
  },
  {
    step: '06',
    title: '성장 추적 & 알림',
    desc: '주간 약점 해소율과 영역별 성장을 리포트로 정리합니다. 목표 레벨 달성 예상일과 필요 학습량을 학생·교사 모두에게 알립니다.',
    color: '#1FAF54',
  },
]

const WEAK_AREAS_DEMO = [
  { area: '문법', sub: '시제 활용', score: 42, color: '#1865F2', pct: 42 },
  { area: '어휘', sub: '이디엄 표현', score: 55, color: '#7854F7', pct: 55 },
  { area: '읽기', sub: '추론·함축', score: 61, color: '#0FBFAD', pct: 61 },
  { area: '쓰기', sub: '문장 완성도', score: 38, color: '#E35C20', pct: 38 },
  { area: '듣기', sub: '핵심 정보 파악', score: 49, color: '#E91E8A', pct: 49 },
]

const COMPARISONS = [
  {
    label: '기존 방식',
    items: [
      { text: '교사가 수동으로 오답 노트 확인', bad: true },
      { text: '전체 반 대상 동일한 복습 문제', bad: true },
      { text: '약점 파악에 수업 시간 소모', bad: true },
      { text: '학생의 자발적 복습 의존', bad: true },
      { text: '데이터 기반 분석 불가', bad: true },
    ],
  },
  {
    label: 'EduLevel AI 분석',
    items: [
      { text: 'AI가 오답 패턴 자동 감지 및 분류', bad: false },
      { text: '학생별 완전히 다른 개인화 문제 제공', bad: false },
      { text: '교사는 분석 결과만 확인하면 OK', bad: false },
      { text: '망각 곡선 기반 자동 반복 스케줄', bad: false },
      { text: '영역별 약점 지도로 데이터 기반 지도', bad: false },
    ],
  },
]

export default function AiAnalysisPage() {
  return (
    <div className="bg-white">

      {/* ── Hero ──────────────────────────────────────────── */}
      <section className="pt-20 pb-16 px-6 bg-[#F3F0FF]">
        <div className="max-w-6xl mx-auto">
          <ScrollReveal>
            <Link
              href="/features"
              className="inline-flex items-center gap-1.5 text-sm font-medium mb-6 hover:underline"
              style={{ color: '#7854F7' }}
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
                  style={{ background: '#7854F7' }}
                >
                  핵심 기능 02
                </div>
                <h1 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-4 leading-tight">
                  AI 데이터 분석
                  <br />
                  <span style={{ color: '#7854F7' }}>+ 약점 반복 제시</span>
                </h1>
                <p className="text-lg font-semibold mb-4" style={{ color: '#7854F7' }}>
                  부족한 부분을 AI가 정확히 찾아 반복 학습
                </p>
                <p className="text-gray-600 leading-relaxed text-base mb-8">
                  AI가 학생의 오답 패턴과 영역별 점수를 정밀 분석합니다.
                  취약한 유형을 자동으로 감지하고 해당 문제를 반복 제시하여
                  실질적인 실력 향상을 이끕니다.
                </p>
                <div className="flex flex-col sm:flex-row gap-4">
                  <Link
                    href="/register/owner"
                    className="inline-flex items-center justify-center gap-2 text-white font-bold px-7 py-3.5 rounded-xl text-base transition-colors"
                    style={{ background: '#7854F7' }}
                  >
                    14일 무료 체험 시작
                  </Link>
                  <Link
                    href="/contact"
                    className="inline-flex items-center justify-center gap-2 font-bold px-7 py-3.5 rounded-xl text-base transition-colors border"
                    style={{ borderColor: '#7854F7', color: '#7854F7' }}
                  >
                    도입 문의하기
                  </Link>
                </div>
              </div>

              {/* Hero Visual Mockup */}
              <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
                  <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
                  <div className="flex-1 bg-gray-100 rounded-md h-6 ml-2" />
                </div>
                <div className="bg-gray-50 rounded-xl p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">AI 약점 분석 리포트</div>
                      <div className="text-sm font-bold text-gray-900 mt-0.5">박서연 학생 · 이번 주 분석</div>
                    </div>
                    <div
                      className="text-xs font-bold px-2.5 py-1 rounded-full text-white"
                      style={{ background: '#7854F7' }}
                    >
                      AI 분석 완료
                    </div>
                  </div>
                  <div className="space-y-3 mb-4">
                    {WEAK_AREAS_DEMO.map((item) => (
                      <div key={item.area} className="flex items-center gap-3">
                        <div className="w-20 text-xs font-medium text-gray-600 flex-shrink-0">
                          <div>{item.area}</div>
                          <div className="text-gray-400 text-[10px]">{item.sub}</div>
                        </div>
                        <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${item.pct}%`, background: item.color }}
                          />
                        </div>
                        <div
                          className="text-xs font-bold w-10 text-right flex-shrink-0"
                          style={{ color: item.score < 50 ? '#D92916' : item.color }}
                        >
                          {item.score}점
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="rounded-lg p-3 border" style={{ background: '#FFF3F1', borderColor: '#FECDCA' }}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
                      <div className="text-xs font-bold text-red-700">오늘의 집중 약점</div>
                    </div>
                    <div className="text-xs text-red-600">
                      쓰기(38점) · 문법 시제(42점) 집중 반복 필요
                    </div>
                    <div className="mt-2 text-xs font-semibold" style={{ color: '#7854F7' }}>
                      → AI가 맞춤 문제 12개를 자동 구성했습니다
                    </div>
                  </div>
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
            { value: '4개', unit: '', label: '분석 기반 데이터 소스', color: '#7854F7' },
            { value: '5', unit: '영역', label: '세부 약점 분류', color: '#1865F2' },
            { value: '30초', unit: '', label: 'AI 피드백 제공 시간', color: '#0FBFAD' },
            { value: '3배', unit: '', label: '반복 학습 효과 향상', color: '#E35C20' },
          ].map((stat) => (
            <ScrollReveal key={stat.label}>
              <div className="text-center py-4">
                <div className="text-3xl lg:text-4xl font-bold mb-1" style={{ color: stat.color }}>
                  {stat.value}
                  <span className="text-xl">{stat.unit}</span>
                </div>
                <div className="text-sm text-gray-500">{stat.label}</div>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </section>

      {/* ── 4가지 핵심 분석 기능 ───────────────────────────── */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <ScrollReveal>
            <div className="text-center mb-14">
              <h2 className="text-3xl font-bold text-gray-900 mb-3">4가지 핵심 AI 분석 기능</h2>
              <p className="text-gray-500 max-w-xl mx-auto">
                단순한 오답 체크를 넘어, 학생 개개인의 학습 패턴을 깊이 이해하고 최적의 학습 경로를 제시합니다.
              </p>
            </div>
          </ScrollReveal>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {ANALYSIS_FEATURES.map((feature, i) => (
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

      {/* ── 작동 방식 ─────────────────────────────────────── */}
      <section className="py-20 px-6 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <ScrollReveal>
            <div className="text-center mb-14">
              <h2 className="text-3xl font-bold text-gray-900 mb-3">AI 분석은 어떻게 작동하나요?</h2>
              <p className="text-gray-500 max-w-xl mx-auto">
                데이터 수집부터 개인화 문제 제시까지, AI가 전 과정을 자동으로 처리합니다.
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

      {/* ── 약점 분석 대시보드 시각화 ──────────────────────── */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <ScrollReveal>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-14 items-center">
              <div>
                <div
                  className="inline-flex items-center gap-2 text-white text-xs font-bold px-3 py-1.5 rounded-full mb-5"
                  style={{ background: '#7854F7' }}
                >
                  약점 분석 대시보드
                </div>
                <h2 className="text-3xl font-bold text-gray-900 mb-5">
                  교사와 학생이 함께
                  <br />
                  약점을 파악합니다
                </h2>
                <p className="text-gray-600 leading-relaxed mb-6">
                  AI가 분석한 약점 지도는 교사 대시보드와 학생 학습 화면에 동시에 공유됩니다.
                  교사는 수업 전 학생의 현황을 파악하고, 학생은 오늘 집중해야 할 영역을 명확히 알고 학습에 임합니다.
                </p>
                <ul className="space-y-3">
                  {[
                    { text: '영역별 세부 항목 점수 히트맵 시각화', color: '#7854F7' },
                    { text: '개선 추이 그래프로 성장 확인', color: '#7854F7' },
                    { text: '교사 전용 반 전체 약점 현황 뷰', color: '#7854F7' },
                    { text: '학생별 1:1 맞춤 피드백 메모 추가', color: '#7854F7' },
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

              {/* Dashboard Mockup */}
              <div className="space-y-4">
                <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-6">
                  <div className="flex items-center justify-between mb-5">
                    <div>
                      <div className="text-xs text-gray-400 mb-0.5">2024년 4월 3주차</div>
                      <div className="text-base font-bold text-gray-900">약점 분석 현황</div>
                    </div>
                    <div
                      className="text-xs font-bold px-3 py-1.5 rounded-lg text-white"
                      style={{ background: '#7854F7' }}
                    >
                      AI 업데이트됨
                    </div>
                  </div>

                  {/* Heatmap style grid */}
                  <div className="mb-4">
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">영역별 항목 성취도 히트맵</div>
                    <div className="grid grid-cols-5 gap-1.5">
                      {[
                        { area: '문법', scores: [42, 78, 65, 55] },
                        { area: '어휘', scores: [72, 55, 81, 60] },
                        { area: '읽기', scores: [85, 61, 74, 88] },
                        { area: '쓰기', scores: [38, 45, 52, 41] },
                        { area: '듣기', scores: [67, 49, 73, 58] },
                      ].map(({ area, scores }) => (
                        <div key={area}>
                          <div className="text-center text-xs font-medium text-gray-500 mb-1.5">{area}</div>
                          {scores.map((score, si) => (
                            <div
                              key={si}
                              className="rounded h-7 mb-1 flex items-center justify-center text-xs font-bold"
                              style={{
                                background: score < 50 ? '#FEE2E2' : score < 70 ? '#FEF3C7' : '#D1FAE5',
                                color: score < 50 ? '#DC2626' : score < 70 ? '#92400E' : '#065F46',
                              }}
                            >
                              {score}
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-3 mt-2 justify-end">
                      <div className="flex items-center gap-1 text-xs text-gray-400">
                        <div className="w-2.5 h-2.5 rounded bg-red-100" /> 50 미만
                      </div>
                      <div className="flex items-center gap-1 text-xs text-gray-400">
                        <div className="w-2.5 h-2.5 rounded bg-yellow-100" /> 50~69
                      </div>
                      <div className="flex items-center gap-1 text-xs text-gray-400">
                        <div className="w-2.5 h-2.5 rounded bg-green-100" /> 70+
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5">
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">오늘의 AI 추천 복습 세트</div>
                  <div className="space-y-2.5">
                    {[
                      { area: '쓰기', sub: '문장 완성도', count: 5, color: '#E35C20', priority: '최우선' },
                      { area: '문법', sub: '시제 활용', count: 4, color: '#1865F2', priority: '우선' },
                      { area: '듣기', sub: '핵심 정보 파악', count: 3, color: '#E91E8A', priority: '일반' },
                    ].map((item) => (
                      <div key={item.area} className="flex items-center justify-between rounded-lg p-3 bg-gray-50">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                            style={{ background: item.color }}
                          >
                            {item.area[0]}
                          </div>
                          <div>
                            <div className="text-xs font-semibold text-gray-800">{item.area} · {item.sub}</div>
                            <div className="text-xs text-gray-400">{item.count}문항</div>
                          </div>
                        </div>
                        <div
                          className="text-xs font-bold px-2 py-0.5 rounded-full"
                          style={{
                            background: item.priority === '최우선' ? '#FEE2E2' : item.priority === '우선' ? '#FEF3C7' : '#F0FDF4',
                            color: item.priority === '최우선' ? '#DC2626' : item.priority === '우선' ? '#92400E' : '#166534',
                          }}
                        >
                          {item.priority}
                        </div>
                      </div>
                    ))}
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
                수동 오답 노트 관리에서 벗어나 AI가 자동으로 분석하고 최적 복습 경로를 설계합니다.
              </p>
            </div>
          </ScrollReveal>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {COMPARISONS.map((col, ci) => (
              <ScrollReveal key={col.label} delay={ci * 100}>
                <div
                  className={`rounded-xl border p-6 h-full ${ci === 1 ? 'border-purple-200 bg-[#F3F0FF]' : 'border-gray-200 bg-gray-50'}`}
                >
                  <div className={`text-base font-bold mb-5 ${ci === 1 ? 'text-purple-700' : 'text-gray-500'}`}>
                    {ci === 1 && (
                      <span
                        className="inline-flex items-center gap-1.5 text-white text-xs px-2.5 py-1 rounded-full mr-2"
                        style={{ background: '#7854F7' }}
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

      {/* ── AI 피드백 예시 ────────────────────────────────── */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <ScrollReveal>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-14 items-start">
              <div>
                <div
                  className="inline-flex items-center gap-2 text-white text-xs font-bold px-3 py-1.5 rounded-full mb-5"
                  style={{ background: '#7854F7' }}
                >
                  AI 즉시 피드백
                </div>
                <h2 className="text-3xl font-bold text-gray-900 mb-5">
                  오답 즉시,
                  <br />
                  AI가 이유를 설명합니다
                </h2>
                <p className="text-gray-600 leading-relaxed mb-6">
                  학생이 문제를 틀리면 GPT-4o 기반 AI가 30초 이내에 오답 원인을 분석하고
                  개념 설명, 예문, 개선 전략을 한국어로 제공합니다.
                  교사는 이 피드백에 추가 코멘트를 덧붙여 더욱 개인화된 지도가 가능합니다.
                </p>
                <ul className="space-y-3">
                  {[
                    '오답 원인을 명확한 개념 단위로 설명',
                    '올바른 예문과 함께 정확한 용법 제시',
                    '유사 실수 방지를 위한 기억 전략 제공',
                    '교사 추가 코멘트 병행으로 완전 학습 지원',
                    '피드백 이력 누적으로 성장 추이 확인',
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

              {/* AI Feedback Mockup */}
              <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-6">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ background: '#7854F7' }}>
                    AI
                  </div>
                  <div>
                    <div className="text-sm font-bold text-gray-900">AI 피드백</div>
                    <div className="text-xs text-gray-400">방금 전</div>
                  </div>
                </div>

                {/* Wrong answer display */}
                <div className="rounded-xl bg-red-50 border border-red-100 p-4 mb-4">
                  <div className="text-xs font-semibold text-red-600 mb-2">오답 문제</div>
                  <div className="text-sm text-gray-800 mb-3">
                    By the time she arrived, he ___ for two hours.
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 bg-red-100 text-red-700 text-xs font-semibold px-2.5 py-1 rounded-full">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                      선택: was waiting
                    </div>
                    <div className="flex items-center gap-1.5 bg-green-100 text-green-700 text-xs font-semibold px-2.5 py-1 rounded-full">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      정답: had been waiting
                    </div>
                  </div>
                </div>

                {/* AI Explanation */}
                <div className="space-y-3">
                  <div className="rounded-xl bg-purple-50 border border-purple-100 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-4 h-4 rounded-full flex items-center justify-center text-white text-xs" style={{ background: '#7854F7' }}>!</div>
                      <div className="text-xs font-bold text-purple-700">오답 원인</div>
                    </div>
                    <div className="text-xs text-gray-700 leading-relaxed">
                      &apos;By the time&apos;은 과거완료 시제와 함께 씁니다. &apos;was waiting&apos;은 단순 과거 진행형으로, 기준 시점보다 앞서 시작된 동작의 지속을 표현하지 못합니다.
                    </div>
                  </div>
                  <div className="rounded-xl bg-gray-50 p-4">
                    <div className="text-xs font-bold text-gray-600 mb-2">올바른 개념 정리</div>
                    <div className="text-xs text-gray-600 leading-relaxed">
                      <span className="font-semibold">과거완료진행 (had been + V-ing)</span>: 과거의 기준 시점 이전부터 계속 진행 중인 동작을 나타냄.
                    </div>
                    <div className="mt-2 p-2 bg-white rounded-lg border border-gray-200 text-xs text-gray-500 italic">
                      예: &quot;He had been studying for 3 hours before I called.&quot;
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
                  <div className="text-xs text-gray-400">유사 문제 3개 복습 예정</div>
                  <div
                    className="text-xs font-bold px-3 py-1.5 rounded-lg text-white"
                    style={{ background: '#7854F7' }}
                  >
                    다음 문제 →
                  </div>
                </div>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────── */}
      <section className="py-20 px-6" style={{ background: '#0C2340' }}>
        <ScrollReveal>
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl font-bold text-white mb-4">
              AI가 분석하고, 학생이 성장하고,
              <br />
              교사가 확인합니다
            </h2>
            <p className="text-white/60 mb-8">
              14일 무료 체험 · 카드 등록 없음 · 언제든 해지 가능
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/register/owner"
                className="inline-flex items-center justify-center gap-2 font-bold px-8 py-4 rounded-xl text-base transition-colors text-white"
                style={{ background: '#7854F7' }}
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
