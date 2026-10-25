'use server'

// AI 강의 음성 (ElevenLabs) — SUPER_ADMIN 전용
// 장면 1개 = 호출 1번 (Vercel 시간 제한). 관리자 화면(2-5-4)이 바뀐 장면만 차례로 부른다.

import { revalidatePath } from 'next/cache'
import type { Prisma } from '@/generated/prisma'
import { prisma } from '@/lib/prisma/client'
import { getCurrentUser } from '@/lib/auth'
import { logActivity } from '@/lib/activity-log'
import { ACTIVITY_ACTIONS } from '@/lib/constants/activity-actions'
import { parseVideoScenes, type VideoScene } from '@/types/grammar-video'
import {
  elevenLabsErrorMessage,
  isElevenLabsConfigured,
  listVoices,
  resolveAudioVoices,
  synthesizeSegment,
  type ElevenLabsVoice,
} from '@/lib/grammar/elevenlabs'
import {
  planScriptAudio,
  referencedAudioPaths,
  segmentAudioState,
  type AudioVoices,
  type SegmentAudioState,
} from '@/lib/grammar/video/audio-plan'
import { applySceneAudio, generateSceneAudioFiles } from '@/lib/grammar/video/scene-audio'
import { buildTimeline } from '@/lib/grammar/video/timeline'
import {
  LECTURE_AUDIO_URL_TTL_SEC,
  removeLectureAudio,
  signLectureAudioUrls,
  uploadLectureAudio,
} from '@/lib/grammar/lecture-audio-storage'

type Fail = { ok: false; error: string }

async function getAdmin() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'SUPER_ADMIN') return null
  return user
}

const scriptSelect = {
  id: true,
  status: true,
  scenesJson: true,
  koVoiceId: true,
  enVoiceId: true,
  updatedAt: true,
  grammarPoint: { select: { code: true } },
} satisfies Prisma.GrammarLectureScriptSelect

type LoadedScript = Prisma.GrammarLectureScriptGetPayload<{ select: typeof scriptSelect }>

type Loaded = { ok: true; script: LoadedScript; scenes: VideoScene[]; voices: AudioVoices | null } | Fail

async function loadScript(scriptId: unknown): Promise<Loaded> {
  if (typeof scriptId !== 'string' || !scriptId) return { ok: false, error: '스크립트를 찾을 수 없습니다.' }
  const script = await prisma.grammarLectureScript.findUnique({ where: { id: scriptId }, select: scriptSelect })
  if (!script) return { ok: false, error: '스크립트를 찾을 수 없습니다.' }
  const parsed = parseVideoScenes(script.scenesJson)
  // 오류 장면이 있으면 저장 시 그 장면이 사라지므로 음성 작업을 하지 않는다
  if (!parsed.ok) return { ok: false, error: '장면 데이터에 오류가 있습니다. 장면 편집에서 먼저 고쳐 주세요.' }
  return { ok: true, script, scenes: parsed.scenes, voices: resolveAudioVoices(script.koVoiceId, script.enVoiceId) }
}

const NO_VOICE_ERROR = '한국어·영어 목소리를 먼저 골라 주세요. (기본값: ELEVENLABS_KO_VOICE_ID / ELEVENLABS_EN_VOICE_ID)'

// ── 목소리 목록 ─────────────────────────────────────────────

export async function getVoiceOptions(): Promise<
  { ok: true; voices: ElevenLabsVoice[]; defaults: { ko: string | null; en: string | null } } | Fail
> {
  const admin = await getAdmin()
  if (!admin) return { ok: false, error: '권한이 없습니다.' }
  if (!isElevenLabsConfigured()) return { ok: false, error: 'ElevenLabs API 키가 설정되지 않았습니다. (ELEVENLABS_API_KEY)' }
  try {
    const voices = await listVoices()
    return {
      ok: true,
      voices,
      defaults: { ko: process.env.ELEVENLABS_KO_VOICE_ID?.trim() || null, en: process.env.ELEVENLABS_EN_VOICE_ID?.trim() || null },
    }
  } catch (error) {
    console.error('[lecture-audio] 목소리 목록 실패:', error)
    return { ok: false, error: elevenLabsErrorMessage(error) }
  }
}

// ── 이번에 만들 글자 수 ──────────────────────────────────────

