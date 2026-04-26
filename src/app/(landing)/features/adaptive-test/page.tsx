import type { Metadata } from 'next'
import Link from 'next/link'
import ScrollReveal from '@/components/landing/scroll-reveal'

export const metadata: Metadata = {
  title: '적응형 10단계 레벨 테스트 | EduLevel',
  description: '맞추면 어려운 문제, 틀리면 쉬운 문제. CEFR 기준 Pre-A1 ~ C1+ 10단계로 학생의 정확한 영어 실력을 측정합니다.',
}

const CEFR_LEVELS = [
  { level: 1, name: 'Pre-A1', cefr: 'Pre-A1', desc: '기초 이전', color: '#94A3B8' },
  { level: 2, name: 'A1 하', cefr: 'A1', desc: '왕초보', color: '#64B5F6' },
  { level: 3, name: 'A1 상', cefr: 'A1', desc: '초급', color: '#42A5F5' },
  { level: 4, name: 'A2 하', cefr: 'A2', desc: '초중급', color: '#2196F3' },
  { level: 5, name: 'A2 상', cefr: 'A2', desc: '중급 이전', color: '#1E88E5' },
  { level: 6, name: 'B1 하', cefr: 'B1', desc: '중급', color: '#1976D2' },
  { level: 7, name: 'B1 상', cefr: 'B1', desc: '중상급', color: '#1565C0' },
  { level: 8, name: 'B2 하', cefr: 'B2', desc: '상급', color: '#0D47A1' },
  { level: 9, name: 'B2 상', cefr: 'B2', desc: '고급', color: '#4527A0' },
  { level: 10, name: 'C1+', cefr: 'C1+', desc: '최고급', color: '#7854F7' },
]

const AREAS = [
  {
    name: '문법',
    en: 'Grammar',
    color: '#1865F2',
    bg: '#EEF4FF',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    desc: '시제·관사·전치사·문장 구조 등 핵심 문법 규칙을 문맥 속에서 측정합니다.',
    items: ['시제 및 조동사', '문장 구조 분석', '관사·전치사 활용', '구문 변환 능력'],
  },
  {
    name: '어휘',
    en: 'Vocabulary',
    color: '#7854F7',
    bg: '#F3F0FF',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
    desc: 'CEFR 기준 빈출 단어 2,000+개를 레벨별로 분류하여 어휘 폭을 정밀 측정합니다.',
    items: ['핵심 어휘 인식', '문맥 어휘 추론', '유의어·반의어 판별', '숙어·이디엄 이해'],
  },
  {
    name: '읽기',
    en: 'Reading',
    color: '#0FBFAD',
    bg: '#E8FAF8',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
      </svg>
    ),
    desc: '지문 독해력, 주제 파악, 세부 정보 추출 등 실용 읽기 역량을 종합 평가합니다.',
    items: ['주제 및 요지 파악', '세부 정보 추출', '추론·함축 이해', '글의 구조 분석'],
  },
  {
    name: '쓰기',
    en: 'Writing',
    color: '#E35C20',
    bg: '#FEF3EC',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    ),
    desc: 'GPT-4o 기반 AI 채점으로 문장 구성력, 표현력, 문법 정확성을 즉시 평가합니다.',
    items: ['문장 완성도', '표현의 정확성', '내용 전달력', 'AI 즉시 피드백'],
  },
  {
    name: '듣기',
    en: 'Listening',
    color: '#E91E8A',
    bg: '#FDE9F4',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15.536 8.464a5 5 0 010 7.072M12 9v6m0 0H9m3 0h3M9.464 8.464A5 5 0 0112 7.5a5 5 0 012.536.964" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M18.364 5.636a9 9 0 010 12.728M5.636 5.636a9 9 0 000 12.728" />
      </svg>
    ),
    desc: '실제 원어민 발음 기반의 오디오 클립으로 청해력과 핵심 내용 파악 능력을 측정합니다.',
    items: ['대화 청취 이해', '핵심 정보 파악', '억양·발음 인식', '속도별 이해도'],
  },
]

