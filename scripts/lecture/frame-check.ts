// 렌더 깜박임 검사 — 앞뒤 프레임과 전혀 다른 장면(빈 화면 등)이 1~2프레임만 끼어든 곳을 찾는다.
// 1440p 렌더에서 Chrome이 화면을 다 그리기 전에 캡처해 배경만 찍힌 프레임이 가끔 섞였다 (2026-11).
// 영상을 160×90 회색조로 줄여 이웃 프레임끼리 평균 밝기 차이를 비교한다.

import { ffmpeg } from './common'

const W = 160
const H = 90
/** 장면이 "바뀌었다"고 볼 평균 밝기 차이 (0~255) */
const CHANGE = 6

export interface FlickerHit {
  /** 영상 안 프레임 번호 (0부터) */
  frame: number
  /** 끼어든 프레임 수 */
  length: number
}

/** ffmpeg → AVI(rawvideo gray) 파이프에서 프레임만 꺼낸다 (내장 ffmpeg에 rawvideo 출력 형식이 없어 AVI로 받음) */
function parseAviFrames(buf: Buffer): Uint8Array[] {
  const frames: Uint8Array[] = []
  const size = W * H
  let i = buf.indexOf('movi')
  if (i < 0) return frames
  i += 4
  while (i + 8 <= buf.length) {
    const id = buf.toString('latin1', i, i + 4)
    const len = buf.readUInt32LE(i + 4)
    if (id === 'LIST') {
      i += 12 // LIST + 크기 + 목록 종류 → 안으로 들어감
      continue
    }
    if ((id.endsWith('db') || id.endsWith('dc')) && len === size && i + 8 + len <= buf.length) {
      frames.push(buf.subarray(i + 8, i + 8 + len))
    }
    i += 8 + len + (len % 2)
  }
  return frames
}

async function readFrames(file: string, startSec?: number, durSec?: number): Promise<Uint8Array[]> {
  const seek = startSec !== undefined ? ['-ss', startSec.toFixed(3)] : []
  const dur = durSec !== undefined ? ['-t', durSec.toFixed(3)] : []
  const { stdout } = await ffmpeg([
    '-v', 'error', ...seek, '-i', file, ...dur,
    '-an', '-vf', `scale=${W}:${H}`, '-pix_fmt', 'gray', '-c:v', 'rawvideo', '-f', 'avi', '-',
  ])
  return parseAviFrames(stdout)
}

function diff(a: Uint8Array, b: Uint8Array): number {
  let s = 0
  for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i])
  return s / a.length
}

/** 프레임 목록에서 끼어든 프레임 찾기: 앞→끼어든 것, 끼어든 것→뒤 모두 크게 바뀌었는데 앞↔뒤는 거의 같음 */
export function findFlicker(frames: Uint8Array[], offset = 0): FlickerHit[] {
  const hits: FlickerHit[] = []
  for (const k of [1, 2]) {
    for (let i = 1; i + k < frames.length; i++) {
      const before = diff(frames[i - 1], frames[i])
      if (before <= CHANGE) continue
      const after = diff(frames[i + k - 1], frames[i + k])
      if (after <= CHANGE) continue
      const span = diff(frames[i - 1], frames[i + k])
      if (span < Math.min(before, after) / 4) hits.push({ frame: offset + i, length: k })
    }
  }
  return hits.sort((a, b) => a.frame - b.frame)
}

/** 영상 파일 전체(또는 구간) 검사 */
export async function checkVideoFlicker(file: string, opts: { startSec?: number; durSec?: number; frameOffset?: number } = {}): Promise<FlickerHit[]> {
  const frames = await readFrames(file, opts.startSec, opts.durSec)
  if (frames.length === 0) throw new Error(`깜박임 검사: 프레임을 읽지 못했어요 (${file})`)
  return findFlicker(frames, opts.frameOffset ?? 0)
}
