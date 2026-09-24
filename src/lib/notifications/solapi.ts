import 'server-only'

import { createHmac, randomBytes } from 'crypto'

// SOLAPI REST 직접 호출 (SDK 미사용)
// 인증: HMAC-SHA256 apiKey=<key>, date=<ISO8601>, salt=<랜덤>, signature=hex(HMAC_SHA256(secret, date + salt))
// 발송: POST /messages/v4/send-many/detail

const API_URL = 'https://api.solapi.com/messages/v4/send-many/detail'
const SALT_ALPHABET = '1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'

export type SolapiConfig = {
  apiKey: string
  apiSecret: string
  pfId: string | null
  senderNumber: string
}

/** 필수 환경변수가 모두 있으면 설정 반환 (pfId는 알림톡에만 필요) */
export function getSolapiConfig(): SolapiConfig | null {
  const apiKey = process.env.SOLAPI_API_KEY
  const apiSecret = process.env.SOLAPI_API_SECRET
  const senderNumber = process.env.SOLAPI_SENDER_NUMBER?.replace(/\D/g, '')
  if (!apiKey || !apiSecret || !senderNumber) return null
  return { apiKey, apiSecret, senderNumber, pfId: process.env.SOLAPI_PFID || null }
}

function buildAuthHeader(apiKey: string, apiSecret: string): string {
  const bytes = randomBytes(32)
  let salt = ''
  for (let i = 0; i < 32; i++) salt += SALT_ALPHABET[bytes[i] % SALT_ALPHABET.length]
  const date = new Date().toISOString()
  const signature = createHmac('sha256', apiSecret).update(date + salt).digest('hex')
  return `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`
}

export type SolapiMessage =
  | {
      kind: 'ALIMTALK'
      to: string
      templateId: string
      /** { "#{변수}": "값" } — key·value 모두 string */
      variables: Record<string, string>
    }
  | { kind: 'SMS' | 'LMS'; to: string; text: string; subject?: string }

export type SolapiSendResult = { ok: true; messageId: string | null } | { ok: false; error: string }

type FailedMessage = { statusCode?: string; statusMessage?: string }
type SendManyResponse = {
  failedMessageList?: FailedMessage[]
  messageList?: { messageId?: string; statusCode?: string; statusMessage?: string }[]
  errorCode?: string
  errorMessage?: string
}

/**
 * 메시지 1건 발송 요청.
 * 알림톡은 disableSms를 지정하지 않아 실패 시 SOLAPI가 같은 내용을 SMS/LMS로 대체발송한다.
 * 결과는 "접수" 기준이며 최종 수신 결과는 SOLAPI 콘솔에서 확인한다.
 */
export async function sendSolapiMessage(config: SolapiConfig, message: SolapiMessage): Promise<SolapiSendResult> {
  const body =
    message.kind === 'ALIMTALK'
      ? {
          to: message.to,
          from: config.senderNumber,
          kakaoOptions: { pfId: config.pfId, templateId: message.templateId, variables: message.variables },
        }
      : {
          to: message.to,
          from: config.senderNumber,
          type: message.kind,
          text: message.text,
          ...(message.kind === 'LMS' && message.subject ? { subject: message.subject } : {}),
        }

  let res: Response
  try {
    res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        Authorization: buildAuthHeader(config.apiKey, config.apiSecret),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ messages: [body], showMessageList: true }),
      signal: AbortSignal.timeout(10_000),
      cache: 'no-store',
    })
  } catch (err) {
    return { ok: false, error: `SOLAPI 연결 실패: ${err instanceof Error ? err.message : String(err)}` }
  }

  let data: SendManyResponse
  try {
    data = (await res.json()) as SendManyResponse
  } catch {
    return { ok: false, error: `SOLAPI 응답 오류 (HTTP ${res.status})` }
  }

  if (!res.ok) {
    return { ok: false, error: `${data.errorCode ?? `HTTP ${res.status}`}: ${data.errorMessage ?? '발송 요청 실패'}` }
  }
  const failed = data.failedMessageList?.[0]
  if (failed) {
    return { ok: false, error: `${failed.statusCode ?? ''} ${failed.statusMessage ?? '접수 실패'}`.trim() }
  }
  return { ok: true, messageId: data.messageList?.[0]?.messageId ?? null }
}
