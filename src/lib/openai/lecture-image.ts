// AI 강의 장면 배경 그림 생성 (OpenAI 이미지 API) — 서버 전용
// 1536×1024 가로 그림 1장을 webp로 받는다. 모델은 AI_IMAGE_MODEL (기본 gpt-image-1-mini).

import OpenAI from 'openai'
import { AI_IMAGE_FALLBACK_MODEL, AI_IMAGE_MODEL } from './models'

/** 그림 1장 생성은 보통 20~60초 */
const REQUEST_TIMEOUT_MS = 150_000

export type LectureImageResult =
  | { ok: true; bytes: Uint8Array; contentType: 'image/webp' | 'image/png'; ext: 'webp' | 'png'; model: string }
  | { ok: false; error: string }

function statusOf(error: unknown): number | null {
  return error instanceof OpenAI.APIError && typeof error.status === 'number' ? error.status : null
}

function errorMessage(error: unknown): string {
  const status = statusOf(error)
  const raw = error instanceof Error ? error.message : ''
  if (status === 403 && /verif/i.test(raw)) {
    return 'OpenAI 조직 인증이 필요합니다. platform.openai.com → Settings → Organization에서 Verify Organization을 마친 뒤 다시 시도해 주세요.'
  }
  if (status === 400 && /safety|moderation|content_policy/i.test(raw)) {
    return '그림 내용이 OpenAI 안전 기준에 걸렸습니다. 프롬프트를 바꿔 다시 시도해 주세요.'
  }
  if (status === 401) return 'OPENAI_API_KEY가 올바르지 않습니다.'
  if (status === 429) return 'OpenAI 사용 한도에 걸렸습니다. 잠시 후 다시 시도하거나 결제 한도를 확인해 주세요.'
  if (error instanceof OpenAI.APIConnectionTimeoutError) return '그림 생성 시간이 너무 오래 걸렸습니다. 다시 시도해 주세요.'
  return '그림을 만들지 못했습니다. 잠시 후 다시 시도해 주세요.'
}

export async function generateLectureImage(prompt: string): Promise<LectureImageResult> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return { ok: false, error: 'OPENAI_API_KEY가 설정되지 않았습니다.' }
  const openai = new OpenAI({ apiKey, timeout: REQUEST_TIMEOUT_MS, maxRetries: 0 })

  const call = async (model: string): Promise<LectureImageResult> => {
    // dall-e-3는 크기·형식 옵션이 다르다 (png만, 1792×1024)
    const isDalle = model.startsWith('dall-e')
    const res = await openai.images.generate(
      isDalle
        ? { model, prompt, n: 1, size: '1792x1024', response_format: 'b64_json' }
        : { model, prompt, n: 1, size: '1536x1024', quality: 'medium', output_format: 'webp', output_compression: 85 },
    )
    const b64 = res.data?.[0]?.b64_json
    if (!b64) return { ok: false, error: '그림 응답이 비어 있습니다. 다시 시도해 주세요.' }
    const bytes = new Uint8Array(Buffer.from(b64, 'base64'))
    return isDalle
      ? { ok: true, bytes, contentType: 'image/png', ext: 'png', model }
      : { ok: true, bytes, contentType: 'image/webp', ext: 'webp', model }
  }

  try {
    try {
      return await call(AI_IMAGE_MODEL)
    } catch (error) {
      const status = statusOf(error)
      const rejected = (status === 400 || status === 404) && /model/i.test(error instanceof Error ? error.message : '')
      if (AI_IMAGE_MODEL === AI_IMAGE_FALLBACK_MODEL || !rejected) throw error
      console.error('[lecture-image] 모델 거부, 기본 이미지 모델로 재시도', { model: AI_IMAGE_MODEL })
      return await call(AI_IMAGE_FALLBACK_MODEL)
    }
  } catch (error) {
    console.error('[lecture-image] 생성 실패:', error)
    return { ok: false, error: errorMessage(error) }
  }
}
