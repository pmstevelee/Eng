import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import sample from './samples/passive-voice.json'
import { parseVideoScenes, type VideoScene } from '../../../types/grammar-video'
import { ElevenLabsError, synthesizeSegment } from '../elevenlabs'
import { isSpokenSegment, planScriptAudio, type AudioVoices } from './audio-plan'
import { applySceneAudio, generateSceneAudioFiles, type SceneAudioDeps } from './scene-audio'

const voices: AudioVoices = {
  ko: { voiceId: 'ko-voice', modelId: 'eleven_multilingual_v2', speed: 1 },
  en: { voiceId: 'en-voice', modelId: 'eleven_multilingual_v2', speed: 0.88 },
}

/** 128kbps MP3 프레임 n개 (프레임당 1152/44100초) */
function mp3(n: number): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(417 * n)
  for (let i = 0; i < n; i++) out.set([0xff, 0xfb, 0x90, 0x00], i * 417)
  return out
}

type FetchCall = { url: string; body: Record<string, unknown> }
let calls: FetchCall[] = []
let stored: Map<string, Uint8Array>

function okAudio(): Response {
  return new Response(mp3(50), { status: 200, headers: { 'Content-Type': 'audio/mpeg' } })
}

beforeEach(() => {
  calls = []
  stored = new Map()
  process.env.ELEVENLABS_API_KEY = 'test-key'
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, body: JSON.parse(String(init.body)) as Record<string, unknown> })
      return okAudio()
    }),
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
  delete process.env.ELEVENLABS_API_KEY
})

const deps: SceneAudioDeps = {
  synthesize: (text, lang, voiceId, opts) => synthesizeSegment(text, lang, voiceId, opts),
  upload: async (path, audio) => {
    stored.set(path, audio)
  },
}

function fixture(): VideoScene[] {
  return parseVideoScenes(sample).scenes
}

async function runScene(scenes: VideoScene[], sceneId: string) {
  const scene = scenes.find((s) => s.id === sceneId)
  if (!scene) throw new Error('no scene')
  const result = await generateSceneAudioFiles('script-1', scene, voices, deps)
  const applied = applySceneAudio(scenes, sceneId, result.generated, voices)
  return { result, applied }
}

