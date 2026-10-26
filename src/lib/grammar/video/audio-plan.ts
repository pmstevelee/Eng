// AI 강의 음성 — 어떤 세그먼트에 음성을 새로 만들어야 하는지 정하는 순수 함수
// 서버(음성 생성)와 관리자 화면(음성 상태 표시) 양쪽에서 쓰므로 Node 전용 모듈(crypto 등)을 쓰지 않는다.

import type { Segment, VideoLang, VideoScene } from '../../../types/grammar-video'

/** 해시 규칙이 바뀌면 올린다 → 모든 음성이 다시 생성 대상이 된다 */
const AUDIO_HASH_VERSION = 'v1'

/** 언어별 음성 설정 — 목소리나 모델이 바뀌면 해시가 달라져 다시 만든다 */
export interface AudioVoiceSettings {
  voiceId: string
  modelId: string
  /** 읽기 속도 (1 = 기본) */
  speed: number
}

export type AudioVoices = Record<VideoLang, AudioVoiceSettings>

/** 문자열 해시 (cyrb53, 53비트) — 보안용이 아니라 바뀜 감지용 */
function cyrb53(str: string, seed = 0): number {
  let h1 = 0xdeadbeef ^ seed
  let h2 = 0x41c6ce57 ^ seed
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507)
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507)
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return 4294967296 * (2097151 & h2) + (h1 >>> 0)
}

/** 읽을 문장을 비교용으로 정리 (앞뒤·연속 공백만 정리, 글자는 그대로) */
export function normalizeSpeechText(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

/** 음성 해시 — 문장·언어·목소리·모델·속도 중 하나라도 바뀌면 달라진다 */
export function segmentAudioHash(segment: Pick<Segment, 'lang' | 'text'>, voices: AudioVoices): string {
  const v = voices[segment.lang]
  const key = [AUDIO_HASH_VERSION, segment.lang, v.voiceId, v.modelId, v.speed.toFixed(2), normalizeSpeechText(segment.text)].join('|')
  return cyrb53(key).toString(36).padStart(11, '0')
}

/** 소리로 읽는 세그먼트인가 (퀴즈 대기 세그먼트는 음성이 없다) */
export function isSpokenSegment(segment: Segment): boolean {
  return !segment.waitMs && normalizeSpeechText(segment.text).length > 0
}

export type SegmentAudioState = 'none' | 'ready' | 'stale'

/** 세그먼트 음성 상태 — 없음 / 최신 / 문장·목소리가 바뀌어 다시 만들어야 함 */
export function segmentAudioState(segment: Segment, voices: AudioVoices): SegmentAudioState {
  if (!segment.audioPath || !segment.durationSec || !segment.textHash) return 'none'
  return segment.textHash === segmentAudioHash(segment, voices) ? 'ready' : 'stale'
}

export function needsAudio(segment: Segment, voices: AudioVoices): boolean {
  return isSpokenSegment(segment) && segmentAudioState(segment, voices) !== 'ready'
}

/** ElevenLabs 과금 글자 수 (공백 정리 후 글자 수) */
export function speechChars(text: string): number {
  return normalizeSpeechText(text).length
}

export interface SceneAudioPlan {
  sceneId: string
  /** 새로 만들 세그먼트 */
  targets: Segment[]
  chars: number
}

export function planSceneAudio(scene: VideoScene, voices: AudioVoices): SceneAudioPlan {
  const targets = scene.segments.filter((s) => needsAudio(s, voices))
  return { sceneId: scene.id, targets, chars: targets.reduce((n, s) => n + speechChars(s.text), 0) }
}

export interface ScriptAudioPlan {
  /** 음성을 만들어야 하는 장면만 */
  scenes: SceneAudioPlan[]
  segments: number
  chars: number
  /** 읽는 세그먼트 전체 수 */
  spokenSegments: number
  /** 모든 읽는 세그먼트에 최신 음성이 있음 */
  ready: boolean
}

export function planScriptAudio(scenes: VideoScene[], voices: AudioVoices): ScriptAudioPlan {
  const plans = scenes.map((s) => planSceneAudio(s, voices)).filter((p) => p.targets.length > 0)
  const spokenSegments = scenes.reduce((n, s) => n + s.segments.filter(isSpokenSegment).length, 0)
  return {
    scenes: plans,
    segments: plans.reduce((n, p) => n + p.targets.length, 0),
    chars: plans.reduce((n, p) => n + p.chars, 0),
    spokenSegments,
    ready: plans.length === 0 && spokenSegments > 0,
  }
}

/** Storage 경로 조각에 쓸 수 있게 정리 */
function safePathPart(value: string): string {
  return value.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 80) || 'seg'
}

