'use server'

import { randomUUID } from 'crypto'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma/client'
import { walletAcademyIdOf } from './wallet'

export type CreditCheckoutResult =
  | { ok: true; paymentId: string; amount: number; orderName: string; customerKey: string }
  | { ok: false; error: string }

/**
 * 통합 크레딧(알림 + AI) 충전 결제 준비 — PENDING Payment 생성 (상품 정보는 metadata에 스냅샷).
 * 실제 충전은 결제 승인(/owner/credits/toss-success) 또는 토스 웹훅에서 서버가 처리한다.
 */
export async function startCreditCheckout(packageId: string): Promise<CreditCheckoutResult> {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ACADEMY_OWNER' || !user.academyId) {
    return { ok: false, error: '학원장만 크레딧을 충전할 수 있습니다.' }
  }

  const walletAcademyId = await walletAcademyIdOf(user.academyId)
  const [pkg, subscription] = await Promise.all([
    prisma.creditPackage.findFirst({
      where: { id: packageId, active: true },
      select: { id: true, name: true, credits: true, priceKrw: true },
    }),
    prisma.subscription.findUnique({ where: { academyId: walletAcademyId }, select: { id: true } }),
  ])
  if (!pkg) return { ok: false, error: '판매 중인 충전 상품이 아닙니다. 새로고침 후 다시 선택해주세요.' }
  if (!subscription) return { ok: false, error: '구독 정보가 없습니다. 고객센터로 문의해주세요.' }

  const paymentId = randomUUID()
  await prisma.payment.create({
    data: {
      subscriptionId: subscription.id,
      academyId: walletAcademyId,
      paymentId,
      type: 'NOTIFICATION_CREDIT',
      amount: pkg.priceKrw,
      status: 'PENDING',
      metadata: { creditPackageId: pkg.id, name: pkg.name, credits: pkg.credits },
    },
  })

  return {
    ok: true,
    paymentId,
    amount: pkg.priceKrw,
    orderName: `위고업잉글리시 크레딧 ${pkg.credits.toLocaleString('ko-KR')} (${pkg.name})`,
    customerKey: walletAcademyId,
  }
}
