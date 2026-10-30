import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { compileNormalizer, nativeNumber, sinoNumber, type PronunciationDict } from './normalize'
import { splitMixedSegment, splitMixedSegments } from './mixed'
import { buildChapters, buildCues, gapBetween, layoutTimeline, slideStepTimes, toSrt, GAP_MS, LEAD_IN_MS } from './timing'
import { alignmentToWords, compareTranscript } from './qa'
import { parseLectureScript, type LectureScript, type Segment } from './types'

const dict = JSON.parse(readFileSync(path.resolve(__dirname, '../../../lectures/pronunciation-dict.json'), 'utf8')) as PronunciationDict
const norm = compileNormalizer(dict)

describe('발음 정규화', () => {
  it('사전 예시를 바꿔 읽는다', () => {
    expect(norm('to부정사는 동사 앞에 와요.', 'ko')).toBe('투부정사는 동사 앞에 와요.')
    expect(norm('be동사 다음에 -ing를 붙여요.', 'ko')).toBe('비동사 다음에 아이엔지를 붙여요.')
    expect(norm('3인칭 단수 주어', 'ko')).toBe('삼인칭 단수 주어')
    expect(norm('have 다음에 p.p.가 와요.', 'ko')).toBe('have 다음에 과거분사가 와요.')
  })
  it('S+V+O 공식은 성분 이름으로 읽는다', () => {
    expect(norm('3형식은 S+V+O예요.', 'ko')).toBe('삼형식은 주어, 동사, 목적어예요.')
    expect(norm('S + V + C', 'ko')).toBe('주어, 동사, 보어')
  })
  it('숫자는 단위에 맞게 읽는다', () => {
    expect(norm('2가지만 기억해요.', 'ko')).toBe('두 가지만 기억해요.')
    expect(norm('1번 문제를 풀어요.', 'ko')).toBe('일 번 문제를 풀어요.')
    expect(norm('2번째 규칙', 'ko')).toBe('두 번째 규칙')
    expect(norm('1번째 규칙', 'ko')).toBe('첫 번째 규칙')
    expect(norm('5초 동안', 'ko')).toBe('오 초 동안')
    expect(norm('20개', 'ko')).toBe('스무 개')
    expect(sinoNumber(2026)).toBe('이천이십육')
    expect(nativeNumber(32)).toBe('서른두')
  })
  it('기호·괄호·슬래시가 이상하게 읽히지 않는다', () => {
    expect(norm('현재완료(have + p.p.)', 'ko')).toBe('현재완료, have, 과거분사')
    expect(norm('주어 + 동사', 'ko')).toBe('주어, 동사')
    expect(norm('경험/계속', 'ko')).toBe('경험 또는 계속')
    expect(norm('"이미" → 완료', 'ko')).toBe('이미, 완료')
    expect(norm('I ___ finished it.', 'en')).toBe('I blank finished it.')
    expect(norm('He has (already) left.', 'en')).toBe('He has, already, left.')
  })
})

const seg = (o: Partial<Segment> & { id: string; text: string }): Segment => ({ slideId: 's1', lang: 'ko', emotion: '설명', ...o })

describe('한국어 문장 속 영어 분리', () => {
  it('영어 단어·문장을 영어 세그먼트로 나눈다', () => {
    const { parts } = splitMixedSegment(seg({ id: 'a', text: '이 문장을 보세요. I have finished my homework. 어때요?', reveal: 2 }), dict)
    expect(parts.map((p) => [p.lang, p.text, !!p.joinNext])).toEqual([
      ['ko', '이 문장을 보세요.', true],
      ['en', 'I have finished my homework.', true],
      ['ko', '어때요?', false],
    ])
    expect(parts[0].id).toBe('a')
    expect(parts[0].reveal).toBe(2)
    expect(parts[1].reveal).toBeUndefined()
  })
  it('사전에 있는 문법 용어는 나누지 않는다', () => {
    const { parts } = splitMixedSegment(seg({ id: 'b', text: 'to부정사와 be동사, -ing, p.p., S+V+O를 배워요.' }), dict)
    expect(parts).toHaveLength(1)
    expect(parts[0].lang).toBe('ko')
  })
  it('영어 뒤 조사는 검토 메모를 남긴다', () => {
    const { parts, notes } = splitMixedSegment(seg({ id: 'c', text: '"have"를 써요.' }), dict)
    expect(parts.map((p) => p.lang)).toEqual(['en', 'ko'])
    expect(notes).toHaveLength(1)
  })
  it('id가 겹치지 않는다', () => {
    const r = splitMixedSegments([seg({ id: 'x', text: 'have 다음에 와요.' }), seg({ id: 'xb', text: '좋아요.' })], dict)
    expect(new Set(r.segments.map((s) => s.id)).size).toBe(r.segments.length)
  })
})

