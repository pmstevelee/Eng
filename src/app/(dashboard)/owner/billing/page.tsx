import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma/client'
import { PLANS, PLAN_DISPLAY_NAMES, BILLING_CYCLE_DISPLAY_NAMES } from '@/lib/pricing'
import { BillingActions } from '@/components/billing/BillingActions'
import { CREDIT_ITEM_LABEL, CREDIT_ITEM_UNIT, estimateSendable, formatCredits } from '@/lib/credits/constants'
import { getCreditPricing, getWallet, walletAcademyIdOf } from '@/lib/credits/wallet'
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

  // 통합 크레딧 잔액 (본원 지갑)
  const now = new Date()
  const [wallet, pricing] = await Promise.all([
    walletAcademyIdOf(user.academyId).then(getWallet),
    getCreditPricing(),
  ])

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

      {/* 통합 크레딧 */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">크레딧</h2>
            <p className="text-sm text-gray-500">AI 기능과 학부모 알림에 함께 쓰는 통합 크레딧</p>
          </div>
          <Link
            href="/owner/credits"
            className="flex items-center gap-1 text-sm font-medium text-[#7854F7] hover:underline"
          >
            <Zap className="h-4 w-4" />
            충전·내역
          </Link>
        </div>

        <p className="text-3xl font-bold text-gray-900">
          {formatCredits(wallet.balance)}
          <span className="ml-1 text-base font-medium text-gray-500">크레딧</span>
        </p>
        <div className="mt-4 grid grid-cols-3 gap-3">
          {(['AI_WRITING', 'AI_QUESTION', 'ALIMTALK'] as const).map((item) => (
            <div key={item} className="rounded-lg bg-gray-50 p-3">
              <p className="text-xs font-medium text-gray-500">{CREDIT_ITEM_LABEL[item]}</p>
              <p className="mt-0.5 text-lg font-bold text-gray-900">
                약 {formatCredits(estimateSendable(wallet.balance, pricing[item]))}
                <span className="ml-0.5 text-sm font-normal text-gray-500">{CREDIT_ITEM_UNIT[item]}</span>
              </p>
            </div>
          ))}
        </div>
        <p className="mt-3 flex items-center gap-1.5 text-xs text-gray-500">
          <CheckCircle className="h-3.5 w-3.5 text-[#1FAF54]" />
          AI 기능은 플랜 무료 한도를 먼저 쓰고, 초과분부터 크레딧이 차감됩니다. 크레딧은 만료되지 않습니다.
        </p>
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
