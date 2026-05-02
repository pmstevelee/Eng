import { NextRequest, NextResponse } from 'next/server'
import { verifyWebhook } from '@/lib/portone/server'
import { dispatchWebhookEvent } from '@/lib/webhooks/handler'
import { prisma } from '@/lib/prisma/client'
import { WebhookStatus } from '@/generated/prisma'
import { sendSlackAlert } from '@/lib/notifications/slack'
import type { PortOneWebhookEvent } from '@/lib/portone/types'

// 포트원 공식 IP 대역 (https://developers.portone.io/docs/ko/webhook/security)
const PORTONE_IP_ALLOWLIST = [
  '52.78.100.19',
  '52.78.48.223',
  '52.78.5.241',
  '13.124.88.85',
  // 로컬 개발 환경
  '::1',
  '127.0.0.1',
]

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    '0.0.0.0'
  )
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const clientIp = getClientIp(req)

  // IP allowlist 검사 (개발 환경 제외)
  if (process.env.NODE_ENV === 'production' && !PORTONE_IP_ALLOWLIST.includes(clientIp)) {
    await sendSlackAlert({
      level: 'warn',
      title: '웹훅 허용되지 않은 IP 접근',
      message: `IP ${clientIp}에서 웹훅 엔드포인트 접근 시도`,
    })
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Raw body를 string으로 보관 (서명 검증용)
  const rawBody = await req.text()

  // 서명 검증
  let event: PortOneWebhookEvent
  try {
    const headers = Object.fromEntries(req.headers.entries())
    event = await verifyWebhook(rawBody, headers)
  } catch {
    await sendSlackAlert({
      level: 'error',
      title: '웹훅 서명 검증 실패 — 보안 이슈 가능성',
      message: `IP: ${clientIp}\nBody 길이: ${rawBody.length}자`,
    })
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // eventId 추출 — 포트원은 헤더 webhook-id 또는 payload 내 id 사용
  const webhookId =
    req.headers.get('webhook-id') ??
    req.headers.get('x-webhook-id') ??
    // 포트원 V2 일부 버전은 payload에 id 포함
    (typeof (event as unknown as Record<string, unknown>)['webhookId'] === 'string'
      ? String((event as unknown as Record<string, unknown>)['webhookId'])
      : null) ??
    `${event.type}:${event.data.paymentId ?? event.data.billingKey ?? Date.now()}`

  // 멱등성 체크: 같은 이벤트 재수신 시 무시 (동기 처리 필요)
  const existing = await prisma.webhookEvent.findUnique({ where: { eventId: webhookId } })
  if (existing) {
    // 이미 처리된 이벤트 — 200 반환 (포트원 재전송 방지)
    return NextResponse.json({ ok: true, deduplicated: true })
  }

  // 이벤트 저장 (RECEIVED 상태)
  const webhookEvent = await prisma.webhookEvent.create({
    data: {
      eventId: webhookId,
      eventType: event.type,
      payload: JSON.parse(rawBody),
      status: WebhookStatus.RECEIVED,
    },
  })

  // 즉시 200 응답 (포트원 타임아웃 방지), 후처리는 백그라운드
  // 단, 처리 결과를 DB에 업데이트하기 위해 fire-and-forget 패턴 사용
  void processEventBackground(webhookEvent.id, event)

  return NextResponse.json({ ok: true })
}

async function processEventBackground(
  dbEventId: string,
  event: PortOneWebhookEvent,
): Promise<void> {
  try {
    await dispatchWebhookEvent(event)
    await prisma.webhookEvent.update({
      where: { id: dbEventId },
      data: { status: WebhookStatus.PROCESSED, processedAt: new Date() },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    await prisma.webhookEvent.update({
      where: { id: dbEventId },
      data: { status: WebhookStatus.FAILED, errorMsg: msg },
    })
  }
}
