import type { Metadata } from 'next'
import Link from 'next/link'
import ScrollReveal from '@/components/landing/scroll-reveal'

export const metadata: Metadata = {
  title: '데이터 기반 실시간 성장 추적 | EduLevel',
  description: '반별 비교, 영역별 분석, 성장률 추이를 한눈에 파악합니다. 선생님이 데이터에 근거해 효율적으로 지도하고, 1클릭 PDF 리포트로 학부모 상담을 준비합니다.',
}

const PRIMARY = '#E35C20'

const CORE_FEATURES = [
  {
    title: '실시간 성장 대시보드',
    desc: '학생별, 반별, 영역별 점수 변화를 실시간으로 확인할 수 있습니다. 이번달과 지난달 데이터를 자동 비교해 성장 추이를 시각화합니다.',
    color: PRIMARY,
    bg: '#FEF3EC',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    items: ['주간·월간·학기별 성장 추이', '이전 기간과 자동 비교', '영역별 성장률 시각화', '전체 반 통계 한눈에 파악'],
  },
  {
    title: '반별·학생별 비교 분석',
    desc: '동일 레벨 반끼리 비교하거나 개별 학생 성장을 심층 분석합니다. 평균 이하 학생을 자동으로 감지해 집중 지도 대상을 제안합니다.',
    color: '#1865F2',
    bg: '#EEF4FF',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    items: ['반별 평균 점수 비교', '학생 개인 성장 그래프', '집중 지도 필요 학생 자동 감지', '레벨업 대기 학생 목록'],
  },
  {
    title: '5영역 심층 분석',
    desc: '문법·어휘·읽기·쓰기·듣기 5개 영역의 점수를 독립적으로 분석합니다. 영역별 강점과 약점을 파악해 맞춤형 지도 전략을 세울 수 있습니다.',
    color: '#7854F7',
    bg: '#F3F0FF',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
      </svg>
    ),
    items: ['5개 영역 독립 점수 추적', '영역별 성장률 비교', '취약 영역 자동 감지 및 알림', '학원 전체 영역별 통계'],
  },
  {
    title: '1클릭 PDF 리포트',
    desc: '학부모 상담에 필요한 성장 리포트를 버튼 하나로 생성합니다. 학생의 레벨, 점수 추이, 강약점, 향후 학습 계획이 깔끔하게 담긴 보고서가 즉시 완성됩니다.',
    color: '#1FAF54',
    bg: '#E8F8EF',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    items: ['클릭 한 번에 PDF 자동 생성', '학생 성장 추이 시각화 포함', '영역별 강약점 분석 포함', '다음 학습 목표 및 계획 제안'],
  },
]

const HOW_IT_WORKS = [
  {
    step: '01',
    title: '데이터 자동 수집',
    desc: '학생이 테스트를 응시하거나 학습을 완료하면 점수·정답률·소요 시간이 자동으로 수집됩니다. 별도 입력 없이 모든 데이터가 실시간으로 반영됩니다.',
    color: PRIMARY,
  },
  {
    step: '02',
    title: 'AI 성장 분석',
    desc: 'AI가 누적된 학습 데이터를 분석해 개인별 성장 패턴을 파악합니다. 단순 점수 비교를 넘어 영역별 성장 속도와 취약 유형을 진단합니다.',
    color: '#7854F7',
  },
  {
    step: '03',
    title: '대시보드 시각화',
    desc: '분석 결과가 반별·학생별 대시보드에 실시간으로 업데이트됩니다. 선생님은 언제든 최신 데이터를 확인하고 수업에 즉시 반영할 수 있습니다.',
    color: '#1865F2',
  },
  {
    step: '04',
    title: '집중 지도 대상 감지',
    desc: '성장이 정체되거나 점수가 하락한 학생을 자동으로 감지합니다. 선생님에게 알림을 보내고, 원인 분석과 맞춤 지도 방향을 함께 제안합니다.',
    color: '#E91E8A',
  },
  {
    step: '05',
    title: 'PDF 리포트 생성',
    desc: '학부모 상담 전 버튼 하나로 학생별 성장 리포트를 생성합니다. 점수 추이, 강약점, 레벨 변화, 향후 학습 계획이 깔끔하게 정리됩니다.',
    color: '#1FAF54',
  },
  {
    step: '06',
    title: '지속적인 개선 사이클',
    desc: '리포트를 바탕으로 수업 방향을 조정하면 그 효과가 다시 데이터로 쌓입니다. 데이터 → 분석 → 개선의 사이클로 학생 실력이 꾸준히 향상됩니다.',
    color: '#0FBFAD',
  },
]

