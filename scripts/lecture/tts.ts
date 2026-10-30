// TTS 공급자 추상화 — LECTURE_TTS_PROVIDER=elevenlabs | google | openai
// 세 공급자 모두 fetch로 직접 호출한다 (SDK 설치 없음).
//
// 확인한 공식 문서 (2026-10-30)
// - ElevenLabs: POST /v1/text-to-speech/{voice_id}/with-timestamps → { audio_base64, alignment{characters, character_start_times_seconds, character_end_times_seconds} }
//   eleven_v4(최상위, 한국어 지원, language_code 지원), voice_settings.speed 0.7~1.2, previous_text/next_text로 이어 읽기 문맥, seed
// - Google Cloud TTS: POST https://texttospeech.googleapis.com/v1/text:synthesize?key=… , Chirp 3: HD(ko-KR-Chirp3-HD-*, en-US-Chirp3-HD-*),
//   speakingRate 0.25~2.0, 단어 타임스탬프 없음 → Whisper 단어 시간으로 대신
// - OpenAI: POST /v1/audio/speech (gpt-4o-mini-tts, instructions로 말투 지정, 추천 보이스 marin·cedar), 타임스탬프 없음.
//   2027-01-06 종료 예정 공지가 있어 예비용으로만 둔다.

import { createHash } from 'node:crypto'
import type { Emotion, Lang } from '../../src/lib/lecture-pipeline/types'

export interface TtsRequest {
  text: string
  lang: Lang
  emotion: Emotion
  previousText?: string
  nextText?: string
  /** 다시 만들기 때 바꾸면 다른 읽기가 나온다 */
  seed?: number
}

export interface TtsAlignment {
  chars: string[]
  starts: number[]
  ends: number[]
}

export interface TtsResult {
  audio: Buffer
  ext: 'mp3' | 'wav'
  alignment?: TtsAlignment
}

export interface TtsProvider {
  id: 'elevenlabs' | 'google' | 'openai'
  model: string
  voice(lang: Lang): string
  /** 음성이 같으면 다시 만들지 않기 위한 설정 서명 (문장 제외) */
  settingsKey(lang: Lang, emotion: Emotion): string
  synthesize(req: TtsRequest): Promise<TtsResult>
}

const env = (k: string) => process.env[k]?.trim() || ''
const num = (k: string, fallback: number) => {
  const v = Number(env(k))
  return Number.isFinite(v) && v > 0 ? v : fallback
}

/** 언어별 속도 — 한국어는 또렷하게 조금 천천히, 영어 예문은 학습용으로 조금 더 천천히 */
const speedFor = (lang: Lang) => (lang === 'ko' ? num('LECTURE_KO_SPEED', 0.95) : num('LECTURE_EN_SPEED', 0.9))

class TtsError extends Error {}

async function postJson(url: string, headers: Record<string, string>, body: unknown, label: string): Promise<Response> {
  let lastError = ''
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body), signal: AbortSignal.timeout(60_000) }).catch(
      (e: unknown) => {
        lastError = e instanceof Error ? e.message : String(e)
        return null
      },
    )
    if (res?.ok) return res
    if (res) {
      const text = await res.text().catch(() => '')
      lastError = `${res.status} ${text.slice(0, 300)}`
      if (res.status === 401 || res.status === 403) throw new TtsError(`${label} 인증 오류예요. .env.local의 API 키를 확인해 주세요. (${lastError})`)
      if (res.status === 402) throw new TtsError(`${label} 크레딧(사용 한도)이 부족해요. 요금제·남은 글자 수를 확인해 주세요.`)
      if (res.status === 400 || res.status === 404 || res.status === 422) throw new TtsError(`${label} 요청 오류: ${lastError}`)
    }
    await new Promise((r) => setTimeout(r, attempt * 1500))
  }
  throw new TtsError(`${label} 일시 오류로 음성을 만들지 못했어요: ${lastError}`)
}

// ── ElevenLabs ────────────────────────────────────────────

/** 감정별 음성 설정 — 설명은 안정적으로, 강조·칭찬은 표현을 조금 더 */
const ELEVEN_EMOTION: Record<Emotion, { stability: number; style: number }> = {
  설명: { stability: 0.55, style: 0.1 },
  강조: { stability: 0.45, style: 0.3 },
  질문: { stability: 0.45, style: 0.25 },
  칭찬: { stability: 0.4, style: 0.4 },
}

