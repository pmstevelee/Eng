import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma/client'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { CreditsClient } from './credits-client'

export default async function CreditsPage() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ACADEMY_OWNER') redirect('/login')
  if (!user.academyId) redirect('/owner/settings')

  const now = new Date()

  // 보유 크레딧 집계
  const creditTotals = await prisma.aiCredit.groupBy({
    by: ['type'],
    where: {
      academyId: user.academyId,
      amount: { gt: 0 },
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    _sum: { amount: true },
  })

  const writingCredits = creditTotals.find((c) => c.type === 'WRITING')?._sum.amount ?? 0
  const questionCredits = creditTotals.find((c) => c.type === 'QUESTION')?._sum.amount ?? 0

  // 가장 빨리 만료되는 크레딧
  const earliestCredit = await prisma.aiCredit.findFirst({
    where: {
      academyId: user.academyId,
      amount: { gt: 0 },
      expiresAt: { not: null, gt: now },
    },
    orderBy: { expiresAt: 'asc' },
    select: { expiresAt: true },
  })

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Link
        href="/owner/billing"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        결제 관리로
      </Link>

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">AI 크레딧 충전</h1>
        <p className="mt-1 text-sm text-gray-500">
          월 한도 초과 시 사용할 수 있는 1회성 AI 크레딧입니다.
        </p>
      </div>

      <CreditsClient
        writingCredits={writingCredits}
        questionCredits={questionCredits}
        earliestExpiry={earliestCredit?.expiresAt?.toISOString() ?? null}
        customerInfo={{
          customerId: user.academyId,
          fullName: user.name,
          email: user.email,
        }}
      />
    </div>
  )
}