describe('generateSceneAudioFiles + applySceneAudio (fetch 모킹)', () => {
  it('장면 1개: 읽는 세그먼트만 호출 → 다시 누르면 호출 없음 → 문장 1개 수정 시 그 문장만', async () => {
    let scenes = fixture()
    const quiz = scenes.find((s) => s.id === 'quiz')
    if (!quiz) throw new Error('quiz 장면 없음')
    const spoken = quiz.segments.filter(isSpokenSegment)
    expect(spoken.length).toBeLessThan(quiz.segments.length) // 대기 세그먼트 포함 장면

    // 1) 처음 생성
    const first = await runScene(scenes, 'quiz')
    expect(first.result.error).toBeNull()
    expect(calls).toHaveLength(spoken.length)
    expect(first.result.chars).toBe(spoken.reduce((n, s) => n + s.text.trim().length, 0))
    scenes = first.applied.scenes
    const saved = scenes.find((s) => s.id === 'quiz')?.segments.filter(isSpokenSegment) ?? []
    for (const s of saved) {
      expect(s.audioPath).toMatch(new RegExp(`^script-1/${s.id}-[0-9a-z]+\\.mp3$`))
      expect(s.durationSec).toBeCloseTo((50 * 1152) / 44100, 3)
      expect(stored.has(s.audioPath as string)).toBe(true)
    }

    // 2) 같은 장면 다시 → 호출 없음
    calls = []
    const again = await runScene(scenes, 'quiz')
    expect(calls).toHaveLength(0)
    expect(again.result.generated).toHaveLength(0)

    // 3) 문장 1개 수정 → 그 문장만, 이전 파일은 지울 대상
    const target = saved[0]
    scenes = scenes.map((s) =>
      s.id === 'quiz'
        ? ({ ...s, segments: s.segments.map((seg) => (seg.id === target.id ? { ...seg, text: `${seg.text} 다시 들어 볼까요?` } : seg)) } as VideoScene)
        : s,
    )
    calls = []
    const edited = await runScene(scenes, 'quiz')
    expect(calls).toHaveLength(1)
    expect(calls[0].body.text).toBe(`${target.text} 다시 들어 볼까요?`)
    expect(edited.applied.applied).toHaveLength(1)
    expect(edited.applied.applied[0].previousPath).toBe(target.audioPath)
    expect(edited.applied.applied[0].audioPath).not.toBe(target.audioPath)
  })

  it('영어는 0.88 속도·영어 목소리, multilingual v2에는 language_code를 보내지 않는다', async () => {
    const scenes = fixture()
    const withEn = scenes.find((s) => s.segments.some((seg) => seg.lang === 'en'))
    if (!withEn) throw new Error('영어 세그먼트 없음')
    await runScene(scenes, withEn.id)
    const enIndex = withEn.segments.filter(isSpokenSegment).findIndex((s) => s.lang === 'en')
    const call = calls[enIndex]
    expect(call.url).toContain('/v1/text-to-speech/en-voice?output_format=mp3_44100_128')
    expect((call.body.voice_settings as { speed: number }).speed).toBe(0.88)
    expect(call.body.model_id).toBe('eleven_multilingual_v2')
    expect(call.body).not.toHaveProperty('language_code')
  })

  it('전체 장면을 만들면 스크립트 음성 준비 완료', async () => {
    let scenes = fixture()
    for (const id of scenes.map((s) => s.id)) scenes = (await runScene(scenes, id)).applied.scenes
    expect(planScriptAudio(scenes, voices).ready).toBe(true)
    expect(calls).toHaveLength(scenes.flatMap((s) => s.segments).filter(isSpokenSegment).length)
  })

  it('중간에 실패하면 멈추고, 앞에서 만든 음성은 남긴다', async () => {
    let n = 0
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        n += 1
        if (n === 2) return new Response(JSON.stringify({ detail: { type: 'payment_required', code: 'insufficient_credits' } }), { status: 402 })
        return okAudio()
      }),
    )
    const scenes = fixture()
    const { result } = await runScene(scenes, 'compare')
    expect(result.generated).toHaveLength(1)
    expect(result.error).toBeInstanceOf(ElevenLabsError)
    expect((result.error as ElevenLabsError).kind).toBe('QUOTA')
    expect((result.error as Error).message).toContain('한도')
  })

  it('생성 중 문장이 또 바뀌면 그 세그먼트는 반영하지 않고 새 파일을 지울 대상으로 돌린다', async () => {
    const scenes = fixture()
    const scene = scenes.find((s) => s.id === 'opening') as VideoScene
    const result = await generateSceneAudioFiles('script-1', scene, voices, deps)
    const changed = scenes.map((s) =>
      s.id === 'opening' ? ({ ...s, segments: s.segments.map((seg, i) => (i === 0 ? { ...seg, text: '바뀐 문장' } : seg)) } as VideoScene) : s,
    )
    const applied = applySceneAudio(changed, 'opening', result.generated, voices)
    expect(applied.orphanPaths).toEqual([result.generated[0].audioPath])
    expect(applied.applied).toHaveLength(result.generated.length - 1)
  })
})

describe('ElevenLabs 오류 메시지', () => {
  it('키가 없으면 호출하지 않고 한국어 안내', async () => {
    delete process.env.ELEVENLABS_API_KEY
    await expect(synthesizeSegment('안녕하세요', 'ko', 'v')).rejects.toMatchObject({ kind: 'NO_KEY' })
    expect(calls).toHaveLength(0)
  })

  it('예전 형식 401 quota_exceeded도 한도 초과로 본다', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ detail: { status: 'quota_exceeded' } }), { status: 401 })))
    await expect(synthesizeSegment('안녕하세요', 'ko', 'v')).rejects.toMatchObject({ kind: 'QUOTA' })
  })

  it('무료 요금제 + 라이브러리 목소리는 PAID_PLAN (한도 초과와 구분)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ detail: { type: 'payment_required', code: 'paid_plan_required', status: 'payment_required' } }), { status: 402 })),
    )
    await expect(synthesizeSegment('안녕하세요', 'ko', 'v')).rejects.toMatchObject({ kind: 'PAID_PLAN' })
  })

  it('잘못된 키는 BAD_KEY', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ detail: { code: 'invalid_api_key' } }), { status: 401 })))
    await expect(synthesizeSegment('안녕하세요', 'ko', 'v')).rejects.toMatchObject({ kind: 'BAD_KEY' })
  })

  it('429는 한 번 기다렸다 다시 시도한다', async () => {
    vi.useFakeTimers()
    let n = 0
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        n += 1
        return n === 1 ? new Response('{}', { status: 429 }) : okAudio()
      }),
    )
    const p = synthesizeSegment('안녕하세요', 'ko', 'v')
    await vi.advanceTimersByTimeAsync(2000)
    await expect(p).resolves.toMatchObject({ chars: 5 })
    expect(n).toBe(2)
  })

  it('5xx가 계속되면 일시 오류', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 503 })))
    const p = synthesizeSegment('안녕하세요', 'ko', 'v')
    const check = expect(p).rejects.toMatchObject({ kind: 'TEMPORARY' })
    await vi.advanceTimersByTimeAsync(2000)
    await check
  })
})
