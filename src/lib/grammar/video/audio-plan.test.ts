import { describe, expect, it } from 'vitest'
import sample from './samples/passive-voice.json'
import { parseVideoScenes, type Segment } from '../../../types/grammar-video'
import {
  isSpokenSegment,
  normalizeSpeechText,
  planScriptAudio,
  segmentAudioHash,
  segmentAudioPath,
  segmentAudioState,
  type AudioVoices,
} from './audio-plan'

const voices: AudioVoices = {
  ko: { voiceId: 'ko-voice', modelId: 'eleven_multilingual_v2', speed: 1 },
  en: { voiceId: 'en-voice', modelId: 'eleven_multilingual_v2', speed: 0.88 },
}
const scenes = parseVideoScenes(sample).scenes

describe('segmentAudioHash', () => {
  const seg = { lang: 'ko' as const, text: '수동태를 배워 봐요.' }

  it('같은 입력이면 같은 해시', () => {
    expect(segmentAudioHash(seg, voices)).toBe(segmentAudioHash({ ...seg }, voices))
  })

  it('앞뒤·연속 공백은 무시한다', () => {
    expect(segmentAudioHash({ ...seg, text: '  수동태를   배워 봐요. ' }, voices)).toBe(segmentAudioHash(seg, voices))
  })

  it('문장·목소리·모델·속도가 바뀌면 해시가 바뀐다', () => {
    const base = segmentAudioHash(seg, voices)
    expect(segmentAudioHash({ ...seg, text: '수동태를 배워요.' }, voices)).not.toBe(base)
    expect(segmentAudioHash(seg, { ...voices, ko: { ...voices.ko, voiceId: 'other' } })).not.toBe(base)
    expect(segmentAudioHash(seg, { ...voices, ko: { ...voices.ko, modelId: 'eleven_flash_v2_5' } })).not.toBe(base)
    expect(segmentAudioHash(seg, { ...voices, ko: { ...voices.ko, speed: 1.1 } })).not.toBe(base)
    // 영어 목소리만 바뀌면 한국어 해시는 그대로
    expect(segmentAudioHash(seg, { ...voices, en: { ...voices.en, voiceId: 'other' } })).toBe(base)
  })
})

describe('segmentAudioState', () => {
  const seg: Segment = { id: 's1', lang: 'en', text: 'The cake was made.' }
  const hash = segmentAudioHash(seg, voices)

  it('음성 없음 / 최신 / 수정됨', () => {
    expect(segmentAudioState(seg, voices)).toBe('none')
    const ready = { ...seg, audioPath: 'x/s1.mp3', durationSec: 1.4, textHash: hash }
    expect(segmentAudioState(ready, voices)).toBe('ready')
    expect(segmentAudioState({ ...ready, text: 'The cake is made.' }, voices)).toBe('stale')
  })

  it('대기 세그먼트는 읽지 않는다', () => {
    expect(isSpokenSegment({ id: 'w', lang: 'ko', text: '', waitMs: 5000, timer: true })).toBe(false)
    expect(isSpokenSegment(seg)).toBe(true)
  })
})

describe('planScriptAudio', () => {
  it('픽스처: 처음에는 읽는 세그먼트 전부가 대상', () => {
    const plan = planScriptAudio(scenes, voices)
    const spoken = scenes.flatMap((s) => s.segments).filter(isSpokenSegment)
    expect(plan.segments).toBe(spoken.length)
    expect(plan.spokenSegments).toBe(spoken.length)
    expect(plan.chars).toBe(spoken.reduce((n, s) => n + normalizeSpeechText(s.text).length, 0))
    expect(plan.ready).toBe(false)
    expect(plan.scenes).toHaveLength(scenes.length)
  })

  it('모든 세그먼트에 최신 음성이 있으면 ready', () => {
    const done = scenes.map((scene) => ({
      ...scene,
      segments: scene.segments.map((s) =>
        isSpokenSegment(s) ? { ...s, audioPath: `p/${s.id}.mp3`, durationSec: 1, textHash: segmentAudioHash(s, voices) } : s,
      ),
    })) as typeof scenes
    const plan = planScriptAudio(done, voices)
    expect(plan).toMatchObject({ segments: 0, chars: 0, ready: true })
  })
})

describe('segmentAudioPath', () => {
  it('{scriptId}/{segmentId}-{hash}.mp3, 경로에 못 쓰는 글자는 _', () => {
    expect(segmentAudioPath('abc-123', 'opening/1', 'h1')).toBe('abc-123/opening_1-h1.mp3')
  })
})
