import { prisma } from '@/lib/prisma/client'
import { AlertCircle, Receipt } from 'lucide-react'
import type { PaymentStatus, PlanType, SubscriptionPeriod } from '@prisma/client'
import { confirmPayment } from './actions'

const PAYMENT_LABEL: Record<PaymentStatus, string> = {
  PENDING: '입금 대기',
  PAID: '결제 완료',
  EXPIRED: '만료',
  REFUNDED: '환불',
  CANCELLED: '취소',
}
const PAYMENT_CLASS: Record<PaymentStatus, string> = {
  PENDING: 'bg-accent-gold-light text-accent-gold',
  PAID: 'bg-accent-green-light text-accent-green',
  EXPIRED: 'bg-gray-100 text-gray-500',
  REFUNDED: 'bg-accent-purple-light text-accent-purple',
  CANCELLED: 'bg-gray-100 text-gray-500',
}
const PLAN_LABEL: Record<PlanType, string> = {
  BASIC: '기본',
  STANDARD: '표준',
  PREMIUM: '프리미엄',
  ENTERPRISE: '엔터프라이즈',
}
const PLAN_CLASS: Record<PlanType, string> = {
  BASIC: 'bg-gray-100 text-gray-600',
  STANDARD: 'bg-primary-100 text-primary-700',
  PREMIUM: 'bg-accent-purple-light text-accent-purple',
  ENTERPRISE: 'bg-accent-gold-light text-accent-gold',
}
const PERIOD_LABEL: Record<SubscriptionPeriod, string> = {
  MONTHLY: '월간',
  YEARLY: '연간',
}

interface PageProps {
  searchParams: { status?: string }
}

const ALL_STATUSES: PaymentStatus[] = ['PENDING', 'PAID', 'EXPIRED', 'REFUNDED', 'CANCELLED']

