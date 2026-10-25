import { describe, expect, it } from 'vitest'
import sample from './samples/passive-voice.json'
import { parseVideoScenes, VIDEO_TEMPLATES, type VideoScene } from '../../../types/grammar-video'
import {
  checkScriptStructure,
  compareNarration,
  createBlankScene,
  detectSentenceLang,
  fillConvertedNarration,
  narrationChars,
  narrationTargetChars,
  normalizeAiScript,
  repairReveals,
  scenesWithFewExamples,
  splitScriptSentences,
} from './script-prompt'

const scenes = parseVideoScenes(sample).scenes

describe('normalizeAiScript', () => {
  it('장면 id를 slug로, 겹치면 번호, 세그먼트 id는 장면id-번호, 음성 필드는 지운다', () => {
    const raw = {
      title: ' 수동태 ',
      scenes: [
        { id: 'Intro Scene', segments: [{ id: 'x', text: 'a', audioPath: 'p', durationSec: 1, textHash: 'h' }] },
        { id: 'intro-scene', segments: [{ id: 'x', text: 'b' }, { id: 'x', text: 'c' }] },
        { segments: [] },
      ],
      gaps: [{ message: '예외 설명 없음', request: '예외 원고' }, '문자열 요청', { request: '메시지 없음' }],
    }
    const out = normalizeAiScript(raw)
    expect(out?.title).toBe('수동태')
    const s = out?.scenes as { id: string; segments: Record<string, unknown>[] }[]
    expect(s.map((x) => x.id)).toEqual(['intro-scene', 'intro-scene-2', 'scene-3'])
    expect(s[1].segments.map((g) => g.id)).toEqual(['intro-scene-2-1', 'intro-scene-2-2'])
    expect(s[0].segments[0]).toEqual({ id: 'intro-scene-1', text: 'a' })
    expect(out?.gaps).toEqual([
      { message: '예외 설명 없음', request: '예외 원고' },
      { message: '문자열 요청', request: '' },
    ])
  })

  it('배열만 와도 받는다, 형식이 다르면 null', () => {
    expect(normalizeAiScript([{ id: 'a', segments: [] }])?.scenes).toHaveLength(1)
    expect(normalizeAiScript({ foo: 1 })).toBeNull()
  })

  it('픽스처를 정리해도 파서를 통과한다', () => {
    const out = normalizeAiScript({ scenes: sample })
    expect(parseVideoScenes(out?.scenes).ok).toBe(true)
  })
})

describe('checkScriptStructure', () => {
  it('픽스처는 통과', () => {
    expect(checkScriptStructure(scenes)).toEqual([])
  })

  it('opening·quiz·summary·장면 수 규칙', () => {
    const noQuiz = scenes.filter((s) => s.template !== 'quiz')
    expect(checkScriptStructure(noQuiz)).toContain('quiz 장면이 없어요')
    const reversed = [...scenes].reverse()
    const problems = checkScriptStructure(reversed)
    expect(problems).toContain('첫 장면은 opening이어야 해요')
    expect(problems).toContain('마지막 장면은 summary여야 해요')
    expect(checkScriptStructure(scenes.slice(0, 3)).some((p) => p.includes('장면은 6~10개'))).toBe(true)
  })
})

describe('분량', () => {
  it('분당 650자', () => {
    expect(narrationTargetChars(3)).toBe(1950)
  })
  it('픽스처 나레이션 글자 수 (대기 제외)', () => {
    expect(narrationChars(scenes)).toBe(1119)
  })
  it('예문 장면의 영어 예문이 2개 미만이면 알려 준다', () => {
    const one = scenes.map((s) =>
      s.id === 'compare' ? ({ ...s, segments: s.segments.filter((g) => g.lang !== 'en') } as VideoScene) : s,
    )
    expect(scenesWithFewExamples(one)).toContain('능동 vs 수동')
  })
})

describe('compareNarration (붙여넣기 원문 대조)', () => {
  const script = scenes
    .flatMap((s) => s.segments)
    .filter((g) => !g.waitMs)
    .map((g) => g.text)
    .join('\n')

  it('나레이션이 대본 그대로면 차이 없음 (공백 차이는 무시)', () => {
    expect(compareNarration(script.replace(/\n/g, '  \n '), scenes)).toEqual({ missing: [], added: [] })
  })

  it('문장이 바뀌면 빠진 문장·추가된 문장으로 알려 준다', () => {
    const edited = scenes.map((s) =>
      s.id === 'compare'
        ? ({ ...s, segments: s.segments.map((g, i) => (i === 0 ? { ...g, text: '먼저 능동태를 봐요.' } : g)) } as VideoScene)
        : s,
    )
    const diff = compareNarration(script, edited)
    expect(diff.missing).toEqual(['먼저 능동태 문장을 볼게요.'])
    expect(diff.added).toEqual(['먼저 능동태를 봐요.'])
  })

  it('문장 나누기', () => {
    expect(splitScriptSentences('안녕하세요. 오늘은 수동태!\n"Tom wrote it." 그렇죠?')).toEqual([
      '안녕하세요.',
      '오늘은 수동태!',
      '"Tom wrote it."',
      '그렇죠?',
    ])
  })
})

