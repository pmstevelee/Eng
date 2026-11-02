// 일상영어회화 패턴 파트 — 본 강의의 pattern → dialogue → repeat 슬라이드 묶음
// 패턴 1개 = 숏폼 1편. 원어민 세그먼트(패턴 읽기·대화·따라하기)는 AI가 아니라 코드가 화면 데이터로 만든다
// (화면 문장과 읽는 문장이 늘 같고, 대화 화자·따라하기 속도가 틀리지 않게).

import { REPEAT_SPEEDS, patternReading, splitPattern, type DialogueData, type LectureScript, type PatternData, type RepeatData, type Segment, type Slide } from './types'

export interface PatternGroup {
  /** 1부터 — 숏폼 번호 */
  index: number
  pattern: Extract<Slide, { type: 'pattern' }>
  dialogue: Extract<Slide, { type: 'dialogue' }> | null
  repeats: Extract<Slide, { type: 'repeat' }>[]
}

/** 패턴 슬라이드부터 다음 패턴(또는 대화·따라하기가 아닌 슬라이드) 전까지를 한 묶음으로 */
export function findPatternGroups(script: Pick<LectureScript, 'slides'>): PatternGroup[] {
  const groups: PatternGroup[] = []
  let cur: PatternGroup | null = null
  for (const s of script.slides) {
    if (s.type === 'pattern') {
      cur = { index: groups.length + 1, pattern: s, dialogue: null, repeats: [] }
      groups.push(cur)
    } else if (cur && s.type === 'dialogue' && !cur.dialogue) cur.dialogue = s
    else if (cur && s.type === 'repeat') cur.repeats.push(s)
    else cur = null
  }
  return groups
}

/** 슬라이드가 속한 패턴 (대화 속 패턴 강조용) */
export function patternForSlide(script: Pick<LectureScript, 'slides'>, slideId: string): PatternData | null {
  for (const g of findPatternGroups(script)) {
    if (g.pattern.id === slideId || g.dialogue?.id === slideId || g.repeats.some((r) => r.id === slideId)) return g.pattern.data
  }
  return null
}

/** 문장 안에서 패턴 고정 부분이 있는 위치 [시작, 끝) — 대화·예문에서 패턴을 인디고로 강조 */
export function patternRanges(text: string, pattern: string): [number, number][] {
  const lower = text.toLowerCase().replace(/’/g, "'")
  const out: [number, number][] = []
  for (const part of splitPattern(pattern)) {
    const key = part.trim().replace(/[.?!,]+$/, '').toLowerCase().replace(/’/g, "'")
    if (key.length < 2) continue
    const at = lower.indexOf(key)
    if (at >= 0) out.push([at, at + key.length])
  }
  return out.sort((a, b) => a[0] - b[0])
}

// ── 세그먼트 자동 구성 ───────────────────────────────────

type RawSeg = Record<string, unknown>

const isKo = (g: RawSeg) => g.lang !== 'en'