export interface AudioEstimate {
  ok: true
  /** 이번에 생성할 글자 수 */
  chars: number
  segments: number
  /** 음성을 만들어야 하는 장면 (순서대로) */
  scenes: { sceneId: string; segments: number; chars: number }[]
  spokenSegments: number
  ready: boolean
}

export async function estimateChars(scriptId: string): Promise<AudioEstimate | Fail> {
  const admin = await getAdmin()
  if (!admin) return { ok: false, error: '권한이 없습니다.' }
  const loaded = await loadScript(scriptId)
  if (!loaded.ok) return loaded
  if (!loaded.voices) return { ok: false, error: NO_VOICE_ERROR }
  const plan = planScriptAudio(loaded.scenes, loaded.voices)
  return {
    ok: true,
    chars: plan.chars,
    segments: plan.segments,
    scenes: plan.scenes.map((s) => ({ sceneId: s.sceneId, segments: s.targets.length, chars: s.chars })),
    spokenSegments: plan.spokenSegments,
    ready: plan.ready,
  }
}

// ── 장면 1개 음성 생성 ──────────────────────────────────────

export type GenerateSceneAudioResult =
  | {
      ok: true
      /** 이번에 ElevenLabs를 부른 횟수 (0이면 이미 최신) */
      generated: number
      chars: number
      /** 스크립트 전체에 최신 음성이 다 있음 */
      ready: boolean
      status: string
    }
  | (Fail & { generated: number; chars: number })

export async function generateSceneAudio(scriptId: string, sceneId: string): Promise<GenerateSceneAudioResult> {
  const admin = await getAdmin()
  if (!admin) return { ok: false, error: '권한이 없습니다.', generated: 0, chars: 0 }
  const loaded = await loadScript(scriptId)
  if (!loaded.ok) return { ...loaded, generated: 0, chars: 0 }
  const { script, voices } = loaded
  if (!voices) return { ok: false, error: NO_VOICE_ERROR, generated: 0, chars: 0 }
  if (script.status === 'DRAFT') return { ok: false, error: '스크립트를 먼저 승인해 주세요.', generated: 0, chars: 0 }
  const scene = loaded.scenes.find((s) => s.id === sceneId)
  if (!scene) return { ok: false, error: '장면을 찾을 수 없습니다.', generated: 0, chars: 0 }

  const result = await generateSceneAudioFiles(script.id, scene, voices, {
    synthesize: (text, lang, voiceId, opts) => synthesizeSegment(text, lang, voiceId, opts),
    upload: uploadLectureAudio,
  })

  let finalScenes = loaded.scenes
  let status = script.status
  let ready = planScriptAudio(finalScenes, voices).ready
  const toRemove: string[] = []

  if (result.generated.length > 0) {
    try {
      const saved = await saveGeneratedAudio(script, voices, sceneId, result.generated, result.chars)
      finalScenes = saved.scenes
      status = saved.status
      ready = saved.ready
      toRemove.push(...saved.removePaths)
    } catch (error) {
      console.error('[lecture-audio] 저장 실패:', error)
      await removeLectureAudio(result.generated.map((g) => g.audioPath))
      return { ok: false, error: '음성을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.', generated: result.generated.length, chars: result.chars }
    }
  } else if (ready && script.status === 'APPROVED') {
    // 음성이 이미 모두 있는데 상태만 늦은 경우
    await prisma.grammarLectureScript.update({ where: { id: script.id }, data: { status: 'AUDIO_READY', audioReadyAt: new Date() } })
    status = 'AUDIO_READY'
  }

  // 이전 파일 삭제 — 스크립트가 더는 쓰지 않는 경로만
  if (toRemove.length > 0) {
    const still = referencedAudioPaths(finalScenes)
    await removeLectureAudio(toRemove.filter((p) => !still.has(p)))
  }

  if (result.generated.length > 0 || result.error) {
    await logActivity({
      userId: admin.id,
      role: admin.role,
      action: ACTIVITY_ACTIONS.GRAMMAR_LECTURE_AUDIO_GENERATE,
      metadata: {
        scriptId: script.id,
        sceneId,
        pointCode: script.grammarPoint.code,
        segments: result.generated.length,
        chars: result.chars,
        failed: result.error ? elevenLabsErrorMessage(result.error) : null,
      },
    })
  }
  revalidatePath(`/admin/grammar/points/${script.grammarPoint.code}`)

  if (result.error) {
    // ElevenLabsError·저장소 오류 모두 한국어 메시지를 담고 있다
    const message = result.error instanceof Error ? result.error.message : elevenLabsErrorMessage(result.error)
    return { ok: false, error: message, generated: result.generated.length, chars: result.chars }
  }
  return { ok: true, generated: result.generated.length, chars: result.chars, ready, status }
}

