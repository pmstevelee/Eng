import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { prisma } from '@/lib/prisma/client'
import { formatCredits } from '@/lib/credits/constants'
import { getCreditPricing, getWallet, walletAcademyIdOf } from '@/lib/credits/wallet'

/**
 * 학원장 대시보드 상단 — 통합 크레딧 잔액이 부족 기준 이하일 때 충전 안내.
 * 학부모 알림을 켰거나 최근 30일 안에 AI 기능에 크레딧을 쓴 학원에만 표시한다.
 * Suspense로 감싸 대시보드 렌더를 막지 않는다.
 */
export async function LowCreditBanner({ academyId }: { academyId: string }) {
  const walletAcademyId = await walletAcademyIdOf(academyId)
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const [wallet, pricing, notifying, aiUsing] = await Promise.all([
    getWallet(walletAcademyId),
    getCreditPricing(),
    prisma.attendanceSetting.findFirst({
      where: {
        academy: { OR: [{ id: walletAcademyId }, { parentAcademyId: walletAcademyId }] },
        OR: [{ notifyCheckIn: true }, { notifyCheckOut: true }, { notifyAbsent: true }],
      },
      select: { id: true },
    }),
    prisma.creditTransaction.findFirst({
      where: { academyId: walletAcademyId, type: 'USE', item: { in: ['AI_WRITING', 'AI_QUESTION'] }, createdAt: { gte: since } },
      select: { id: true },
    }),
  ])
  if ((!notifying && !aiUsing) || wallet.balance > wallet.lowBalanceThreshold) return null

  const empty = wallet.balance < Math.min(pricing.ALIMTALK, pricing.AI_WRITING)
  const affected = notifying ? '학부모 알림이 발송되지 않고 있습니다.' : '플랜 무료 한도를 넘은 AI 기능은 초과 요금이 청구되거나 제한됩니다.'
  return (
    <div
      role="alert"
      className="flex flex-col gap-3 rounded-xl border border-accent-gold/40 bg-accent-gold/10 p-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-start gap-2 text-sm text-gray-900">
        <AlertTriangle size={18} className="mt-0.5 shrink-0 text-accent-gold" />
        <p>
          <strong>{empty ? '크레딧이 없습니다.' : '크레딧이 얼마 남지 않았습니다.'}</strong>{' '}
          {empty
            ? affected
            : `잔액 ${formatCredits(wallet.balance)}크레딧 (알림톡 약 ${formatCredits(Math.floor(wallet.balance / Math.max(1, pricing.ALIMTALK)))}건 · AI 쓰기 평가 약 ${formatCredits(Math.floor(wallet.balance / Math.max(1, pricing.AI_WRITING)))}회)`}
        </p>
      </div>
      <Link
        href="/owner/credits#charge"
        className="inline-flex h-11 shrink-0 items-center justify-center rounded-xl bg-primary-700 px-4 text-sm font-semibold text-white hover:bg-primary-800"
      >
        충전하기
      </Link>
    </div>
  )
}