/** 패턴 슬라이드 — AI 나레이션 중 첫 한국어 뒤에 패턴 원어민 읽기를 넣는다 (AI가 쓴 패턴 읽기는 뺀다) */
function patternSegments(slide: { id: string; data: PatternData }, ai: RawSeg[]): RawSeg[] {
  const reading = patternReading(String(slide.data.pattern ?? ''))
  const kept = ai.filter((g) => !(g.lang === 'en' && (/\.\.\.|…|~/.test(String(g.text)) || norm(String(g.text)) === norm(reading))))
  kept.forEach((g) => delete g.type)
  const firstKo = kept.findIndex(isKo)
  const at = firstKo >= 0 ? firstKo + 1 : 0
  const seg: RawSeg = { slideId: slide.id, lang: 'en', type: 'pattern', text: reading, emotion: '강조', reveal: 1 }
  // 패턴 다음 문장이 의미 설명 (reveal 2)
  const out = [...kept.slice(0, at), seg, ...kept.slice(at)]
  const next = out[at + 1]
  if (next && isKo(next) && !next.reveal) next.reveal = 2
  return out
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9']/g, '')

/** 대화 슬라이드 — AI 한국어 소개 → A/B 대화(원어민 남·여) → AI 한국어 정리 */
function dialogueSegments(slide: { id: string; data: DialogueData }, ai: RawSeg[]): RawSeg[] {
  const ko = ai.filter(isKo)
  const firstEn = ai.findIndex((g) => !isKo(g))
  const intro = firstEn >= 0 ? ai.slice(0, firstEn).filter(isKo) : ko.slice(0, 1)
  const after = ko.filter((g) => !intro.includes(g))
  intro.forEach((g) => delete g.reveal)
  after.forEach((g) => delete g.reveal)
  const lines = (Array.isArray(slide.data.lines) ? slide.data.lines : [])
    .filter((l) => l && typeof l.en === 'string' && l.en.trim())
    .map((l, i): RawSeg => ({
      slideId: slide.id, lang: 'en', type: 'dialogue', speaker: l.speaker === 'A' || l.speaker === 'B' ? l.speaker : i % 2 === 0 ? 'A' : 'B',
      text: l.en.trim(), emotion: '설명', reveal: i + 1,
    }))
  return [...intro, ...lines, ...after]
}

/** 따라하기 슬라이드 — 정해진 순서: 안내 → 1회차(0.85배) → 대기 → 안내 → 2회차(1.0배) → 대기 → 칭찬 */
export function repeatSegments(slide: { id: string; data: RepeatData }, opts: { intro?: string } = {}): RawSeg[] {
  return [
    { slideId: slide.id, lang: 'ko', text: opts.intro || '따라 해 볼까요? 먼저 천천히 들어 보세요.', emotion: '설명' },
    { slideId: slide.id, lang: 'en', type: 'repeat', text: String(slide.data.sentence ?? '').trim(), speed: REPEAT_SPEEDS.slow, emotion: '설명' },
    { slideId: slide.id, lang: 'ko', text: '이번엔 자연스러운 속도예요.', emotion: '설명' },
    { slideId: slide.id, lang: 'en', type: 'repeat', text: String(slide.data.sentence ?? '').trim(), speed: REPEAT_SPEEDS.natural, emotion: '설명' },
    { slideId: slide.id, lang: 'ko', text: '잘했어요!', emotion: '칭찬' },
  ]
}

/**
 * AI가 쓴 세그먼트에서 패턴·대화·따라하기 슬라이드의 원어민 부분을 화면 데이터대로 다시 만든다.
 * 다른 슬라이드 세그먼트는 그대로 둔다. 순서(슬라이드 순)는 유지.
 */
export function repairPatternSegments(segments: RawSeg[], slides: { id: string; type: string; data?: unknown }[]): RawSeg[] {
  const special = new Map(slides.filter((s) => s.type === 'pattern' || s.type === 'dialogue' || s.type === 'repeat').map((s) => [s.id, s]))
  if (special.size === 0) return segments
  const out: RawSeg[] = []
  let i = 0
  while (i < segments.length) {
    const sid = String(segments[i].slideId)
    const slide = special.get(sid)
    if (!slide) {
      out.push(segments[i++])
      continue
    }
    const own: RawSeg[] = []
    while (i < segments.length && String(segments[i].slideId) === sid) own.push({ ...segments[i++] })
    const firstKo = own.find((g) => isKo(g) && String(g.text ?? '').trim())
    if (slide.type === 'pattern') out.push(...patternSegments(slide as { id: string; data: PatternData }, own))
    else if (slide.type === 'dialogue') out.push(...dialogueSegments(slide as { id: string; data: DialogueData }, own))
    else out.push(...repeatSegments(slide as { id: string; data: RepeatData }, { intro: firstKo ? String(firstKo.text) : undefined }))
  }
  // AI가 세그먼트를 하나도 안 쓴 특수 슬라이드도 채운다
  const present = new Set(out.map((g) => String(g.slideId)))
  const order = slides.map((s) => s.id)
  for (const [sid, slide] of Array.from(special)) {
    if (present.has(sid)) continue
    const segs =
      slide.type === 'pattern' ? patternSegments(slide as { id: string; data: PatternData }, [])
      : slide.type === 'dialogue' ? dialogueSegments(slide as { id: string; data: DialogueData }, [])
      : repeatSegments(slide as { id: string; data: RepeatData })
    const myIdx = order.indexOf(sid)
    const insertAt = out.findIndex((g) => order.indexOf(String(g.slideId)) > myIdx)
    out.splice(insertAt < 0 ? out.length : insertAt, 0, ...segs)
  }
  return out
}

/** 예: 따라하기 화면 문장 → [{text, stress, link}] 조각 (굵게·밑줄+발음 힌트) */
export interface RepeatPiece {
  text: string
  stress?: boolean
  link?: string
}

export function repeatPieces(data: RepeatData): RepeatPiece[] {
  const s = data.sentence
  const lower = s.toLowerCase()
  type Mark = { start: number; end: number; kind: 'stress' | 'link'; hint?: string }
  const marks: Mark[] = []
  const free = (a: number, b: number) => marks.every((m) => b <= m.start || a >= m.end)
  for (const l of data.links ?? []) {
    const at = lower.indexOf(l.text.toLowerCase())
    if (at >= 0 && free(at, at + l.text.length)) marks.push({ start: at, end: at + l.text.length, kind: 'link', hint: l.hint })
  }
  for (const w of data.stress ?? []) {
    const re = new RegExp(`(?<![A-Za-z])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![A-Za-z])`, 'i')
    const m = re.exec(s)
    if (m && free(m.index, m.index + w.length)) marks.push({ start: m.index, end: m.index + w.length, kind: 'stress' })
  }
  marks.sort((a, b) => a.start - b.start)
  const out: RepeatPiece[] = []
  let pos = 0
  for (const m of marks) {
    if (m.start > pos) out.push({ text: s.slice(pos, m.start) })
    out.push({ text: s.slice(m.start, m.end), ...(m.kind === 'stress' ? { stress: true } : { link: m.hint }) })
    pos = m.end
  }
  if (pos < s.length) out.push({ text: s.slice(pos) })
  return out
}

/** 세그먼트 목록에서 특정 슬라이드의 repeat 세그먼트 (1회차·2회차) */
export function repeatRounds(segments: Segment[], slideId: string): Segment[] {
  return segments.filter((g) => g.slideId === slideId && g.type === 'repeat')
}
