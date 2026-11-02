import { describe, expect, it } from 'vitest'
import { findPatternGroups, patternRanges, repairPatternSegments, repeatPieces } from './patterns'
import { buildCaptionChunks, buildShortsScript, SHORTS_TEMPO, timeWords, type ShortsDraft } from './shorts'
import { cardLines, cleanHashtags, parseCardNews, type Card } from './cardnews'
import { layoutTimeline, repeatPauseMs, slideStepTimes } from './timing'
import { parseLectureScript, patternReading, type LectureScript, type Segment } from './types'

const slides = [
  { id: 's1', type: 'title', data: { title: '현재완료 시제' } },
  { id: 's2', type: 'pattern', data: { pattern: 'Have you ever ~?', slot: '과거분사', ko: '~해 본 적 있어?', examples: [{ en: 'Have you ever seen snow?', ko: '눈 본 적 있어?' }] } },
  { id: 's3', type: 'dialogue', data: { lines: [{ speaker: 'A', en: 'Have you ever been to Jeju?' }, { speaker: 'B', en: 'Yes, I have.' }] } },
  { id: 's4', type: 'repeat', data: { sentence: 'Have you ever been to Jeju?', ko: '제주도에 가 본 적 있어?', stress: ['ever'], links: [{ text: 'Have you', hint: '해뷰' }] } },
  { id: 's5', type: 'outro', data: {} },
]

function lecture(): LectureScript {
  const segs = repairPatternSegments(
    [
      { slideId: 's1', lang: 'ko', text: '안녕하세요.', emotion: '설명' },
      { slideId: 's2', lang: 'ko', text: '경험을 묻는 패턴이에요.', emotion: '설명' },
      { slideId: 's2', lang: 'en', text: 'Have you ever ...?', emotion: '설명' },
      { slideId: 's2', lang: 'ko', text: '해 본 적 있냐는 뜻이에요.', emotion: '설명' },
      { slideId: 's2', lang: 'en', text: 'Have you ever seen snow?', emotion: '설명' },
      { slideId: 's3', lang: 'ko', text: '대화를 들어 볼까요?', emotion: '질문' },
      { slideId: 's3', lang: 'en', text: 'AI가 쓴 대사는 버린다', emotion: '설명' },
      { slideId: 's5', lang: 'ko', text: '수고했어요.', emotion: '칭찬' },
    ],
    slides,
  ).map((g, i) => ({ ...g, id: `g${i + 1}` }))
  const { script, issues } = parseLectureScript({ version: 1, slug: 'pp', title: '현재완료 시제', targetMinutes: 2, slides, segments: segs })
  if (!script) throw new Error(issues.map((i) => i.message).join('\n'))
  return script
}

describe('패턴 파트 세그먼트 자동 구성', () => {
  const s = lecture()
  it('패턴 읽기를 첫 한국어 뒤에 넣고 AI가 쓴 패턴 읽기는 뺀다', () => {
    const own = s.segments.filter((g) => g.slideId === 's2')
    expect(own.map((g) => g.type ?? g.lang)).toEqual(['ko', 'pattern', 'ko', 'en'])
    expect(own[1].text).toBe('Have you ever …?')
    expect(own[2].reveal).toBe(2)
  })
  it('대화는 화면 대사 그대로 A(남)/B(여) 세그먼트를 만든다', () => {
    const own = s.segments.filter((g) => g.slideId === 's3')
    expect(own.map((g) => [g.type ?? 'ko', g.speaker ?? '', g.text])).toEqual([
      ['ko', '', '대화를 들어 볼까요?'],
      ['dialogue', 'A', 'Have you ever been to Jeju?'],
      ['dialogue', 'B', 'Yes, I have.'],
    ])
  })
  it('AI가 안 쓴 따라하기도 0.85배 → 1.0배 순서로 채운다', () => {
    const rounds = s.segments.filter((g) => g.type === 'repeat')
    expect(rounds.map((g) => g.speed)).toEqual([0.85, 1])
    expect(rounds.every((g) => g.slideId === 's4')).toBe(true)
  })
  it('패턴 묶음을 찾는다', () => {
    const g = findPatternGroups(s)
    expect(g).toHaveLength(1)
    expect(g[0].dialogue?.id).toBe('s3')
    expect(g[0].repeats.map((r) => r.id)).toEqual(['s4'])
  })
})

