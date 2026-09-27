import { prisma } from '@/lib/prisma/client'
import { getCreditPricing } from '@/lib/credits/wallet'
import { DEFAULT_LOW_BALANCE_THRESHOLD } from '@/lib/credits/constants'
import { CreditAdminClient, type AcademyCreditRow } from './_components/credit-admin-client'

export const metadata = { title: '크레딧 — EduLevel Admin' }

export default async function AdminCreditsPage() {
  const [pricing, packages, academies, wallets] = await Promise.all([
    getCreditPricing(),
    prisma.creditPackage.findMany({
      orderBy: [{ sortOrder: 'asc' }, { priceKrw: 'asc' }],
      select: { id: true, name: true, credits: true, priceKrw: true, active: true, sortOrder: true },
    }),
    // 지갑은 본원 단위 (지점은 본원 지갑 공유)
    prisma.academy.findMany({
      where: { parentAcademyId: null, isDeleted: false },
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, businessName: true },
    }),
    prisma.creditWallet.findMany({ select: { academyId: true, balance: true, lowBalanceThreshold: true, updatedAt: true } }),
  ])

  const walletOf = new Map(wallets.map((w) => [w.academyId, w]))
  const rows: AcademyCreditRow[] = academies
    .map((a) => {
      const w = walletOf.get(a.id)
      return {
        id: a.id,
        name: a.businessName ?? a.name,
        balance: w?.balance ?? 0,
        lowBalanceThreshold: w?.lowBalanceThreshold ?? DEFAULT_LOW_BALANCE_THRESHOLD,
        updatedAt: w?.updatedAt.toISOString() ?? null,
      }
    })
    // 잔액 있는 학원 먼저
    .sort((a, b) => b.balance - a.balance)

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">크레딧</h1>
        <p className="text-sm text-gray-500 mt-1">
          학부모 알림과 AI 기능에 함께 쓰는 통합 크레딧의 단가·충전 상품을 관리하고, 학원별 잔액을 조회·조정합니다.
        </p>
      </div>
      <CreditAdminClient pricing={pricing} packages={packages} academies={rows} />
    </div>
  )
}