const script: LectureScript = {
  version: 1, slug: 'test', title: '테스트', targetMinutes: 1, createdAt: '', grammarPoint: null,
  slides: [
    { id: 's1', type: 'title', data: { title: '현재완료' } },
    { id: 's2', type: 'example', chapter: '예문', data: { sentence: [{ text: 'I' }, { text: 'have finished', role: 'verb', point: true }, { text: 'it.' }], ko: '나는 그것을 끝냈어요.' } },
  ],
  segments: [
    seg({ id: 'a', slideId: 's1', text: '안녕하세요.' }),
    seg({ id: 'b', slideId: 's1', text: '오늘은', joinNext: true }),
    seg({ id: 'c', slideId: 's1', lang: 'en', text: 'present perfect' }),
    seg({ id: 'd', slideId: 's2', text: '예문을 볼게요.' }),
    seg({ id: 'e', slideId: 's2', lang: 'en', text: 'I have finished it.' }),
    seg({ id: 'f', slideId: 's2', text: '나는 그것을 끝냈어요.' }),
  ],
}

describe('타임라인·자막', () => {
  it('쉼 규칙', () => {
    const [a, b, c, d, e] = script.segments
    expect(gapBetween(a, b)).toBe(GAP_MS.sameLang)
    expect(gapBetween(b, c)).toBe(GAP_MS.joined)
    expect(gapBetween(c, d)).toBe(GAP_MS.slideChange)
    expect(gapBetween(d, e)).toBe(GAP_MS.langChange)
  })
  it('측정 길이로 배치하고 슬라이드 경계는 쉼의 가운데', () => {
    const durations = new Map(script.segments.map((s) => [s.id, 1000]))
    const t = layoutTimeline(script, durations, new Map([['e', [{ text: 'I', startMs: 0, endMs: 100 }]]]))
    expect(t.segments[0].startMs).toBe(LEAD_IN_MS)
    expect(t.segments[1].startMs).toBe(LEAD_IN_MS + 1000 + 300)
    const cEnd = t.segments[2].endMs
    const dStart = t.segments[3].startMs
    expect(dStart - cEnd).toBe(800)
    expect(t.slides[1].startMs).toBe((cEnd + dStart) / 2)
    expect(t.segments[4].words?.[0].startMs).toBe(t.segments[4].startMs)
    expect(t.measured).toBe(true)
  })
  it('예문 슬라이드는 영어 문장이 읽힐 때 등장', () => {
    const t = layoutTimeline(script)
    const times = slideStepTimes(script.slides[1], script, t)
    expect(times[0]).toBe(t.segments[4].startMs)
    expect(times[1]).toBe(t.segments[5].startMs)
  })
  it('나뉜 조각은 자막 한 줄로 합친다', () => {
    const t = layoutTimeline(script)
    const cues = buildCues(script, t)
    expect(cues.map((c) => c.text)).toContain('오늘은 present perfect')
    expect(toSrt(cues)).toMatch(/^1\n00:00:00,800 --> /)
  })
  it('챕터는 0초에서 시작', () => {
    const chapters = buildChapters(script, layoutTimeline(script))
    expect(chapters[0].startMs).toBe(0)
  })
})

describe('검수 비교', () => {
  it('한국어 숫자 표기 차이는 오류로 보지 않는다', () => {
    expect(compareTranscript(['삼인칭 단수예요.'], '3인칭 단수예요', 'ko').passed).toBe(true)
  })
  it('Whisper가 한글 발음을 영어로 받아 적어도 통과', () => {
    expect(compareTranscript(['현재완료는 주어 다음에 해브나 해즈, 그리고 과거분사가 와요.'], '현재 완료는 주어 다음에 have나 has 그리고 과거 분사가 와요.', 'ko').passed).toBe(true)
  })
  it('영어 축약형·문장부호 차이는 무시', () => {
    expect(compareTranscript(["I've finished my homework."], 'I have finished my homework', 'en').errorRate).toBe(0)
    expect(compareTranscript(['I have finished my homework.'], 'I finish homework', 'en').passed).toBe(false)
  })
  it('글자 타임스탬프 → 단어', () => {
    const w = alignmentToWords(['I', ' ', 'h', 'a', 'v', 'e'], [0, 0.1, 0.2, 0.25, 0.3, 0.35], [0.1, 0.2, 0.25, 0.3, 0.35, 0.4])
    expect(w).toEqual([{ text: 'I', startMs: 0, endMs: 100 }, { text: 'have', startMs: 200, endMs: 400 }])
  })
})

describe('대본 검증', () => {
  it('정상 대본은 통과', () => {
    const r = parseLectureScript(script)
    expect(r.issues.filter((i) => i.level === 'error')).toEqual([])
  })
  it('퀴즈 정답 공개가 없으면 오류', () => {
    const bad = {
      ...script,
      slides: [...script.slides, { id: 'q', type: 'quiz', data: { question: '?', choices: ['a', 'b'], answer: 0 } }],
      segments: [...script.segments, seg({ id: 'q1', slideId: 'q', text: '문제예요.' })],
    }
    expect(parseLectureScript(bad).script).toBeNull()
  })
})
