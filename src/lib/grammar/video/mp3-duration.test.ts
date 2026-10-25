import { describe, expect, it } from 'vitest'
import { getMp3DurationSec } from './mp3-duration'

/** MPEG-1 Layer III 128kbps 44.1kHz 프레임 (417바이트, 1152샘플) */
function frame(): Uint8Array {
  const f = new Uint8Array(417)
  f.set([0xff, 0xfb, 0x90, 0x00])
  return f
}

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let o = 0
  for (const p of parts) {
    out.set(p, o)
    o += p.length
  }
  return out
}

function frames(n: number): Uint8Array[] {
  return Array.from({ length: n }, frame)
}

describe('getMp3DurationSec', () => {
  it('프레임 수 × 1152 / 44100', () => {
    expect(getMp3DurationSec(concat(frames(100)))).toBeCloseTo((100 * 1152) / 44100, 3)
  })

  it('ID3v2 태그는 건너뛴다', () => {
    const id3 = new Uint8Array(10 + 20)
    id3.set([0x49, 0x44, 0x33, 4, 0, 0, 0, 0, 0, 20])
    expect(getMp3DurationSec(concat([id3, ...frames(50)]))).toBeCloseTo((50 * 1152) / 44100, 3)
  })

  it('Xing 프레임 수가 있으면 그 값을 쓴다', () => {
    const xing = frame()
    // 스테레오 MPEG-1: 헤더 4 + 사이드 정보 32 = 36
    xing.set([0x58, 0x69, 0x6e, 0x67, 0, 0, 0, 0x01, 0, 0, 0, 200], 36)
    expect(getMp3DurationSec(concat([xing, ...frames(3)]))).toBeCloseTo((200 * 1152) / 44100, 3)
  })

  it('프레임 수가 없는 Info 프레임은 세지 않는다', () => {
    const info = frame()
    info.set([0x49, 0x6e, 0x66, 0x6f, 0, 0, 0, 0], 36)
    expect(getMp3DurationSec(concat([info, ...frames(10)]))).toBeCloseTo((10 * 1152) / 44100, 3)
  })

  it('잘린 마지막 프레임은 세지 않는다', () => {
    const data = concat([...frames(10), frame().slice(0, 100)])
    expect(getMp3DurationSec(data)).toBeCloseTo((10 * 1152) / 44100, 3)
  })

  it('MP3가 아니면 null', () => {
    expect(getMp3DurationSec(new Uint8Array([1, 2, 3, 4, 5, 6]))).toBeNull()
    expect(getMp3DurationSec(new Uint8Array())).toBeNull()
  })
})
