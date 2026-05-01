'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PlanCard } from '@/components/billing/PlanCard'
import type { PlanFeature } from '@/components/billing/PlanCard'
import { PLANS } from '@/lib/pricing'
import type { Plan } from '@/generated/prisma'

const PLAN_METADATA: Record<
  Plan,
  {
    name: string
    badge?: string
    isRecommended: boolean
    features: PlanFeature[]
  }
> = {
  FREE: {
    name: '무료',
    isRecommended: false,
    features: [
      { text: '학생 최대 10명', included: true },
      { text: '교사 계정 1개', included: true },
      { text: '레벨 테스트 무제한', included: true },
      { text: '기본 문제 뱅크 열람', included: true },
      { text: 'AI 쓰기 평가 월 5회', included: true },
      { text: 'AI 문제 생성 월 3회', included: true },
      { text: '1GB 파일 저장', included: true },
      { text: '데이터 30일 보관', included: true },
      { text: 'AI 유사문제 생성', included: false },
      { text: '고급 분석 대시보드', included: false },
    ],
  },
  STARTER: {
    name: '스타터',
    isRecommended: false,
    features: [
      { text: '학생 최대 20명', included: true },
      { text: '교사 계정 2개', included: true },
      { text: '레벨 테스트 + 단원 테스트 무제한', included: true },
      { text: '기본 문제 뱅크 열람', included: true },
      { text: 'AI 쓰기 평가 월 50회', included: true },
      { text: 'AI 문제 생성 월 30회', included: true },
      { text: '10GB 파일 저장', included: true },
      { text: '데이터 1년 보관', included: true },
      { text: 'AI 유사문제 생성', included: false },
      { text: '고급 분석 대시보드', included: false },
    ],
  },
  STANDARD: {
    name: '스탠다드',
    badge: '가장 인기',
    isRecommended: true,
    features: [
      { text: '학생 최대 50명', included: true },
      { text: '교사 계정 5개', included: true },
      { text: '레벨 테스트 + 단원 테스트 무제한', included: true },
      { text: '전체 문제 뱅크 열람', included: true },
      { text: 'AI 쓰기 평가 월 200회', included: true },
      { text: 'AI 문제 생성 월 100회', included: true },
      { text: '50GB 파일 저장', included: true },
      { text: '데이터 3년 보관', included: true },
      { text: 'AI 유사문제 생성', included: true },
      { text: '고급 분석 대시보드', included: true },
    ],
  },
  PREMIUM: {
    name: '프리미엄',
    isRecommended: false,
    features: [
      { text: '학생 무제한', included: true },
      { text: '교사 계정 무제한', included: true },
      { text: '레벨 테스트 + 단원 테스트 무제한', included: true },
      { text: '전체 문제 뱅크 우선 접근', included: true },
      { text: 'AI 쓰기 평가 월 1,000회', included: true },
      { text: 'AI 문제 생성 월 500회', included: true },
      { text: '500GB 파일 저장', included: true },
      { text: '데이터 무기한 보관', included: true },
      { text: 'AI 유사문제 생성', included: true },
      { text: '고급 분석 대시보드', included: true },
    ],
  },
}

const PLAN_ORDER: Plan[] = ['FREE', 'STARTER', 'STANDARD', 'PREMIUM']

interface PlansClientProps {
  currentPlan: Plan
}

export function PlansClient({ currentPlan }: PlansClientProps) {
  const router = useRouter()
  const [isYearly, setIsYearly] = useState(false)

  function handleSelect(plan: Plan) {
    if (plan === currentPlan) return

    if (plan === 'FREE') {
      fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: 'FREE', billingCycle: 'MONTHLY' }),
      }).then(() => router.push('/owner/billing/success?free=1'))
      return
    }

    router.push(
      `/owner/billing/checkout?plan=${plan}&cycle=${isYearly ? 'YEARLY' : 'MONTHLY'}`,
    )
  }

  return (
    <div className="flex flex-col gap-8">
      {/* 헤더 */}
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900">요금제 선택</h1>
        <p className="mt-2 text-gray-500">학원 규모에 맞는 플랜을 선택하세요</p>
      </div>

      {/* 월간 / 연간 토글 */}
      <div className="flex justify-center">
        <div className="inline-flex items-center gap-3 rounded-full border border-gray-200 bg-white p-1 shadow-sm">
          <button
            onClick={() => setIsYearly(false)}
            className={`rounded-full px-5 py-2 text-sm font-medium transition-colors ${
              !isYearly
                ? 'bg-primary-700 text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            월간
          </button>
          <button
            onClick={() => setIsYearly(true)}
            className={`flex items-center gap-2 rounded-full px-5 py-2 text-sm font-medium transition-colors ${
              isYearly
                ? 'bg-primary-700 text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            연간
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                isYearly ? 'bg-accent-gold text-white' : 'bg-accent-gold/10 text-accent-gold'
              }`}
            >
              20% 할인
            </span>
          </button>
        </div>
      </div>

      {/* 플랜 카드 그리드 */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {PLAN_ORDER.map((plan) => {
          const meta = PLAN_METADATA[plan]
          const config = PLANS[plan]

          return (
            <PlanCard
              key={plan}
              plan={plan}
              name={meta.name}
              price={config.monthlyPrice}
              yearlyPrice={config.yearlyPrice}
              isYearly={isYearly}
              features={meta.features}
              isCurrent={plan === currentPlan}
              isRecommended={meta.isRecommended}
              badge={meta.badge}
              onSelect={handleSelect}
            />
          )
        })}
      </div>

      {/* 하단 안내 */}
      <p className="text-center text-sm text-gray-400">
        언제든지 플랜 변경 및 해지 가능 · KG이니시스 카드 정기결제 · 부가세 별도
      </p>
    </div>
  )
}
