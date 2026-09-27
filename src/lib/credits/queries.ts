import 'server-only'

import { prisma } from '@/lib/prisma/client'
import type { CreditUsageRow } from './constants'

/** 사용 내역 한 달 최대 행 수 (화면·CSV 공용) */
export const USAGE_ROW_LIMIT = 5000

/** 'YYYY-MM' → KST 월 시작·다음 달 시작 */
function kstMonthBounds(monthKey: string): { from: Date; to: Date } {
  const [y, m] = monthKey.split('-').map(Number)
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`
  return { from: new Date(`${monthKey}-01T00:00:00+09:00`), to: new Date(`${next}-01T00:00:00+09:00`) }
}

export async function getCreditUsage(
  walletAcademyId: string,
  monthKey: string,
): Promise<{ rows: CreditUsageRow[]; truncated: boolean }> {
  const { from, to } = kstMonthBounds(monthKey)
  const txs = await prisma.creditTransaction.findMany({
    where: { academyId: walletAcademyId, createdAt: { gte: from, lt: to } },
    orderBy: { createdAt: 'desc' },
    take: USAGE_ROW_LIMIT + 1,
    select: {
      id: true,
      createdAt: true,
      type: true,
      amount: true,
      balanceAfter: true,
      memo: true,
      notificationJob: {
        select: { type: true, channel: true, student: { select: { user: { select: { name: true } } } } },
      },
    },
  })
  return {
    truncated: txs.length > USAGE_ROW_LIMIT,
    rows: txs.slice(0, USAGE_ROW_LIMIT).map((t) => ({
      id: t.id,
      createdAt: t.createdAt.toISOString(),
      type: t.type,
      studentName: t.notificationJob?.student.user.name ?? null,
      jobType: t.notificationJob?.type ?? null,
      channel: t.notificationJob?.channel ?? null,
      amount: t.amount,
      balanceAfter: t.balanceAfter,
      memo: t.memo,
    })),
  }
}

/** 이번 달 알림 발송 현황 (건수) — 학원(본원+지점) 전체 */
export async function getMonthlyJobCounts(walletAcademyId: string, monthKey: string) {
  const { from, to } = kstMonthBounds(monthKey)
  const groups = await prisma.notificationJob.groupBy({
    by: ['status'],
    where: {
      createdAt: { gte: from, lt: to },
      academy: { OR: [{ id: walletAcademyId }, { parentAcademyId: walletAcademyId }] },
    },
    _count: { _all: true },
  })
  const count = (s: string) => groups.find((g) => g.status === s)?._count._all ?? 0
  return {
    sent: count('SENT'),
    pending: count('PENDING'),
    failed: count('FAILED'),
    noCredit: count('SKIPPED_NO_CREDIT'),
  }
}
