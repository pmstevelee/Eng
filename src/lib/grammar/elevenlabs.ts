// ElevenLabs 음성 합성 (서버 전용 — API 키를 쓰므로 클라이언트 컴포넌트에서 import 금지)
// SDK 없이 fetch로 호출한다. vitest에서 fetch를 모킹하므로 @/ 대신 상대 경로를 쓴다.
//
// 확인한 API (2026-10-26, elevenlabs.io/docs):
// - 음성 합성: POST https://api.elevenlabs.io/v1/text-to-speech/{voice_id}?output_format=mp3_44100_128
//   헤더 xi-api-key, 본문 { text, model_id, language_code?, voice_settings: { speed, ... } } → MP3 바이너리
// - 목소리 목록: GET https://api.elevenlabs.io/v2/voices?page_size=100 (next_page_token으로 다음 쪽)
// - 속도: voice_settings.speed 0.7~1.2 (기본 1.0)
// - 모델: eleven_multilingual_v2(장문 안정, 한국어·영어 지원, language_code 미지원)가 기본.
//   ELEVENLABS_MODEL_ID로 바꿀 수 있다 (예: eleven_flash_v2_5 — 절반 가격, language_code 지원)
// - 오류: { detail: { type, code, message } } — 401 키 오류, 402 크레딧 부족, 429 요청 과다, 5xx 일시 오류
//   (예전 응답은 401 + detail.status 'quota_exceeded'로 한도 초과를 알린다)

import { EN_SPEECH_RATE } from './video/constants'
import { getMp3DurationSec } from './video/mp3-duration'
import type { AudioVoices } from './video/audio-plan'
import type { VideoLang } from '../../types/grammar-video'

const API_BASE = 'https://api.elevenlabs.io'
const OUTPUT_FORMAT = 'mp3_44100_128'
const DEFAULT_MODEL_ID = 'eleven_multilingual_v2'
const REQUEST_TIMEOUT_MS = 45_000
const VOICES_CACHE_MS = 60 * 60 * 1000

/** 언어별 읽기 속도 — 영어 예문은 샘플처럼 조금 느리게 */
export const ELEVENLABS_SPEED: Record<VideoLang, number> = { ko: 1, en: EN_SPEECH_RATE }

export type ElevenLabsErrorKind = 'NO_KEY' | 'BAD_KEY' | 'QUOTA' | 'PAID_PLAN' | 'TEMPORARY' | 'VOICE' | 'BAD_REQUEST'

export class ElevenLabsError extends Error {
  constructor(
    readonly kind: ElevenLabsErrorKind,
    message: string,
    readonly status?: number,
  ) {
    super(message)
    this.name = 'ElevenLabsError'
  }
}

const MESSAGES: Record<ElevenLabsErrorKind, string> = {
  NO_KEY: 'ElevenLabs API 키가 설정되지 않았습니다. 서버 환경 변수 ELEVENLABS_API_KEY를 확인해 주세요.',
  BAD_KEY: 'ElevenLabs API 키가 올바르지 않습니다. 키를 다시 확인해 주세요.',
  QUOTA: 'ElevenLabs 사용 한도를 넘었습니다. 요금제의 남은 글자 수를 확인해 주세요.',
  PAID_PLAN: '이 목소리는 ElevenLabs 유료 요금제(또는 크레딧 충전)에서만 API로 쓸 수 있습니다. 요금제를 올리거나 기본 목소리를 골라 주세요.',
  TEMPORARY: 'ElevenLabs 일시 오류입니다. 잠시 후 다시 시도해 주세요.',
  VOICE: '선택한 목소리를 찾을 수 없습니다. 목소리를 다시 골라 주세요.',
  BAD_REQUEST: 'ElevenLabs가 요청을 처리하지 못했습니다. 문장 내용을 확인해 주세요.',
}

export function elevenLabsErrorMessage(error: unknown): string {
  if (error instanceof ElevenLabsError) return error.message
  return MESSAGES.TEMPORARY
}

export function getElevenLabsModelId(): string {
  return process.env.ELEVENLABS_MODEL_ID?.trim() || DEFAULT_MODEL_ID
}

