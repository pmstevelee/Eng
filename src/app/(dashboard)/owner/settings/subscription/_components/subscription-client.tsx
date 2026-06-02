'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createPendingSubscription } from '../actions'

type Plan = 'FREE' | 'STARTER' | 'STANDARD' | 'PREMIUM'

interface PlanConfig {
  type: Plan
  name: string
  target: string
  monthlyPrice: number
  maxStudents: number | null  // null = 무제한
  maxTeachers: number | null
  recommended?: boolean
  badge?: string
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
    type: 'FREE',
    name: '무료',
    target: '도입 검토 중인 학원 · 1인 공부방',
    monthlyPrice: 0,
    maxStudents: 10,
    maxTeachers: 1,
  },
  {
    type: 'STARTER',
    name: '스타터',
    target: '1인 공부방 · 소형 교습소 (10~20명)',
    monthlyPrice: 19900,
    maxStudents: 20,
    maxTeachers: 2,
    badge: '신규 권장',
  },
  {
    type: 'STANDARD',
    name: '스탠다드',
    target: '중형 영어학원 (30~50명)',
    monthlyPrice: 49900,
    maxStudents: 50,
    maxTeachers: 5,
    recommended: true,
    badge: '가장 인기',
  },
  {
    type: 'PREMIUM',
    name: '프리미엄',
    target: '대형 학원 · 다지점 · 프랜차이즈 (50명+)',
    monthlyPrice: 129000,
    maxStudents: null,
    maxTeachers: null,
  },
]

const PLAN_ORDER: Plan[] = ['FREE', 'STARTER', 'STANDARD', 'PREMIUM']

function planRank(plan: Plan) {
  return PLAN_ORDER.indexOf(plan)
}

// 플랜별 핵심 기능 목록 (카드 내 표시용)
const PLAN_KEY_FEATURES: Record<Plan, string[]> = {
  FREE: [
    '학생 최대 10명 / 교사 1개',
    '레벨 테스트 학생당 1회 (재시험 불가)',
    '자작 문제뱅크 최대 100문항',
    '공용 문제뱅크 읽기 전용 (450+ 문항)',
    '단원 테스트 월 3회',
    'AI 쓰기 평가 월 5회 맛보기',
    'AI 문제 생성 월 3회 맛보기',
    '스토리지 1GB / 데이터 30일 보관',
  ],
  STARTER: [
    '학생 최대 20명 / 교사 2개',
    '적응형 레벨 테스트 무제한',
    '자작 문제뱅크 무제한',
    '공용 문제뱅크 읽기 전용 (16000+ 문항)',
    '단원 테스트 무제한',
    'AI 쓰기 평가 월 50회 (초과 1회당 60원)',
    'AI 문제 생성 월 30회 (초과 1회당 100원)',
    '스토리지 10GB / 데이터 1년 보관',
  ],
  STANDARD: [
    '학생 최대 50명 / 교사 5개',
    '레벨 테스트 무제한',
    '자작 문제뱅크 무제한',
    '공용 문제뱅크 전체 사용',
    '단원 테스트 무제한',
    'AI 쓰기 평가 월 200회 (초과 1회당 50원)',
    'AI 문제 생성 월 100회 (초과 1회당 80원)',
    '스토리지 50GB / 데이터 3년 보관',
  ],
  PREMIUM: [
    '학생 무제한 / 교사 무제한',
    'Standard 모든 기능 포함',
    'AI 쓰기 평가 월 1,000회',
    'AI 문제 생성 월 500회',
    '다지점/분원 통합 관리 대시보드',
    '학부모 알림톡 월 2,000건',
    '우선 기능 요청권 + 신기능 베타 참여',
    'AI 초과 사용 별도 협의 (대량 할인)',
    '스토리지 500GB / 데이터 무제한 보관',
  ],
}

// 기능 비교 표 데이터
type CompareRow = [string, string, string, string, string]

