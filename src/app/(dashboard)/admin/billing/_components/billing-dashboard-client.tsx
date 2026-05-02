'use client'

import { useState, useTransition } from 'react'
import {
  TrendingUp,
  AlertCircle,
  RefreshCw,
  CheckCircle,
  Search,
  DollarSign,
  Users,
  Percent,
  Webhook,
} from 'lucide-react'
import { forceRetryPayment, refundPayment, manualActivateSubscription, searchPayments } from '../actions'
import type { getBillingDashboardData } from '../actions'
import { Plan, PaymentStatus, PaymentType } from '@/generated/prisma'

type DashboardData = Awaited<ReturnType<typeof getBillingDashboardData>>
type SearchResult = Awaited<ReturnType<typeof searchPayments>>
type PastDueSub = DashboardData['pastDueSubscriptions'][number]
type FailedSchedule = DashboardData['failedSchedules'][number]
type RecentPayment = DashboardData['recentPayments'][number]
type AuditLog = DashboardData['auditLogs'][number]

const PLAN_LABEL: Record<Plan, string> = {
  FREE: '무료',
  STARTER: '스타터',
  STANDARD: '스탠다드',
  PREMIUM: '프리미엄',
}

const PLAN_COLOR: Record<Plan, string> = {
  FREE: 'bg-gray-100 text-gray-600',
  STARTER: 'bg-primary-100 text-primary-700',
  STANDARD: 'bg-accent-purple-light text-accent-purple',
  PREMIUM: 'bg-accent-gold-light text-accent-gold',
}

const STATUS_LABEL: Record<PaymentStatus, string> = {
  PENDING: '대기',
  PAID: '완료',
  EXPIRED: '만료',
  REFUNDED: '환불',
  CANCELLED: '취소',
  CANCELED: '취소',
  FAILED: '실패',
  PARTIAL_CANCELED: '부분취소',
}

const STATUS_COLOR: Record<PaymentStatus, string> = {
  PENDING: 'bg-accent-gold-light text-accent-gold',
  PAID: 'bg-accent-green-light text-accent-green',
  EXPIRED: 'bg-gray-100 text-gray-500',
  REFUNDED: 'bg-accent-purple-light text-accent-purple',
  CANCELLED: 'bg-gray-100 text-gray-500',
  CANCELED: 'bg-gray-100 text-gray-500',
  FAILED: 'bg-accent-red-light text-accent-red',
  PARTIAL_CANCELED: 'bg-accent-gold-light text-accent-gold',
}

const TYPE_LABEL: Record<PaymentType, string> = {
  SUBSCRIPTION: '구독',
  ANNUAL: '연간구독',
  CREDIT_PACKAGE: '크레딧',
  OVERAGE_AI_WRITING: '초과(작문)',
  OVERAGE_AI_QUESTION: '초과(문제)',
  STUDENT_OVERAGE: '초과(학생)',
  STORAGE_OVERAGE: '초과(저장)',
}

interface Props {
  data: DashboardData
}

