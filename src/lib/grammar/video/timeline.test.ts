import { describe, expect, it } from 'vitest'
import sample from './samples/passive-voice.json'
import { parseVideoScenes, type VideoScene } from '../../../types/grammar-video'
import {
  buildTimeline,
  cssEase,
  estimateSpeechMs,
  formatChapterTime,
  formatSrtTime,
  getFrameState,
  sceneSettledTime,
  toSrt,
  toYoutubeChapters,
} from './timeline'

const scenes = parseVideoScenes(sample).scenes

function scene(id: string, name: string, segments: VideoScene['segments']): VideoScene {
  return {
    id,
    name,
    template: 'opening',
    data: { seriesLabel: 's', titleKo: 't', titleEn: 'e', hook: 'h', hookStep: 1 },
    segments,
  }
}

describe('estimateSpeechMs', () => {
  it('한국어 글자당 120ms, 영어 80ms, 최소 1.2초', () => {
    expect(estimateSpeechMs('가나다라마바사아자차', 'ko')).toBe(1200)
    expect(estimateSpeechMs('가'.repeat(20), 'ko')).toBe(2400)
    expect(estimateSpeechMs('a'.repeat(20), 'en')).toBe(1600)
    expect(estimateSpeechMs('hi', 'en')).toBe(1200)
  })
})

describe('buildTimeline', () => {
  it('장면 시작 350 → 문장 + 260 → 장면 끝 600', () => {
    const tl = buildTimeline([
      scene('a', 'A', [
        { id: 'a1', lang: 'ko', text: 'x', reveal: 0, durationSec: 2 },
        { id: 'a2', lang: 'en', text: 'y', reveal: 1, durationSec: 1.5 },
      ]),
    ])
    const s = tl.scenes[0]
    expect(s.segments.map((x) => [x.start, x.end])).toEqual([
      [350, 2350],
      [2610, 4110],
    ])
    expect(s.end).toBe(4110 + 260 + 600)
    expect(tl.duration).toBe(4970)
    expect(tl.estimatedCount).toBe(0)
    expect(s.stepTimes.get(1)).toBe(2610)
  })

  it('대기 세그먼트는 문장 간격 없이 waitMs만, 타이머 구간 기록', () => {
    const tl = buildTimeline(scenes)
    const quiz = tl.scenes[6]
    const wait = quiz.segments[1]
    expect(wait.end - wait.start).toBe(5000)
    expect(quiz.segments[2].start).toBe(wait.end)
    expect(quiz.timer).toEqual({ start: wait.start, end: wait.end })
    expect(quiz.answerTimes.get(1)).toBe(quiz.segments[2].start)
    expect(quiz.answerTimes.get(3)).toBe(quiz.segments[4].start)
  })

  it('다음 장면은 앞 장면 끝에서 시작하고 합계 = 마지막 장면 끝', () => {
    const tl = buildTimeline(scenes)
    for (let i = 1; i < tl.scenes.length; i++) expect(tl.scenes[i].start).toBe(tl.scenes[i - 1].end)
    expect(tl.duration).toBe(tl.scenes[7].end)
    expect(tl.estimatedCount).toBe(scenes.reduce((n, s) => n + s.segments.filter((x) => !x.waitMs).length, 0))
  })

  it('샘플 길이는 약 2분 (예상치 기준)', () => {
    const sec = buildTimeline(scenes).duration / 1000
    expect(sec).toBeGreaterThan(90)
    expect(sec).toBeLessThan(150)
  })

  it('reveal 3이면 1~3단계를 같은 시각에 공개', () => {
    const tl = buildTimeline(scenes)
    const st = tl.scenes[1] // compare: 단계 0, 2, 3
    expect(st.stepTimes.get(0)).toBe(st.segments[0].start)
    expect(st.stepTimes.get(2)).toBe(st.segments[4].start)
    expect(st.stepTimes.get(3)).toBe(st.segments[5].start)
  })
})