export default async function SubscriptionsPage({ searchParams }: PageProps) {
  const statusFilter = ALL_STATUSES.includes(searchParams.status as PaymentStatus)
    ? (searchParams.status as PaymentStatus)
    : null

  const subscriptions = await prisma.subscription.findMany({
    where: statusFilter ? { status: statusFilter } : {},
    select: {
      id: true,
      plan: true,
      amount: true,
      period: true,
      startedAt: true,
      expiresAt: true,
      paymentMethod: true,
      paymentRef: true,
      status: true,
      createdAt: true,
      academy: {
        select: {
          id: true,
          name: true,
          businessName: true,
        },
      },
    },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
  })

  // Separate PENDING from the rest
  const pendingSubs = subscriptions.filter((s) => s.status === 'PENDING')
  const otherSubs = subscriptions.filter((s) => s.status !== 'PENDING')
  const pendingCount = pendingSubs.length

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">구독 관리</h1>
          <p className="text-sm text-gray-500 mt-1">전체 구독 이력 및 입금 확인</p>
        </div>
        {pendingCount > 0 && (
          <div className="flex items-center gap-1.5 bg-accent-gold-light text-accent-gold text-sm font-medium px-3 py-1.5 rounded-lg">
            <AlertCircle size={14} />
            입금 대기 {pendingCount}건
          </div>
        )}
      </div>

      {/* Status filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <a
          href="/admin/subscriptions"
          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
            !statusFilter ? 'bg-primary-700 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          전체
        </a>
        {ALL_STATUSES.map((s) => (
          <a
            key={s}
            href={`/admin/subscriptions?status=${s}`}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              statusFilter === s
                ? 'bg-primary-700 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {PAYMENT_LABEL[s]}
          </a>
        ))}
      </div>

      {/* Pending section */}
      {!statusFilter && pendingSubs.length > 0 && (
        <div className="rounded-xl border border-accent-gold/30 bg-accent-gold-light overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3 border-b border-accent-gold/20">
            <AlertCircle size={14} className="text-accent-gold" />
            <span className="text-sm font-semibold text-accent-gold">
              입금 확인 대기 ({pendingSubs.length}건)
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-accent-gold/20">
                  {['학원', '플랜', '기간', '금액', '입금수단', '요청일', '만료예정', ''].map(
                    (h) => (
                      <th
                        key={h}
                        className="text-left text-xs font-medium text-accent-gold/80 uppercase tracking-wider px-4 py-2.5"
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-accent-gold/10">
                {pendingSubs.map((sub) => (
                  <SubscriptionRow
                    key={sub.id}
                    sub={sub}
                    showConfirm
                    rowClass="hover:bg-accent-gold/5"
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* All subscriptions table */}
      {otherSubs.length === 0 && pendingSubs.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 py-20 flex flex-col items-center gap-3">
          <Receipt size={40} className="text-gray-300" />
          <p className="text-sm text-gray-500">구독 이력이 없습니다</p>
        </div>
      ) : (otherSubs.length > 0 || statusFilter) ? (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {statusFilter && (
            <div className="px-5 py-3 border-b border-gray-100">
              <span className="text-sm font-medium text-gray-700">
                {PAYMENT_LABEL[statusFilter as PaymentStatus]} ({subscriptions.length}건)
              </span>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  {['학원', '플랜', '기간', '금액', '결제 상태', '입금수단', '요청일', '구독 기간'].map(
                    (h) => (
                      <th
                        key={h}
                        className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3"
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(statusFilter ? subscriptions : otherSubs).map((sub) => (
                  <SubscriptionRow key={sub.id} sub={sub} showConfirm={false} rowClass="" />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  )
}

type SubRow = {
  id: string
  plan: PlanType
  amount: number
  period: SubscriptionPeriod
  startedAt: Date
  expiresAt: Date
  paymentMethod: string | null
  paymentRef: string | null
  status: PaymentStatus
  createdAt: Date
  academy: { id: string; name: string; businessName: string | null }
}

function SubscriptionRow({
  sub,
  showConfirm,
  rowClass,
}: {
  sub: SubRow
  showConfirm: boolean
  rowClass: string
}) {
  const PLAN_LABEL_MAP: Record<PlanType, string> = {
    BASIC: '기본',
    STANDARD: '표준',
    PREMIUM: '프리미엄',
    ENTERPRISE: '엔터프라이즈',
  }
  const PERIOD_LABEL_MAP: Record<SubscriptionPeriod, string> = {
    MONTHLY: '월간',
    YEARLY: '연간',
  }
  const PAYMENT_LABEL_MAP: Record<PaymentStatus, string> = {
    PENDING: '입금 대기',
    PAID: '결제 완료',
    EXPIRED: '만료',
    REFUNDED: '환불',
    CANCELLED: '취소',
  }

  return (
    <tr className={`hover:bg-gray-50 transition-colors ${rowClass}`}>
      <td className="px-4 py-3">
        <span className="text-sm font-medium text-gray-900">
          {sub.academy.businessName ?? sub.academy.name}
        </span>
      </td>
      <td className="px-4 py-3">
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${PLAN_CLASS[sub.plan]}`}
        >
          {PLAN_LABEL_MAP[sub.plan]}
        </span>
      </td>
      <td className="px-4 py-3 text-sm text-gray-700">{PERIOD_LABEL_MAP[sub.period]}</td>
      <td className="px-4 py-3 text-sm font-medium text-gray-900">
        ₩{sub.amount.toLocaleString()}
      </td>
      {!showConfirm && (
        <td className="px-4 py-3">
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${PAYMENT_CLASS[sub.status]}`}
          >
            {PAYMENT_LABEL_MAP[sub.status]}
          </span>
        </td>
      )}
      <td className="px-4 py-3 text-sm text-gray-500">{sub.paymentMethod ?? '-'}</td>
      <td className="px-4 py-3 text-sm text-gray-500">
        {sub.createdAt.toLocaleDateString('ko-KR')}
      </td>
      <td className="px-4 py-3 text-sm text-gray-400">
        {sub.startedAt.toLocaleDateString('ko-KR')} ~ {sub.expiresAt.toLocaleDateString('ko-KR')}
      </td>
      {showConfirm && (
        <td className="px-4 py-3">
          <form action={confirmPayment}>
            <input type="hidden" name="subscriptionId" value={sub.id} />
            <button
              type="submit"
              className="h-8 px-3 rounded-lg bg-accent-green text-white text-xs font-medium hover:opacity-90 transition-opacity whitespace-nowrap"
            >
              입금 확인
            </button>
          </form>
        </td>
      )}
    </tr>
  )
}
