'use client'

import { useState, useTransition } from 'react'
import { createPendingSubscription } from '../actions'

type Plan = 'BASIC' | 'STANDARD' | 'PREMIUM'
type Period = 'MONTHLY' | 'YEARLY'

interface PlanFeature {
  label: string
  basic: boolean
  standard: boolean
  premium: boolean
}

interface PlanConfig {
  type: Plan
  name: string
  monthlyPrice: number
  yearlyPrice: number
  maxStudents: number | null
  maxTeachers: number | null
  recommended?: boolean
}

interface PendingSubscription {
  plan: string
  period: string
  amount: number
  createdAt: string
}

interface Props {
  currentPlan: Plan
  academyName: string
  pendingSubscription?: PendingSubscription
}

const PLANS: PlanConfig[] = [
  {
    type: 'BASIC',
    name: '베이직',
    monthlyPrice: 300000,
    yearlyPrice: 3000000,
    maxStudents: 50,
    maxTeachers: 3,
  },
  {
    type: 'STANDARD',
    name: '스탠다드',
    monthlyPrice: 500000,
    yearlyPrice: 5000000,
    maxStudents: 150,
    maxTeachers: 5,
    recommended: true,
  },
  {
    type: 'PREMIUM',
    name: '프리미엄',
    monthlyPrice: 800000,
    yearlyPrice: 8000000,
    maxStudents: null,
    maxTeachers: null,
  },
]

const FEATURES: PlanFeature[] = [
  { label: 'AI 분석', basic: false, standard: true, premium: true },
  { label: 'PDF 리포트', basic: false, standard: true, premium: true },
  { label: '적응형 학습', basic: false, standard: true, premium: true },
  { label: '전담 지원', basic: false, standard: false, premium: true },
]

const PLAN_ORDER: Plan[] = ['BASIC', 'STANDARD', 'PREMIUM']

function planRank(plan: Plan) {
  return PLAN_ORDER.indexOf(plan)
}

function featureAvailable(feature: PlanFeature, plan: Plan): boolean {
  if (plan === 'BASIC') return feature.basic
  if (plan === 'STANDARD') return feature.standard
  return feature.premium
}