const COMPARE_ROWS: CompareRow[] = [
  ['학생 수',           '최대 10명',    '최대 20명',    '최대 50명',        '무제한'],
  ['교사 계정',         '1개',          '2개',          '5개',              '무제한'],
  ['레벨 테스트',       '1회/학생',     '무제한',       '무제한+자동',      '무제한+자동'],
  ['자작 문제뱅크',     '100문항',      '무제한',       '무제한',           '무제한'],
  ['공용 문제뱅크',     '읽기 전용',    '읽기 전용',    '전체+기여',        '전체+기여'],
  ['단원 테스트',       '월 3회',       '무제한',       '무제한+자동',      '무제한+자동'],
  ['AI 쓰기 평가',      '월 5회',       '월 50회',      '월 200회',         '월 1,000회'],
  ['AI 문제 생성',      '월 3회',       '월 30회',      '월 100회',         '월 500회'],
  ['AI 유사문제',       '—',            '—',            '✓',                '✓'],
  ['AI 약점 분석',      '요약만',       '상세',         '상세+반별 비교',   '상세+반별 비교'],
  ['고급 분석',         '—',            '—',            '✓',                '✓'],
  ['PDF 리포트',        '월 5회',       '무제한(3종)',   '무제한(8종+로고)', '무제한(8종+로고)'],
  ['학부모 알림톡',     '—',            '월 100건',     '월 500건+자동',    '월 2,000건'],
  ['다지점 통합',       '—',            '—',            '—',                '✓'],
  ['화이트라벨',        '—',            '—',            '—',                '✓'],
  ['스토리지',          '1GB',          '10GB',         '50GB',             '500GB'],
  ['데이터 보관',       '30일',         '1년',          '3년',              '무제한'],
]

