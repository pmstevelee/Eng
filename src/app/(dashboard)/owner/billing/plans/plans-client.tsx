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
      { text: 'AI 약점 분석 요약본만', included: true },
      { text: '기본 PDF 리포트 (월 5회 제한)', included: true },
      { text: '게임화/XP/스트릭 기본 기능', included: true },
      { text: '스토리지 1GB / 데이터 30일 보관', included: true },
      { text: '학부모 알림톡', included: false },
      { text: 'AI 유사문제 생성 (오답 기반)', included: false },
      { text: '고급 분석 대시보드', included: false },
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
      { text: '공용 문제뱅크 읽기 전용 (450+ 문항)', included: true },
      { text: '단원 테스트 무제한', included: true },
      { text: 'AI 쓰기 평가 월 50회 (초과 60원/회)', included: true },
      { text: 'AI 문제 생성 월 30회 (초과 100원/회)', included: true },
      { text: 'AI 약점 분석 상세', included: true },
      { text: 'PDF 리포트 무제한 · 템플릿 3종', included: true },
      { text: '학부모 알림톡 월 100건', included: true },
      { text: '게임화/XP/스트릭 전체 기능', included: true },
      { text: '공용 음원 라이브러리 사용', included: true },
      { text: '스토리지 10GB / 데이터 1년 보관', included: true },
      { text: 'AI 유사문제 생성 (오답 기반)', included: false },
      { text: '고급 분석 대시보드', included: false },
    ],
  },
  STANDARD: {
    name: '스탠다드',
    target: '중형 영어학원 (30~50명)',
    badge: '가장 인기',
    isRecommended: true,
    features: [
      { text: '학생 최대 50명 / 교사 5개', included: true },
      { text: '레벨 테스트 무제한 + 정기 자동 스케줄', included: true },
      { text: '자작 문제뱅크 무제한', included: true },
      { text: '공용 문제뱅크 전체 사용 + 기여 가능', included: true },
      { text: '단원 테스트 무제한 + 자동 출제', included: true },
      { text: 'AI 쓰기 평가 월 200회 (초과 50원/회)', included: true },
      { text: 'AI 문제 생성 월 100회 (초과 80원/회)', included: true },
      { text: 'AI 유사문제 생성 (오답 기반)', included: true },
      { text: 'AI 약점 분석 상세 + 반별 비교', included: true },
      { text: '고급 분석 대시보드 (성장률·영역별·반별)', included: true },
      { text: 'PDF 리포트 무제한 · 템플릿 8종 · 로고 커스텀', included: true },
      { text: '학부모 알림톡 월 500건 + 주간/월간 자동 발송', included: true },
      { text: '듣기 풀 라이브러리 + 자동 채점', included: true },
      { text: 'AI 추천 커리큘럼 (학생별)', included: true },
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
      { text: 'AI 쓰기 평가 월 1,000회 (공정 사용 정책)', included: true },
      { text: 'AI 문제 생성 월 500회 (공정 사용 정책)', included: true },
      { text: '다지점/분원 통합 관리 대시보드', included: true },
      { text: '학부모 알림톡 월 2,000건', included: true },
      { text: '화이트라벨 (학원 자체 브랜드)', included: true },
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
              description={meta.target}
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
