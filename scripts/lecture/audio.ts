// 오디오 후처리 — 세그먼트 음성 해석 → 앞뒤 무음 정리 → 세그먼트별 음량 맞춤 → 쉼 넣어 이어 붙이기 → -16 LUFS 정규화
// PCM(16bit, 모노, 44.1kHz)은 Node에서 직접 다루고, 해석·라우드니스는 ffmpeg로 한다.

import { writeFileSync } from 'node:fs'
import { ffmpeg } from './common'

export const SAMPLE_RATE = 44100
export const TARGET_LUFS = -16

/**
 * 음성 파일 → 16bit 모노 PCM.
 * Remotion에 들어 있는 ffmpeg에는 raw(s16le) 출력이 없어 wav로 받고 머리말을 뗀다
 * (파이프 출력이라 data 크기 칸이 비어 있을 수 있으므로 'data' 뒤 전부를 쓴다).
 */
export async function decodeToPcm(file: string, opts: { tempo?: number } = {}): Promise<Int16Array> {
  // tempo: 음 높이는 그대로 두고 빠르기만 바꾼다 (atempo 0.5~2.0)
  const tempo = opts.tempo && Math.abs(opts.tempo - 1) > 0.005 ? Math.min(2, Math.max(0.5, opts.tempo)) : null
  const filter = tempo ? ['-af', `atempo=${tempo.toFixed(3)}`] : []
  const { stdout } = await ffmpeg(['-v', 'error', '-i', file, ...filter, '-f', 'wav', '-acodec', 'pcm_s16le', '-ac', '1', '-ar', String(SAMPLE_RATE), 'pipe:1'])
  let offset = 12
  while (offset + 8 <= stdout.length) {
    const id = stdout.toString('ascii', offset, offset + 4)
    const size = stdout.readUInt32LE(offset + 4)
    if (id === 'data') {
      offset += 8
      break
    }
    offset += 8 + size
  }
  const bytes = stdout.subarray(offset)
  const copy = Buffer.from(bytes.subarray(0, bytes.length - (bytes.length % 2)))
  return new Int16Array(copy.buffer, copy.byteOffset, copy.length / 2)
}

const msToSamples = (ms: number) => Math.round((ms * SAMPLE_RATE) / 1000)
export const samplesToMs = (n: number) => (n * 1000) / SAMPLE_RATE

/** 10ms 창의 RMS(dBFS) 목록 */
function windowDb(pcm: Int16Array, win: number): number[] {
  const out: number[] = []
  for (let i = 0; i < pcm.length; i += win) {
    let sum = 0
    const end = Math.min(pcm.length, i + win)
    for (let j = i; j < end; j++) sum += pcm[j] * pcm[j]
    const rms = Math.sqrt(sum / Math.max(1, end - i))
    out.push(rms > 0 ? 20 * Math.log10(rms / 32768) : -120)
  }
  return out
}

/**
 * 앞뒤 무음 정리 — -45dBFS보다 큰 소리가 처음·마지막으로 나오는 곳을 찾아,
 * 앞은 30ms, 뒤는 80ms(숨·끝음 여유)를 남기고 자른다.
 */
export function trimSilence(pcm: Int16Array): { start: number; end: number } {
  const win = msToSamples(10)
  const db = windowDb(pcm, win)
  const first = db.findIndex((v) => v > -45)
  let last = -1
  for (let i = db.length - 1; i >= 0; i--) if (db[i] > -45) { last = i; break }
  if (first < 0 || last < 0) return { start: 0, end: pcm.length }
  const start = Math.max(0, first * win - msToSamples(30))
  const end = Math.min(pcm.length, (last + 1) * win + msToSamples(80))
  return { start, end }
}

/**
 * 세그먼트끼리 크기를 맞추는 이득(배수) — 말소리 부분(-40dBFS 이상) RMS를 -20dBFS에 맞추되 ±6dB 안에서,
 * 피크가 넘치지 않게. 최종 -16 LUFS는 전체 트랙에서 다시 맞춘다.
 */
export function levelGain(pcm: Int16Array): number {
  const win = msToSamples(20)
  const voiced = windowDb(pcm, win).filter((v) => v > -40)
  if (voiced.length === 0) return 1
  const meanPower = voiced.reduce((a, v) => a + Math.pow(10, v / 10), 0) / voiced.length
  const level = 10 * Math.log10(meanPower)
  const gainDb = Math.max(-6, Math.min(6, -20 - level))
  let peak = 1
  for (let i = 0; i < pcm.length; i++) peak = Math.max(peak, Math.abs(pcm[i]))
  return Math.min(Math.pow(10, gainDb / 20), 32000 / peak)
}

export function applyGain(pcm: Int16Array, gain: number): Int16Array {
  if (Math.abs(gain - 1) < 0.01) return pcm
  const out = new Int16Array(pcm.length)
  for (let i = 0; i < pcm.length; i++) out[i] = Math.max(-32768, Math.min(32767, Math.round(pcm[i] * gain)))
  return out
}

/** 끝을 5ms 페이드해 자른 자리의 '딸깍' 소리를 막는다 */
export function fadeEdges(pcm: Int16Array): Int16Array {
  const n = Math.min(msToSamples(5), Math.floor(pcm.length / 2))
  const out = new Int16Array(pcm)
  for (let i = 0; i < n; i++) {
    const f = i / n
    out[i] = Math.round(out[i] * f)
    out[out.length - 1 - i] = Math.round(out[out.length - 1 - i] * f)
  }
  return out
}

