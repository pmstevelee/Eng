'use client'

import { useState, useEffect, useCallback } from 'react'

const REVIEWS = [
  {
    academy: '강남 A+ 영어학원',
    type: '중고등 전문',
    duration: '6개월 사용',
    change: '교사 행정시간 65% 절감',
    quote:
      '레벨 테스트를 수동으로 진행하고 결과를 엑셀에 정리하던 시간이 사라졌습니다. 이제 선생님들이 수업 준비에 집중할 수 있어요. 학부모 상담 자료도 클릭 한 번에 나오니 정말 편합니다.',
    author: '원장 김○○',
  },
  {
    academy: '분당 스마트잉글리시',
    type: '초등 전문',
    duration: '4개월 사용',
    change: '학생 학습 참여율 40% 향상',
    quote:
      '아이들이 일일 미션을 스스로 찾아서 합니다. AI가 맞춤 문제를 내주니 너무 어렵거나 쉽지 않고 딱 맞는 수준이에요. 부모님들도 앱으로 학습 현황을 바로 확인하셔서 만족도가 높아졌습니다.',
    author: '원장 박○○',
  },
  {
    academy: '노원 탑클래스어학원',
    type: '성인·대입 전문',
    duration: '8개월 사용',
    change: 'AI 쓰기 평가로 첨삭 시간 70% 절감',
    quote:
      '에세이 첨삭이 가장 큰 고민이었는데, AI가 즉시 피드백을 줘서 학생들이 오래 기다리지 않아도 됩니다. 레벨업 기준도 명확해서 학생과 학부모 모두 목표가 생겼어요.',
    author: '원장 이○○',
  },
]

export default function ReviewsCarousel() {
  const [current, setCurrent] = useState(0)

  const next = useCallback(() => setCurrent((c) => (c + 1) % REVIEWS.length), [])
  const prev = () => setCurrent((c) => (c - 1 + REVIEWS.length) % REVIEWS.length)

  useEffect(() => {
    const timer = setInterval(next, 5000)
    return () => clearInterval(timer)
  }, [next])

  const review = REVIEWS[current]

  return (
    <div className="relative max-w-3xl mx-auto">
      {/* Card */}
      <div className="bg-white rounded-2xl border border-gray-200 p-8 md:p-10">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-primary-100 rounded-xl flex items-center justify-center text-primary-700 font-bold text-sm">
            {review.academy.charAt(0)}
          </div>
          <div>
            <div className="font-semibold text-gray-900 text-sm">{review.academy}</div>
            <div className="text-xs text-gray-500">{review.type} · {review.duration}</div>
          </div>
          <div className="ml-auto">
            <span className="bg-accent-green/10 text-accent-green text-xs font-semibold px-3 py-1 rounded-full">
              {review.change}
            </span>
          </div>
        </div>

        {/* Stars */}
        <div className="flex gap-1 mb-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <svg key={i} className="w-4 h-4 text-accent-gold" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
          ))}
        </div>

        <p className="text-gray-700 leading-relaxed mb-6">&ldquo;{review.quote}&rdquo;</p>
        <div className="text-sm font-medium text-gray-500">— {review.author}</div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between mt-6">
        <button
          onClick={prev}
          className="w-10 h-10 rounded-xl border border-gray-200 bg-white flex items-center justify-center hover:bg-gray-50 transition-colors"
          aria-label="이전"
        >
          <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div className="flex gap-2">
          {REVIEWS.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`w-2 h-2 rounded-full transition-all ${
                i === current ? 'bg-primary-700 w-6' : 'bg-gray-300'
              }`}
              aria-label={`${i + 1}번째 후기`}
            />
          ))}
        </div>

        <button
          onClick={next}
          className="w-10 h-10 rounded-xl border border-gray-200 bg-white flex items-center justify-center hover:bg-gray-50 transition-colors"
          aria-label="다음"
        >
          <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  )
}
