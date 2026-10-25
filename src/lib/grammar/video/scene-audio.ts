// 장면 1개의 음성 생성 — 바뀐(또는 음성 없는) 세그먼트만 합성해 저장한다
// DB·Storage·ElevenLabs는 밖에서 넣어 준다 (테스트에서 모킹). 서버 액션은 lecture-audio-actions.ts.

import type { Segment, VideoScene } from '../../../types/grammar-video'
import { needsAudio, segmentAudioHash, segmentAudioPath, speechChars, type AudioVoices } from './audio-plan'

export interface SceneAudioDeps {
  synthesize: (text: string, lang: Segment['lang'], voiceId: string, opts: { modelId: string; speed: number }) => Promise<{ audio: Uint8Array; durationSec: number }>
  upload: (path: string, audio: Uint8Array) => Promise<void>
}

export interface GeneratedSegmentAudio {
  segmentId: string
  audioPath: string
  durationSec: number
  textHash: string
  chars: number
  /** 교체된 이전 파일 (저장이 끝난 뒤 지운다) */
  previousPath: string | null
}

export interface SceneAudioResult {
  generated: GeneratedSegmentAudio[]
  /** 이번에 합성한 글자 수 */
  chars: number
  /** 중간에 실패했으면 그 오류 (앞에서 만든 음성은 generated에 남는다) */
  error: unknown | null
}

/**
 * 장면에서 음성이 필요한 세그먼트를 차례로 합성·업로드한다.
 * 실패하면 거기서 멈추고, 이미 만든 음성은 결과에 남겨 저장하게 한다(다시 돈 내지 않도록).
 */
export async function generateSceneAudioFiles(
  scriptId: string,
  scene: VideoScene,
  voices: AudioVoices,
  deps: SceneAudioDeps,
): Promise<SceneAudioResult> {
  const generated: GeneratedSegmentAudio[] = []
  let chars = 0
  for (const segment of scene.segments) {
    if (!needsAudio(segment, voices)) continue
    const voice = voices[segment.lang]
    const hash = segmentAudioHash(segment, voices)
    const path = segmentAudioPath(scriptId, segment.id, hash)
    try {
      const { audio, durationSec } = await deps.synthesize(segment.text, segment.lang, voice.voiceId, {
        modelId: voice.modelId,
        speed: voice.speed,
      })
      await deps.upload(path, audio)
      const segChars = speechChars(segment.text)
      chars += segChars
      generated.push({
        segmentId: segment.id,
        audioPath: path,
        durationSec,
        textHash: hash,
        chars: segChars,
        previousPath: segment.audioPath && segment.audioPath !== path ? segment.audioPath : null,
      })
    } catch (error) {
      return { generated, chars, error }
    }
  }
  return { generated, chars, error: null }
}

export interface ApplyAudioResult {
  scenes: VideoScene[]
  /** 실제로 반영된 세그먼트 (생성 중에 문장이 또 바뀐 세그먼트는 빠진다) */
  applied: GeneratedSegmentAudio[]
  /** 반영되지 못해 지워야 하는 새 파일 */
  orphanPaths: string[]
}

/**
 * 생성 결과를 최신 장면 목록에 반영한다.
 * 생성 도중 관리자가 문장을 고쳤다면 해시가 달라지므로 그 세그먼트는 반영하지 않는다.
 */
export function applySceneAudio(
  scenes: VideoScene[],
  sceneId: string,
  generated: GeneratedSegmentAudio[],
  voices: AudioVoices,
): ApplyAudioResult {
  const byId = new Map(generated.map((g) => [g.segmentId, g]))
  const applied: GeneratedSegmentAudio[] = []
  const next = scenes.map((scene) => {
    if (scene.id !== sceneId) return scene
    const segments = scene.segments.map((segment) => {
      const g = byId.get(segment.id)
      if (!g || segmentAudioHash(segment, voices) !== g.textHash) return segment
      applied.push({ ...g, previousPath: segment.audioPath && segment.audioPath !== g.audioPath ? segment.audioPath : null })
      return { ...segment, audioPath: g.audioPath, durationSec: g.durationSec, textHash: g.textHash }
    }) as Segment[]
    return { ...scene, segments } as VideoScene
  })
  const appliedIds = new Set(applied.map((a) => a.segmentId))
  const orphanPaths = generated.filter((g) => !appliedIds.has(g.segmentId)).map((g) => g.audioPath)
  return { scenes: next, applied, orphanPaths }
}
