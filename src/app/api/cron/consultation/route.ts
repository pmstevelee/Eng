import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma/client'
import { addDaysToDateKey, kstDateStart, todayKst } from '@/lib/consultation/constants'
import { notifyAppointment } from '@/lib/consultation/notify'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5분

/**
 * 상담관리 일일 작업 — Vercel Cron 매일 01:00 UTC (= 10:00 KST)
 * - 내일(KST) 예정된 상담 예약에 전날 리마인드 발송 (dedupeKey로 중복 방지, 취소 예약은 발송 직전 재확인)
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 })
  }
  if (req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // DB는 UTC — KST 날짜 경계로 변환해서 조회
  const tomorrow = addDaysToDateKey(todayKst(), 1)
  const from = kstDateStart(tomorrow)
  const to = kstDateStart(addDaysToDateKey(tomorrow, 1))

  const appointments = await prisma.consultationAppointment.findMany({
    where: {
      status: 'SCHEDULED',
      scheduledAt: { gte: from, lt: to },
      lead: { status: { notIn: ['ENROLLED', 'LOST'] } },
    },
    select: { id: true },
    orderBy: { scheduledAt: 'asc' },
  })

  const summary = { target: appointments.length, sent: 0, skipped: 0, duplicate: 0, failed: 0 }
  // 발송 API 부하를 고려해 5건씩 병렬 처리
  for (let i = 0; i < appointments.length; i += 5) {
    const results = await Promise.all(appointments.slice(i, i + 5).map((a) => notifyAppointment(a.id, 'reminder')))
    for (const r of results) {
      if (!r) summary.skipped++
      else if (r.status === 'SENT') summary.sent++
      else if (r.status === 'SKIPPED') summary.skipped++
      else if (r.status === 'DUPLICATE') summary.duplicate++
      else summary.failed++
    }
  }

  console.log(`[cron/consultation] ${tomorrow} 리마인드`, summary)
  return NextResponse.json({ date: tomorrow, reminders: summary })
}
