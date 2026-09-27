import { redirect } from 'next/navigation'
import { AlertTriangle, CheckCircle2, MessageSquareText } from 'lucide-react'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma/client'
import { isMonthKey, todayKst } from '@/lib/attendance/time'
import { estimateSendable, formatCredits } from '@/lib/credits/constants'
import { getCreditUsage, getMonthlyJobCounts } from '@/lib/credits/queries'
import { getCreditPricing, getWallet, walletAcademyIdOf } from '@/lib/credits/wallet'
import { CreditPackagesClient } from './_components/credit-packages-client'
import { CreditUsageTable } from './_components/credit-usage-table'

export const metadata = { title: '알림 크레딧' }

export default async function OwnerCreditsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; charged?: string; error?: string }>
}) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ACADEMY_OWNER' || !user.academyId) redirect('/login')

  const params = await searchParams
  const monthKey = isMonthKey(params.month) ? params.month : todayKst().slice(0, 7)
  const walletAcademyId = await walletAcademyIdOf(user.academyId)

  const [wallet, pricing, packages, usage, counts] = await Promise.all([
    getWallet(walletAcademyId),
    getCreditPricing(),
    prisma.creditPackage.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: 'asc' }, { priceKrw: 'asc' }],
      select: { id: true, name: true, credits: true, priceKrw: true },
    }),
    getCreditUsage(walletAcademyId, monthKey),
    getMonthlyJobCounts(walletAcademyId, todayKst().slice(0, 7)),
  ])

  const sendable = estimateSendable(wallet.balance, pricing.ALIMTALK)
  const low = wallet.balance <= wallet.lowBalanceThreshold
  const charged = Number(params.charged)

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">알림 크레딧</h1>
        <p className="text-sm text-gray-500 mt-1">
          등원·하원·미등원 안내를 학부모에게 보낼 때 사용하는 크레딧입니다. 발송에 성공한 건만 차감됩니다.
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

      <section className="rounded-xl border border-gray-200 bg-white p-5 md:p-6">
        <div className="grid gap-6 sm:grid-cols-3">
          <div>
            <p className="text-sm text-gray-500">현재 잔액</p>
            <p className="mt-1 text-3xl font-bold text-gray-900">
              {formatCredits(wallet.balance)}
              <span className="ml-1 text-base font-medium text-gray-500">크레딧</span>
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">예상 발송 가능</p>
            <p className="mt-1 text-3xl font-bold text-gray-900">
              {formatCredits(sendable)}
              <span className="ml-1 text-base font-medium text-gray-500">건</span>
            </p>
            <p className="text-xs text-gray-500 mt-1">알림톡 기준 (잔액 ÷ {pricing.ALIMTALK}크레딧)</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">건당 차감</p>
            <p className="mt-1 text-sm text-gray-900">
              알림톡 <strong>{pricing.ALIMTALK}</strong>크레딧
            </p>
            <p className="text-sm text-gray-900">
              문자 대체발송 <strong>{pricing.SMS}</strong>크레딧
            </p>
          </div>
        </div>
        {low && (
          <div className="mt-5 flex items-start gap-2 rounded-xl bg-accent-gold/10 p-3 text-sm text-gray-900">
            <AlertTriangle size={18} className="shrink-0 mt-0.5 text-accent-gold" />
            {wallet.balance < pricing.ALIMTALK
              ? '잔액이 없어 학부모 알림이 발송되지 않습니다. 아래에서 충전해주세요.'
              : `잔액이 ${formatCredits(wallet.lowBalanceThreshold)}크레딧 이하입니다. 알림이 끊기지 않도록 미리 충전해주세요.`}
          </div>
        )}
        <div className="mt-5 flex flex-wrap gap-x-6 gap-y-1 border-t border-gray-100 pt-4 text-sm text-gray-500">
          <span className="inline-flex items-center gap-1.5 font-medium text-gray-700">
            <MessageSquareText size={16} /> 이번 달 알림
          </span>
          <span>발송 {formatCredits(counts.sent)}건</span>
          <span>대기 {formatCredits(counts.pending)}건</span>
          <span>실패 {formatCredits(counts.failed)}건</span>
          <span className={counts.noCredit > 0 ? 'text-accent-red font-medium' : undefined}>
            잔액 부족 미발송 {formatCredits(counts.noCredit)}건
          </span>
        </div>
      </section>

      <section id="charge" className="space-y-3">
        <h2 className="text-lg font-bold text-gray-900">충전하기</h2>
        <CreditPackagesClient packages={packages} alimtalkPrice={pricing.ALIMTALK} customerName={user.name} customerEmail={user.email} />
      </section>

      <CreditUsageTable monthKey={monthKey} rows={usage.rows} truncated={usage.truncated} />
    </div>
  )
}