const PROCESS_STEPS = [
  {
    step: '01',
    title: '영역 선택 및 시작',
    desc: '5개 영역(문법·어휘·읽기·쓰기·듣기) 중 측정할 영역을 선택하거나 전체 레벨 테스트를 시작합니다.',
    color: '#1865F2',
  },
  {
    step: '02',
    title: '중간 난이도로 시작',
    desc: '첫 문제는 항상 레벨 5(A2 상) 난이도로 시작하여 학생의 현재 수준을 빠르게 파악합니다.',
    color: '#7854F7',
  },
  {
    step: '03',
    title: 'AI 실시간 난이도 조절',
    desc: '정답이면 더 어려운 문제, 오답이면 더 쉬운 문제가 제시됩니다. 각 답변이 다음 문제를 결정합니다.',
    color: '#0FBFAD',
  },
  {
    step: '04',
    title: '25문항으로 정밀 배치',
    desc: '평균 25문항(최소 15~최대 35)으로 최적 레벨을 수렴합니다. 전통 시험 대비 40% 적은 문항으로 동등한 정확도를 달성합니다.',
    color: '#E35C20',
  },
  {
    step: '05',
    title: '영역별 독립 레벨 산출',
    desc: '각 영역의 레벨이 독립적으로 계산됩니다. 문법은 B1이지만 어휘는 A2인 학생의 불균형도 정확히 파악합니다.',
    color: '#E91E8A',
  },
  {
    step: '06',
    title: '종합 리포트 생성',
    desc: '5영역 레벨, 강약점 분석, 레벨업 로드맵이 담긴 리포트가 즉시 생성됩니다. PDF 출력도 1클릭으로 가능합니다.',
    color: '#1865F2',
  },
]

const DIFFERENTIATORS = [
  {
    title: '전통 시험',
    items: [
      { label: '문항 수', value: '60~100문항', bad: true },
      { label: '소요 시간', value: '90~120분', bad: true },
      { label: '난이도', value: '모든 학생 동일', bad: true },
      { label: '결과', value: '총점 하나', bad: true },
      { label: '동일 문제 반복', value: '매번 같은 문제', bad: true },
      { label: 'AI 분석', value: '없음', bad: true },
    ],
  },
  {
    title: 'EduLevel 적응형 테스트',
    items: [
      { label: '문항 수', value: '평균 25문항', bad: false },
      { label: '소요 시간', value: '30~45분', bad: false },
      { label: '난이도', value: '학생 수준에 맞게 실시간 조절', bad: false },
      { label: '결과', value: '5영역 독립 레벨 + 강약점 분석', bad: false },
      { label: '동일 문제 반복', value: '1년 내 중복 출제 방지', bad: false },
      { label: 'AI 분석', value: '즉각적인 AI 약점 분석 리포트', bad: false },
    ],
  },
]

