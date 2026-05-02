import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma/client'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { HistoryClient } from './history-client'
import type { PaymentType, PaymentStatus } from '@/generated/prisma'

const PAGE_SIZE = 20

interface PageProps {
  searchParams: Promise<{ type?: string; page?: string }>
}

export default async function HistoryPage({ searchParams }: PageProps) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ACADEMY_OWNER') redirect('/login')
  if (!user.academyId) redirect('/owner/settings')

  const params = await searchParams
  const typeFilter = params.type as PaymentType | undefined
  const page = Math.max(1, parseInt(params.page ?? '1', 10))
  const skip = (page - 1) * PAGE_SIZE

  const validTypes: PaymentType[] = [
    'SUBSCRIPTION',
    'OVERAGE_AI_WRITING',
    'OVERAGE_AI_QUESTION',
    'CREDIT_PACKAGE',
    'ANNUAL',
    'STUDENT_OVERAGE',
    'STORAGE_OVERAGE',
  ]

  const whereType =
    typeFilter && validTypes.includes(typeFilter) ? { type: typeFilter } : {}

  const [payments, total] = await Promise.all([
    prisma.payment.findMany({
      where: { academyId: user.academyId, ...whereType },
      orderBy: { paidAt: 'desc' },
      skip,
      take: PAGE_SIZE,
      select: {
        id: true,
        paymentId: true,
        type: true,
        amount: true,
        status: true,
        paidAt: true,
        canceledAt: true,
        receiptUrl: true,
        failureReason: true,
      },
    }),
    prisma.payment.count({
      where: { academyId: user.academyId, ...whereType },
    }),
  ])

  const totalPages = Math.ceil(total / PAGE_SIZE)

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
        <h1 className="text-2xl font-bold text-gray-900">결제 내역</h1>
        <p className="mt-1 text-sm text-gray-500">총 {total.toLocaleString()}건</p>
      </div>

      <HistoryClient
        payments={payments.map((p) => ({
          id: p.id,
          paymentId: p.paymentId,
          type: p.type as PaymentType,
          amount: p.amount,
          status: p.status as PaymentStatus,
          paidAt: p.paidAt?.toISOString() ?? null,
          canceledAt: p.canceledAt?.toISOString() ?? null,
          receiptUrl: p.receiptUrl,
          failureReason: p.failureReason,
        }))}
        total={total}
        page={page}
        totalPages={totalPages}
        typeFilter={typeFilter}
        academyId={user.academyId}
      />
    </div>
  )
}
