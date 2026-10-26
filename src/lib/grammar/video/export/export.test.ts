import { describe, expect, it } from 'vitest'
import sample from '../samples/passive-voice.json'
import { parseVideoScenes } from '../../../../types/grammar-video'
import { buildTimeline } from '../timeline'
import { EXPORT_SAMPLE_RATE, frameCount, frameTimeMs, mixPlacements, msToSamples, planAudioPlacements } from './plan'
import { buildScriptText, buildYoutubeDescription, exportFileBase, hashtags, titleCandidates, YOUTUBE_TITLE_MAX } from './youtube-text'

const scenes = parseVideoScenes(sample).scenes
const timeline = buildTimeline(scenes)
const point = { code: 'G06-01-01', title: '수동태의 기본 형태', summary: 'be + p.p.로 만든다.', categoryName: '수동태' }

describe('frameCount', () => {
  it('마지막 프레임이 끝을 덮도록 올림', () => {
    expect(frameCount(1000)).toBe(30)
    expect(frameCount(1001)).toBe(31)
    expect(frameCount(0)).toBe(1)
    expect(frameTimeMs(30)).toBe(1000)
  })
  it('프레임 길이 합계 ≥ 타임라인 길이, 차이는 한 프레임 미만', () => {
    const n = frameCount(timeline.duration)
    expect(n * (1000 / 30)).toBeGreaterThanOrEqual(timeline.duration)
    expect(n * (1000 / 30) - timeline.duration).toBeLessThan(1000 / 30)
  })
})

describe('planAudioPlacements', () => {
  it('대기 세그먼트는 빼고, 다음 세그먼트 시작까지를 최대 길이로', () => {
    const plan = planAudioPlacements(timeline)
    const all = timeline.scenes.flatMap((s) => s.segments)
    const spoken = all.filter((s) => !s.segment.waitMs && s.segment.text.trim())
    expect(plan).toHaveLength(spoken.length)
    plan.forEach((p) => {
      const idx = all.findIndex((s) => s.segment.id === p.segmentId)
      const seg = all[idx]
      expect(p.startMs).toBe(seg.start)
      const next = idx + 1 < all.length ? all[idx + 1].start : timeline.duration
      expect(p.startMs + p.maxMs).toBe(next)
      expect(p.maxMs).toBeGreaterThanOrEqual(seg.end - seg.start)
    })
  })
})

describe('mixPlacements', () => {
  it('위치에 놓고 최대 길이·전체 길이에서 자른다', () => {
    const out = mixPlacements(10, [
      { startSample: 2, maxSamples: 3, data: new Float32Array([0.5, 0.5, 0.5, 0.5]) },
      { startSample: 8, maxSamples: 5, data: new Float32Array([0.25, 0.25, 0.25]) },
    ])
    expect(Array.from(out)).toEqual([0, 0, 0.5, 0.5, 0.5, 0, 0, 0, 0.25, 0.25])
  })
  it('겹치면 더하고 -1~1로 자른다', () => {
    const out = mixPlacements(2, [
      { startSample: 0, maxSamples: 2, data: new Float32Array([0.8, -0.8]) },
      { startSample: 0, maxSamples: 2, data: new Float32Array([0.8, -0.8]) },
    ])
    expect(Array.from(out)).toEqual([1, -1])
  })
  it('음수 시작은 앞부분을 버린다', () => {
    const out = mixPlacements(3, [{ startSample: -1, maxSamples: 10, data: new Float32Array([0.1, 0.2, 0.3]) }])
    expect(Array.from(out).map((v) => Math.round(v * 10) / 10)).toEqual([0.2, 0.3, 0])
  })
  it('ms → 샘플', () => {
    expect(msToSamples(1000)).toBe(EXPORT_SAMPLE_RATE)
  })
})

describe('youtube-text', () => {
  it('파일 이름에서 못 쓰는 글자를 바꾼다', () => {
    expect(exportFileBase('G06-01-01', '수동태: be + p.p. / 기본')).toBe('G06-01-01-수동태-be-p.p.-기본')
    expect(exportFileBase('G01', '   ')).toBe('G01')
  })
  it('제목 후보 3개, 100자 이내', () => {
    const titles = titleCandidates(scenes, point)
    expect(titles).toHaveLength(3)
    titles.forEach((t) => expect(Array.from(t).length).toBeLessThanOrEqual(YOUTUBE_TITLE_MAX))
    expect(new Set(titles).size).toBe(3)
  })
  it('해시태그는 공백·기호 없이 중복 없음', () => {
    const tags = hashtags(scenes, point)
    tags.forEach((t) => expect(t).toMatch(/^#[^\s#.+():/-]+$/))
    expect(new Set(tags).size).toBe(tags.length)
  })
  it('설명문에 제목 후보·요약·0:00 챕터·해시태그', () => {
    const text = buildYoutubeDescription(scenes, timeline, point)
    expect(text).toContain('1. ')
    expect(text).toContain(point.summary)
    expect(text).toMatch(/^0:00 /m)
    expect(text).toContain('#영문법')
  })
  it('스크립트에 모든 나레이션 문장', () => {
    const text = buildScriptText(scenes, timeline, '수동태', point)
    for (const s of scenes) for (const seg of s.segments) if (!seg.waitMs) expect(text).toContain(seg.text)
    expect(text).toContain('(대기 ')
  })
})
