// MP3 바이트에서 재생 길이(초)를 계산한다 — 프레임 헤더를 직접 읽는다 (라이브러리 없음)
// ElevenLabs 기본 출력(mp3_44100_128, MPEG-1 Layer III)을 대상으로 하며, MPEG-2/2.5 Layer III도 읽는다.

const BITRATES_V1_L3 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320]
const BITRATES_V2_L3 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160]
const SAMPLE_RATES: Record<number, number[]> = {
  3: [44100, 48000, 32000], // MPEG-1
  2: [22050, 24000, 16000], // MPEG-2
  0: [11025, 12000, 8000], // MPEG-2.5
}

interface FrameHeader {
  length: number
  samples: number
  sampleRate: number
  /** 사이드 정보가 끝나는 위치 (Xing/Info 태그 위치) */
  sideInfoEnd: number
}

function readFrameHeader(bytes: Uint8Array, pos: number): FrameHeader | null {
  if (pos + 4 > bytes.length) return null
  const b1 = bytes[pos + 1]
  const b2 = bytes[pos + 2]
  const b3 = bytes[pos + 3]
  if (bytes[pos] !== 0xff || (b1 & 0xe0) !== 0xe0) return null
  const version = (b1 >> 3) & 0x03 // 0=2.5, 2=2, 3=1, 1=예약
  const layer = (b1 >> 1) & 0x03 // 1 = Layer III
  if (version === 1 || layer !== 1) return null
  const bitrateIndex = (b2 >> 4) & 0x0f
  const rateIndex = (b2 >> 2) & 0x03
  if (bitrateIndex === 0 || bitrateIndex === 15 || rateIndex === 3) return null
  const padding = (b2 >> 1) & 0x01
  const isV1 = version === 3
  const kbps = (isV1 ? BITRATES_V1_L3 : BITRATES_V2_L3)[bitrateIndex]
  const sampleRate = SAMPLE_RATES[version][rateIndex]
  const samples = isV1 ? 1152 : 576
  const length = Math.floor(((isV1 ? 144 : 72) * kbps * 1000) / sampleRate) + padding
  const mono = ((b3 >> 6) & 0x03) === 3
  const sideInfo = isV1 ? (mono ? 17 : 32) : mono ? 9 : 17
  return { length, samples, sampleRate, sideInfoEnd: pos + 4 + sideInfo }
}

/** ID3v2 태그 길이 (없으면 0) */
function id3Length(bytes: Uint8Array): number {
  if (bytes.length < 10 || bytes[0] !== 0x49 || bytes[1] !== 0x44 || bytes[2] !== 0x33) return 0
  const size = ((bytes[6] & 0x7f) << 21) | ((bytes[7] & 0x7f) << 14) | ((bytes[8] & 0x7f) << 7) | (bytes[9] & 0x7f)
  const footer = (bytes[5] & 0x10) !== 0 ? 10 : 0
  return 10 + size + footer
}

function readAscii(bytes: Uint8Array, pos: number, len: number): string {
  let s = ''
  for (let i = 0; i < len && pos + i < bytes.length; i++) s += String.fromCharCode(bytes[pos + i])
  return s
}

/**
 * MP3 재생 길이(초, 소수 셋째 자리). 프레임을 하나도 못 찾으면 null.
 * 첫 프레임이 Xing/Info 태그면 그 프레임은 소리로 세지 않고, 프레임 수가 적혀 있으면 그 값을 쓴다.
 */
export function getMp3DurationSec(bytes: Uint8Array): number | null {
  let pos = id3Length(bytes)
  let totalSamples = 0
  let sampleRate = 0
  let frames = 0
  let skippedBytes = 0
  let checkedTag = false

  while (pos + 4 <= bytes.length) {
    const header = readFrameHeader(bytes, pos)
    if (!header) {
      // 동기화가 깨진 경우 한 바이트씩 앞으로 (긴 쓰레기 구간은 포기)
      pos += 1
      skippedBytes += 1
      if (skippedBytes > 64 * 1024) break
      continue
    }
    if (frames === 0 && !checkedTag) {
      checkedTag = true
      const tag = readAscii(bytes, header.sideInfoEnd, 4)
      if (tag === 'Xing' || tag === 'Info') {
        const flags = bytes[header.sideInfoEnd + 7]
        if (flags & 0x01) {
          const p = header.sideInfoEnd + 8
          const count = ((bytes[p] << 24) | (bytes[p + 1] << 16) | (bytes[p + 2] << 8) | bytes[p + 3]) >>> 0
          if (count > 0) return round3((count * header.samples) / header.sampleRate)
        }
        // 태그 프레임은 소리로 세지 않는다
        pos += header.length
        continue
      }
    }
    if (pos + header.length > bytes.length) break // 마지막 잘린 프레임
    totalSamples += header.samples
    sampleRate = header.sampleRate
    frames += 1
    pos += header.length
  }

  if (frames === 0 || !sampleRate) return null
  return round3(totalSamples / sampleRate)
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000
}
