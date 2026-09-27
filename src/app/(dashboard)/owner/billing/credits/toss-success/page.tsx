import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma/client'
import { getCurrentUser } from '@/lib/auth'

interface PageProps {
  searchParams: Promise<{ paymentKey?: string; orderId?: string; amount?: string }>
}

const back = (error: string) => `/owner/credits?error=${encodeURIComponent(error)}`

/**
 * (구) AI 전용 크레딧 패키지 결제 복귀 주소.
 * AI 크레딧이 통합 크레딧으로 바뀌어 더 이상 승인하지 않는다 — 승인(confirm)하지 않은 토스 결제는
 * 청구되지 않고 자동 만료되므로, 대기 중인 결제는 실패 처리하고 통합 크레딧 화면으로 안내한다.
 */
export default async function LegacyCreditsTossSuccessPage({ searchParams }: PageProps) {
  const { orderId } = await searchParams

  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (user.role !== 'ACADEMY_OWNER' || !user.academyId) redirect(back('권한이 없습니다.'))

  if (orderId) {
    await prisma.payment.updateMany({
      where: { paymentId: orderId, academyId: user.academyId, type: 'CREDIT_PACKAGE', status: 'PENDING' },
      data: { status: 'FAILED', failureReason: '통합 크레딧 전환으로 AI 전용 패키지 판매 종료' },
    })
  }
  redirect(back('AI 전용 크레딧 상품은 판매가 종료되어 결제가 진행되지 않았습니다(청구되지 않음). 통합 크레딧으로 충전해주세요.'))
}
