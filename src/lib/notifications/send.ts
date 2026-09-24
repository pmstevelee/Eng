import 'server-only'

import { Prisma } from '@/generated/prisma'
import { prisma } from '@/lib/prisma/client'
import { getSolapiConfig, sendSolapiMessage, type SolapiMessage } from './solapi'
import {
  NOTIFICATION_TEMPLATES,
  renderTemplate,
  toKakaoVariables,
  type TemplateKey,
  type TemplateVariables,
} from './templates'

export type NotificationMode = 'live' | 'log'

/** "live"로 명시한 경우에만 실제 발송 (미설정·오타는 모두 log) */
export function getNotificationMode(): NotificationMode {
  return process.env.NOTIFICATION_MODE === 'live' ? 'live' : 'log'
}

export type SendNotificationInput<K extends TemplateKey> = {
  academyId: string
  leadId?: string
  appointmentId?: string
  phone: string
  templateKey: K
  variables: TemplateVariables<K>
  /** 같은 키로는 한 번만 발송 (실패 건은 재시도 허용) */
  dedupeKey: string
}

export type SendNotificationResult =
  | { status: 'SENT' | 'SKIPPED' }
  | { status: 'FAILED'; error: string }
  | { status: 'DUPLICATE' }

type Channel = 'ALIMTALK' | 'SMS' | 'LMS'

/** SMS 90바이트(EUC-KR 기준, 한글 2바이트) 초과 시 LMS */
function textChannel(text: string): 'SMS' | 'LMS' {
  let bytes = 0
  for (const ch of text) bytes += ch.charCodeAt(0) > 0x7f ? 2 : 1
  return bytes > 90 ? 'LMS' : 'SMS'
}

/**
 * 학부모 알림 발송 + NotificationLog 기록.
 * - 알림톡 템플릿 ID·pfId가 있으면 알림톡(실패 시 SOLAPI가 SMS/LMS 대체발송), 없으면 같은 문구로 SMS/LMS
 * - NOTIFICATION_MODE=log 이면 발송하지 않고 SKIPPED로 기록
 * - 호출부 흐름을 막지 않도록 예외를 던지지 않는다
 */
export async function sendNotification<K extends TemplateKey>(
  input: SendNotificationInput<K>,
): Promise<SendNotificationResult> {
  const phone = input.phone.replace(/\D/g, '')
  const variables = input.variables as Record<string, string>
  const text = renderTemplate(input.templateKey, variables)
  const config = getSolapiConfig()
  const templateId = process.env[NOTIFICATION_TEMPLATES[input.templateKey].templateIdEnv] || null
  const channel: Channel = templateId && config?.pfId ? 'ALIMTALK' : textChannel(text)

  try {
    const claimed = await claimDedupeKey(input, phone, variables, channel)
    if (!claimed) return { status: 'DUPLICATE' }

    const finish = (data: Prisma.NotificationLogUpdateInput) =>
      prisma.notificationLog.update({ where: { dedupeKey: input.dedupeKey }, data })

    if (getNotificationMode() === 'log') {
      // 서버 로그에 연락처가 남지 않도록 뒤 4자리만
      console.log(`[notification:log] ${input.templateKey} → ***${phone.slice(-4)} (${channel})\n${text}`)
      await finish({ status: 'SKIPPED', errorMessage: 'log 모드: 실제로 발송하지 않았습니다.' })
      return { status: 'SKIPPED' }
    }

    if (!config) {
      const error = 'SOLAPI 환경변수(API 키·시크릿·발신번호)가 설정되지 않았습니다.'
      await finish({ status: 'FAILED', errorMessage: error })
      return { status: 'FAILED', error }
    }

    const message: SolapiMessage =
      channel === 'ALIMTALK' && templateId
        ? { kind: 'ALIMTALK', to: phone, templateId, variables: toKakaoVariables(input.templateKey, variables) }
        : {
            kind: channel === 'LMS' ? 'LMS' : 'SMS',
            to: phone,
            text,
            subject: `[${variables['학원명'] ?? ''}] ${NOTIFICATION_TEMPLATES[input.templateKey].label}`.slice(0, 40),
          }

    const result = await sendSolapiMessage(config, message)
    if (!result.ok) {
      await finish({ status: 'FAILED', errorMessage: result.error.slice(0, 500) })
      return { status: 'FAILED', error: result.error }
    }
    await finish({ status: 'SENT', sentAt: new Date(), providerMessageId: result.messageId, errorMessage: null })
    return { status: 'SENT' }
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    console.error('[notification] 발송 처리 실패:', input.dedupeKey, error)
    return { status: 'FAILED', error }
  }
}

/**
 * dedupeKey 선점. 새 키면 PENDING으로 생성, 이전에 실패한 키면 PENDING으로 되돌려 재시도.
 * 이미 발송(또는 진행 중)된 키면 false.
 */
async function claimDedupeKey(
  input: Omit<SendNotificationInput<TemplateKey>, 'variables'>,
  phone: string,
  variables: Record<string, string>,
  channel: Channel,
): Promise<boolean> {
  const data = {
    academyId: input.academyId,
    leadId: input.leadId ?? null,
    appointmentId: input.appointmentId ?? null,
    phone,
    templateKey: input.templateKey,
    variables,
    channel,
    status: 'PENDING' as const,
    errorMessage: null,
  }
  // 대부분의 중복은 여기서 걸러 unique 위반 에러 로그를 남기지 않는다 (동시 요청은 아래 P2002로 처리)
  const existing = await prisma.notificationLog.findUnique({
    where: { dedupeKey: input.dedupeKey },
    select: { status: true },
  })
  if (!existing) {
    try {
      await prisma.notificationLog.create({ data: { ...data, dedupeKey: input.dedupeKey } })
      return true
    } catch (err) {
      if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== 'P2002') throw err
      return false
    }
  }
  if (existing.status !== 'FAILED') return false
  const retried = await prisma.notificationLog.updateMany({
    where: { dedupeKey: input.dedupeKey, status: 'FAILED' },
    data: { ...data, sentAt: null, providerMessageId: null, createdAt: new Date() },
  })
  return retried.count > 0
}
