'use client'

import { useState } from 'react'

const TABS = [
  {
    id: 'owner',
    label: '학원장',
    title: '학원 전체를 한눈에',
    desc: '데이터 기반으로 학원을 운영하세요. 직관적인 대시보드로 모든 현황을 파악할 수 있습니다.',
    features: [
      '반별·학생별 성적 현황 실시간 확인',
      '교사 성과 분석 및 비교 관리',
      '월별 수익·등록·이탈 추이 분석',
      'PDF 리포트 1클릭 생성',
      '정기 레벨 테스트 자동 스케줄링',
    ],
    mockupLabel: '학원장 분석 대시보드',
  },
  {
    id: 'teacher',
    label: '교사',
    title: '교육에만 집중하세요',
    desc: 'AI가 행정 업무를 대신합니다. 선생님은 학생과 더 많은 시간을 보낼 수 있습니다.',
    features: [
      'AI가 학생별 약점을 자동 분석',
      '테스트 출제부터 채점까지 자동화',
      '학생별 맞춤 학습 경로 추천',
      '학부모 상담 자료 자동 생성',
      '레벨 조정 및 이력 관리',
    ],
    mockupLabel: '교사 학생 관리 화면',
  },
  {
    id: 'student',
    label: '학생',
    title: '매일 성장하는 영어 실력',
    desc: 'AI가 설계한 나만의 학습 경로. 매일 조금씩 성장하는 재미를 느낄 수 있습니다.',
    features: [
      '나만을 위한 AI 맞춤 문제',
      '게임처럼 즐기는 일일 미션',
      '오답 자동 복습 시스템',
      '레벨업 달성의 성취감',
      '쓰기 AI 즉시 피드백',
    ],
    mockupLabel: '학생 홈 미션 카드',
  },
]

export default function RoleTabs() {
  const [active, setActive] = useState('owner')
  const tab = TABS.find((t) => t.id === active)!

  return (
    <div>
      {/* Tab buttons */}
      <div className="flex gap-2 justify-center mb-12 flex-wrap">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setActive(t.id)}
            className={`px-6 py-3 rounded-xl text-sm font-semibold transition-all ${
              active === t.id
                ? 'bg-primary-700 text-white shadow-sm'
                : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center max-w-5xl mx-auto">
        <div>
          <h3 className="text-2xl font-bold text-gray-900 mb-2">{tab.title}</h3>
          <p className="text-gray-500 mb-6">{tab.desc}</p>
          <ul className="space-y-4">
            {tab.features.map((feature) => (
              <li key={feature} className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <svg className="w-3 h-3 text-primary-700" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <span className="text-gray-700">{feature}</span>
              </li>
            ))}
          </ul>
          <div className="mt-8">
            <a
              href="/register/owner"
              className="inline-flex items-center gap-2 text-primary-700 text-sm font-semibold hover:underline"
            >
              무료로 시작하기 →
            </a>
          </div>
        </div>

        {/* Mockup placeholder */}
        <div className="bg-gray-50 rounded-2xl aspect-[4/3] flex flex-col items-center justify-center border border-gray-200 gap-4 overflow-hidden p-8">
          <div className="flex gap-2">
            {['#1865F2', '#7854F7', '#0FBFAD', '#E35C20', '#E91E8A'].map((c) => (
              <div key={c} className="w-2 h-2 rounded-full" style={{ background: c }} />
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2 w-full max-w-xs">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="rounded-lg h-12 animate-pulse"
                style={{ background: 'rgba(0,0,0,0.07)', animationDelay: `${i * 0.12}s` }}
              />
            ))}
          </div>
          <div className="text-xs text-gray-400">{tab.mockupLabel}</div>
        </div>
      </div>
    </div>
  )
}
