'use server'

import { headers } from 'next/headers'
import { checkRateLimit } from '@/lib/security/rate-limit'
import type { AdaptiveNextResult } from '@/app/(dashboard)/student/tests/[sessionId]/adaptive-actions'
import { answerPlacementQuestion, answerPlacementWriting, startPlacement } from './runner'

// 비회원 레벨테스트 공개 액션 — 로그인 없이 토큰으로만 접근
// 토큰이 틀리거나 만료되면 어떤 문의 정보도 돌려주지 않는다.

const RATE_LIMITED: AdaptiveNextResult = {
  type: 'error',
  error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
}

function clientIp(): string {
  const h = headers()
  return h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || 'unknown'
}

/** 토큰당 분당 30회, IP당 분당 120회 (문항 1개 응답 ≒ 1회) */
function allowed(token: string): boolean {
  const byToken = checkRateLimit(`placement:token:${token}`, { max: 30 })
  const byIp = checkRateLimit(`placement:ip:${clientIp()}`, { max: 120 })
  return byToken.allowed && byIp.allowed
}

export async function startPlacementTest(token: string): Promise<AdaptiveNextResult> {
  if (typeof token !== 'string' || !allowed(token)) return RATE_LIMITED
  return startPlacement(token)
}

export async function submitPlacementAnswer(
  token: string,
  questionId: string,
  answer: string,
): Promise<AdaptiveNextResult> {
  if (typeof token !== 'string' || !allowed(token)) return RATE_LIMITED
  if (typeof questionId !== 'string' || typeof answer !== 'string') return { type: 'error', error: '잘못된 요청입니다.' }
  return answerPlacementQuestion(token, questionId, answer)
}

export async function submitPlacementWriting(
  token: string,
  questionIndex: number,
  text: string,
): Promise<AdaptiveNextResult> {
  if (typeof token !== 'string' || !allowed(token)) return RATE_LIMITED
  if (!Number.isInteger(questionIndex) || typeof text !== 'string') return { type: 'error', error: '잘못된 요청입니다.' }
  return answerPlacementWriting(token, questionIndex, text)
}
