'use client'

import { useState, useTransition } from 'react'
import { createPendingSubscription } from '../actions'

type Plan = 'BASIC' | 'STANDARD' | 'PREMIUM'
type Period = 'MONTHLY' | 'YEARLY'

interface PlanFeature {
  label: string
  available: boolean
}

interface PlanConfig {
  type: Plan
  name: string
  monthlyPrice: number
  yearlyPrice: number
  maxStudents: number
  maxTeachers: number
  recommended?: boolean
  features: PlanFeature[]
}

const PLANS: PlanConfig[] = [
  {
    type: 'BASIC',
    name: '베이직',
    monthlyPrice: 49000,
    yearlyPrice: 490000,
    maxStudents: 30,
    maxTeachers: 3,
    features: [
      { label: '레벨 테스트', available: true },
      { label: 'AI 학습 리포트', available: false },
      { label: '맞춤형 테스트 생성', available: false },
      { label: '다중 반 관리', available: false },
      { label: '우선 지원', available: false },
    ],
  },
  {
    type: 'STANDARD',
    name: '스탠다드',
    monthlyPrice: 89000,
    yearlyPrice: 890000,
    maxStudents: 100,
    maxTeachers: 10,
    recommended: true,
    features: [
      { label: '레벨 테스트', available: true },
      { label: 'AI 학습 리포트', available: true },
      { label: '맞춤형 테스트 생성', available: true },
      { label: '다중 반 관리', available: false },
      { label: '우선 지원', available: false },
    ],
  },
  {
    type: 'PREMIUM',
    name: '프리미엄',
    monthlyPrice: 149000,
    yearlyPrice: 1490000,
    maxStudents: 300,
    maxTeachers: 30,
    features: [
      { label: '레벨 테스트', available: true },
      { label: 'AI 학습 리포트', available: true },
      { label: '맞춤형 테스트 생성', available: true },
      { label: '다중 반 관리', available: true },
      { label: '우선 지원', available: true },
    ],
  },
]

interface Props {
  currentPlan: Plan
}

