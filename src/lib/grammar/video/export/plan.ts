// 내보내기 계산 (순수 함수 — 브라우저·DB 없음)
// 세그먼트 음성을 타임라인 위치에 놓아 하나의 오디오로 합치는 계산과 프레임 수.

import type { Timeline } from '../timeline'
import { VIDEO_FPS } from '../constants'

/** 합친 오디오 샘플레이트 */
export const EXPORT_SAMPLE_RATE = 48000

/** 영상 프레임 수 — 마지막 프레임이 타임라인 끝을 덮도록 올림 */
export function frameCount(durationMs: number, fps: number = VIDEO_FPS): number {
  return Math.max(1, Math.ceil((durationMs * fps) / 1000))
}

/** i번째 프레임의 시각(ms) */
export function frameTimeMs(index: number, fps: number = VIDEO_FPS): number {
  return (index * 1000) / fps
}

export function msToSamples(ms: number, sampleRate: number = EXPORT_SAMPLE_RATE): number {
  return Math.round((ms * sampleRate) / 1000)
}

export interface AudioPlacement {
  segmentId: string
  /** 타임라인 시작 위치(ms) */
  startMs: number
  /**
   * 이 세그먼트가 차지할 수 있는 최대 길이(ms) — 다음 세그먼트 시작(또는 영상 끝)까지.
   * MP3 디코딩 길이가 메타데이터 길이보다 조금 길어도 다음 문장과 겹치지 않게 자른다.
   */
  maxMs: number
}

/** 음성이 있어야 하는 세그먼트(대기 아님, 문장 있음)의 배치 */
export function planAudioPlacements(timeline: Timeline): AudioPlacement[] {
  const all = timeline.scenes.flatMap((s) => s.segments)
  const out: AudioPlacement[] = []
  all.forEach((seg, i) => {
    if (seg.segment.waitMs || !seg.segment.text.trim()) return
    const nextStart = i + 1 < all.length ? all[i + 1].start : timeline.duration
    out.push({ segmentId: seg.segment.id, startMs: seg.start, maxMs: Math.max(0, nextStart - seg.start) })
  })
  return out
}

export interface MixInput {
  startSample: number
  maxSamples: number
  data: Float32Array
}

/**
 * 세그먼트 샘플을 한 트랙에 더한다. 범위를 벗어나는 부분은 버리고 결과는 -1~1로 자른다.
 * (세그먼트는 겹치지 않게 배치되지만, 겹쳐도 더해진다)
 */
export function mixPlacements(totalSamples: number, inputs: MixInput[]): Float32Array<ArrayBuffer> {
  const out = new Float32Array(Math.max(0, totalSamples))
  for (const input of inputs) {
    const start = Math.max(0, input.startSample)
    const skip = start - input.startSample
    const len = Math.min(input.data.length - skip, input.maxSamples - skip, out.length - start)
    for (let k = 0; k < len; k++) out[start + k] += input.data[skip + k]
  }
  for (let k = 0; k < out.length; k++) {
    if (out[k] > 1) out[k] = 1
    else if (out[k] < -1) out[k] = -1
  }
  return out
}