export function SubscriptionClient({ currentPlan, academyName, pendingSubscription }: Props) {
  const router = useRouter()
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null)
  const [isPending, startTransition] = useTransition()
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const planConfig = PLANS.find((p) => p.type === selectedPlan)
  const price =
    selectedPlan && planConfig && planConfig.type !== 'FREE' && planConfig.type !== 'STARTER'
      ? planConfig.monthlyPrice
      : 0

  function handleSelectPlan(plan: Plan) {
    if (plan === currentPlan || plan === 'FREE') return
    if (plan === 'STARTER') {
      // 스타터는 카드 결제 페이지로 이동
      router.push('/owner/billing/plans')
      return
    }
    setSelectedPlan(plan === selectedPlan ? null : plan)
    setSubmitted(false)
    setError(null)
  }

  function handleSubmit() {
    if (!selectedPlan || selectedPlan === 'FREE' || selectedPlan === 'STARTER') return
    setError(null)
    startTransition(async () => {
      const result = await createPendingSubscription(
        selectedPlan as 'STANDARD' | 'PREMIUM',
        'MONTHLY',
      )
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
        </div>

        {/* 플랜 카드 */}
        <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
          {PLANS.map((plan) => {
            const isCurrentPlan = plan.type === currentPlan
            const isSelected = plan.type === selectedPlan
            const isFree = plan.type === 'FREE'
            const isUpgrade = planRank(plan.type) > currentRank
            const isDowngrade = planRank(plan.type) < currentRank
            const planPrice = plan.monthlyPrice

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
                <div className="flex gap-2 mb-3 min-h-6 flex-wrap">
                  {isCurrentPlan && (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#1865F2] text-white">
                      현재
                    </span>
                  )}
                  {plan.badge && !isCurrentPlan && (
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold text-white ${
                      plan.recommended ? 'bg-[#1865F2]' : 'bg-[#1FAF54]'
                    }`}>
                      {plan.badge}
                    </span>
                  )}
                </div>

                {/* 플랜 정보 */}
                <h3 className="text-base font-bold text-gray-900">{plan.name}</h3>
                <p className="text-xs text-gray-400 mt-0.5 mb-3 leading-relaxed">{plan.target}</p>

                {/* 가격 */}
                <div className="mb-1">
                  {isFree ? (
                    <span className="text-2xl font-bold text-gray-900">무료</span>
                  ) : (
                    <>
                      <span className="text-2xl font-bold text-gray-900">
                        {planPrice.toLocaleString('ko-KR')}원
                      </span>
                      <span className="text-sm text-gray-500 ml-1">
                        /월
                      </span>
                    </>
                  )}
                </div>
                <div className="mb-4" />

                {/* 핵심 기능 */}
                <ul className="space-y-1.5 flex-1 mb-5">
                  {PLAN_KEY_FEATURES[plan.type].map((feature) => (
                    <li key={feature} className="flex items-start gap-1.5 text-xs text-gray-700">
                      <span className="text-[#1FAF54] font-bold flex-shrink-0 mt-0.5">✓</span>
                      {feature}
                    </li>
                  ))}
                </ul>

                {/* CTA 버튼 */}
                {isFree ? (
                  <button
                    disabled
                    className="w-full py-2.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-400 cursor-not-allowed min-h-[44px]"
                  >
                    {isCurrentPlan ? '현재 플랜' : '무료 플랜'}
                  </button>
                ) : plan.type === 'STARTER' ? (
                  <button
                    onClick={() => handleSelectPlan('STARTER')}
                    disabled={isCurrentPlan}
                    className={`w-full py-2.5 rounded-lg text-sm font-medium transition-colors min-h-[44px] ${
                      isCurrentPlan
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'border border-[#1FAF54] text-[#1FAF54] hover:bg-green-50'
                    }`}
                  >
                    {isCurrentPlan ? '현재 플랜' : '카드 결제로 신청 →'}
                  </button>
                ) : (
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
                          ? '선택됨 ✓'
                          : isUpgrade
                            ? '업그레이드'
                            : '다운그레이드'}
                  </button>
                )}
              </div>
            )
          })}
        </div>

        {/* 기능 비교 표 */}
        <div className="border border-gray-200 rounded-xl overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/4">
                  기능
                </th>
                {PLANS.map((plan) => (
                  <th
                    key={plan.type}
                    className={`px-3 py-3 text-center text-xs font-semibold uppercase tracking-wider ${
                      plan.type === currentPlan ? 'text-[#1865F2]' : 'text-gray-500'
                    }`}
                  >
                    {plan.name}
                    {plan.type === currentPlan && (
                      <span className="ml-1 normal-case text-[10px] bg-[#1865F2] text-white px-1.5 py-0.5 rounded-full">
                        현재
                      </span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {COMPARE_ROWS.map(([feature, free, starter, standard, premium], i) => (
                <tr key={feature} className={`hover:bg-gray-50/50 ${i % 2 === 1 ? 'bg-gray-50/30' : ''}`}>
                  <td className="px-5 py-3 text-gray-700 text-xs font-medium">{feature}</td>
                  {([free, starter, standard, premium] as [string, string, string, string]).map((val, j) => {
                    const planType = PLANS[j].type
                    const isCurrent = planType === currentPlan
                    return (
                      <td
                        key={planType}
                        className={`px-3 py-3 text-center text-xs ${
                          isCurrent ? 'text-[#1865F2] font-semibold' : 'text-gray-600'
                        }`}
                      >
                        {val === '✓' ? (
                          <span className="text-[#1FAF54] font-bold text-sm">✓</span>
                        ) : val === '—' ? (
                          <span className="text-gray-300">—</span>
                        ) : (
                          val
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">
          부가세 별도 · 언제든지 플랜 변경 가능
        </p>
      </div>

      {/* 결제 섹션 */}
      {selectedPlan && selectedPlan !== 'FREE' && planConfig && !pendingSubscription && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-5">선불 결제 안내</h2>

          {/* 선택한 플랜 요약 */}
          <div className="flex items-center gap-4 p-4 bg-blue-50 rounded-xl border border-blue-100 mb-6">
            <div>
              <p className="text-sm font-medium text-[#1865F2]">
                {planConfig.name} · 월간
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