/** 음성 파일 경로: {scriptId}/{segmentId}-{textHash}.mp3 */
export function segmentAudioPath(scriptId: string, segmentId: string, hash: string): string {
  return `${safePathPart(scriptId)}/${safePathPart(segmentId)}-${hash}.mp3`
}

/** 스크립트에서 아직 쓰는 음성 경로 전체 */
export function referencedAudioPaths(scenes: VideoScene[]): Set<string> {
  const out = new Set<string>()
  for (const scene of scenes) for (const s of scene.segments) if (s.audioPath) out.add(s.audioPath)
  return out
}

// ── 장면 편집 저장 ──────────────────────────────────────────

/**
 * 장면 편집 저장 시 음성 필드는 화면이 보낸 값을 믿지 않고 저장돼 있던 값을 세그먼트 id로 이어 붙인다.
 * 문장이 바뀐 세그먼트도 음성 필드는 그대로 두므로 해시가 달라져 '수정됨'(다시 생성 대상)이 된다.
 * removedPaths: 이번 편집으로 아무 세그먼트도 쓰지 않게 된 음성 파일
 */
export function carryOverAudio(prev: VideoScene[], next: VideoScene[]): { scenes: VideoScene[]; removedPaths: string[] } {
  const audioById = new Map<string, Pick<Segment, 'audioPath' | 'durationSec' | 'textHash'>>()
  for (const scene of prev) {
    for (const s of scene.segments) {
      if (s.audioPath) audioById.set(s.id, { audioPath: s.audioPath, durationSec: s.durationSec, textHash: s.textHash })
    }
  }
  const scenes = next.map((scene) => {
    const segments = scene.segments.map((s) => {
      const { audioPath: _p, durationSec: _d, textHash: _h, ...rest } = s
      void _p
      void _d
      void _h
      const audio = audioById.get(s.id)
      if (!audio || s.waitMs) return rest as Segment
      return { ...rest, ...audio } as Segment
    })
    return { ...scene, segments } as VideoScene
  })
  const still = referencedAudioPaths(scenes)
  const removedPaths = Array.from(referencedAudioPaths(prev)).filter((p) => !still.has(p))
  return { scenes, removedPaths }
}

export type LectureScriptStatus = 'DRAFT' | 'APPROVED' | 'AUDIO_READY' | 'LINKED'

/** 장면을 고친 뒤 상태 — 승인은 유지하고, 음성이 모두 최신인지만 다시 본다. YouTube 연결은 그대로 */
export function statusAfterEdit(current: string, audioReady: boolean): LectureScriptStatus {
  if (current === 'LINKED') return 'LINKED'
  if (current === 'DRAFT') return 'DRAFT'
  return audioReady ? 'AUDIO_READY' : 'APPROVED'
}

/** YouTube 연결이 풀린 뒤 상태 — 음성이 모두 최신이면 AUDIO_READY, 아니면 APPROVED (초안은 그대로) */
export function statusAfterUnlink(current: string, audioReady: boolean): LectureScriptStatus {
  if (current === 'DRAFT') return 'DRAFT'
  return audioReady ? 'AUDIO_READY' : 'APPROVED'
}
