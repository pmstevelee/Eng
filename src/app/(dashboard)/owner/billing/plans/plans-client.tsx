'use client'

import { useRouter } from 'next/navigation'
import { PlanCard } from '@/components/billing/PlanCard'
import type { PlanFeature } from '@/components/billing/PlanCard'
import { PLANS } from '@/lib/pricing'
import type { Plan } from '@/generated/prisma'

const PLAN_METADATA: Record<
  Plan,
  {
    name: string
    target: string
    badge?: string
    isRecommended: boolean
    features: PlanFeature[]
  }
> = {
  FREE: {
    name: '무료',
    target: '도입 검토 중인 학원 · 1인 공부방',
    isRecommended: false,
    features: [
      { text: '학생 최대 10명 / 교사 1개', included: true },
      { text: '레벨 테스트 학생당 1회 (재시험 불가)', included: true },
      { text: '자작 문제뱅크 최대 100문항', included: true },
      { text: '공용 문제뱅크 읽기 전용 (450+ 문항)', included: true },
      { text: '단원 테스트 월 3회', included: true },
      { text: 'AI 쓰기 평가 월 5회 맛보기', included: true },
      { text: 'AI 문제 생성 월 3회 맛보기', included: true },
      { text: '스토리지 1GB / 데이터 30일 보관', included: true },
    ],
  },
  STARTER: {
    name: '스타터',
    target: '1인 공부방 · 소형 교습소 (10~20명)',
    isRecommended: false,
    badge: '신규 권장',
    features: [
      { text: '학생 최대 20명 / 교사 2개', included: true },
      { text: '적응형 레벨 테스트 무제한', included: true },
      { text: '자작 문제뱅크 무제한', included: true },
      { text: '공용 문제뱅크 읽기 전용 (16000+ 문항)', included: true },
      { text: '단원 테스트 무제한', included: true },
      { text: 'AI 쓰기 평가 월 50회 (초과 1회당 60원)', included: true },
      { text: 'AI 문제 생성 월 30회 (초과 1회당 100원)', included: true },
      { text: '스토리지 10GB / 데이터 1년 보관', included: true },
    ],
  },
  STANDARD: {
    name: '스탠다드',
    target: '중형 영어학원 (30~50명)',
    badge: '가장 인기',
    isRecommended: true,
    features: [
      { text: '학생 최대 50명 / 교사 5개', included: true },
      { text: '레벨 테스트 무제한', included: true },
      { text: '자작 문제뱅크 무제한', included: true },
      { text: '공용 문제뱅크 전체 사용', included: true },
      { text: '단원 테스트 무제한', included: true },
      { text: 'AI 쓰기 평가 월 200회 (초과 1회당 50원)', included: true },
      { text: 'AI 문제 생성 월 100회 (초과 1회당 80원)', included: true },
      { text: '스토리지 50GB / 데이터 3년 보관', included: true },
    ],
  },
  PREMIUM: {
    name: '프리미엄',
    target: '대형 학원 · 다지점 · 프랜차이즈 (50명+)',
    isRecommended: false,
    features: [
      { text: '학생 무제한 / 교사 무제한', included: true },
      { text: 'Standard 모든 기능 포함', included: true },
      { text: 'AI 쓰기 평가 월 1,000회', included: true },
      { text: 'AI 문제 생성 월 500회', included: true },
      { text: '다지점/분원 통합 관리 대시보드', included: true },
      { text: '학부모 알림톡 월 2,000건', included: true },
      { text: '우선 기능 요청권 + 신기능 베타 참여', included: true },
      { text: 'AI 초과 사용 별도 협의 (대량 할인)', included: true },
      { text: '스토리지 500GB / 데이터 무제한 보관', included: true },
    ],
  },
}

const PLAN_ORDER: Plan[] = ['FREE', 'STARTER', 'STANDARD', 'PREMIUM']

interface PlansClientProps {
  currentPlan: Plan
}

export function PlansClient({ currentPlan }: PlansClientProps) {
  const router = useRouter()

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

    router.push(`/owner/billing/checkout?plan=${plan}&cycle=MONTHLY`)
  }

  return (
    <div className="flex flex-col gap-8">
      {/* 헤더 */}
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900">요금제 선택</h1>
        <p className="mt-2 text-gray-500">학원 규모에 맞는 플랜을 선택하세요</p>
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
              description={meta.target}
              price={config.monthlyPrice}
              yearlyPrice={null}
              isYearly={false}
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
