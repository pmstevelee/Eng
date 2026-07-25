import { NextRequest, NextResponse } from 'next/server'
import { dispatchWebhookEvent } from '@/lib/webhooks/handler'
import { prisma } from '@/lib/prisma/client'
import { WebhookStatus } from '@/generated/prisma'
import type { TossWebhookEvent } from '@/lib/tosspayments/server'

// 토스페이먼츠는 PAYMENT_STATUS_CHANGED / BILLING_DELETED 웹훅에 서명이나
// 발신 IP 대역을 제공하지 않는다 (서명은 지급대행/셀러 이벤트 전용).
// 따라서 IP·서명 검증 대신, handler.ts의 dispatchWebhookEvent가 항상
// getPayment()로 토스 서버에 재조회해 실제 상태를 확인한 뒤에만 반영한다.
// (payload는 "재조회를 트리거하는 신호"로만 사용)

export async function POST(req: NextRequest): Promise<NextResponse> {
  const rawBody = await req.text()

  let event: TossWebhookEvent
  try {
    event = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!event || typeof event.eventType !== 'string') {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  const webhookId =
    req.headers.get('tosspayments-webhook-transmission-id') ??
    `${event.eventType}:${event.data?.orderId ?? event.data?.billingKey ?? Date.now()}`

  // 멱등성 체크: 같은 이벤트 재수신 시 무시
  const existing = await prisma.webhookEvent.findUnique({ where: { eventId: webhookId } })
  if (existing) {
    return NextResponse.json({ ok: true, deduplicated: true })
  }

  const webhookEvent = await prisma.webhookEvent.create({
    data: {
      eventId: webhookId,
      eventType: event.eventType,
      payload: JSON.parse(rawBody),
      status: WebhookStatus.RECEIVED,
    },
  })

  // 즉시 200 응답 (타임아웃 방지), 후처리는 백그라운드
  void processEventBackground(webhookEvent.id, event)

  return NextResponse.json({ ok: true })
}

async function processEventBackground(
  dbEventId: string,
  event: TossWebhookEvent,
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