export default function AdaptiveTestPage() {
  return (
    <div className="bg-white">

      {/* ── Hero ──────────────────────────────────────────── */}
      <section className="pt-20 pb-16 px-6 bg-[#EEF4FF]">
        <div className="max-w-6xl mx-auto">
          <ScrollReveal>
            <Link
              href="/features"
              className="inline-flex items-center gap-1.5 text-sm text-primary-700 font-medium mb-6 hover:underline"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              기능소개로 돌아가기
            </Link>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div>
                <div className="inline-flex items-center gap-2 bg-primary-700 text-white text-xs font-bold px-4 py-2 rounded-full mb-5">
                  핵심 기능 01
                </div>
                <h1 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-4 leading-tight">
                  적응형
                  <br />
                  <span style={{ color: '#1865F2' }}>10단계</span> 레벨 테스트
                </h1>
                <p className="text-lg font-semibold text-primary-700 mb-4">
                  맞추면 어려운 문제, 틀리면 쉬운 문제
                </p>
                <p className="text-gray-600 leading-relaxed text-base mb-8">
                  영역별(문법·어휘·읽기·쓰기·듣기) 독립 레벨 측정으로 학생의 정확한 실력을 파악합니다.
                  CEFR 기준 Pre-A1 ~ C1+ 10단계로 정밀하게 배치합니다.
                  전통 시험 대비 <strong>40% 적은 문항</strong>으로 더 정확한 결과를 냅니다.
                </p>
                <div className="flex flex-col sm:flex-row gap-4">
                  <Link
                    href="/register/owner"
                    className="inline-flex items-center justify-center gap-2 bg-primary-700 text-white font-bold px-7 py-3.5 rounded-xl text-base hover:bg-primary-800 transition-colors"
                  >
                    14일 무료 체험 시작
                  </Link>
                  <Link
                    href="/contact"
                    className="inline-flex items-center justify-center gap-2 border border-primary-700 text-primary-700 font-bold px-7 py-3.5 rounded-xl text-base hover:bg-primary-50 transition-colors"
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
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                    레벨 테스트 결과 리포트
                  </div>
                  <div className="text-sm font-bold text-gray-900 mb-4">김민준 학생 · 2024년 4월 배치 결과</div>
                  <div className="space-y-3">
                    {[
                      { name: '문법', level: 7, label: 'B1 상', color: '#1865F2', pct: 70 },
                      { name: '어휘', level: 6, label: 'B1 하', color: '#7854F7', pct: 60 },
                      { name: '읽기', level: 8, label: 'B2 하', color: '#0FBFAD', pct: 80 },
                      { name: '쓰기', level: 5, label: 'A2 상', color: '#E35C20', pct: 50 },
                      { name: '듣기', level: 6, label: 'B1 하', color: '#E91E8A', pct: 60 },
                    ].map((area) => (
                      <div key={area.name} className="flex items-center gap-3">
                        <div className="w-10 text-xs font-semibold text-gray-600 flex-shrink-0">{area.name}</div>
                        <div className="flex-1 bg-gray-200 rounded-full h-2.5 overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${area.pct}%`, background: area.color }}
                          />
                        </div>
                        <div
                          className="text-xs font-bold w-14 text-right flex-shrink-0"
                          style={{ color: area.color }}
                        >
                          Lv.{area.level} {area.label}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 pt-4 border-t border-gray-200 flex items-center justify-between">
                    <div className="text-xs text-gray-500">종합 레벨</div>
                    <div className="text-lg font-bold" style={{ color: '#1865F2' }}>Lv.6 · B1 하</div>
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
            { value: '25', unit: '문항', label: '평균 측정 문항 수', color: '#1865F2' },
            { value: '10', unit: '단계', label: 'CEFR 기반 레벨', color: '#7854F7' },
            { value: '5', unit: '영역', label: '독립 레벨 측정', color: '#0FBFAD' },
            { value: '1년', unit: '', label: '중복 문제 방지 기간', color: '#E35C20' },
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

      {/* ── 5개 측정 영역 ──────────────────────────────────── */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <ScrollReveal>
            <div className="text-center mb-14">
              <h2 className="text-3xl font-bold text-gray-900 mb-3">5개 영역 독립 측정</h2>
              <p className="text-gray-500 max-w-xl mx-auto">
                각 영역은 독립적으로 평가되어 학생의 강점과 약점을 영역별로 정확히 파악합니다.
              </p>
            </div>
          </ScrollReveal>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
            {AREAS.map((area, i) => (
              <ScrollReveal key={area.name} delay={i * 70}>
                <div
                  className="rounded-xl border border-gray-200 p-5 hover:border-gray-300 hover:shadow-sm transition-all cursor-default h-full"
                >
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center mb-4"
                    style={{ background: area.bg, color: area.color }}
                  >
                    {area.icon}
                  </div>
                  <div className="text-xs font-medium text-gray-400 mb-0.5">{area.en}</div>
                  <div className="text-lg font-bold text-gray-900 mb-2">{area.name}</div>
                  <p className="text-xs text-gray-500 leading-relaxed mb-4">{area.desc}</p>
                  <ul className="space-y-1.5">
                    {area.items.map((item) => (
                      <li key={item} className="flex items-center gap-2 text-xs text-gray-600">
                        <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: area.color }} />
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

      {/* ── 10단계 레벨 체계 ───────────────────────────────── */}
      <section className="py-20 px-6 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <ScrollReveal>
            <div className="text-center mb-14">
              <h2 className="text-3xl font-bold text-gray-900 mb-3">CEFR 기반 10단계 레벨 체계</h2>
              <p className="text-gray-500 max-w-xl mx-auto">
                국제 표준 CEFR 프레임워크를 기반으로 한국 영어교육 현장에 맞게 세분화한
                10단계 레벨 체계입니다.
              </p>
            </div>
          </ScrollReveal>
          <div className="grid grid-cols-2 sm:grid-cols-5 lg:grid-cols-10 gap-3">
            {CEFR_LEVELS.map((lvl, i) => (
              <ScrollReveal key={lvl.level} delay={i * 50}>
                <div className="rounded-xl border border-gray-200 bg-white p-4 text-center hover:shadow-sm transition-all">
                  <div
                    className="text-xs font-bold mb-1.5 px-2 py-0.5 rounded-full inline-block"
                    style={{ background: lvl.color + '20', color: lvl.color }}
                  >
                    {lvl.cefr}
                  </div>
                  <div
                    className="text-xl font-bold mb-1"
                    style={{ color: lvl.color }}
                  >
                    {lvl.level}
                  </div>
                  <div className="text-xs font-semibold text-gray-800 mb-0.5">{lvl.name}</div>
                  <div className="text-xs text-gray-400">{lvl.desc}</div>
                </div>
              </ScrollReveal>
            ))}
          </div>

          {/* Score range */}
          <ScrollReveal>
            <div className="mt-8 rounded-xl border border-gray-200 bg-white p-6">
              <div className="text-sm font-semibold text-gray-700 mb-4">점수 → 레벨 변환 기준</div>
              <div className="flex items-end gap-1 overflow-x-auto pb-2">
                {CEFR_LEVELS.map((lvl, i) => (
                  <div key={lvl.level} className="flex-1 min-w-[52px] text-center">
                    <div
                      className="rounded-t-md flex items-end justify-center text-xs font-bold text-white pb-1"
                      style={{
                        background: lvl.color,
                        height: `${28 + i * 8}px`,
                      }}
                    >
                      {lvl.level}
                    </div>
                    <div className="text-xs text-gray-400 mt-1.5">{i * 10 + 1}~{(i + 1) * 10}</div>
                    <div className="text-xs font-medium text-gray-600">{lvl.name}</div>
                  </div>
                ))}
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ── 테스트 프로세스 ────────────────────────────────── */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <ScrollReveal>
            <div className="text-center mb-14">
              <h2 className="text-3xl font-bold text-gray-900 mb-3">테스트 진행 프로세스</h2>
              <p className="text-gray-500 max-w-xl mx-auto">
                AI 알고리즘이 학생의 답변을 실시간 분석하여 최적의 레벨에 빠르게 수렴합니다.
              </p>
            </div>
          </ScrollReveal>
          <div className="relative">
            {/* Connector line */}
            <div className="hidden lg:block absolute top-8 left-0 right-0 h-0.5 bg-gray-200 mx-24" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {PROCESS_STEPS.map((step, i) => (
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

      {/* ── 적응형 알고리즘 시각화 ─────────────────────────── */}
      <section className="py-20 px-6 bg-[#EEF4FF]">
        <div className="max-w-6xl mx-auto">
          <ScrollReveal>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-14 items-center">
              <div>
                <div className="inline-flex items-center gap-2 bg-primary-700 text-white text-xs font-bold px-3 py-1.5 rounded-full mb-5">
                  적응형 알고리즘
                </div>
                <h2 className="text-3xl font-bold text-gray-900 mb-5">
                  AI가 실시간으로
                  <br />
                  난이도를 조절합니다
                </h2>
                <p className="text-gray-600 leading-relaxed mb-6">
                  문항반응이론(IRT, Item Response Theory) 기반 알고리즘이 각 답변을 분석하여
                  다음 문제의 난이도를 즉시 결정합니다. 학생이 정답을 맞히면 더 어려운 문제로,
                  틀리면 더 쉬운 문제로 분기되어 최적의 레벨에 빠르게 수렴합니다.
                </p>
                <ul className="space-y-3">
                  {[
                    { text: '전통 시험 대비 40% 적은 문항으로 동등한 정확도', color: '#1865F2' },
                    { text: '정답·오답 패턴으로 실시간 레벨 추정값 업데이트', color: '#1865F2' },
                    { text: '각 영역 독립 측정으로 불균형 학습자도 정확히 파악', color: '#1865F2' },
                    { text: '1년 내 동일 문제 재출제 방지로 결과 신뢰도 유지', color: '#1865F2' },
                  ].map((item) => (
                    <li key={item.text} className="flex items-start gap-3 text-sm text-gray-700">
                      <svg className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: '#1FAF54' }} fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      {item.text}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Algorithm visualization */}
              <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-6">
                <div className="text-sm font-semibold text-gray-700 mb-5">적응형 문제 분기 예시 (어휘 영역)</div>
                <div className="relative">
                  {/* Start node */}
                  <div className="flex justify-center mb-3">
                    <div className="bg-primary-700 text-white text-xs font-bold px-4 py-2 rounded-full">
                      시작: Lv.5 (A2 상)
                    </div>
                  </div>
                  {/* Branch 1 */}
                  <div className="flex justify-center gap-8 mb-3 relative">
                    <div className="absolute top-0 left-1/2 h-5 w-0.5 bg-gray-300 -translate-x-1/2" />
                    <div className="absolute top-5 left-1/4 right-1/4 h-0.5 bg-gray-300" />
                    <div className="text-center">
                      <div className="w-0.5 h-5 bg-gray-300 mx-auto" />
                      <div className="bg-green-100 border border-green-200 text-green-700 text-xs font-semibold px-3 py-1.5 rounded-lg">
                        정답 → Lv.7
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="w-0.5 h-5 bg-gray-300 mx-auto" />
                      <div className="bg-red-100 border border-red-200 text-red-700 text-xs font-semibold px-3 py-1.5 rounded-lg">
                        오답 → Lv.3
                      </div>
                    </div>
                  </div>
                  {/* Branch 2 */}
                  <div className="flex justify-center gap-8 mb-3 relative">
                    <div className="flex flex-col items-center gap-2 w-32">
                      <div className="w-0.5 h-4 bg-gray-300" />
                      <div className="bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold px-3 py-1.5 rounded-lg w-full text-center">
                        정답 → Lv.8
                      </div>
                      <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 text-xs font-semibold px-3 py-1.5 rounded-lg w-full text-center">
                        오답 → Lv.6
                      </div>
                    </div>
                    <div className="flex flex-col items-center gap-2 w-32">
                      <div className="w-0.5 h-4 bg-gray-300" />
                      <div className="bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold px-3 py-1.5 rounded-lg w-full text-center">
                        정답 → Lv.4
                      </div>
                      <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 text-xs font-semibold px-3 py-1.5 rounded-lg w-full text-center">
                        오답 → Lv.2
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
                    <span className="text-xs text-gray-400">약 25문항 후</span>
                    <div className="bg-primary-100 text-primary-700 text-xs font-bold px-4 py-2 rounded-full">
                      최종 레벨 확정
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ── 전통 시험과의 비교 ─────────────────────────────── */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <ScrollReveal>
            <div className="text-center mb-14">
              <h2 className="text-3xl font-bold text-gray-900 mb-3">전통 시험과 무엇이 다른가요?</h2>
              <p className="text-gray-500 max-w-xl mx-auto">
                획일적인 종이 시험에서 벗어나 학생 개개인에게 최적화된 측정을 경험하세요.
              </p>
            </div>
          </ScrollReveal>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {DIFFERENTIATORS.map((col, ci) => (
              <ScrollReveal key={col.title} delay={ci * 100}>
                <div className={`rounded-xl border p-6 h-full ${ci === 1 ? 'border-primary-300 bg-[#EEF4FF]' : 'border-gray-200 bg-gray-50'}`}>
                  <div className={`text-base font-bold mb-5 ${ci === 1 ? 'text-primary-700' : 'text-gray-500'}`}>
                    {ci === 1 && (
                      <span className="inline-flex items-center gap-1.5 bg-primary-700 text-white text-xs px-2.5 py-1 rounded-full mr-2">
                        추천
                      </span>
                    )}
                    {col.title}
                  </div>
                  <div className="space-y-3">
                    {col.items.map((item) => (
                      <div key={item.label} className="flex items-start gap-3">
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${item.bad ? 'bg-red-100' : 'bg-green-100'}`}>
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
                        <div>
                          <div className="text-xs text-gray-400 mb-0.5">{item.label}</div>
                          <div className={`text-sm font-medium ${item.bad ? 'text-gray-500' : 'text-gray-900'}`}>
                            {item.value}
                          </div>
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

      {/* ── 결과 리포트 프리뷰 ─────────────────────────────── */}
      <section className="py-20 px-6 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <ScrollReveal>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-14 items-start">
              <div>
                <div className="inline-flex items-center gap-2 bg-gray-900 text-white text-xs font-bold px-3 py-1.5 rounded-full mb-5">
                  결과 리포트
                </div>
                <h2 className="text-3xl font-bold text-gray-900 mb-5">
                  테스트 직후 즉시
                  <br />
                  상세 리포트 생성
                </h2>
                <p className="text-gray-600 leading-relaxed mb-6">
                  테스트가 끝나는 즉시 5영역 레벨, 강약점 분석, 레벨업 로드맵이 담긴
                  상세 리포트가 생성됩니다. 교사와 학원장은 실시간으로 결과를 확인하고
                  PDF로 출력하여 학부모 상담 자료로 활용할 수 있습니다.
                </p>
                <ul className="space-y-3">
                  {[
                    '5영역 독립 레벨 + 종합 레벨 산출',
                    '영역별 강약점 분석 및 학습 방향 제시',
                    '레벨업까지 필요한 조건 로드맵',
                    '1클릭 PDF 출력 (학부모 상담용)',
                    '이전 테스트 결과와 성장 비교',
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-3 text-sm text-gray-700">
                      <svg className="w-4 h-4 flex-shrink-0" style={{ color: '#1FAF54' }} fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Report mockup */}
              <div className="space-y-4">
                <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-6">
                  <div className="flex items-center justify-between mb-5">
                    <div>
                      <div className="text-xs text-gray-400 mb-0.5">2024.04.15 배치 테스트</div>
                      <div className="text-base font-bold text-gray-900">이수연 학생 레벨 리포트</div>
                    </div>
                    <div className="flex items-center gap-2 bg-primary-50 text-primary-700 text-xs font-bold px-3 py-2 rounded-lg">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      PDF 출력
                    </div>
                  </div>
                  <div className="grid grid-cols-5 gap-2 mb-5">
                    {[
                      { name: '문법', level: 6, color: '#1865F2' },
                      { name: '어휘', level: 7, color: '#7854F7' },
                      { name: '읽기', level: 8, color: '#0FBFAD' },
                      { name: '쓰기', level: 5, color: '#E35C20' },
                      { name: '듣기', level: 6, color: '#E91E8A' },
                    ].map((area) => (
                      <div key={area.name} className="text-center rounded-xl p-3" style={{ background: area.color + '15' }}>
                        <div className="text-xs text-gray-500 mb-1">{area.name}</div>
                        <div className="text-xl font-bold" style={{ color: area.color }}>
                          {area.level}
                        </div>
                        <div className="text-xs font-medium" style={{ color: area.color }}>레벨</div>
                      </div>
                    ))}
                  </div>

                  <div className="rounded-xl bg-gray-50 p-4">
                    <div className="text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wider">강약점 분석</div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-14 text-xs text-gray-600">가장 강한 영역</div>
                      <div className="flex items-center gap-1.5 bg-green-100 text-green-700 text-xs font-bold px-2.5 py-1 rounded-full">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#0FBFAD]" />
                        읽기 Lv.8
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-14 text-xs text-gray-600">집중 필요 영역</div>
                      <div className="flex items-center gap-1.5 bg-orange-100 text-orange-700 text-xs font-bold px-2.5 py-1 rounded-full">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#E35C20]" />
                        쓰기 Lv.5
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5">
                  <div className="text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wider">레벨업 로드맵</div>
                  <div className="space-y-2.5">
                    {[
                      { label: '레벨 테스트', desc: '5영역 중 3개 이상 목표 레벨 도달', done: true },
                      { label: '단원 테스트', desc: '현재 레벨 단원 70% 이수 + 평균 60점', done: true },
                      { label: '학습 활동', desc: '30일 내 문제 50개 또는 미션 20일 완료', done: false },
                    ].map((cond) => (
                      <div key={cond.label} className="flex items-start gap-3">
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${cond.done ? 'bg-green-100' : 'bg-gray-100'}`}>
                          {cond.done ? (
                            <svg className="w-3 h-3 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          ) : (
                            <div className="w-2 h-2 rounded-full bg-gray-400" />
                          )}
                        </div>
                        <div>
                          <div className={`text-xs font-semibold ${cond.done ? 'text-gray-800' : 'text-gray-400'}`}>{cond.label}</div>
                          <div className="text-xs text-gray-400">{cond.desc}</div>
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

      {/* ── CTA ───────────────────────────────────────────── */}
      <section className="py-20 px-6" style={{ background: '#0C2340' }}>
        <ScrollReveal>
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl font-bold text-white mb-4">
              지금 바로 적응형 레벨 테스트를
              <br />
              직접 경험해보세요
            </h2>
            <p className="text-white/60 mb-8">
              14일 무료 체험 · 카드 등록 없음 · 언제든 해지 가능
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/register/owner"
                className="inline-flex items-center justify-center gap-2 bg-primary-700 text-white font-bold px-8 py-4 rounded-xl text-base hover:bg-primary-600 transition-colors"
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