export function SubscriptionClient({ currentPlan, academyName, pendingSubscription }: Props) {
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

  const currentRank = planRank(currentPlan)

  return (
    <div className="space-y-6" id="plan-comparison">
      {/* 요금제 비교 */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <h2 className="text-base font-semibold text-gray-900">요금제 비교</h2>

          {/* 기간 토글 */}
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
              <span className="text-xs bg-[#1FAF54] text-white px-1.5 py-0.5 rounded-full leading-none">
                17% 절약
              </span>
            </button>
          </div>
        </div>

        {/* 플랜 카드 */}
        <div className="grid sm:grid-cols-3 gap-4 mb-8">
          {PLANS.map((plan) => {
            const isCurrentPlan = plan.type === currentPlan
            const isSelected = plan.type === selectedPlan
            const isUpgrade = planRank(plan.type) > currentRank
            const isDowngrade = planRank(plan.type) < currentRank
            const planPrice = period === 'MONTHLY' ? plan.monthlyPrice : plan.yearlyPrice

            return (
              <div
                key={plan.type}
                className={`relative rounded-xl border-2 p-5 flex flex-col transition-all ${
                  isCurrentPlan
                    ? 'border-[#1865F2] bg-blue-50/30'
                    : isSelected
                      ? 'border-[#1865F2]'
                      : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                {/* 배지 */}
                <div className="flex gap-2 mb-4 min-h-6 flex-wrap">
                  {isCurrentPlan && (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#1865F2] text-white">
                      현재
                    </span>
                  )}
                  {plan.recommended && !isCurrentPlan && (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#1FAF54] text-white">
                      추천
                    </span>
                  )}
                </div>

                {/* 플랜 정보 */}
                <h3 className="text-lg font-bold text-gray-900">{plan.name}</h3>
                <p className="text-xs text-gray-500 mt-1">
                  학생{' '}
                  {plan.maxStudents !== null ? `${plan.maxStudents}명` : '무제한'}
                  {' '}· 교사{' '}
                  {plan.maxTeachers !== null ? `${plan.maxTeachers}명` : '무제한'}
                </p>

                <div className="mt-4 mb-1">
                  <span className="text-2xl font-bold text-gray-900">
                    {planPrice.toLocaleString('ko-KR')}원
                  </span>
                  <span className="text-sm text-gray-500 ml-1">
                    /{period === 'MONTHLY' ? '월' : '년'}
                  </span>
                </div>
                {period === 'YEARLY' && (
                  <p className="text-xs text-gray-400 mb-4">
                    월 {Math.round(planPrice / 12).toLocaleString('ko-KR')}원
                  </p>
                )}
                {period === 'MONTHLY' && <div className="mb-4" />}

                {/* 기능 목록 */}
                <ul className="space-y-2.5 flex-1 mb-5">
                  {FEATURES.map((feature) => {
                    const available = featureAvailable(feature, plan.type)
                    return (
                      <li key={feature.label} className="flex items-center gap-2 text-sm">
                        {available ? (
                          <span className="text-[#1FAF54] font-bold flex-shrink-0 text-base leading-none">
                            ✓
                          </span>
                        ) : (
                          <span className="text-gray-300 font-bold flex-shrink-0 text-base leading-none">
                            ✗
                          </span>
                        )}
                        <span className={available ? 'text-gray-700' : 'text-gray-400'}>
                          {feature.label}
                        </span>
                      </li>
                    )
                  })}
                </ul>

                {/* CTA 버튼 */}
                <button
                  onClick={() => handleSelectPlan(plan.type)}
                  disabled={isCurrentPlan || !!pendingSubscription}
                  className={`w-full py-2.5 rounded-lg text-sm font-medium transition-colors min-h-[44px] ${
                    isCurrentPlan
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : pendingSubscription
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : isSelected
                          ? 'bg-[#1865F2] text-white hover:bg-blue-700'
                          : isUpgrade
                            ? 'border border-[#1865F2] text-[#1865F2] hover:bg-blue-50'
                            : isDowngrade
                              ? 'border border-gray-300 text-gray-600 hover:bg-gray-50'
                              : 'border border-gray-200 text-gray-500'
                  }`}
                >
                  {isCurrentPlan
                    ? '현재 플랜'
                    : pendingSubscription
                      ? '처리 대기중'
                      : isSelected
                        ? '선택됨'
                        : isUpgrade
                          ? '업그레이드'
                          : '변경'}
                </button>
              </div>
            )
          })}
        </div>

        {/* 기능 비교 표 */}
        <div className="border border-gray-200 rounded-xl overflow-x-auto">
          <table className="w-full text-sm min-w-[480px]">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/4">
                  기능
                </th>
                {PLANS.map((plan) => (
                  <th
                    key={plan.type}
                    className={`px-4 py-3 text-center text-xs font-medium uppercase tracking-wider ${
                      plan.type === currentPlan ? 'text-[#1865F2]' : 'text-gray-500'
                    }`}
                  >
                    {plan.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              <tr className="hover:bg-gray-50/50">
                <td className="px-5 py-3 text-gray-700">월 요금</td>
                {PLANS.map((plan) => (
                  <td key={plan.type} className="px-4 py-3 text-center font-medium text-gray-900">
                    {plan.monthlyPrice.toLocaleString('ko-KR')}원
                  </td>
                ))}
              </tr>
              <tr className="hover:bg-gray-50/50">
                <td className="px-5 py-3 text-gray-700">연 요금</td>
                {PLANS.map((plan) => (
                  <td key={plan.type} className="px-4 py-3 text-center font-medium text-gray-900">
                    {plan.yearlyPrice.toLocaleString('ko-KR')}원
                  </td>
                ))}
              </tr>
              <tr className="hover:bg-gray-50/50">
                <td className="px-5 py-3 text-gray-700">학생 수</td>
                {PLANS.map((plan) => (
                  <td key={plan.type} className="px-4 py-3 text-center text-gray-700">
                    {plan.maxStudents !== null ? `${plan.maxStudents}명` : '무제한'}
                  </td>
                ))}
              </tr>
              <tr className="hover:bg-gray-50/50">
                <td className="px-5 py-3 text-gray-700">교사 수</td>
                {PLANS.map((plan) => (
                  <td key={plan.type} className="px-4 py-3 text-center text-gray-700">
                    {plan.maxTeachers !== null ? `${plan.maxTeachers}명` : '무제한'}
                  </td>
                ))}
              </tr>
              {FEATURES.map((feature) => (
                <tr key={feature.label} className="hover:bg-gray-50/50">
                  <td className="px-5 py-3 text-gray-700">{feature.label}</td>
                  {PLANS.map((plan) => {
                    const available = featureAvailable(feature, plan.type)
                    return (
                      <td key={plan.type} className="px-4 py-3 text-center">
                        {available ? (
                          <span className="text-[#1FAF54] font-bold text-base">✓</span>
                        ) : (
                          <span className="text-gray-300 font-bold text-base">✗</span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 결제 섹션 */}
      {selectedPlan && planConfig && !pendingSubscription && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-5">선불 결제 안내</h2>

          {/* 선택한 플랜 요약 */}
          <div className="flex items-center gap-4 p-4 bg-blue-50 rounded-xl border border-blue-100 mb-6">
            <div>
              <p className="text-sm font-medium text-[#1865F2]">
                {planConfig.name} · {period === 'MONTHLY' ? '월간' : '연간'}
              </p>
              <p className="text-2xl font-bold text-[#1865F2] mt-0.5">
                {price.toLocaleString('ko-KR')}원
              </p>
            </div>
          </div>

          {/* 계좌 안내 */}
          <div className="bg-gray-50 rounded-xl p-5 mb-5 border border-gray-200">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">입금 계좌 정보</h3>
            <dl className="space-y-3">
              <div className="flex gap-4">
                <dt className="text-sm text-gray-500 w-24 shrink-0">은행</dt>
                <dd className="text-sm font-medium text-gray-900">국민은행</dd>
              </div>
              <div className="flex gap-4">
                <dt className="text-sm text-gray-500 w-24 shrink-0">계좌번호</dt>
                <dd className="text-sm font-medium text-gray-900 font-mono tracking-wider">
                  123-456-789012
                </dd>
              </div>
              <div className="flex gap-4">
                <dt className="text-sm text-gray-500 w-24 shrink-0">예금주</dt>
                <dd className="text-sm font-medium text-gray-900">(주)에듀레벨</dd>
              </div>
              <div className="flex gap-4 pt-3 border-t border-gray-200">
                <dt className="text-sm text-gray-500 w-24 shrink-0">입금자명</dt>
                <dd className="text-sm font-semibold text-[#1865F2]">{academyName}</dd>
              </div>
              <div className="flex gap-4">
                <dt className="text-sm text-gray-500 w-24 shrink-0">입금 금액</dt>
                <dd className="text-sm font-bold text-[#1865F2]">
                  {price.toLocaleString('ko-KR')}원
                </dd>
              </div>
            </dl>
          </div>

          <div className="flex items-start gap-2 p-3 bg-yellow-50 rounded-lg border border-yellow-200 mb-5">
            <span className="text-sm">💡</span>
            <p className="text-sm text-amber-800">
              입금자명을 <strong>{academyName}</strong>으로 정확히 기재해 주세요.
              입금 후 아래 버튼을 눌러 입금 완료를 알려주시면 1~2 영업일 내에 구독이 활성화됩니다.
            </p>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 rounded-lg border border-red-200 mb-4">
              <span className="text-sm">⚠️</span>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleSubmit}
              disabled={isPending}
              className="px-6 py-3 bg-[#1865F2] text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-h-[44px]"
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

      {/* 성공 메시지 */}
      {submitted && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-5 flex items-start gap-3">
          <span className="text-lg mt-0.5">✅</span>
          <div>
            <p className="font-semibold text-green-800">입금 확인 요청이 접수되었습니다</p>
            <p className="text-sm text-green-700 mt-1">
              관리자 확인 후 구독이 활성화됩니다. 보통 1~2 영업일 내에 처리됩니다.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