function elevenLabs(): TtsProvider {
  const key = env('ELEVENLABS_API_KEY')
  if (!key) throw new TtsError('ELEVENLABS_API_KEY가 없어요. .env.local에 넣어 주세요.')
  const model = env('LECTURE_ELEVENLABS_MODEL') || 'eleven_v4'
  const voices = {
    ko: env('LECTURE_KO_VOICE_ID') || env('ELEVENLABS_KO_VOICE_ID'),
    en: env('LECTURE_EN_VOICE_ID') || env('ELEVENLABS_EN_VOICE_ID'),
  }
  if (!voices.ko || !voices.en) throw new TtsError('LECTURE_KO_VOICE_ID·LECTURE_EN_VOICE_ID(ElevenLabs 보이스 id)를 .env.local에 넣어 주세요.')
  const supportsLanguageCode = !model.startsWith('eleven_multilingual')
  const settings = (lang: Lang, emotion: Emotion) => ({ ...ELEVEN_EMOTION[emotion], similarity_boost: 0.75, use_speaker_boost: true, speed: speedFor(lang) })
  return {
    id: 'elevenlabs',
    model,
    voice: (lang) => voices[lang],
    settingsKey: (lang, emotion) => JSON.stringify(['elevenlabs', model, voices[lang], settings(lang, emotion)]),
    async synthesize(req) {
      const body = {
        text: req.text,
        model_id: model,
        ...(supportsLanguageCode ? { language_code: req.lang } : {}),
        voice_settings: settings(req.lang, req.emotion),
        ...(req.previousText ? { previous_text: req.previousText } : {}),
        ...(req.nextText ? { next_text: req.nextText } : {}),
        ...(req.seed !== undefined ? { seed: req.seed } : {}),
      }
      const res = await postJson(
        `https://api.elevenlabs.io/v1/text-to-speech/${voices[req.lang]}/with-timestamps?output_format=mp3_44100_128`,
        { 'xi-api-key': key },
        body,
        'ElevenLabs',
      )
      const json = (await res.json()) as {
        audio_base64?: string
        alignment?: { characters: string[]; character_start_times_seconds: number[]; character_end_times_seconds: number[] } | null
      }
      if (!json.audio_base64) throw new TtsError('ElevenLabs 응답에 음성이 없어요.')
      const a = json.alignment
      return {
        audio: Buffer.from(json.audio_base64, 'base64'),
        ext: 'mp3',
        ...(a ? { alignment: { chars: a.characters, starts: a.character_start_times_seconds, ends: a.character_end_times_seconds } } : {}),
      }
    },
  }
}

// ── Google Cloud TTS (Chirp 3: HD) ────────────────────────

function google(): TtsProvider {
  const key = env('GOOGLE_TTS_API_KEY')
  if (!key) throw new TtsError('GOOGLE_TTS_API_KEY가 없어요. .env.local에 넣어 주세요.')
  const voices = {
    ko: env('GOOGLE_TTS_KO_VOICE') || 'ko-KR-Chirp3-HD-Charon',
    en: env('GOOGLE_TTS_EN_VOICE') || 'en-US-Chirp3-HD-Kore',
  }
  return {
    id: 'google',
    model: 'chirp3-hd',
    voice: (lang) => voices[lang],
    settingsKey: (lang) => JSON.stringify(['google', voices[lang], speedFor(lang)]),
    async synthesize(req) {
      const res = await postJson(
        `https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(key)}`,
        {},
        {
          input: { text: req.text },
          voice: { languageCode: req.lang === 'ko' ? 'ko-KR' : 'en-US', name: voices[req.lang] },
          audioConfig: { audioEncoding: 'MP3', sampleRateHertz: 44100, speakingRate: speedFor(req.lang) },
        },
        'Google TTS',
      )
      const json = (await res.json()) as { audioContent?: string }
      if (!json.audioContent) throw new TtsError('Google TTS 응답에 음성이 없어요.')
      return { audio: Buffer.from(json.audioContent, 'base64'), ext: 'mp3' }
    },
  }
}

// ── OpenAI TTS (예비) ─────────────────────────────────────

const OPENAI_STYLE: Record<Lang, string> = {
  ko: '한국 중학생에게 영어 문법을 가르치는 친근하고 또렷한 한국어 선생님. 표준어 존댓말, 너무 빠르지 않게.',
  en: 'A professional American English announcer reading an example sentence for language learners. Clear, natural, slightly slow.',
}
const OPENAI_EMOTION: Record<Emotion, string> = { 설명: '차분하게 설명', 강조: '핵심을 힘주어 강조', 질문: '학생에게 묻듯 끝을 올려서', 칭찬: '밝게 칭찬하듯' }

function openai(): TtsProvider {
  const key = env('OPENAI_API_KEY')
  if (!key) throw new TtsError('OPENAI_API_KEY가 없어요.')
  const model = env('LECTURE_OPENAI_TTS_MODEL') || 'gpt-4o-mini-tts'
  const voices = { ko: env('LECTURE_OPENAI_KO_VOICE') || 'marin', en: env('LECTURE_OPENAI_EN_VOICE') || 'cedar' }
  return {
    id: 'openai',
    model,
    voice: (lang) => voices[lang],
    settingsKey: (lang, emotion) => JSON.stringify(['openai', model, voices[lang], OPENAI_STYLE[lang], OPENAI_EMOTION[emotion], speedFor(lang)]),
    async synthesize(req) {
      const res = await postJson(
        'https://api.openai.com/v1/audio/speech',
        { authorization: `Bearer ${key}` },
        { model, voice: voices[req.lang], input: req.text, instructions: `${OPENAI_STYLE[req.lang]} 말투: ${OPENAI_EMOTION[req.emotion]}.`, response_format: 'mp3', speed: speedFor(req.lang) },
        'OpenAI TTS',
      )
      return { audio: Buffer.from(await res.arrayBuffer()), ext: 'mp3' }
    },
  }
}

export function createTtsProvider(): TtsProvider {
  const id = (env('LECTURE_TTS_PROVIDER') || 'elevenlabs').toLowerCase()
  if (id === 'elevenlabs') return elevenLabs()
  if (id === 'google') return google()
  if (id === 'openai') return openai()
  throw new TtsError(`LECTURE_TTS_PROVIDER "${id}"는 지원하지 않아요 (elevenlabs | google | openai).`)
}

/** 음성 캐시 키 — 공급자·보이스·설정·읽을 문장이 같으면 다시 만들지 않는다 */
export function audioHash(provider: TtsProvider, lang: Lang, emotion: Emotion, spokenText: string): string {
  return createHash('sha1').update(provider.settingsKey(lang, emotion)).update('\n').update(spokenText).digest('hex').slice(0, 16)
}