describe('따라 할 시간', () => {
  const seg = { id: 'x', slideId: 's', lang: 'en', text: 'Hi', emotion: '설명', type: 'repeat' } as Segment
  it('기본은 음성 길이 × 1.5 + 1초', () => expect(repeatPauseMs(seg, 2000)).toBe(4000))
  it('pauseSec가 있으면 그 값', () => expect(repeatPauseMs({ ...seg, pauseSec: 3 }, 2000)).toBe(3000))
  it('숏폼은 음성 길이 × 1.2', () => expect(repeatPauseMs(seg, 2000, SHORTS_TEMPO)).toBe(2400))
  it('일반 세그먼트는 대기 없음', () => expect(repeatPauseMs({ ...seg, type: undefined }, 2000)).toBe(0))
  it('타임라인이 대기만큼 다음 문장을 미룬다', () => {
    const s = lecture()
    const durations = new Map(s.segments.map((g) => [g.id, 1000]))
    const tl = layoutTimeline(s, durations)
    const r = tl.segments.filter((t) => t.type === 'repeat')
    expect(r[0].pauseEndMs).toBe(r[0].endMs + 2500)
    const next = tl.segments[tl.segments.indexOf(r[0]) + 1]
    expect(next.startMs).toBeGreaterThanOrEqual(r[0].pauseEndMs as number)
  })
  it('대화 줄은 각 대사가 시작할 때 나타난다', () => {
    const s = lecture()
    const tl = layoutTimeline(s)
    const times = slideStepTimes(s.slides[2], s, tl)
    const lines = tl.segments.filter((t) => t.type === 'dialogue')
    expect(times).toEqual(lines.map((l) => l.startMs))
  })
})

describe('대본 검증', () => {
  it('repeat 세그먼트는 영어·따라하기 슬라이드만', () => {
    const { issues } = parseLectureScript({
      version: 1, slug: 'x', title: 't', slides: [{ id: 's1', type: 'title', data: { title: 't' } }],
      segments: [{ id: 'a', slideId: 's1', lang: 'ko', type: 'repeat', text: '안녕', emotion: '설명' }],
    })
    expect(issues.filter((i) => i.level === 'error').map((i) => i.message).join(' ')).toMatch(/lang "en"|따라하기\(repeat\) 슬라이드/)
  })
  it('speed는 0.7~1.2로 맞춘다', () => {
    const s = lecture()
    const raw = JSON.parse(JSON.stringify(s))
    raw.segments.find((g: Segment) => g.type === 'repeat').speed = 0.5
    const { script } = parseLectureScript(raw)
    expect(script?.segments.find((g) => g.type === 'repeat')?.speed).toBe(0.7)
  })
  it('패턴에는 빈칸(~)이 있어야 한다', () => {
    const raw = JSON.parse(JSON.stringify(lecture()))
    raw.slides[1].data.pattern = 'Have you ever'
    expect(parseLectureScript(raw).script).toBeNull()
  })
})

describe('화면 도우미', () => {
  it('패턴 읽기 문장', () => {
    expect(patternReading('Have you ever ~?')).toBe('Have you ever …?')
    expect(patternReading("I'm about to ~.")).toBe("I'm about to ….")
  })
  it('문장 속 패턴 위치', () => {
    expect(patternRanges('Have you ever been to Jeju?', 'Have you ever ~?')).toEqual([[0, 13]])
  })
  it('강세·연음 조각', () => {
    expect(repeatPieces({ sentence: 'I want to go home.', ko: '', stress: ['home'], links: [{ text: 'want to', hint: '워너' }] })).toEqual([
      { text: 'I ' }, { text: 'want to', link: '워너' }, { text: ' go ' }, { text: 'home', stress: true }, { text: '.' },
    ])
  })
})

