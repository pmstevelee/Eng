import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma/client'
import { PLANS, PLAN_DISPLAY_NAMES, BILLING_CYCLE_DISPLAY_NAMES } from '@/lib/pricing'
import { UsageWidget } from '@/components/billing/UsageWidget'
import { BillingActions } from '@/components/billing/BillingActions'
import {
  CreditCard,
  Zap,
  ChevronRight,
  Calendar,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react'
import type { Plan, BillingCycle, SubscriptionStatus } from '@/generated/prisma'

const STATUS_LABELS: Record<SubscriptionStatus, { label: string; color: string }> = {
  TRIAL: { label: '무료 체험', color: 'text-[#1865F2] bg-blue-50' },
  ACTIVE: { label: '이용 중', color: 'text-[#1FAF54] bg-green-50' },
  PAST_DUE: { label: '결제 미납', color: 'text-[#D92916] bg-red-50' },
  CANCELLED: { label: '해지됨', color: 'text-gray-500 bg-gray-100' },
  CANCELED: { label: '해지됨', color: 'text-gray-500 bg-gray-100' },
  EXPIRED: { label: '만료됨', color: 'text-gray-500 bg-gray-100' },
}

export default async function BillingPage() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ACADEMY_OWNER') redirect('/login')
  if (!user.academyId) redirect('/owner/settings')

  const subscription = await prisma.subscription.findUnique({
    where: { academyId: user.academyId },
    include: { billingKey: true },
  })

  // AiCredit 잔여 집계
  const now = new Date()
  const creditTotals = await prisma.aiCredit.groupBy({
    by: ['type'],
    where: {
      academyId: user.academyId,
      amount: { gt: 0 },
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    _sum: { amount: true },
  })

  const writingCredits = creditTotals.find((c) => c.type === 'WRITING')?._sum.amount ?? 0
  const questionCredits = creditTotals.find((c) => c.type === 'QUESTION')?._sum.amount ?? 0

  // 가장 빨리 만료되는 크레딧
  const earliestCredit = await prisma.aiCredit.findFirst({
    where: {
      academyId: user.academyId,
      amount: { gt: 0 },
      expiresAt: { not: null, gt: now },
    },
    orderBy: { expiresAt: 'asc' },
    select: { expiresAt: true },
  })

  if (!subscription) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="mb-8 text-2xl font-bold text-gray-900">결제 관리</h1>
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
          <p className="mb-4 text-gray-500">구독 정보가 없습니다.</p>
          <Link
            href="/owner/billing/plans"
            className="inline-flex items-center gap-2 rounded-lg bg-[#1865F2] px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            요금제 선택하기
          </Link>
        </div>
      </div>
    )
  }

  const plan = subscription.plan as Plan
  const cycle = subscription.billingCycle as BillingCycle
  const status = subscription.status as SubscriptionStatus
  const planConfig = PLANS[plan]
  const planPrice = cycle === 'YEARLY' ? planConfig.yearlyPrice : planConfig.monthlyPrice
  const statusInfo = STATUS_LABELS[status] ?? { label: status, color: 'text-gray-500 bg-gray-100' }

  const renewalDate = subscription.currentPeriodEnd.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const daysUntilRenewal = Math.max(
    0,
    Math.floor(
      (subscription.currentPeriodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    ),
  )

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">결제 관리</h1>
        <Link
          href="/owner/billing/history"
          className="flex items-center gap-1.5 text-sm text-[#1865F2] hover:underline"
        >
          결제 내역
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>

      {/* 현재 플랜 */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">현재 플랜</h2>
            <p className="text-sm text-gray-500">
              {PLAN_DISPLAY_NAMES[plan]} · {BILLING_CYCLE_DISPLAY_NAMES[cycle]}
            </p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${statusInfo.color}`}
          >
            {statusInfo.label}
          </span>
        </div>

        <div className="flex items-baseline gap-1 mb-4">
          <span className="text-3xl font-bold text-gray-900">
            {planPrice.toLocaleString('ko-KR')}원
          </span>
          <span className="text-sm text-gray-500">/{cycle === 'YEARLY' ? '년' : '월'}</span>
        </div>

        <div className="flex items-center gap-2 text-sm">
          <Calendar className="h-4 w-4 text-gray-400" />
          {subscription.cancelAtPeriodEnd ? (
            <span className="text-[#D92916]">
              {renewalDate} 해지 예정
            </span>
          ) : (
            <span className="text-gray-600">
              {renewalDate} 갱신 예정
              {daysUntilRenewal <= 7 && (
                <span className="ml-1 text-[#FFB100]">({daysUntilRenewal}일 후)</span>
              )}
            </span>
          )}
        </div>

        {status === 'PAST_DUE' && (
          <div className="mt-4 flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-[#D92916]">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            결제가 실패했습니다. 결제 수단을 확인하고 다시 시도해 주세요.
          </div>
        )}

        {subscription.cancelAtPeriodEnd && (
          <div className="mt-4 flex items-center gap-2 rounded-lg bg-yellow-50 p-3 text-sm text-[#FFB100]">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            구독 해지가 예약되었습니다. {renewalDate}까지 이용하실 수 있습니다.
          </div>
        )}
      </div>

      {/* 결제 수단 */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-bold text-gray-900">결제 수단</h2>
        {subscription.billingKey ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100">
                <CreditCard className="h-5 w-5 text-gray-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">
                  {subscription.billingKey.cardCompany ?? '카드'}
                </p>
                <p className="text-sm text-gray-500">
                  {subscription.billingKey.cardNumberMasked
                    ? `**** **** **** ${subscription.billingKey.cardNumberMasked.slice(-4)}`
                    : '카드번호 미공개'}
                </p>
              </div>
            </div>
            <Link
              href="/owner/billing/plans"
              className="text-sm text-[#1865F2] hover:underline"
            >
              결제 수단 변경
            </Link>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">등록된 결제 수단이 없습니다.</p>
            <Link
              href="/owner/billing/plans"
              className="text-sm font-medium text-[#1865F2] hover:underline"
            >
              카드 등록
            </Link>
          </div>
        )}
      </div>

      {/* 이번 달 사용량 */}
      <div>
        <h2 className="mb-3 text-lg font-bold text-gray-900">이번 달 사용량</h2>
        <UsageWidget />
      </div>

      {/* 보유 크레딧 */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">보유 AI 크레딧</h2>
          <Link
            href="/owner/billing/credits"
            className="flex items-center gap-1 text-sm font-medium text-[#7854F7] hover:underline"
          >
            <Zap className="h-4 w-4" />
            크레딧 충전
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-lg bg-purple-50 p-4">
            <p className="text-xs font-medium text-[#7854F7] mb-1">AI 쓰기 평가</p>
            <p className="text-2xl font-bold text-gray-900">
              {writingCredits.toLocaleString()}
              <span className="ml-1 text-sm font-normal text-gray-500">회</span>
            </p>
          </div>
          <div className="rounded-lg bg-purple-50 p-4">
            <p className="text-xs font-medium text-[#7854F7] mb-1">AI 문제 생성</p>
            <p className="text-2xl font-bold text-gray-900">
              {questionCredits.toLocaleString()}
              <span className="ml-1 text-sm font-normal text-gray-500">회</span>
            </p>
          </div>
        </div>

        {earliestCredit?.expiresAt && (
          <p className="mt-3 flex items-center gap-1.5 text-xs text-gray-500">
            <CheckCircle className="h-3.5 w-3.5 text-[#1FAF54]" />
            가장 빨리 만료되는 크레딧:{' '}
            {earliestCredit.expiresAt.toLocaleDateString('ko-KR')}
          </p>
        )}

        {writingCredits === 0 && questionCredits === 0 && (
          <p className="mt-3 text-sm text-gray-400">보유 크레딧이 없습니다.</p>
        )}
      </div>

      {/* 액션 버튼 */}
      <BillingActions
        currentPlan={plan}
        currentCycle={cycle}
        status={status}
        cancelAtPeriodEnd={subscription.cancelAtPeriodEnd}
      />
    </div>
  )
}