const COMPARISONS = [
  {
    label: '기존 방식',
    items: [
      { text: '교사의 기억과 감에 의존한 학생 파악', bad: true },
      { text: '성적표 작성에 많은 시간 소모', bad: true },
      { text: '반별 비교나 영역별 분석 어려움', bad: true },
      { text: '학부모 상담 자료 준비에 별도 작업 필요', bad: true },
      { text: '성장 정체 학생을 놓치는 경우 발생', bad: true },
    ],
  },
  {
    label: 'EduLevel 성장 추적',
    items: [
      { text: '실시간 데이터로 정확한 학생 현황 파악', bad: false },
      { text: '대시보드에서 성장 추이 즉시 확인', bad: false },
      { text: '반별·영역별 비교 분석 자동 제공', bad: false },
      { text: '1클릭으로 학부모 상담 리포트 생성', bad: false },
      { text: '성장 정체 학생 자동 감지 및 알림', bad: false },
    ],
  },
]

const METRICS = [
  { value: '실시간', label: '데이터 업데이트', color: PRIMARY },
  { value: '5영역', label: '독립 분석 제공', color: '#7854F7' },
  { value: '1클릭', label: 'PDF 리포트 생성', color: '#1865F2' },
  { value: '3배', label: '상담 준비 시간 단축', color: '#1FAF54' },
]