describe('getFrameState', () => {
  const tl = buildTimeline(scenes)

  it('첫 장면은 전환 없이 시작, 훅은 reveal 1 이후 등장', () => {
    const f0 = getFrameState(tl, 0)
    expect(f0?.sceneIndex).toBe(0)
    expect(f0?.transition).toBe(1)
    expect(f0?.current.step(1)).toBe(0)
    const hookAt = tl.scenes[0].stepTimes.get(1) ?? 0
    expect(getFrameState(tl, hookAt + 225)?.current.step(1)).toBeGreaterThan(0)
    expect(getFrameState(tl, hookAt + 450)?.current.step(1)).toBe(1)
  })

  it('장면 전환 0.45초 동안 이전 장면이 겹쳐 보인다', () => {
    const start = tl.scenes[1].start
    const mid = getFrameState(tl, start + 100)
    expect(mid?.previous?.sceneIndex).toBe(0)
    expect(mid?.previous?.step(1)).toBe(1)
    const after = getFrameState(tl, start + 450)
    expect(after?.previous).toBeNull()
  })

  it('타이머 진행률은 대기 구간에서 0→1', () => {
    const timer = tl.scenes[6].timer
    if (!timer) throw new Error('timer')
    expect(getFrameState(tl, timer.start)?.current.timer).toBe(0)
    expect(getFrameState(tl, (timer.start + timer.end) / 2)?.current.timer).toBeCloseTo(0.5)
    expect(getFrameState(tl, timer.end + 10)?.current.timer).toBe(1)
  })

  it('자막: 문장이 이어지면 페이드 없이, 대기 중에는 꺼짐', () => {
    const quiz = tl.scenes[6]
    const second = tl.scenes[1].segments[1]
    expect(getFrameState(tl, second.start + 10)?.subtitle).toMatchObject({ lang: 'en', opacity: 1 })
    const wait = quiz.segments[1]
    expect(getFrameState(tl, wait.start + 1000)?.subtitle).toBeNull()
    expect(getFrameState(tl, wait.start + 50)?.subtitle?.opacity).toBeLessThan(1)
  })

  it('같은 t는 항상 같은 상태', () => {
    const t = tl.scenes[3].start + 3210
    const a = getFrameState(tl, t)
    const b = getFrameState(tl, t)
    expect(a?.revealedStep).toBe(b?.revealedStep)
    expect(a?.subtitle).toEqual(b?.subtitle)
  })

  it('장면 끝 화면에서는 모든 단계가 보인다', () => {
    const f = getFrameState(tl, sceneSettledTime(tl, 2))
    expect(f?.sceneIndex).toBe(2)
    expect([1, 2, 3, 4].map((s) => f?.current.step(s))).toEqual([1, 1, 1, 1])
  })
})

describe('cssEase', () => {
  it('0과 1, 단조 증가', () => {
    expect(cssEase(0)).toBe(0)
    expect(cssEase(1)).toBe(1)
    expect(cssEase(0.5)).toBeGreaterThan(0.75)
    expect(cssEase(0.3)).toBeLessThan(cssEase(0.31))
  })
})

describe('toSrt', () => {
  it('시간 형식', () => {
    expect(formatSrtTime(0)).toBe('00:00:00,000')
    expect(formatSrtTime(3723045)).toBe('01:02:03,045')
  })

  it('세그먼트 1개 = 자막 1줄, 대기 세그먼트는 빠짐', () => {
    const tl = buildTimeline(scenes)
    const srt = toSrt(tl)
    const blocks = srt.trim().split('\n\n')
    const speechCount = scenes.reduce((n, s) => n + s.segments.filter((x) => !x.waitMs).length, 0)
    expect(blocks).toHaveLength(speechCount)
    expect(blocks[0]).toBe('1\n00:00:00,350 --> 00:00:04,570\n안녕하세요! 오늘은 영어 문법의 핵심, 수동태를 알아볼게요.')
  })
})

describe('toYoutubeChapters', () => {
  it('첫 챕터 0:00, 10초 이상, 3개 이상', () => {
    const chapters = toYoutubeChapters(buildTimeline(scenes))
    expect(chapters[0]).toMatchObject({ startSec: 0, line: '0:00 오프닝' })
    expect(chapters.length).toBeGreaterThanOrEqual(3)
    const total = Math.floor(buildTimeline(scenes).duration / 1000)
    chapters.forEach((c, i) => {
      const next = chapters[i + 1]?.startSec ?? total
      expect(next - c.startSec).toBeGreaterThanOrEqual(10)
    })
  })

  it('짧은 장면은 앞 챕터에 합친다', () => {
    const long = (id: string, sec: number) => scene(id, id, [{ id: `${id}-1`, lang: 'ko', text: 'x', reveal: 1, durationSec: sec }])
    const tl = buildTimeline([long('A', 20), long('B', 3), long('C', 20), long('D', 20)])
    expect(toYoutubeChapters(tl).map((c) => c.name)).toEqual(['A', 'C', 'D'])
  })

  it('짧은 첫 장면은 다음 장면을 합친다', () => {
    const long = (id: string, sec: number) => scene(id, id, [{ id: `${id}-1`, lang: 'ko', text: 'x', reveal: 1, durationSec: sec }])
    const tl = buildTimeline([long('A', 4), long('B', 20), long('C', 20), long('D', 20)])
    expect(toYoutubeChapters(tl).map((c) => c.name)).toEqual(['A', 'C', 'D'])
  })

  it('3개가 안 되면 빈 배열', () => {
    const long = (id: string, sec: number) => scene(id, id, [{ id: `${id}-1`, lang: 'ko', text: 'x', reveal: 1, durationSec: sec }])
    expect(toYoutubeChapters(buildTimeline([long('A', 20), long('B', 20)]))).toEqual([])
  })

  it('시간 표기', () => {
    expect(formatChapterTime(65)).toBe('1:05')
    expect(formatChapterTime(3723)).toBe('1:02:03')
  })
})