export function writeWav(file: string, pcm: Int16Array): void {
  const data = Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength)
  const header = Buffer.alloc(44)
  header.write('RIFF', 0)
  header.writeUInt32LE(36 + data.length, 4)
  header.write('WAVE', 8)
  header.write('fmt ', 12)
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20)
  header.writeUInt16LE(1, 22)
  header.writeUInt32LE(SAMPLE_RATE, 24)
  header.writeUInt32LE(SAMPLE_RATE * 2, 28)
  header.writeUInt16LE(2, 32)
  header.writeUInt16LE(16, 34)
  header.write('data', 36)
  header.writeUInt32LE(data.length, 40)
  writeFileSync(file, Buffer.concat([header, data]))
}

/** 조각들을 정해진 위치(ms)에 놓아 하나의 트랙으로 */
export function mixdown(totalMs: number, clips: { startMs: number; pcm: Int16Array }[]): Int16Array {
  const out = new Int16Array(msToSamples(totalMs))
  for (const c of clips) {
    const offset = msToSamples(c.startMs)
    for (let i = 0; i < c.pcm.length && offset + i < out.length; i++) out[offset + i] = c.pcm[i]
  }
  return out
}

interface LoudnormMeasure {
  input_i: string
  input_tp: string
  input_lra: string
  input_thresh: string
  target_offset: string
}

function parseLoudnorm(stderr: string): LoudnormMeasure {
  const m = stderr.match(/\{[\s\S]*?"target_offset"[\s\S]*?\}/)
  if (!m) throw new Error('loudnorm 측정값을 읽지 못했어요')
  return JSON.parse(m[0]) as LoudnormMeasure
}

/** 두 번 지나가는 loudnorm(linear) — 길이·타이밍은 그대로, 전체 음량만 -16 LUFS / 피크 -1.5dBTP */
export async function loudnormFile(input: string, output: string): Promise<{ before: number; after: number }> {
  const base = `I=${TARGET_LUFS}:TP=-1.5:LRA=11`
  const pass1 = await ffmpeg(['-i', input, '-af', `loudnorm=${base}:print_format=json`, '-f', 'null', '-'])
  const m = parseLoudnorm(pass1.stderr)
  const filter = `loudnorm=${base}:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true:print_format=json`
  await ffmpeg(['-y', '-i', input, '-af', filter, '-ar', String(SAMPLE_RATE), '-ac', '1', '-c:a', 'pcm_s16le', output])
  const check = await ffmpeg(['-i', output, '-af', `loudnorm=${base}:print_format=json`, '-f', 'null', '-'])
  return { before: Number(m.input_i), after: Number(parseLoudnorm(check.stderr).input_i) }
}

// ── 따라하기 대기 구간 배경음 ─────────────────────────────
// 무음 대신 아주 작은 소리를 깔아 "기다리는 중"임을 느끼게 한다. 기본 -34dBFS(RMS), -30dB보다 커지지 않게 막는다.

export type BedKind = 'off' | 'pad' | 'noise'
export const BED_MAX_DB = -30

/** 부드러운 패드 — 낮은 화음(C3·G3·C4) 사인파 + 아주 느린 떨림 */
function padSample(i: number): number {
  const t = i / SAMPLE_RATE
  const lfo = 0.85 + 0.15 * Math.sin(2 * Math.PI * 0.25 * t)
  return lfo * (0.5 * Math.sin(2 * Math.PI * 130.81 * t) + 0.3 * Math.sin(2 * Math.PI * 196.0 * t) + 0.2 * Math.sin(2 * Math.PI * 261.63 * t))
}

/** 배경음 조각(PCM) — 앞뒤 0.3초 페이드, RMS를 db(dBFS)에 맞춤 */
export function makeBed(kind: Exclude<BedKind, 'off'>, durationMs: number, db: number, seed = 1): Int16Array {
  const n = msToSamples(durationMs)
  const raw = new Float64Array(n)
  let state = seed >>> 0 || 1
  let lp = 0
  for (let i = 0; i < n; i++) {
    if (kind === 'pad') raw[i] = padSample(i)
    else {
      // 갈색에 가까운 잔잔한 잡음 (1차 저역 통과)
      state = (state * 1664525 + 1013904223) >>> 0
      const white = state / 0xffffffff - 0.5
      lp += 0.02 * (white - lp)
      raw[i] = lp
    }
  }
  let sum = 0
  for (let i = 0; i < n; i++) sum += raw[i] * raw[i]
  const rms = Math.sqrt(sum / Math.max(1, n)) || 1
  const target = Math.pow(10, Math.min(db, BED_MAX_DB) / 20) * 32768
  const fade = Math.min(msToSamples(300), Math.floor(n / 2))
  const out = new Int16Array(n)
  for (let i = 0; i < n; i++) {
    const f = Math.min(1, i / fade, (n - 1 - i) / fade)
    out[i] = Math.round((raw[i] / rms) * target * Math.max(0, f))
  }
  return out
}

/** 트랙에 배경음 조각을 더한다 (겹치는 말소리는 그대로) */
export function addBed(track: Int16Array, ranges: { startMs: number; endMs: number }[], kind: Exclude<BedKind, 'off'>, db: number): Int16Array {
  const out = new Int16Array(track)
  ranges.forEach((r, k) => {
    const bed = makeBed(kind, r.endMs - r.startMs, db, k + 7)
    const offset = msToSamples(r.startMs)
    for (let i = 0; i < bed.length && offset + i < out.length; i++) out[offset + i] = Math.max(-32768, Math.min(32767, out[offset + i] + bed[i]))
  })
  return out
}