export default function GrowthTrackingPage() {
  return (
    <div className="bg-white">

      {/* ── Hero ──────────────────────────────────────────── */}
      <section className="pt-20 pb-16 px-6 bg-[#FEF3EC]">
        <div className="max-w-6xl mx-auto">
          <ScrollReveal>
            <Link
              href="/features"
              className="inline-flex items-center gap-1.5 text-sm font-medium mb-6 hover:underline"
              style={{ color: PRIMARY }}
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
                  style={{ background: PRIMARY }}
                >
                  핵심 기능 04
                </div>
                <h1 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-4 leading-tight">
                  데이터 기반
                  <br />
                  <span style={{ color: PRIMARY }}>실시간 성장 추적</span>
                </h1>
                <p className="text-lg font-semibold mb-4" style={{ color: PRIMARY }}>
                  숫자로 보이는 학생의 실력 향상
                </p>
                <p className="text-gray-600 leading-relaxed text-base mb-8">
                  반별 비교, 영역별 분석, 성장률 추이를 한눈에 파악합니다.
                  선생님이 데이터에 근거해 효율적으로 지도하고,
                  1클릭 PDF 리포트로 학부모 상담을 준비합니다.
                </p>
                <div className="flex flex-col sm:flex-row gap-4">
                  <Link
                    href="/register/owner"
                    className="inline-flex items-center justify-center gap-2 text-white font-bold px-7 py-3.5 rounded-xl text-base transition-colors"
                    style={{ background: PRIMARY }}
                  >
                    14일 무료 체험 시작
                  </Link>
                  <Link
                    href="/contact"
                    className="inline-flex items-center justify-center gap-2 font-bold px-7 py-3.5 rounded-xl text-base transition-colors border"
                    style={{ borderColor: PRIMARY, color: PRIMARY }}
                  >
                    도입 문의하기
                  </Link>
                </div>
              </div>

              {/* Hero Visual: Dashboard mockup */}
              <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border-b border-gray-100">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
                  <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
                  <div className="flex-1 bg-gray-100 rounded-md h-5 ml-2" />
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/images/growth-tracking-mockup.svg"
                  alt="데이터 기반 성장 추적 대시보드"
                  className="w-full block"
                />
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ── Stats ─────────────────────────────────────────── */}
      <section className="py-12 px-6 border-b border-gray-100">
        <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6">
          {METRICS.map((stat) => (
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
              <h2 className="text-3xl font-bold text-gray-900 mb-3">4가지 핵심 분석 기능</h2>
              <p className="text-gray-500 max-w-xl mx-auto">
                데이터로 학생을 이해하고, 결과로 교육을 증명합니다.
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

      {/* ── 대시보드 상세 시각화 ───────────────────────────── */}
      <section className="py-20 px-6 bg-[#FEF3EC]">
        <div className="max-w-6xl mx-auto">
          <ScrollReveal>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-14 items-center">
              <div>
                <div
                  className="inline-flex items-center gap-2 text-white text-xs font-bold px-3 py-1.5 rounded-full mb-5"
                  style={{ background: PRIMARY }}
                >
                  성장 대시보드
                </div>
                <h2 className="text-3xl font-bold text-gray-900 mb-5">
                  모든 학생의 성장을
                  <br />
                  한 화면에서 파악
                </h2>
                <p className="text-gray-600 leading-relaxed mb-6">
                  수십 명의 학생 데이터를 일일이 확인할 필요 없습니다.
                  대시보드 한 화면에서 반 전체의 성장 현황을 파악하고,
                  집중 지도가 필요한 학생을 즉시 찾아낼 수 있습니다.
                </p>
                <ul className="space-y-3">
                  {[
                    { text: '반별·영역별 평균 점수 실시간 확인', color: PRIMARY },
                    { text: '이전 기간 대비 성장률 자동 계산', color: PRIMARY },
                    { text: '하락 학생 자동 감지 및 강조 표시', color: PRIMARY },
                    { text: '레벨업 완료 및 대기 학생 한눈에 파악', color: PRIMARY },
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

              {/* Dashboard mockup full view */}
              <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border-b border-gray-100">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
                  <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
                  <div className="flex-1 bg-white rounded-md h-5 ml-2 border border-gray-200 flex items-center px-3">
                    <span className="text-xs text-gray-400">위고업잉글리시 · 성장 추적</span>
                  </div>
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/images/growth-tracking-mockup.svg"
                  alt="실시간 성장 대시보드 화면"
                  className="w-full block"
                />
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ── PDF 리포트 섹션 ────────────────────────────────── */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <ScrollReveal>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-14 items-start">
              {/* PDF Report mockup */}
              <div className="space-y-4">
                {/* Report header */}
                <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                  <div
                    className="px-6 py-4 flex items-center justify-between"
                    style={{ background: '#0C2340' }}
                  >
                    <div>
                      <div className="text-white font-bold text-base">학습 성장 리포트</div>
                      <div className="text-white/60 text-xs mt-0.5">2025년 4월 · 위고업잉글리시</div>
                    </div>
                    <div
                      className="px-3 py-1.5 rounded-lg text-xs font-bold text-white"
                      style={{ background: PRIMARY }}
                    >
                      PDF 저장
                    </div>
                  </div>
                  <div className="p-5">
                    <div className="flex items-center gap-4 mb-5">
                      <div
                        className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0"
                        style={{ background: '#1865F2' }}
                      >
                        김
                      </div>
                      <div>
                        <div className="font-bold text-gray-900 text-base">김민준 학생</div>
                        <div className="text-sm text-gray-500">A반 · Level 7 (B1 상)</div>
                      </div>
                      <div className="ml-auto text-right">
                        <div className="text-2xl font-bold" style={{ color: PRIMARY }}>85.2점</div>
                        <div className="text-xs text-green-600 font-semibold">↑ +8.4% 성장</div>
                      </div>
                    </div>

                    {/* 5 area scores in report */}
                    <div className="space-y-2">
                      {[
                        { label: '문법', score: 88, color: '#1865F2', width: '88%' },
                        { label: '어휘', score: 92, color: '#7854F7', width: '92%' },
                        { label: '읽기', score: 80, color: '#0FBFAD', width: '80%' },
                        { label: '쓰기', score: 74, color: PRIMARY, width: '74%' },
                        { label: '듣기', score: 86, color: '#E91E8A', width: '86%' },
                      ].map((area) => (
                        <div key={area.label} className="flex items-center gap-3">
                          <div className="w-8 text-xs text-gray-500 flex-shrink-0">{area.label}</div>
                          <div className="flex-1 bg-gray-100 rounded-full h-2">
                            <div
                              className="h-2 rounded-full"
                              style={{ width: area.width, background: area.color }}
                            />
                          </div>
                          <div className="w-8 text-xs font-semibold text-right" style={{ color: area.color }}>
                            {area.score}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Growth insight box -->*/}
                <div className="rounded-2xl border border-orange-200 bg-[#FEF3EC] p-5">
                  <div className="flex items-start gap-3">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                      style={{ background: PRIMARY }}
                    >
                      AI
                    </div>
                    <div>
                      <div className="text-sm font-bold text-gray-900 mb-1">AI 분석 코멘트</div>
                      <p className="text-xs text-gray-600 leading-relaxed">
                        쓰기 영역이 다른 영역 대비 낮습니다. 문장 구조 연습 문제를
                        추가로 배정하고, 서술형 답안 작성 훈련을 강화하시기를 권장합니다.
                        어휘 영역의 뛰어난 성과를 쓰기 향상에 연계하면 효과적입니다.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <div
                  className="inline-flex items-center gap-2 text-white text-xs font-bold px-3 py-1.5 rounded-full mb-5"
                  style={{ background: '#1FAF54' }}
                >
                  1클릭 PDF 리포트
                </div>
                <h2 className="text-3xl font-bold text-gray-900 mb-5">
                  학부모 상담,
                  <br />
                  데이터로 설득합니다
                </h2>
                <p className="text-gray-600 leading-relaxed mb-6">
                  &ldquo;우리 아이가 얼마나 성장했나요?&rdquo; 이 질문에 숫자로 답하세요.
                  버튼 하나로 생성되는 리포트에는 점수 추이, 영역별 강약점,
                  레벨 변화, AI 코멘트가 모두 담겨 있습니다.
                </p>
                <ul className="space-y-3">
                  {[
                    '학생별 맞춤 PDF 1클릭 생성',
                    '점수 추이 차트 자동 포함',
                    '영역별 강점·약점 분석 내용',
                    'AI가 작성하는 학습 코멘트',
                    '다음 학습 목표 및 권장 계획',
                    '인쇄 또는 카카오톡·이메일 공유',
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
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ── 작동 방식 ─────────────────────────────────────── */}
      <section className="py-20 px-6 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <ScrollReveal>
            <div className="text-center mb-14">
              <h2 className="text-3xl font-bold text-gray-900 mb-3">성장 추적은 어떻게 이루어지나요?</h2>
              <p className="text-gray-500 max-w-xl mx-auto">
                데이터 수집부터 개선까지, 자동화된 사이클로 끊임없이 작동합니다.
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

      {/* ── 영역별 성장 분석 시각화 ───────────────────────── */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <ScrollReveal>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-14 items-start">
              <div>
                <div
                  className="inline-flex items-center gap-2 text-white text-xs font-bold px-3 py-1.5 rounded-full mb-5"
                  style={{ background: '#7854F7' }}
                >
                  영역별 분석
                </div>
                <h2 className="text-3xl font-bold text-gray-900 mb-5">
                  5개 영역 독립 추적으로
                  <br />
                  정밀한 강약점 파악
                </h2>
                <p className="text-gray-600 leading-relaxed mb-6">
                  전체 점수만으로는 학생의 진짜 실력을 알 수 없습니다.
                  문법·어휘·읽기·쓰기·듣기를 각각 독립적으로 추적해
                  어느 영역이 강하고 어디가 부족한지 정확히 파악합니다.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { area: '문법', color: '#1865F2', bg: '#EEF4FF', desc: '문장 구조, 시제, 문법 규칙' },
                    { area: '어휘', color: '#7854F7', bg: '#F3F0FF', desc: '단어 이해, 표현력, 어휘 범위' },
                    { area: '읽기', color: '#0FBFAD', bg: '#E8FAF8', desc: '독해력, 추론, 글 구조 파악' },
                    { area: '쓰기', color: PRIMARY, bg: '#FEF3EC', desc: '문장 작성, 논리 구성, 표현' },
                    { area: '듣기', color: '#E91E8A', bg: '#FFF0F6', desc: '청취 이해, 세부 사항 파악' },
                  ].map((item) => (
                    <div
                      key={item.area}
                      className="rounded-xl p-4 border border-gray-100"
                      style={{ background: item.bg }}
                    >
                      <div className="text-sm font-bold mb-1" style={{ color: item.color }}>
                        {item.area}
                      </div>
                      <div className="text-xs text-gray-600">{item.desc}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Area tracking visual mockup */}
              <div className="space-y-4">
                <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5">
                  <div className="flex items-center justify-between mb-5">
                    <div className="text-sm font-bold text-gray-900">영역별 성장 비교 (최근 3개월)</div>
                    <div className="text-xs text-gray-400">2025년 2월~4월</div>
                  </div>
                  {[
                    { area: '문법', color: '#1865F2', prev: 68, curr: 80 },
                    { area: '어휘', color: '#7854F7', prev: 79, curr: 88 },
                    { area: '읽기', color: '#0FBFAD', prev: 72, curr: 75 },
                    { area: '쓰기', color: PRIMARY, prev: 58, curr: 65 },
                    { area: '듣기', color: '#E91E8A', prev: 75, curr: 83 },
                  ].map((item) => (
                    <div key={item.area} className="mb-4 last:mb-0">
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="text-xs font-semibold" style={{ color: item.color }}>{item.area}</div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400">{item.prev}점</span>
                          <svg className="w-3 h-3 text-gray-300" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                          <span className="text-xs font-bold" style={{ color: item.color }}>{item.curr}점</span>
                          <span className="text-xs font-bold text-green-600">
                            +{item.curr - item.prev}
                          </span>
                        </div>
                      </div>
                      <div className="relative h-2.5 bg-gray-100 rounded-full">
                        <div
                          className="absolute left-0 top-0 h-full rounded-full opacity-30"
                          style={{ width: `${item.prev}%`, background: item.color }}
                        />
                        <div
                          className="absolute left-0 top-0 h-full rounded-full"
                          style={{ width: `${item.curr}%`, background: item.color }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div
                  className="rounded-2xl p-5"
                  style={{ background: '#0C2340' }}
                >
                  <div className="text-white font-bold text-sm mb-3">AI 종합 분석</div>
                  <div className="space-y-2">
                    {[
                      { icon: '📈', text: '어휘·문법 영역 우수한 성장세 유지' },
                      { icon: '⚠️', text: '쓰기 영역 상대적으로 성장 속도 저조' },
                      { icon: '💡', text: '읽기↔쓰기 연계 학습으로 동반 향상 권장' },
                    ].map((item) => (
                      <div key={item.text} className="flex items-start gap-2.5">
                        <span className="text-sm flex-shrink-0">{item.icon}</span>
                        <span className="text-xs text-white/80 leading-relaxed">{item.text}</span>
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
                감이 아닌 데이터로, 추측이 아닌 근거로 학생을 지도하세요.
              </p>
            </div>
          </ScrollReveal>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {COMPARISONS.map((col, ci) => (
              <ScrollReveal key={col.label} delay={ci * 100}>
                <div
                  className={`rounded-xl border p-6 h-full ${ci === 1 ? 'border-orange-200 bg-[#FEF3EC]' : 'border-gray-200 bg-gray-50'}`}
                >
                  <div className={`text-base font-bold mb-5 ${ci === 1 ? 'text-orange-700' : 'text-gray-500'}`}>
                    {ci === 1 && (
                      <span
                        className="inline-flex items-center gap-1.5 text-white text-xs px-2.5 py-1 rounded-full mr-2"
                        style={{ background: PRIMARY }}
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
              데이터가 증명하는 교육,
              <br />
              지금 바로 시작하세요
            </h2>
            <p className="text-white/60 mb-8">
              14일 무료 체험 · 카드 등록 없음 · 언제든 해지 가능
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/register/owner"
                className="inline-flex items-center justify-center gap-2 font-bold px-8 py-4 rounded-xl text-base transition-colors text-white"
                style={{ background: PRIMARY }}
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
