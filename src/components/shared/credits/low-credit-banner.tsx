import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { prisma } from '@/lib/prisma/client'
import { formatCredits } from '@/lib/credits/constants'
import { getCreditPricing, getWallet, walletAcademyIdOf } from '@/lib/credits/wallet'

/**
 * 학원장 대시보드 상단 — 알림 크레딧 잔액이 부족 기준 이하일 때 충전 안내.
 * 학부모 알림을 하나라도 켠 학원(본원·지점)에만 표시한다. Suspense로 감싸 대시보드 렌더를 막지 않는다.
 */
export async function LowCreditBanner({ academyId }: { academyId: string }) {
  const walletAcademyId = await walletAcademyIdOf(academyId)
  const [wallet, pricing, notifying] = await Promise.all([
    getWallet(walletAcademyId),
    getCreditPricing(),
    prisma.attendanceSetting.findFirst({
      where: {
        academy: { OR: [{ id: walletAcademyId }, { parentAcademyId: walletAcademyId }] },
        OR: [{ notifyCheckIn: true }, { notifyCheckOut: true }, { notifyAbsent: true }],
      },
      select: { id: true },
    }),
  ])
  if (!notifying || wallet.balance > wallet.lowBalanceThreshold) return null

  const empty = wallet.balance < pricing.ALIMTALK
  return (
    <div
      role="alert"
      className="flex flex-col gap-3 rounded-xl border border-accent-gold/40 bg-accent-gold/10 p-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-start gap-2 text-sm text-gray-900">
        <AlertTriangle size={18} className="mt-0.5 shrink-0 text-accent-gold" />
        <p>
          <strong>{empty ? '알림 크레딧이 없습니다.' : '알림 크레딧이 얼마 남지 않았습니다.'}</strong>{' '}
          {empty
            ? '등원·하원 알림이 학부모에게 발송되지 않고 있습니다.'
            : `잔액 ${formatCredits(wallet.balance)}크레딧 (알림톡 약 ${formatCredits(Math.floor(wallet.balance / Math.max(1, pricing.ALIMTALK)))}건)`}
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