describe('createBlankScene', () => {
  it.each(VIDEO_TEMPLATES)('%s 빈 장면이 파서를 통과하고 id가 겹치지 않는다', (template) => {
    const blank = createBlankScene(template, scenes)
    const all = [...scenes, blank]
    const parsed = parseVideoScenes(all)
    expect(parsed.errors).toEqual([])
    expect(scenes.some((s) => s.id === blank.id)).toBe(false)
  })

  it('같은 틀을 두 번 추가해도 id가 다르다', () => {
    const a = createBlankScene('quiz', scenes)
    const b = createBlankScene('quiz', [...scenes, a])
    expect(parseVideoScenes([...scenes, a, b]).ok).toBe(true)
  })
})

describe('fillConvertedNarration (붙여넣기 — 문장 번호 → 원문)', () => {
  const sentences = ['안녕하세요.', 'Mom cleans the room.', '엄마가 방을 청소해요.', 'The room is cleaned.', '끝!']

  it('문장 번호를 원문 문장·언어로 채우고 s는 지운다', () => {
    const out = fillConvertedNarration(
      [{ id: 'a', segments: [{ s: 1, reveal: 1 }, { s: 2 }, { waitMs: 5000, timer: true }, { s: 3 }, { s: 4 }, { s: 5 }] }],
      sentences,
    )
    expect(out.notes).toEqual([])
    const segs = (out.scenes[0] as { segments: Record<string, unknown>[] }).segments
    expect(segs.map((g) => g.text)).toEqual(['안녕하세요.', 'Mom cleans the room.', '', '엄마가 방을 청소해요.', 'The room is cleaned.', '끝!'])
    expect(segs.map((g) => g.lang)).toEqual(['ko', 'en', 'ko', 'ko', 'en', 'ko'])
    expect(segs[0]).toEqual({ reveal: 1, lang: 'ko', text: '안녕하세요.' })
    expect(segs.some((g) => 's' in g)).toBe(false)
  })

  it('지어낸 문장·중복은 버리고, 빠진 문장은 앞 문장 뒤에 넣는다', () => {
    const out = fillConvertedNarration(
      [
        { id: 'a', segments: [{ s: 1 }, { text: 'AI가 지어낸 말' }, { s: 1 }] },
        { id: 'b', segments: [{ s: 3 }, { s: 5 }] },
      ],
      sentences,
    )
    const texts = (out.scenes as { segments: { text: string }[] }[]).map((sc) => sc.segments.map((g) => g.text))
    expect(texts).toEqual([
      ['안녕하세요.', 'Mom cleans the room.'],
      ['엄마가 방을 청소해요.', 'The room is cleaned.', '끝!'],
    ])
    expect(out.notes).toHaveLength(3)
  })

  it('채운 결과는 파서를 통과하고 원문 대조에 차이가 없다', () => {
    const raw = [
      { id: 'op', name: '오프닝', template: 'opening', data: { seriesLabel: 's', titleKo: 't', titleEn: 'e', hook: 'h', hookStep: 1 }, segments: [{ s: 1, reveal: 1 }, { s: 2 }, { s: 3 }, { s: 4 }, { s: 5 }] },
    ]
    const filled = fillConvertedNarration(raw, sentences)
    const parsed = parseVideoScenes(normalizeAiScript({ scenes: filled.scenes })?.scenes)
    expect(parsed.ok).toBe(true)
    expect(compareNarration(sentences.join(' '), parsed.scenes)).toEqual({ missing: [], added: [] })
  })

  it('언어 판별', () => {
    expect(detectSentenceLang('The window was broken.')).toBe('en')
    expect(detectSentenceLang('by 뒤에 써요.')).toBe('ko')
  })
})

describe('repairReveals', () => {
  it('픽스처는 고칠 것이 없다', () => {
    const out = repairReveals(sample)
    expect(out.notes).toEqual([])
    expect(out.scenes).toEqual(sample)
  })

  it('공개 안 된 단계를 마지막 reveal 뒤 문장들에 나눠 주고, 모자라면 마지막 문장에 몰아 준다', () => {
    const compare = sample.find((s) => s.id === 'compare') as unknown as Record<string, unknown>
    const stripped = {
      ...compare,
      segments: (compare.segments as Record<string, unknown>[]).map((g) => {
        const { reveal: _r, ...rest } = g
        void _r
        return rest
      }),
    }
    const out = repairReveals([stripped])
    expect(out.notes).toHaveLength(1)
    const parsed = parseVideoScenes(out.scenes)
    expect(parsed.errors).toEqual([])
    const reveals = parsed.scenes[0].segments.map((g) => g.reveal)
    expect(reveals.slice(0, 3)).toEqual([0, 2, 3])
  })

  it('요약 장면 줄 번호도 단계로 센다', () => {
    const summary = { id: 'sum', name: '정리', template: 'summary', data: { title: 't', lines: [['a'], ['b'], ['c']], cta: 'c', ctaStep: 4 }, segments: [{ id: 'x1', lang: 'ko', text: '정리해요.', reveal: 1 }] }
    const parsed = parseVideoScenes(repairReveals([summary]).scenes)
    expect(parsed.ok).toBe(true)
    expect(parsed.scenes[0].segments[0].reveal).toBe(4)
  })
})