/**
 * 생성 결과를 저장한다. 그사이 다른 저장(장면 편집 등)이 있었으면 최신 장면을 다시 읽어 합친다.
 * updatedAt이 같을 때만 쓰는 낙관적 잠금 — 대화형 트랜잭션은 pgbouncer에서 피한다.
 */
async function saveGeneratedAudio(
  script: LoadedScript,
  voices: AudioVoices,
  sceneId: string,
  generated: Parameters<typeof applySceneAudio>[2],
  paidChars: number,
): Promise<{ scenes: VideoScene[]; status: string; ready: boolean; removePaths: string[] }> {
  let current = script
  let currentScenes = parseVideoScenes(script.scenesJson).scenes

  for (let attempt = 0; attempt < 3; attempt++) {
    const applied = applySceneAudio(currentScenes, sceneId, generated, voices)
    const plan = planScriptAudio(applied.scenes, voices)
    const promote = plan.ready && (current.status === 'APPROVED' || current.status === 'DRAFT')
    const status = promote ? 'AUDIO_READY' : current.status
    const data: Prisma.GrammarLectureScriptUpdateManyMutationInput = {
      scenesJson: applied.scenes as unknown as Prisma.InputJsonValue,
      totalChars: { increment: paidChars },
      durationSec: Math.round(buildTimeline(applied.scenes).duration / 1000),
      // 기본 목소리로 만들었으면 스크립트에 고정 (환경 변수가 바뀌어도 음성이 무효가 되지 않게)
      koVoiceId: voices.ko.voiceId,
      enVoiceId: voices.en.voiceId,
      ...(promote ? { status, audioReadyAt: new Date() } : {}),
    }
    const res = await prisma.grammarLectureScript.updateMany({ where: { id: current.id, updatedAt: current.updatedAt }, data })
    if (res.count === 1) {
      const removePaths = [...applied.applied.map((a) => a.previousPath).filter((p): p is string => Boolean(p)), ...applied.orphanPaths]
      return { scenes: applied.scenes, status, ready: plan.ready, removePaths }
    }
    // 그사이 바뀜 → 다시 읽고 합친다 (실패한 시도는 아무것도 쓰지 않았다)
    const fresh = await prisma.grammarLectureScript.findUnique({ where: { id: script.id }, select: scriptSelect })
    if (!fresh) throw new Error('스크립트가 삭제되었습니다.')
    const parsed = parseVideoScenes(fresh.scenesJson)
    if (!parsed.ok) throw new Error('장면 데이터에 오류가 생겨 음성을 반영하지 못했습니다.')
    current = fresh
    currentScenes = parsed.scenes
  }
  throw new Error('다른 저장과 겹쳐 음성을 반영하지 못했습니다.')
}

// ── 서명 URL ────────────────────────────────────────────────

export interface SegmentAudioUrl {
  url: string | null
  durationSec: number | null
  state: SegmentAudioState
}

export async function getAudioUrls(
  scriptId: string,
): Promise<{ ok: true; urls: Record<string, SegmentAudioUrl>; expiresInSec: number } | Fail> {
  const admin = await getAdmin()
  if (!admin) return { ok: false, error: '권한이 없습니다.' }
  const loaded = await loadScript(scriptId)
  if (!loaded.ok) return loaded
  const { scenes, voices } = loaded

  const segments = scenes.flatMap((s) => s.segments).filter((s) => s.audioPath)
  try {
    const signed = await signLectureAudioUrls(segments.map((s) => s.audioPath as string))
    const urls: Record<string, SegmentAudioUrl> = {}
    for (const s of segments) {
      urls[s.id] = {
        url: signed.get(s.audioPath as string) ?? null,
        durationSec: s.durationSec ?? null,
        state: voices ? segmentAudioState(s, voices) : 'stale',
      }
    }
    return { ok: true, urls, expiresInSec: LECTURE_AUDIO_URL_TTL_SEC }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : '음성 주소를 만들지 못했습니다.' }
  }
}
