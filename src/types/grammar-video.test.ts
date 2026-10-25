import { describe, expect, it } from 'vitest'
import sample from '../lib/grammar/video/samples/passive-voice.json'
import { joinTokens, needsSpaceBetween, parseVideoScenes, sceneSteps, type VideoScene } from './grammar-video'

interface RawSeg {
  id: string
  lang: string
  text: string
  reveal?: number
  answer?: number
  timer?: boolean
}
interface RawScene {
  id: string
  template: string
  data: Record<string, unknown>
  segments: RawSeg[]
}

/** 픽스처를 고쳐 보기 위한 느슨한 복사본 */
function clone(v: unknown): RawScene[] {
  return JSON.parse(JSON.stringify(v)) as RawScene[]
}

describe('parseVideoScenes — 샘플 픽스처', () => {
  it('수동태 샘플 8장면이 오류 없이 통과한다', () => {
    const res = parseVideoScenes(sample)
    expect(res.errors).toEqual([])
    expect(res.ok).toBe(true)
    expect(res.scenes.map((s) => s.template)).toEqual([
      'opening',
      'compare',
      'steps',
      'variations',
      'cases',
      'warning',
      'quiz',
      'summary',
    ])
  })

  it('퀴즈 대기 세그먼트를 읽는다', () => {
    const quiz = parseVideoScenes(sample).scenes.find((s) => s.template === 'quiz')
    const wait = quiz?.segments.find((s) => s.waitMs)
    expect(wait).toMatchObject({ waitMs: 5000, timer: true, text: '' })
  })

  it('화면 문장 조각을 원문 문장으로 잇는다', () => {
    const compare = parseVideoScenes(sample).scenes[1] as Extract<VideoScene, { template: 'compare' }>
    expect(joinTokens(compare.data.rows[1].sentence)).toBe('The letter was written by Tom.')
    const steps = parseVideoScenes(sample).scenes[2] as Extract<VideoScene, { template: 'steps' }>
    expect(joinTokens(steps.data.formula)).toBe('주어 + be + p.p. + (by 행위자)')
  })
})

describe('parseVideoScenes — 잘못된 장면', () => {
  it('배열이 아니면 전체 오류', () => {
    const res = parseVideoScenes({ scenes: [] })
    expect(res.ok).toBe(false)
    expect(res.errors[0]).toMatchObject({ sceneIndex: -1 })
  })

  it('모르는 장면 틀은 이유와 함께 오류로 남고 나머지 장면은 유지된다', () => {
    const json = clone(sample)
    json[2].template = 'slideshow'
    const res = parseVideoScenes(json)
    expect(res.ok).toBe(false)
    expect(res.scenes).toHaveLength(7)
    expect(res.errors).toHaveLength(1)
    expect(res.errors[0]).toMatchObject({ sceneIndex: 2, sceneId: 'steps', path: 'template' })
    expect(res.errors[0].message).toContain('장면 틀')
  })

  it('잘못된 색 역할을 알려 준다', () => {
    const json = clone(sample)
    ;(json[1].data.rows as { sentence: { role?: string }[] }[])[0].sentence[0].role = 'blue'
    const res = parseVideoScenes(json)
    expect(res.errors[0]).toMatchObject({ sceneIndex: 1, path: 'data.rows[0].sentence[0].role' })
  })

  it('나레이션에서 공개되지 않는 등장 단계를 알려 준다', () => {
    const json = clone(sample)
    const steps = json[2]
    steps.segments = steps.segments.filter((s) => (s.reveal ?? 0) < 4)
    const res = parseVideoScenes(json)
    expect(res.ok).toBe(false)
    expect(res.errors.some((e) => e.sceneIndex === 2 && e.message.includes('등장 단계 4'))).toBe(true)
  })

  it('공개되지 않은 퀴즈 정답을 알려 준다', () => {
    const json = clone(sample)
    const quiz = json[6]
    quiz.segments = quiz.segments.filter((s) => s.answer !== 3)
    const res = parseVideoScenes(json)
    expect(res.errors.some((e) => e.sceneIndex === 6 && e.message.includes('퀴즈 정답 3'))).toBe(true)
  })

  it('퀴즈가 아닌 장면의 answer는 오류', () => {
    const json = clone(sample)
    json[0].segments[0].answer = 1
    const res = parseVideoScenes(json)
    expect(res.errors.some((e) => e.sceneIndex === 0 && e.message.includes('퀴즈 장면에서만'))).toBe(true)
  })

  it('겹치는 세그먼트 id는 오류이고 그 장면은 빠진다', () => {
    const json = clone(sample)
    json[1].segments[0].id = 'op-1'
    const res = parseVideoScenes(json)
    expect(res.errors.some((e) => e.message.includes('op-1'))).toBe(true)
    expect(res.scenes.map((s) => s.id)).not.toContain('compare')
  })

  it('타이머는 대기 세그먼트에만', () => {
    const json = clone(sample)
    json[0].segments[0].timer = true
    const res = parseVideoScenes(json)
    expect(res.errors[0].path).toBe('segments[0].timer')
  })

  it('빈 문장 세그먼트와 잘못된 언어', () => {
    const json = clone(sample)
    json[0].segments[0].text = ''
    json[0].segments[1].lang = 'jp'
    const res = parseVideoScenes(json)
    const paths = res.errors.filter((e) => e.sceneIndex === 0).map((e) => e.path)
    expect(paths).toEqual(expect.arrayContaining(['segments[0].text', 'segments[1].lang']))
  })

  it('행 수 범위를 벗어나면 오류', () => {
    const json = clone(sample)
    json[1].data.rows = (json[1].data.rows as unknown[]).slice(0, 1)
    const res = parseVideoScenes(json)
    expect(res.errors.some((e) => e.path === 'data.rows' && e.message.includes('2~4개'))).toBe(true)
  })
})

describe('기본값 채우기', () => {
  it('warning 단계·summary cta 단계가 없으면 기본값', () => {
    const json = clone(sample)
    delete json[5].data.ruleStep
    delete json[5].data.wordsStep
    delete json[7].data.ctaStep
    const res = parseVideoScenes(json)
    expect(res.ok).toBe(true)
    const warning = res.scenes[5] as Extract<VideoScene, { template: 'warning' }>
    expect(warning.data.ruleStep).toBe(1)
    expect(warning.data.wordsStep).toBe(4)
    const summary = res.scenes[7] as Extract<VideoScene, { template: 'summary' }>
    expect(summary.data.ctaStep).toBe(4)
    expect(sceneSteps(summary)).toEqual([1, 2, 3, 4])
  })

  it('compare note가 문자열이면 마지막 행 다음 단계', () => {
    const json = clone(sample)
    json[1].data.note = '같은 색끼리 보세요.'
    const compare = parseVideoScenes(json).scenes[1] as Extract<VideoScene, { template: 'compare' }>
    expect(compare.data.note).toEqual({ text: '같은 색끼리 보세요.', step: 3 })
  })
})

describe('needsSpaceBetween', () => {
  it('문장부호·괄호 규칙', () => {
    expect(needsSpaceBetween('Tom', 'wrote')).toBe(true)
    expect(needsSpaceBetween('letter', '.')).toBe(false)
    expect(needsSpaceBetween('+ (', 'by')).toBe(false)
    expect(needsSpaceBetween('행위자', ')')).toBe(false)
    expect(needsSpaceBetween('a ', 'b')).toBe(false)
  })
})
