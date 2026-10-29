// MP4·M4A 만들기 — WebCodecs(H.264·AAC) + mediabunny(MP4로 묶기). 브라우저 전용.
// 관리자 화면에서 동적 import로만 불러온다 (다른 화면 번들에 들어가지 않게).

import {
  AudioBufferSource,
  BufferTarget,
  CanvasSource,
  Mp4OutputFormat,
  Output,
  QUALITY_HIGH,
  canEncodeAudio,
  canEncodeVideo,
} from 'mediabunny'
import type { VideoScene } from '../../../../types/grammar-video'
import type { Timeline } from '../timeline'
import { renderFrame, type SceneImageSources } from '../render'
import { VIDEO_FPS, VIDEO_HEIGHT, VIDEO_WIDTH } from '../constants'
import { frameCount, frameTimeMs } from './plan'
import { toAudioBuffer, type MixedAudio } from './load-audio'

export const UNSUPPORTED_ENCODER_MESSAGE = '이 브라우저는 영상 인코딩을 지원하지 않아요. Chrome 또는 Edge 데스크톱에서 만들어 주세요.'

const AUDIO_BITRATE = 128_000
/** 오디오는 영상보다 이만큼(초) 앞서 넣어 두 트랙이 번갈아 쌓이게 한다 */
const AUDIO_LEAD_SEC = 1

export async function checkEncoderSupport(): Promise<{ video: boolean; audio: boolean }> {
  if (typeof VideoEncoder === 'undefined' || typeof AudioEncoder === 'undefined') return { video: false, audio: false }
  const [video, audio] = await Promise.all([
    canEncodeVideo('avc', { width: VIDEO_WIDTH, height: VIDEO_HEIGHT, bitrate: QUALITY_HIGH, frameRate: VIDEO_FPS }).catch(() => false),
    canEncodeAudio('aac', { numberOfChannels: 1, sampleRate: 48000, bitrate: AUDIO_BITRATE }).catch(() => false),
  ])
  return { video, audio }
}

/** 가려진 탭에서도 느려지지 않는 양보 (setTimeout은 숨은 탭에서 1초로 늘어난다) */
function yieldToBrowser(): Promise<void> {
  return new Promise((resolve) => {
    const ch = new MessageChannel()
    ch.port1.onmessage = () => {
      ch.port1.close()
      resolve()
    }
    ch.port2.postMessage(null)
  })
}

function abortError(): DOMException {
  return new DOMException('취소됨', 'AbortError')
}

/** 오디오를 sec 위치까지 1초 조각으로 넣는다 */
function createAudioFeeder(source: AudioBufferSource, audio: MixedAudio) {
  const chunk = audio.sampleRate
  let fed = 0
  return async (untilSec: number) => {
    const until = Math.min(audio.samples.length, Math.round(untilSec * audio.sampleRate))
    while (fed < until) {
      const end = Math.min(until, fed + chunk)
      await source.add(toAudioBuffer(audio, fed, end))
      fed = end
    }
  }
}

export interface ExportProgress {
  frame: number
  totalFrames: number
}

export async function exportLectureMp4(params: {
  scenes: VideoScene[]
  timeline: Timeline
  audio: MixedAudio
  subtitles: boolean
  images?: SceneImageSources
  signal?: AbortSignal
  onProgress?: (p: ExportProgress) => void
}): Promise<Blob> {
  const { scenes, timeline, audio, subtitles, images, signal, onProgress } = params
  const canvas = document.createElement('canvas')
  canvas.width = VIDEO_WIDTH
  canvas.height = VIDEO_HEIGHT
  const ctx = canvas.getContext('2d', { alpha: false })
  if (!ctx) throw new Error('캔버스를 만들지 못했어요.')

  const output = new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target: new BufferTarget() })
  const video = new CanvasSource(canvas, { codec: 'avc', bitrate: QUALITY_HIGH, keyFrameInterval: 2 })
  const sound = new AudioBufferSource({ codec: 'aac', bitrate: AUDIO_BITRATE })
  output.addVideoTrack(video, { frameRate: VIDEO_FPS })
  output.addAudioTrack(sound)
  const feedAudio = createAudioFeeder(sound, audio)

  const total = frameCount(timeline.duration)
  try {
    await output.start()
    for (let i = 0; i < total; i++) {
      if (signal?.aborted) throw abortError()
      renderFrame(ctx, scenes, timeline, Math.min(frameTimeMs(i), timeline.duration), { subtitles, images })
      await video.add(i / VIDEO_FPS, 1 / VIDEO_FPS)
      await feedAudio((i + 1) / VIDEO_FPS + AUDIO_LEAD_SEC)
      if (i % 10 === 0 || i === total - 1) {
        onProgress?.({ frame: i + 1, totalFrames: total })
        await yieldToBrowser()
      }
    }
    await feedAudio(Number.POSITIVE_INFINITY)
    if (signal?.aborted) throw abortError()
    await output.finalize()
  } catch (error) {
    if (output.state !== 'finalized' && output.state !== 'canceled') await output.cancel().catch(() => undefined)
    throw error
  }
  const buffer = output.target.buffer
  if (!buffer) throw new Error('영상 파일을 만들지 못했어요.')
  return new Blob([buffer], { type: 'video/mp4' })
}

/** 전체 나레이션 음성 (.m4a — AAC를 MP4 컨테이너에) */
export async function exportNarrationM4a(audio: MixedAudio, signal?: AbortSignal): Promise<Blob> {
  const output = new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target: new BufferTarget() })
  const sound = new AudioBufferSource({ codec: 'aac', bitrate: AUDIO_BITRATE })
  output.addAudioTrack(sound)
  const feed = createAudioFeeder(sound, audio)
  try {
    await output.start()
    const totalSec = audio.samples.length / audio.sampleRate
    for (let sec = 10; sec < totalSec + 10; sec += 10) {
      if (signal?.aborted) throw abortError()
      await feed(sec)
      await yieldToBrowser()
    }
    await output.finalize()
  } catch (error) {
    if (output.state !== 'finalized' && output.state !== 'canceled') await output.cancel().catch(() => undefined)
    throw error
  }
  const buffer = output.target.buffer
  if (!buffer) throw new Error('음성 파일을 만들지 못했어요.')
  return new Blob([buffer], { type: 'audio/mp4' })
}