export function BillingDashboardClient({ data }: Props) {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult>([])
  const [searching, startSearch] = useTransition()
  const [isPending, startTransition] = useTransition()
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)
  const [refundTarget, setRefundTarget] = useState<string | null>(null)
  const [refundReason, setRefundReason] = useState('')
  const [activateTarget, setActivateTarget] = useState<string | null>(null)
  const [activateReason, setActivateReason] = useState('')

  const totalActive = data.activeByPlan.reduce(
    (s: number, g: { plan: Plan; _count: number }) => s + g._count,
    0,
  )

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3500)
  }

  function handleSearch() {
    startSearch(async () => {
      const results = await searchPayments(searchQuery)
      setSearchResults(results)
    })
  }

  function handleForceRetry(subscriptionId: string) {
    startTransition(async () => {
      const res = await forceRetryPayment(subscriptionId)
      showToast(res.error ?? '재시도 요청 완료', !res.error)
    })
  }

  function handleRefund() {
    if (!refundTarget) return
    startTransition(async () => {
      const res = await refundPayment(refundTarget, refundReason)
      if (!res.error) {
        setRefundTarget(null)
        setRefundReason('')
      }
      showToast(res.error ?? '환불 완료', !res.error)
    })
  }

  function handleActivate() {
    if (!activateTarget) return
    startTransition(async () => {
      const res = await manualActivateSubscription(activateTarget, activateReason)
      if (!res.error) {
        setActivateTarget(null)
        setActivateReason('')
      }
      showToast(res.error ?? '구독 활성화 완료', !res.error)
    })
  }

  return (
    <div className="p-6 space-y-8">
      {/* 토스트 */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium shadow-sm ${
            toast.ok ? 'bg-accent-green text-white' : 'bg-accent-red text-white'
          }`}
        >
          {toast.ok ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          {toast.msg}
        </div>
      )}

      <div>
        <h1 className="text-2xl font-bold text-gray-900">결제 모니터링</h1>
        <p className="mt-1 text-sm text-gray-500">실시간 결제 현황 및 운영 관리</p>
      </div>

      {/* 핵심 지표 */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard
          icon={<DollarSign className="h-5 w-5 text-primary-700" />}
          label="이번 달 MRR"
          value={`${data.mrr.toLocaleString()}원`}
          sub={`${data.paidCount}건`}
        />
        <MetricCard
          icon={<Users className="h-5 w-5 text-accent-green" />}
          label="활성 구독"
          value={`${totalActive}개`}
          sub={`체험 ${data.trialCount}개`}
        />
        <MetricCard
          icon={<Percent className="h-5 w-5 text-accent-purple" />}
          label="전환율 (30일)"
          value={`${data.conversionRate.toFixed(1)}%`}
          sub="체험 → 유료"
        />
        <MetricCard
          icon={<TrendingUp className="h-5 w-5 text-accent-gold" />}
          label="AI 초과 비중"
          value={`${data.overageRatio.toFixed(1)}%`}
          sub="이번 달 MRR 대비"
        />
      </div>

      {/* 플랜별 구독 */}
      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold text-gray-700">플랜별 활성 구독</h2>
        <div className="flex flex-wrap gap-3">
          {data.activeByPlan.map((g: { plan: Plan; _count: number }) => (
            <div key={g.plan} className="flex items-center gap-2">
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${PLAN_COLOR[g.plan]}`}>
                {PLAN_LABEL[g.plan]}
              </span>
              <span className="text-sm font-bold text-gray-900">{g._count}개</span>
            </div>
          ))}
          {data.activeByPlan.length === 0 && (
            <p className="text-sm text-gray-400">활성 구독 없음</p>
          )}
        </div>
      </section>

      {/* 이슈 패널 */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* PAST_DUE */}
        <IssuePanel
          title="연체 구독"
          count={data.pastDueSubscriptions.length}
          color="accent-red"
          icon={<AlertCircle className="h-4 w-4" />}
        >
          {data.pastDueSubscriptions.map((sub: PastDueSub) => (
            <IssueRow
              key={sub.id}
              label={sub.academy.businessName ?? sub.academy.name}
              sub={PLAN_LABEL[sub.plan]}
              action={
                <button
                  className="rounded-lg bg-primary-700 px-3 py-1 text-xs font-medium text-white hover:bg-primary-800 disabled:opacity-50"
                  disabled={isPending}
                  onClick={() => setActivateTarget(sub.id)}
                >
                  수동 활성화
                </button>
              }
            />
          ))}
          {data.pastDueSubscriptions.length === 0 && (
            <p className="py-2 text-center text-xs text-gray-400">연체 없음</p>
          )}
        </IssuePanel>

        {/* 재시도 대기 */}
        <IssuePanel
          title="재시도 대기"
          count={data.failedSchedules.length}
          color="accent-gold"
          icon={<RefreshCw className="h-4 w-4" />}
        >
          {data.failedSchedules.map((s: FailedSchedule) => (
            <IssueRow
              key={s.id}
              label={s.subscription.academy.businessName ?? s.subscription.academy.name}
              sub={`${s.amount.toLocaleString()}원 · 재시도 ${s.retryCount}회`}
              action={
                <button
                  className="rounded-lg bg-accent-gold px-3 py-1 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
                  disabled={isPending}
                  onClick={() => handleForceRetry(s.subscriptionId)}
                >
                  즉시 재시도
                </button>
              }
            />
          ))}
          {data.failedSchedules.length === 0 && (
            <p className="py-2 text-center text-xs text-gray-400">대기 없음</p>
          )}
        </IssuePanel>

        {/* 미처리 웹훅 */}
        <IssuePanel
          title="미처리 웹훅"
          count={data.unprocessedWebhooks}
          color={data.unprocessedWebhooks > 0 ? 'accent-red' : 'accent-green'}
          icon={<Webhook className="h-4 w-4" />}
        >
          {data.unprocessedWebhooks === 0 ? (
            <p className="py-2 text-center text-xs text-gray-400">정상</p>
          ) : (
            <p className="py-3 text-center text-sm font-medium text-accent-red">
              {data.unprocessedWebhooks}개 처리 실패 — 수동 확인 필요
            </p>
          )}
        </IssuePanel>
      </div>

      {/* 결제 검색 */}
      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold text-gray-700">결제 검색</h2>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              className="h-11 w-full rounded-xl border border-gray-200 pl-9 pr-4 text-sm outline-none focus:border-primary-700"
              placeholder="결제 ID, 학원 ID, 학원명으로 검색"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
          </div>
          <button
            className="h-11 rounded-xl bg-primary-700 px-5 text-sm font-medium text-white hover:bg-primary-800 disabled:opacity-50"
            onClick={handleSearch}
            disabled={searching}
          >
            검색
          </button>
        </div>
        {searchResults.length > 0 && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="py-2 pr-4 text-left text-xs font-semibold uppercase text-gray-500">학원</th>
                  <th className="py-2 pr-4 text-left text-xs font-semibold uppercase text-gray-500">결제 ID</th>
                  <th className="py-2 pr-4 text-right text-xs font-semibold uppercase text-gray-500">금액</th>
                  <th className="py-2 pr-4 text-left text-xs font-semibold uppercase text-gray-500">유형</th>
                  <th className="py-2 pr-4 text-left text-xs font-semibold uppercase text-gray-500">상태</th>
                  <th className="py-2 text-right text-xs font-semibold uppercase text-gray-500">액션</th>
                </tr>
              </thead>
              <tbody>
                {searchResults.map((p: SearchResult[number]) => (
                  <tr key={p.id} className="border-b border-gray-50">
                    <td className="py-2 pr-4 text-gray-900">
                      {p.subscription.academy.businessName ?? p.subscription.academy.name}
                    </td>
                    <td className="py-2 pr-4 font-mono text-xs text-gray-500">
                      {p.paymentId.slice(0, 16)}…
                    </td>
                    <td className="py-2 pr-4 text-right font-medium text-gray-900">
                      {p.amount.toLocaleString()}원
                    </td>
                    <td className="py-2 pr-4">
                      <span className="text-xs text-gray-600">{TYPE_LABEL[p.type]}</span>
                    </td>
                    <td className="py-2 pr-4">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[p.status]}`}>
                        {STATUS_LABEL[p.status]}
                      </span>
                    </td>
                    <td className="py-2 text-right">
                      {p.status === PaymentStatus.PAID && (
                        <button
                          className="text-xs text-accent-red hover:underline disabled:opacity-50"
                          disabled={isPending}
                          onClick={() => setRefundTarget(p.paymentId)}
                        >
                          환불
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 최근 결제 내역 */}
      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold text-gray-700">최근 결제 내역 (30일)</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="py-2 pr-4 text-left text-xs font-semibold uppercase text-gray-500">학원</th>
                <th className="py-2 pr-4 text-right text-xs font-semibold uppercase text-gray-500">금액</th>
                <th className="py-2 pr-4 text-left text-xs font-semibold uppercase text-gray-500">유형</th>
                <th className="py-2 pr-4 text-left text-xs font-semibold uppercase text-gray-500">상태</th>
                <th className="py-2 text-left text-xs font-semibold uppercase text-gray-500">일시</th>
              </tr>
            </thead>
            <tbody>
              {data.recentPayments.map((p: RecentPayment) => (
                <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-2 pr-4 text-gray-900">
                    {p.subscription.academy.businessName ?? p.subscription.academy.name}
                  </td>
                  <td className="py-2 pr-4 text-right font-medium text-gray-900">
                    {p.amount.toLocaleString()}원
                  </td>
                  <td className="py-2 pr-4">
                    <span className="text-xs text-gray-600">{TYPE_LABEL[p.type]}</span>
                  </td>
                  <td className="py-2 pr-4">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[p.status]}`}>
                      {STATUS_LABEL[p.status]}
                    </span>
                  </td>
                  <td className="py-2 text-xs text-gray-500">
                    {new Date(p.createdAt).toLocaleString('ko-KR', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                </tr>
              ))}
              {data.recentPayments.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-sm text-gray-400">
                    최근 결제 내역이 없습니다
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* 감사 로그 */}
      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold text-gray-700">감사 로그 (최근 30건)</h2>
        <div className="space-y-2">
          {data.auditLogs.map((log: AuditLog) => (
            <div key={log.id} className="flex items-start gap-3 rounded-lg bg-gray-50 px-3 py-2">
              <span className="mt-0.5 rounded bg-gray-200 px-1.5 py-0.5 text-xs font-mono text-gray-600">
                {log.actorType}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800">{log.action}</p>
                <p className="text-xs text-gray-500">{log.target}</p>
              </div>
              <span className="text-xs text-gray-400 whitespace-nowrap">
                {new Date(log.createdAt).toLocaleString('ko-KR', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
          ))}
          {data.auditLogs.length === 0 && (
            <p className="py-4 text-center text-sm text-gray-400">로그 없음</p>
          )}
        </div>
      </section>

      {/* 환불 모달 */}
      {refundTarget && (
        <Modal
          title="환불 처리"
          onClose={() => { setRefundTarget(null); setRefundReason('') }}
        >
          <p className="mb-3 text-sm text-gray-600">환불 사유를 입력하세요 (필수).</p>
          <textarea
            className="h-24 w-full rounded-xl border border-gray-200 p-3 text-sm outline-none focus:border-primary-700"
            placeholder="환불 사유..."
            value={refundReason}
            onChange={(e) => setRefundReason(e.target.value)}
          />
          <div className="mt-4 flex justify-end gap-2">
            <button
              className="rounded-xl border border-gray-200 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              onClick={() => { setRefundTarget(null); setRefundReason('') }}
            >
              취소
            </button>
            <button
              className="rounded-xl bg-accent-red px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              disabled={isPending || !refundReason.trim()}
              onClick={handleRefund}
            >
              환불 확정
            </button>
          </div>
        </Modal>
      )}

      {/* 수동 활성화 모달 */}
      {activateTarget && (
        <Modal
          title="구독 수동 활성화"
          onClose={() => { setActivateTarget(null); setActivateReason('') }}
        >
          <p className="mb-3 text-sm text-gray-600">활성화 사유를 입력하세요 (감사 로그에 기록).</p>
          <textarea
            className="h-24 w-full rounded-xl border border-gray-200 p-3 text-sm outline-none focus:border-primary-700"
            placeholder="활성화 사유..."
            value={activateReason}
            onChange={(e) => setActivateReason(e.target.value)}
          />
          <div className="mt-4 flex justify-end gap-2">
            <button
              className="rounded-xl border border-gray-200 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              onClick={() => { setActivateTarget(null); setActivateReason('') }}
            >
              취소
            </button>
            <button
              className="rounded-xl bg-primary-700 px-4 py-2 text-sm font-medium text-white hover:bg-primary-800 disabled:opacity-50"
              disabled={isPending || !activateReason.trim()}
              onClick={handleActivate}
            >
              활성화
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── 서브 컴포넌트 ────────────────────────────────────────────────────────────

function MetricCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub: string
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="mb-3 flex items-center gap-2">
        {icon}
        <span className="text-xs font-semibold uppercase text-gray-500">{label}</span>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="mt-1 text-xs text-gray-500">{sub}</p>
    </div>
  )
}

function IssuePanel({
  title,
  count,
  color,
  icon,
  children,
}: {
  title: string
  count: number
  color: string
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`text-${color}`}>{icon}</span>
          <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
        </div>
        {count > 0 && (
          <span className={`rounded-full bg-${color}-light px-2 py-0.5 text-xs font-bold text-${color}`}>
            {count}
          </span>
        )}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

function IssueRow({
  label,
  sub,
  action,
}: {
  label: string
  sub: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg bg-gray-50 px-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-gray-800">{label}</p>
        <p className="text-xs text-gray-500">{sub}</p>
      </div>
      {action}
    </div>
  )
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-900">{title}</h3>
          <button className="text-gray-400 hover:text-gray-600" onClick={onClose}>✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}
