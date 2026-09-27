import { redirect } from 'next/navigation'
import { AlertTriangle, CheckCircle2, MessageSquareText, Sparkles } from 'lucide-react'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma/client'
import { PLANS } from '@/lib/pricing'
import { isMonthKey, todayKst } from '@/lib/attendance/time'
import {
  CREDIT_ITEM_LABEL,
  CREDIT_ITEM_UNIT,
  estimateSendable,
  formatCredits,
  type CreditItemValue,
} from '@/lib/credits/constants'
import { getCreditUsage, getMonthlyAiCreditUse, getMonthlyJobCounts } from '@/lib/credits/queries'
import { getCreditPricing, getWallet, walletAcademyIdOf } from '@/lib/credits/wallet'
import { CreditPackagesClient } from './_components/credit-packages-client'
import { CreditUsageTable } from './_components/credit-usage-table'

export const metadata = { title: '크레딧' }

/** 이번 달 플랜 무료 AI 사용량 (UsageRecord는 서버 로컬 월 기준 — tracker.ts와 동일) */
async function getMonthlyAiFreeUsage(academyId: string) {
  const sub = await prisma.subscription.findUnique({ where: { academyId }, select: { id: true, plan: true } })
  if (!sub) return null
  const now = new Date()
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const record = await prisma.usageRecord.findUnique({
    where: { subscriptionId_periodStart: { subscriptionId: sub.id, periodStart } },
    select: { aiWritingCount: true, aiQuestionCount: true },
  })
  const plan = PLANS[sub.plan]
  return {
    writing: { used: record?.aiWritingCount ?? 0, limit: plan.aiWritingLimit },
    question: { used: record?.aiQuestionCount ?? 0, limit: plan.aiQuestionLimit },
  }
}

function PriceRow({ item, price, note }: { item: CreditItemValue; price: number; note?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2">
      <span className="text-sm text-gray-700">
        {CREDIT_ITEM_LABEL[item]}
        {note && <span className="ml-1 text-xs text-gray-500">{note}</span>}
      </span>
      <span className="shrink-0 text-sm text-gray-900">
        <strong className="tabular-nums">{formatCredits(price)}</strong>크레딧 / {CREDIT_ITEM_UNIT[item]}
      </span>
    </div>
  )
}

function AiUsageLine({
  label,
  free,
  credit,
}: {
  label: string
  free: { used: number; limit: number } | null
  credit: { count: number; credits: number }
}) {
  const freeUsed = free ? Math.min(free.used, free.limit) : 0
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2">
      <span className="text-sm font-medium text-gray-900">{label}</span>
      <span className="text-sm text-gray-500">
        {free && (
          <>
            플랜 무료 <span className="tabular-nums text-gray-900">{formatCredits(freeUsed)}</span>/
            {formatCredits(free.limit)}회 ·{' '}
          </>
        )}
        크레딧 <span className="tabular-nums text-gray-900">{formatCredits(credit.count)}</span>회 (
        {formatCredits(credit.credits)}크레딧)
      </span>
    </div>
  )
}