describe('숏폼', () => {
  const draft: ShortsDraft = {
    hook: "'~해 본 적 있어?' 영어로 바로 말할 수 있나요?",
    patternIntro: '이 패턴 하나면 돼요.',
    patternMeaning: '무언가 해 본 경험을 물을 때 써요.',
    examplesLead: '예문 세 개, 바로 갈게요!',
    examples: [
      { en: 'Have you ever seen snow?', ko: '눈 본 적 있어?' },
      { en: 'Have you ever eaten kimchi?', ko: '김치 먹어 봤어?' },
      { en: 'Have you ever been to Busan?', ko: '부산 가 봤어?' },
    ],
    repeatLead: '이제 따라 해 보세요!',
    repeat: { sentence: 'Have you ever been to Jeju?', ko: '제주도 가 본 적 있어?' },
    ctaLine: '전체 강의는 채널에서 확인하세요!',
  }
  it('슬라이드 5장·세그먼트 순서를 만든다', () => {
    const s = lecture()
    const sh = buildShortsScript(s, findPatternGroups(s)[0], draft)
    const { script, issues } = parseLectureScript(sh)
    expect(issues.filter((i) => i.level === 'error')).toEqual([])
    expect(script?.slides.map((x) => x.type)).toEqual(['hook', 'pattern', 'examples', 'repeat', 'cta'])
    expect(script?.format).toBe('shorts')
    expect(script?.tempo?.koSpeedScale).toBe(1.1)
    const rounds = script?.segments.filter((g) => g.type === 'repeat') ?? []
    expect(rounds).toHaveLength(1)
    expect(rounds[0].speed).toBe(1)
  })
  it('자막 조각은 2줄 폭을 넘지 않고 단어 시간을 갖는다', () => {
    const s = lecture()
    const sh = parseLectureScript(buildShortsScript(s, findPatternGroups(s)[0], draft)).script as LectureScript
    const chunks = buildCaptionChunks(sh, layoutTimeline(sh))
    expect(chunks.length).toBeGreaterThan(5)
    for (const c of chunks) {
      expect(c.words.length).toBeGreaterThan(0)
      expect(c.endMs).toBeGreaterThan(c.startMs)
    }
  })
  it('읽은 단어 수가 다르면 글자 비율로 시간을 나눈다', () => {
    const w = timeWords('to부정사는 쉬워요', 0, 1000, [{ text: '투부정사는', startMs: 0, endMs: 500 }])
    expect(w.map((x) => x.text)).toEqual(['to부정사는', '쉬워요'])
    expect(w[1].endMs).toBe(1000)
  })
})

describe('카드뉴스', () => {
  const cards: Card[] = [
    { type: 'cover', topic: '현재완료 시제', hook: '"I have went"가 틀린 이유' },
    { type: 'question', sentence: 'I have went to Jeju.' },
    { type: 'rule', heading: '형태', formula: ['have/has', '과거분사'], lines: ['**have + p.p.**로 만들어요'] },
    { type: 'rule', heading: '경험', lines: ['해 본 적 있는지 말해요'] },
    { type: 'rule', heading: '완료', lines: ['막 끝낸 일을 말해요'] },
    { type: 'mistakes', items: [{ wrong: 'have went', right: 'have gone' }, { wrong: 'since 2 years', right: 'for 2 years' }, { wrong: 'did you ever', right: 'have you ever' }] },
    { type: 'quiz', question: '빈칸에 알맞은 말은?', sentence: 'I have ___ it.', choices: ['saw', 'seen'] },
    { type: 'answer', answer: 'seen', explanation: 'have 뒤에는 과거분사가 와요.' },
    { type: 'pattern', pattern: 'Have you ever ~?', ko: '~해 본 적 있어?' },
    { type: 'cta', lectureTitle: '현재완료 시제' },
  ]
  it('정상 구성은 통과', () => {
    const { cardnews, issues } = parseCardNews({ slug: 'pp', title: '현재완료', cards })
    expect(issues.filter((i) => i.level === 'error')).toEqual([])
    expect(cardnews?.cards).toHaveLength(10)
  })
  it('퀴즈 다음은 정답, 장 수는 8~10', () => {
    const swapped = [...cards]
    ;[swapped[6], swapped[7]] = [swapped[7], swapped[6]]
    expect(parseCardNews({ slug: 'pp', title: 't', cards: swapped }).cardnews).toBeNull()
    expect(parseCardNews({ slug: 'pp', title: 't', cards: cards.slice(0, 5) }).cardnews).toBeNull()
  })
  it('글이 5줄을 넘으면 경고', () => {
    expect(cardLines(cards[0])).toBeLessThanOrEqual(5)
    const long: Card = { type: 'rule', heading: '아주 긴 제목', lines: ['가'.repeat(60), '나'.repeat(60), '다'.repeat(60)] }
    expect(cardLines(long)).toBeGreaterThan(5)
  })
  it('해시태그 정리', () => {
    expect(cleanHashtags(['#영어 공부', '영어공부', 'English!', ''])).toEqual(['#영어공부', '#English'])
  })
})
