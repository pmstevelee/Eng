// 운영팀 슬랙 웹훅 알림

interface SlackAlertParams {
  level: 'info' | 'warn' | 'error'
  title: string
  message: string
  fields?: Array<{ label: string; value: string }>
}

const LEVEL_COLORS = {
  info: '#1865F2',
  warn: '#FFB100',
  error: '#D92916',
} as const

export async function sendSlackAlert(params: SlackAlertParams): Promise<void> {
  const url = process.env.SLACK_WEBHOOK_URL
  if (!url) {
    console.log(`[slack:${params.level}] ${params.title}\n${params.message}`)
    return
  }

  const payload = {
    attachments: [
      {
        color: LEVEL_COLORS[params.level],
        title: params.title,
        text: params.message,
        fields: params.fields?.map((f) => ({
          title: f.label,
          value: f.value,
          short: true,
        })),
        footer: 'EduLevel Billing',
        ts: Math.floor(Date.now() / 1000),
      },
    ],
  }

  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch (err) {
    console.error('[slack] 알림 전송 실패', err)
  }
}

export async function sendSlackPaymentAlert(params: {
  academyName: string
  amount: number
  paymentId: string
  type: string
}): Promise<void> {
  await sendSlackAlert({
    level: 'info',
    title: `💳 결제 완료 — ${params.amount.toLocaleString()}원`,
    message: `학원: ${params.academyName}`,
    fields: [
      { label: '결제 ID', value: params.paymentId },
      { label: '유형', value: params.type },
      { label: '금액', value: `${params.amount.toLocaleString()}원` },
    ],
  })
}

export async function sendSlackRecurringFailAlert(params: {
  academyName: string
  amount: number
  paymentId: string
  reason: string
  retryAt: Date
}): Promise<void> {
  await sendSlackAlert({
    level: 'warn',
    title: '⚠️ 정기결제 실패',
    message: `학원: ${params.academyName}\n사유: ${params.reason}`,
    fields: [
      { label: '결제 ID', value: params.paymentId },
      { label: '금액', value: `${params.amount.toLocaleString()}원` },
      { label: '재시도 예정', value: params.retryAt.toLocaleString('ko-KR') },
    ],
  })
}