function getApiKey(): string {
  const key = process.env.ELEVENLABS_API_KEY?.trim()
  if (!key) throw new ElevenLabsError('NO_KEY', MESSAGES.NO_KEY)
  return key
}

export function isElevenLabsConfigured(): boolean {
  return Boolean(process.env.ELEVENLABS_API_KEY?.trim())
}

/** 스크립트에 고른 목소리 → 없으면 환경 변수 기본 목소리. 둘 다 없으면 null */
export function resolveAudioVoices(koVoiceId?: string | null, enVoiceId?: string | null): AudioVoices | null {
  const ko = koVoiceId?.trim() || process.env.ELEVENLABS_KO_VOICE_ID?.trim()
  const en = enVoiceId?.trim() || process.env.ELEVENLABS_EN_VOICE_ID?.trim()
  if (!ko || !en) return null
  const modelId = getElevenLabsModelId()
  return {
    ko: { voiceId: ko, modelId, speed: ELEVENLABS_SPEED.ko },
    en: { voiceId: en, modelId, speed: ELEVENLABS_SPEED.en },
  }
}

interface ErrorDetail {
  code?: string
  status?: string
  type?: string
  message?: string
}

async function readErrorDetail(res: Response): Promise<ErrorDetail> {
  try {
    const body: unknown = await res.json()
    if (body && typeof body === 'object' && 'detail' in body) {
      const detail = (body as { detail: unknown }).detail
      if (detail && typeof detail === 'object') return detail as ErrorDetail
      if (typeof detail === 'string') return { message: detail }
    }
  } catch {
    // 본문이 JSON이 아님
  }
  return {}
}

/** HTTP 오류 → 한국어 메시지 */
export async function toElevenLabsError(res: Response): Promise<ElevenLabsError> {
  const detail = await readErrorDetail(res)
  const code = `${detail.code ?? ''} ${detail.status ?? ''} ${detail.type ?? ''}`.toLowerCase()
  const s = res.status
  // 무료 요금제에서 라이브러리 목소리를 쓰면 402 paid_plan_required — 글자 한도와 다르다
  if (code.includes('paid_plan')) return new ElevenLabsError('PAID_PLAN', MESSAGES.PAID_PLAN, s)
  if (s === 402 || code.includes('quota') || code.includes('insufficient') || code.includes('payment')) {
    return new ElevenLabsError('QUOTA', MESSAGES.QUOTA, s)
  }
  if (s === 401 || s === 403) return new ElevenLabsError('BAD_KEY', MESSAGES.BAD_KEY, s)
  if (s === 404 || code.includes('voice_not_found')) return new ElevenLabsError('VOICE', MESSAGES.VOICE, s)
  if (s === 400 || s === 422) return new ElevenLabsError('BAD_REQUEST', MESSAGES.BAD_REQUEST, s)
  return new ElevenLabsError('TEMPORARY', MESSAGES.TEMPORARY, s)
}

function isRetryable(status: number): boolean {
  return status === 429 || status >= 500
}

function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

/** 429·5xx·네트워크 오류는 한 번 더 시도한다 */
async function callApi(path: string, init: RequestInit, retryDelayMs = 1500): Promise<Response> {
  const apiKey = getApiKey()
  const headers = { 'xi-api-key': apiKey, ...(init.headers as Record<string, string> | undefined) }
  for (let attempt = 0; attempt < 2; attempt++) {
    let res: Response
    try {
      res = await fetch(`${API_BASE}${path}`, { ...init, headers, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) })
    } catch (error) {
      if (attempt === 0) {
        await wait(retryDelayMs)
        continue
      }
      console.error('[elevenlabs] 네트워크 오류:', error)
      throw new ElevenLabsError('TEMPORARY', MESSAGES.TEMPORARY)
    }
    if (res.ok) return res
    if (attempt === 0 && isRetryable(res.status)) {
      await wait(retryDelayMs)
      continue
    }
    throw await toElevenLabsError(res)
  }
  throw new ElevenLabsError('TEMPORARY', MESSAGES.TEMPORARY)
}

