// 세그먼트 MP3(서명 URL)를 받아 디코딩하고, 타임라인 위치에 놓아 하나의 48kHz 모노 트랙으로 합친다.
// 브라우저 전용. 미리보기 재생·MP4·전체 음성(.m4a)이 이 트랙 하나를 쓴다.

import type { Timeline } from '../timeline'
import { EXPORT_SAMPLE_RATE, mixPlacements, msToSamples, planAudioPlacements, type MixInput } from './plan'

export interface MixedAudio {
  /** 타임라인 전체 길이의 모노 샘플 */
  samples: Float32Array<ArrayBuffer>
  sampleRate: number
}

export class AudioLoadError extends Error {}

/** 한 번에 받는 파일 수 */
const CONCURRENCY = 6

function toMono(buffer: AudioBuffer): Float32Array {
  if (buffer.numberOfChannels === 1) return buffer.getChannelData(0)
  const out = new Float32Array(buffer.length)
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const ch = buffer.getChannelData(c)
    for (let k = 0; k < out.length; k++) out[k] += ch[k] / buffer.numberOfChannels
  }
  return out
}

/**
 * urls: 세그먼트 id → 서명 URL. 음성이 필요한 세그먼트에 URL이 없으면 오류.
 * onProgress(받은 수, 전체)
 */
export async function loadMixedAudio(
  timeline: Timeline,
  urls: Record<string, string>,
  opts: { onProgress?: (done: number, total: number) => void; signal?: AbortSignal } = {},
): Promise<MixedAudio> {
  const placements = planAudioPlacements(timeline)
  const missing = placements.filter((p) => !urls[p.segmentId])
  if (missing.length > 0) throw new AudioLoadError(`음성이 없는 문장이 ${missing.length}개 있어요. 음성 단계에서 먼저 만들어 주세요.`)

  // OfflineAudioContext의 decodeAudioData는 컨텍스트 샘플레이트(48kHz)로 바꿔 준다
  const decoder = new OfflineAudioContext(1, 1, EXPORT_SAMPLE_RATE)
  const inputs: MixInput[] = new Array(placements.length)
  let done = 0
  let next = 0
  opts.onProgress?.(0, placements.length)

  async function worker() {
    while (next < placements.length) {
      const i = next++
      const p = placements[i]
      if (opts.signal?.aborted) throw new DOMException('취소됨', 'AbortError')
      let bytes: ArrayBuffer
      try {
        const res = await fetch(urls[p.segmentId], { signal: opts.signal })
        if (!res.ok) throw new Error(String(res.status))
        bytes = await res.arrayBuffer()
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') throw error
        throw new AudioLoadError('음성 파일을 받지 못했어요. 주소가 만료되었을 수 있으니 "음성 다시 불러오기"를 눌러 주세요.')
      }
      let decoded: AudioBuffer
      try {
        decoded = await decoder.decodeAudioData(bytes)
      } catch {
        throw new AudioLoadError('음성 파일을 읽지 못했어요. 음성 단계에서 그 장면을 다시 만들어 주세요.')
      }
      inputs[i] = { startSample: msToSamples(p.startMs), maxSamples: msToSamples(p.maxMs), data: toMono(decoded) }
      done += 1
      opts.onProgress?.(done, placements.length)
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, placements.length) }, worker))
  const samples = mixPlacements(msToSamples(timeline.duration), inputs)
  return { samples, sampleRate: EXPORT_SAMPLE_RATE }
}

/** 재생용 AudioBuffer */
export function toAudioBuffer(audio: MixedAudio, start = 0, end = audio.samples.length): AudioBuffer {
  const length = Math.max(1, end - start)
  const buffer = new AudioBuffer({ length, numberOfChannels: 1, sampleRate: audio.sampleRate })
  buffer.copyToChannel(audio.samples.subarray(start, start + length), 0)
  return buffer
}
