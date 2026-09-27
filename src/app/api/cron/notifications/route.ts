import { NextRequest, NextResponse } from 'next/server'
import { scanAbsentAlerts } from '@/lib/attendance/absent-alerts'
import { processNotificationQueue } from '@/lib/notifications/attendance-queue'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * 출결 알림 발송 큐 — 1분마다 실행 (Vercel Cron 또는 Supabase pg_cron + pg_net)
 * 1. 미등원 안내 등록 (notifyAbsent가 켜진 학원, 수업 시작 + 지각 허용시간 경과, 수업당 1회)
 * 2. 접수된 알림의 SOLAPI 최종 결과 확인 → 성공 건만 실제 채널 단가로 크레딧 차감
 * 3. PENDING 작업 최대 100건 발송 (실패 시 재시도, 3회 실패하면 FAILED)
 * 인증: Authorization: Bearer <CRON_SECRET>
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 })
  }
  if (req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startedAt = Date.now()
  // 미등원 스캔이 실패해도 이미 쌓인 알림 발송은 계속한다
  const absent = await scanAbsentAlerts().catch((err: unknown) => {
    console.error('[cron/notifications] 미등원 안내 등록 실패:', err)
    return null
  })
  const queue = await processNotificationQueue()

  return NextResponse.json({ ok: true, absent, queue, ms: Date.now() - startedAt })
}

// pg_cron(pg_net)은 POST로 호출하기 쉬워 둘 다 허용
export const POST = GET