// ── 목소리 목록 ─────────────────────────────────────────────

export interface ElevenLabsVoice {
  voiceId: string
  name: string
  category: string | null
  /** language·accent·gender·age 등 */
  labels: Record<string, string>
  previewUrl: string | null
}

type VoicesCache = { at: number; voices: ElevenLabsVoice[] }
const globalForVoices = globalThis as unknown as { __elevenLabsVoices?: VoicesCache }

function toVoice(raw: unknown): ElevenLabsVoice | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (typeof r.voice_id !== 'string' || !r.voice_id) return null
  const labels: Record<string, string> = {}
  if (r.labels && typeof r.labels === 'object') {
    for (const [k, v] of Object.entries(r.labels as Record<string, unknown>)) if (typeof v === 'string') labels[k] = v
  }
  return {
    voiceId: r.voice_id,
    name: typeof r.name === 'string' ? r.name : r.voice_id,
    category: typeof r.category === 'string' ? r.category : null,
    labels,
    previewUrl: typeof r.preview_url === 'string' ? r.preview_url : null,
  }
}

/** 계정에서 쓸 수 있는 목소리 (1시간 캐시, 최대 500개) */
export async function listVoices(opts: { force?: boolean } = {}): Promise<ElevenLabsVoice[]> {
  const cached = globalForVoices.__elevenLabsVoices
  if (!opts.force && cached && Date.now() - cached.at < VOICES_CACHE_MS) return cached.voices

  const voices: ElevenLabsVoice[] = []
  let token: string | null = null
  for (let page = 0; page < 5; page++) {
    const q = new URLSearchParams({ page_size: '100', include_total_count: 'false' })
    if (token) q.set('next_page_token', token)
    const res = await callApi(`/v2/voices?${q.toString()}`, { method: 'GET' })
    const body = (await res.json()) as { voices?: unknown[]; has_more?: boolean; next_page_token?: string | null }
    for (const raw of body.voices ?? []) {
      const v = toVoice(raw)
      if (v) voices.push(v)
    }
    token = body.has_more && body.next_page_token ? body.next_page_token : null
    if (!token) break
  }
  globalForVoices.__elevenLabsVoices = { at: Date.now(), voices }
  return voices
}

// ── 음성 합성 ───────────────────────────────────────────────

export interface SynthesizedSegment {
  audio: Uint8Array
  durationSec: number
  /** 과금 글자 수 */
  chars: number
}

export interface SynthesizeOptions {
  modelId?: string
  speed?: number
}

/** 128kbps 기준 바이트로 길이 어림 (MP3 헤더를 못 읽을 때만) */
function estimateDurationFromBytes(bytes: number): number {
  return Math.round(((bytes * 8) / 128_000) * 1000) / 1000
}

/** 문장 하나를 MP3로 만든다 */
export async function synthesizeSegment(
  text: string,
  lang: VideoLang,
  voiceId: string,
  opts: SynthesizeOptions = {},
): Promise<SynthesizedSegment> {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (!clean) throw new ElevenLabsError('BAD_REQUEST', '읽을 문장이 비어 있습니다.')
  if (!voiceId) throw new ElevenLabsError('VOICE', MESSAGES.VOICE)

  const modelId = opts.modelId ?? getElevenLabsModelId()
  const speed = Math.min(1.2, Math.max(0.7, opts.speed ?? ELEVENLABS_SPEED[lang]))
  const body: Record<string, unknown> = {
    text: clean,
    model_id: modelId,
    voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0, use_speaker_boost: true, speed },
  }
  // multilingual v2는 language_code를 받지 않는다
  if (!modelId.startsWith('eleven_multilingual')) body.language_code = lang

  const res = await callApi(`/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=${OUTPUT_FORMAT}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify(body),
  })
  const audio = new Uint8Array(await res.arrayBuffer())
  if (audio.byteLength === 0) throw new ElevenLabsError('TEMPORARY', MESSAGES.TEMPORARY)
  const durationSec = getMp3DurationSec(audio) ?? estimateDurationFromBytes(audio.byteLength)
  return { audio, durationSec, chars: clean.length }
}