export function SubscriptionClient({ currentPlan }: Props) {
  const [period, setPeriod] = useState<Period>('MONTHLY')
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null)
  const [isPending, startTransition] = useTransition()
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const planConfig = PLANS.find((p) => p.type === selectedPlan)
  const price =
    selectedPlan && planConfig
      ? period === 'MONTHLY'
        ? planConfig.monthlyPrice
        : planConfig.yearlyPrice
      : 0

  function handlePeriodChange(next: Period) {
    setPeriod(next)
    setSelectedPlan(null)
    setSubmitted(false)
    setError(null)
  }

  function handleSelectPlan(plan: Plan) {
    if (plan === currentPlan) return
    setSelectedPlan(plan === selectedPlan ? null : plan)
    setSubmitted(false)
    setError(null)
  }

  function handleSubmit() {
    if (!selectedPlan) return
    setError(null)
    startTransition(async () => {
      const result = await createPendingSubscription(selectedPlan, period)
      if ('error' in result) {
        setError(result.error)
      } else {
        setSubmitted(true)
        setSelectedPlan(null)
      }
    })
  }

  return (
    <div className="space-y-6">
      {/* Plan Comparison */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <h2 className="text-base font-semibold text-gray-900">요금제 비교</h2>

          {/* Period Toggle */}
          <div className="flex items-center bg-gray-100 rounded-lg p-1 gap-1">
            <button
              onClick={() => handlePeriodChange('MONTHLY')}
              className={`px-4 py-1.5 text-sm rounded-md font-medium transition-colors ${
                period === 'MONTHLY'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              월간
            </button>
            <button
              onClick={() => handlePeriodChange('YEARLY')}
              className={`flex items-center gap-1.5 px-4 py-1.5 text-sm rounded-md font-medium transition-colors ${
                period === 'YEARLY'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              연간
              <span className="text-xs bg-accent-green text-white px-1.5 py-0.5 rounded-full leading-none">
                17% 절약
              </span>
            </button>
          </div>
        </div>

        {/* Plan Cards */}
        <div className="grid sm:grid-cols-3 gap-4">
          {PLANS.map((plan) => {
            const isCurrentPlan = plan.type === currentPlan
            const isSelected = plan.type === selectedPlan
            const planPrice =
              period === 'MONTHLY' ? plan.monthlyPrice : plan.yearlyPrice

            return (
              <div
                key={plan.type}
                className={`relative rounded-xl border-2 p-5 flex flex-col transition-all ${
                  isCurrentPlan
                    ? 'border-primary-700'
                    : isSelected
                      ? 'border-primary-600'
                      : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                {/* Badges */}
                <div className="flex gap-2 mb-4 min-h-6">
                  {isCurrentPlan && (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-700 border border-primary-700">
                      현재 플랜
                    </span>
                  )}
                  {plan.recommended && (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-accent-green text-white">
                      추천
                    </span>
                  )}
                </div>

                {/* Plan Info */}
                <h3 className="text-lg font-bold text-gray-900">{plan.name}</h3>
                <p className="text-xs text-gray-500 mt-1">
                  학생 {plan.maxStudents}명 · 교사 {plan.maxTeachers}명
                </p>
                <div className="mt-4 mb-5">
                  <span className="text-2xl font-bold text-gray-900">
                    {planPrice.toLocaleString('ko-KR')}원
                  </span>
                  <span className="text-sm text-gray-500 ml-1">
                    /{period === 'MONTHLY' ? '월' : '년'}
                  </span>
                </div>

                {/* Features */}
                <ul className="space-y-2 flex-1 mb-5">
                  {plan.features.map((feature) => (
                    <li key={feature.label} className="flex items-center gap-2 text-sm">
                      {feature.available ? (
                        <span className="text-accent-green font-bold flex-shrink-0">✓</span>
                      ) : (
                        <span className="text-gray-300 font-bold flex-shrink-0">✗</span>
                      )}
                      <span className={feature.available ? 'text-gray-700' : 'text-gray-400'}>
                        {feature.label}
                      </span>
                    </li>
                  ))}
                </ul>

                {/* CTA Button */}
                <button
                  onClick={() => handleSelectPlan(plan.type)}
                  disabled={isCurrentPlan}
                  className={`w-full py-2.5 rounded-lg text-sm font-medium transition-colors min-h-[44px] ${
                    isCurrentPlan
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : isSelected
                        ? 'bg-primary-700 text-white hover:bg-primary-800'
                        : 'border border-primary-700 text-primary-700 hover:bg-primary-100'
                  }`}
                >
                  {isCurrentPlan ? '현재 플랜' : isSelected ? '선택됨' : '선택'}
                </button>
              </div>
            )
          })}
        </div>
      </div>

      {/* Payment Section */}
      {selectedPlan && planConfig && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-5">선불 결제 안내</h2>

          {/* Selected Plan Summary */}
          <div className="flex items-center gap-4 p-4 bg-primary-100 rounded-xl mb-6">
            <div>
              <p className="text-sm font-medium text-primary-700">
                {planConfig.name} · {period === 'MONTHLY' ? '월간' : '연간'}
              </p>
              <p className="text-2xl font-bold text-primary-700 mt-0.5">
                {price.toLocaleString('ko-KR')}원
              </p>
            </div>
          </div>

          {/* Bank Account Info */}
          <div className="bg-gray-50 rounded-xl p-5 mb-5 border border-gray-200">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">입금 계좌 정보</h3>
            <dl className="space-y-2.5">
              <div className="flex gap-4">
                <dt className="text-sm text-gray-500 w-20 shrink-0">은행</dt>
                <dd className="text-sm font-medium text-gray-900">국민은행</dd>
              </div>
              <div className="flex gap-4">
                <dt className="text-sm text-gray-500 w-20 shrink-0">계좌번호</dt>
                <dd className="text-sm font-medium text-gray-900 font-mono tracking-wider">
                  123-456-789012
                </dd>
              </div>
              <div className="flex gap-4">
                <dt className="text-sm text-gray-500 w-20 shrink-0">예금주</dt>
                <dd className="text-sm font-medium text-gray-900">(주)에듀레벨</dd>
              </div>
              <div className="flex gap-4 pt-2 border-t border-gray-200">
                <dt className="text-sm text-gray-500 w-20 shrink-0">입금금액</dt>
                <dd className="text-sm font-bold text-primary-700">
                  {price.toLocaleString('ko-KR')}원
                </dd>
              </div>
            </dl>
          </div>

          <p className="text-sm text-gray-500 mb-5">
            입금 후 아래 버튼을 눌러 입금 완료를 알려주세요. 관리자 확인 후 구독이
            활성화됩니다.
          </p>

          {error && <p className="text-sm text-accent-red mb-4">{error}</p>}

          <div className="flex gap-3">
            <button
              onClick={handleSubmit}
              disabled={isPending}
              className="px-6 py-3 bg-primary-700 text-white rounded-lg text-sm font-medium hover:bg-primary-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-h-[44px]"
            >
              {isPending ? '처리 중...' : '입금 완료'}
            </button>
            <button
              onClick={() => setSelectedPlan(null)}
              disabled={isPending}
              className="px-6 py-3 border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors min-h-[44px]"
            >
              취소
            </button>
          </div>
        </div>
      )}

      {/* Success Message */}
      {submitted && (
        <div className="bg-accent-green-light border border-accent-green rounded-xl p-5">
          <p className="font-semibold text-green-800">입금 확인 요청이 접수되었습니다</p>
          <p className="text-sm text-green-700 mt-1">
            관리자 확인 후 구독이 활성화됩니다. 보통 1~2 영업일 내에 처리됩니다.
          </p>
        </div>
      )}
    </div>
  )
}