export default async function OwnerCreditsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; charged?: string; error?: string }>
}) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ACADEMY_OWNER' || !user.academyId) redirect('/login')

  const params = await searchParams
  const thisMonth = todayKst().slice(0, 7)
  const monthKey = isMonthKey(params.month) ? params.month : thisMonth
  const walletAcademyId = await walletAcademyIdOf(user.academyId)

  const [wallet, pricing, packages, usage, counts, aiCredit, aiFree] = await Promise.all([
    getWallet(walletAcademyId),
    getCreditPricing(),
    prisma.creditPackage.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: 'asc' }, { priceKrw: 'asc' }],
      select: { id: true, name: true, credits: true, priceKrw: true },
    }),
    getCreditUsage(walletAcademyId, monthKey),
    getMonthlyJobCounts(walletAcademyId, thisMonth),
    getMonthlyAiCreditUse(walletAcademyId, thisMonth),
    getMonthlyAiFreeUsage(user.academyId),
  ])

  const low = wallet.balance <= wallet.lowBalanceThreshold
  const charged = Number(params.charged)
  const minPrice = Math.min(pricing.ALIMTALK, pricing.AI_WRITING, pricing.AI_QUESTION)
  const sendables: CreditItemValue[] = ['AI_WRITING', 'AI_QUESTION', 'ALIMTALK']

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">크레딧</h1>
        <p className="text-sm text-gray-500 mt-1">
          AI 쓰기 평가·AI 문제 생성과 학부모 알림(등원·하원·미등원)에 함께 쓰는 통합 크레딧입니다. 한 번 충전하면
          필요한 곳에 자유롭게 쓸 수 있습니다.
        </p>
      </div>

      {Number.isInteger(charged) && charged > 0 && (
        <div role="status" className="flex items-start gap-2 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-accent-green">
          <CheckCircle2 size={18} className="shrink-0 mt-0.5" />
          {formatCredits(charged)} 크레딧이 충전되었습니다.
        </div>
      )}
      {params.error && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-accent-red">
          {params.error}
        </div>
      )}

      {/* 잔액 */}
      <section className="rounded-xl border border-gray-200 bg-white p-5 md:p-6">
        <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] md:items-center">
          <div>
            <p className="text-sm text-gray-500">현재 잔액</p>
            <p className="mt-1 text-3xl font-bold text-gray-900">
              {formatCredits(wallet.balance)}
              <span className="ml-1 text-base font-medium text-gray-500">크레딧</span>
            </p>
            <p className="text-xs text-gray-500 mt-1">본원·지점이 함께 사용 · 만료 없음</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">한 가지에만 쓴다면</p>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {sendables.map((item) => (
                <div key={item} className="rounded-xl bg-gray-50 p-3">
                  <p className="text-xs font-medium text-gray-500">{CREDIT_ITEM_LABEL[item]}</p>
                  <p className="mt-0.5 text-lg font-bold text-gray-900 tabular-nums">
                    {formatCredits(estimateSendable(wallet.balance, pricing[item]))}
                    <span className="ml-0.5 text-sm font-medium text-gray-500">{CREDIT_ITEM_UNIT[item]}</span>
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
        {low && (
          <div className="mt-5 flex items-start gap-2 rounded-xl bg-accent-gold/10 p-3 text-sm text-gray-900">
            <AlertTriangle size={18} className="shrink-0 mt-0.5 text-accent-gold" />
            {wallet.balance < minPrice
              ? '잔액이 없어 학부모 알림이 발송되지 않고, 플랜 무료 한도를 넘은 AI 기능은 초과 요금이 청구되거나 제한됩니다. 아래에서 충전해주세요.'
              : `잔액이 ${formatCredits(wallet.lowBalanceThreshold)}크레딧 이하입니다. 알림·AI 기능이 끊기지 않도록 미리 충전해주세요.`}
          </div>
        )}
      </section>

      {/* 차감 기준 + 이번 달 사용 */}
      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="text-base font-bold text-gray-900">차감 기준</h2>
          <div className="mt-3">
            <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent-purple">
              <Sparkles size={14} /> AI 기능 — 플랜 무료 한도를 넘은 사용분부터
            </p>
            <div className="divide-y divide-gray-100">
              <PriceRow item="AI_WRITING" price={pricing.AI_WRITING} />
              <PriceRow item="AI_QUESTION" price={pricing.AI_QUESTION} note="(요청 1회)" />
            </div>
          </div>
          <div className="mt-4">
            <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary-700">
              <MessageSquareText size={14} /> 학부모 알림 — 발송에 성공한 건만
            </p>
            <div className="divide-y divide-gray-100">
              <PriceRow item="ALIMTALK" price={pricing.ALIMTALK} />
              <PriceRow item="SMS" price={pricing.SMS} note="(알림톡 실패 시 대체발송)" />
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="text-base font-bold text-gray-900">이번 달 사용</h2>
          <div className="mt-3">
            <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent-purple">
              <Sparkles size={14} /> AI 기능
            </p>
            <div className="divide-y divide-gray-100">
              <AiUsageLine label="AI 쓰기 평가" free={aiFree?.writing ?? null} credit={aiCredit.writing} />
              <AiUsageLine label="AI 문제 생성" free={aiFree?.question ?? null} credit={aiCredit.question} />
            </div>
          </div>
          <div className="mt-4">
            <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary-700">
              <MessageSquareText size={14} /> 학부모 알림
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 py-2 text-sm text-gray-500">
              <span>
                발송 <span className="text-gray-900 tabular-nums">{formatCredits(counts.sent)}</span>건
              </span>
              <span>대기 {formatCredits(counts.pending)}건</span>
              <span>실패 {formatCredits(counts.failed)}건</span>
              <span className={counts.noCredit > 0 ? 'text-accent-red font-medium' : undefined}>
                잔액 부족 미발송 {formatCredits(counts.noCredit)}건
              </span>
            </div>
          </div>
        </section>
      </div>

      <section id="charge" className="space-y-3">
        <h2 className="text-lg font-bold text-gray-900">충전하기</h2>
        <CreditPackagesClient packages={packages} pricing={pricing} customerName={user.name} customerEmail={user.email} />
      </section>

      <CreditUsageTable monthKey={monthKey} rows={usage.rows} truncated={usage.truncated} />
    </div>
  )
}
