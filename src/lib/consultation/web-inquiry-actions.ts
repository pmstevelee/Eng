'use server'

import { headers } from 'next/headers'
import { checkRateLimit } from '@/lib/security/rate-limit'
import { normalizePhone } from './constants'
import { processWebInquiry, type WebInquiryInput, type WebInquiryResult } from './web-inquiry'

// 외부 상담신청 폼 공개 액션 — 로그인 없이 호출됨

const RATE_LIMITED: WebInquiryResult = { ok: false, error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' }
const TEN_MINUTES = 10 * 60 * 1000
const ONE_HOUR = 60 * 60 * 1000

function clientIp(): string {
  const h = headers()
  return h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || 'unknown'
}

export async function submitWebInquiry(slug: string, input: WebInquiryInput): Promise<WebInquiryResult> {
  if (typeof slug !== 'string' || !input || typeof input !== 'object') {
    return { ok: false, error: '잘못된 요청입니다.' }
  }

  // honeypot: 봇에게는 성공처럼 보이게 하고 아무것도 저장하지 않음
  if (typeof input.website === 'string' && input.website.trim() !== '') return { ok: true }

  // IP당 10분 5회 / 1시간 15회, 같은 학원·연락처는 1시간 3회
  const ip = clientIp()
  const byIp = checkRateLimit(`apply:ip:${ip}`, { windowMs: TEN_MINUTES, max: 5 })
  const byIpHour = checkRateLimit(`apply:ip-hour:${ip}`, { windowMs: ONE_HOUR, max: 15 })
  if (!byIp.allowed || !byIpHour.allowed) return RATE_LIMITED
  const phone = normalizePhone(typeof input.phone === 'string' ? input.phone : '')
  if (phone && !checkRateLimit(`apply:phone:${slug}:${phone}`, { windowMs: ONE_HOUR, max: 3 }).allowed) {
    return RATE_LIMITED
  }

  try {
    return await processWebInquiry(slug, input)
  } catch (err) {
    console.error('[web-inquiry] 처리 실패:', err)
    return { ok: false, error: '신청을 처리하지 못했습니다. 잠시 후 다시 시도해주세요.' }
  }
}
