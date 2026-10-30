// 타임라인 — 세그먼트 음성 길이 + 쉼 규칙으로 각 문장·슬라이드·단어의 시작 시간을 정한다.
// 음성 단계(voice)가 timeline.json으로 저장하고, Remotion·자막·YouTube 챕터가 같은 값을 쓴다.
// 음성이 아직 없으면 글자 수로 길이를 어림해 미리보기를 만든다.

import { SLIDE_TYPE_LABELS, slideStepCount, joinTokens, type Lang, type LectureScript, type Segment, type Slide } from './types'

/** 세그먼트 사이 쉼(ms) — 같은 언어 0.3초, 언어 전환 0.5초, 슬라이드 전환 0.8초, 한 문장을 나눈 조각 0.15초 */
export const GAP_MS = { sameLang: 300, langChange: 500, slideChange: 800, joined: 150 } as const
/** 첫 문장 전(제목 등장 애니메이션), 마지막 문장 뒤 여유 */
export const LEAD_IN_MS = 800
export const TAIL_MS = 1800

export function gapBetween(prev: Segment, next: Segment): number {
  if (prev.slideId !== next.slideId) return GAP_MS.slideChange
  if (prev.joinNext) return GAP_MS.joined
  if (prev.lang !== next.lang) return GAP_MS.langChange
  return GAP_MS.sameLang
}

export interface TimedWord {
  text: string
  startMs: number
  endMs: number
}

export interface TimelineSegment {
  id: string
  slideId: string
  lang: Lang
  startMs: number
  endMs: number
  wait?: boolean
  /** 단어별 시간 (절대 ms) — 영어 예문 하이라이트용 */
  words?: TimedWord[]
}

export interface TimelineSlide {
  id: string
  startMs: number
  endMs: number
}

export interface Timeline {
  version: 1
  totalMs: number
  segments: TimelineSegment[]
  slides: TimelineSlide[]
  /** 음성으로 만든 타임라인이면 true, 글자 수 어림이면 false */
  measured: boolean
  audioFile?: string
  loudnessLufs?: number
  provider?: string
}

/** 음성 없이 길이 어림 — 한국어 초당 약 6.5자, 영어 초당 약 2.6단어 */
export function estimateDurationMs(seg: Segment): number {
  if (seg.waitSec) return seg.waitSec * 1000
  if (seg.lang === 'en') return Math.max(700, (seg.text.split(/\s+/).filter(Boolean).length / 2.6) * 1000)
  return Math.max(700, (seg.text.replace(/\s/g, '').length / 6.5) * 1000)
}

/**
 * 세그먼트 길이(ms)·단어 시간(세그먼트 기준 ms)으로 타임라인을 만든다.
 * durations에 없는 세그먼트는 어림값을 쓴다.
 */
export function layoutTimeline(
  script: LectureScript,
  durations: Map<string, number> = new Map(),
  words: Map<string, TimedWord[]> = new Map(),
): Timeline {
  const segments: TimelineSegment[] = []
  let t = LEAD_IN_MS
  script.segments.forEach((seg, i) => {
    if (i > 0) t += gapBetween(script.segments[i - 1], seg)
    const dur = durations.get(seg.id) ?? estimateDurationMs(seg)
    const rel = words.get(seg.id)
    segments.push({
      id: seg.id,
      slideId: seg.slideId,
      lang: seg.lang,
      startMs: Math.round(t),
      endMs: Math.round(t + dur),
      ...(seg.waitSec ? { wait: true } : {}),
      ...(rel?.length ? { words: rel.map((w) => ({ text: w.text, startMs: Math.round(t + w.startMs), endMs: Math.round(t + w.endMs) })) } : {}),
    })
    t += dur
  })
  const totalMs = Math.round(t + TAIL_MS)
  return { version: 1, totalMs, segments, slides: slideRanges(script, segments, totalMs), measured: durations.size > 0 }
}

/** 슬라이드 경계 = 앞 슬라이드 마지막 문장 끝과 다음 슬라이드 첫 문장 시작의 가운데 */
function slideRanges(script: LectureScript, segments: TimelineSegment[], totalMs: number): TimelineSlide[] {
  const firstStart = new Map<string, number>()
  const lastEnd = new Map<string, number>()
  for (const s of segments) {
    if (!firstStart.has(s.slideId)) firstStart.set(s.slideId, s.startMs)
    lastEnd.set(s.slideId, s.endMs)
  }
  const used = script.slides.filter((s) => firstStart.has(s.id))
  return used.map((slide, i) => {
    const start = i === 0 ? 0 : Math.round(((lastEnd.get(used[i - 1].id) ?? 0) + (firstStart.get(slide.id) ?? 0)) / 2)
    const next = used[i + 1]
    const end = next ? Math.round(((lastEnd.get(slide.id) ?? 0) + (firstStart.get(next.id) ?? 0)) / 2) : totalMs
    return { id: slide.id, startMs: start, endMs: end }
  })
}

/** 같은 문장인지 비교용 (대소문자·문장부호·공백 무시) */
export function sentenceKey(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9']/g, '')
}

/**
 * 슬라이드 단계별 등장 시간(절대 ms) — 결과[k-1] = k단계가 보이기 시작하는 시간.
 * reveal로 정한 단계가 없으면: 예문 슬라이드는 영어 문장 시작에, 나머지는 슬라이드 시작에 차례로.
 */
export function slideStepTimes(slide: Slide, script: LectureScript, timeline: Timeline): number[] {
  const n = slideStepCount(slide)
  const range = timeline.slides.find((s) => s.id === slide.id)
  if (!range || n === 0) return []
  const own = timeline.segments.filter((s) => s.slideId === slide.id)
  const segById = new Map(script.segments.map((s) => [s.id, s]))
  const times: number[] = []
  for (let k = 1; k <= n; k++) {
    const hit = own.find((s) => (segById.get(s.id)?.reveal ?? 0) >= k)
    times.push(hit ? hit.startMs : NaN)
  }
  if (slide.type === 'example' && times.every((v) => Number.isNaN(v))) {
    const key = sentenceKey(joinTokens(slide.data.sentence))
    const enIdx = own.findIndex((s) => s.lang === 'en' && sentenceKey(segById.get(s.id)?.text ?? '') === key)
    const idx = enIdx >= 0 ? enIdx : own.findIndex((s) => s.lang === 'en')
    if (idx >= 0) {
      times[0] = own[idx].startMs
      times[1] = own[idx + 1]?.startMs ?? own[idx].endMs
    }
  }
  // 정하지 않은 단계는 앞 단계 직후(또는 슬라이드 시작)에 0.35초 간격으로
  let prev = range.startMs + 300
  return times.map((v, i) => {
    const t = Number.isNaN(v) ? (i === 0 ? prev : prev + 350) : Math.max(v, i === 0 ? range.startMs : prev)
    prev = t
    return t
  })
}

// ── 자막 ──────────────────────────────────────────────────

export interface Cue {
  startMs: number
  endMs: number
  text: string
}

const MAX_CUE_CHARS = 60

/** 긴 자막은 문장·쉼표 경계에서 나누고, 시간은 글자 수 비율로 나눈다 */
function splitLongCue(cue: Cue): Cue[] {
  if (cue.text.length <= MAX_CUE_CHARS) return [cue]
  const parts = cue.text.split(/(?<=[.?!,])\s+/).filter(Boolean)
  const chunks: string[] = []
  for (const p of parts) {
    const last = chunks[chunks.length - 1]
    if (last && (last + ' ' + p).length <= MAX_CUE_CHARS) chunks[chunks.length - 1] = `${last} ${p}`
    else chunks.push(p)
  }
  if (chunks.length <= 1) return [cue]
  const total = chunks.reduce((a, c) => a + c.length, 0)
  let t = cue.startMs
  return chunks.map((text, i) => {
    const end = i === chunks.length - 1 ? cue.endMs : Math.round(t + ((cue.endMs - cue.startMs) * text.length) / total)
    const c = { startMs: t, endMs: end, text }
    t = end
    return c
  })
}

/** 자막 줄 — 나뉜 조각(joinNext)은 한 줄로 합치고, 대기 세그먼트는 뺀다 */
export function buildCues(script: LectureScript, timeline: Timeline): Cue[] {
  const timeById = new Map(timeline.segments.map((s) => [s.id, s]))
  const cues: Cue[] = []
  let open: Cue | null = null
  for (const seg of script.segments) {
    const t = timeById.get(seg.id)
    if (!t || seg.waitSec || !seg.text) continue
    if (open) {
      open.text = `${open.text} ${seg.text}`
      open.endMs = t.endMs
    } else {
      open = { startMs: t.startMs, endMs: t.endMs, text: seg.text }
    }
    if (!seg.joinNext) {
      cues.push(...splitLongCue(open))
      open = null
    }
  }
  if (open) cues.push(...splitLongCue(open))
  // 다음 자막 직전까지 조금 더 보여 준다 (최대 0.4초)
  return cues.map((c, i) => ({ ...c, endMs: Math.min(c.endMs + 400, cues[i + 1]?.startMs ?? c.endMs + 400) }))
}

function srtTime(ms: number): string {
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  const r = Math.floor(ms % 1000)
  const p = (n: number, w = 2) => String(n).padStart(w, '0')
  return `${p(h)}:${p(m)}:${p(s)},${p(r, 3)}`
}

export function toSrt(cues: Cue[]): string {
  return cues.map((c, i) => `${i + 1}\n${srtTime(c.startMs)} --> ${srtTime(c.endMs)}\n${c.text}\n`).join('\n')
}

// ── YouTube 챕터 ──────────────────────────────────────────

export interface Chapter {
  startMs: number
  title: string
}

const MIN_CHAPTER_MS = 10_000

/** 같은 chapter 이름이 이어지는 슬라이드를 묶고, 10초 미만 챕터는 앞 챕터에 합친다 (YouTube 규칙) */
export function buildChapters(script: LectureScript, timeline: Timeline): Chapter[] {
  const slideById = new Map(script.slides.map((s) => [s.id, s]))
  const raw: (Chapter & { endMs: number })[] = []
  for (const r of timeline.slides) {
    const slide = slideById.get(r.id)
    if (!slide) continue
    const title = slide.chapter || defaultChapterName(slide)
    const last = raw[raw.length - 1]
    if (last && last.title === title) last.endMs = r.endMs
    else raw.push({ startMs: r.startMs, endMs: r.endMs, title })
  }
  const merged: (Chapter & { endMs: number })[] = []
  for (const c of raw) {
    const last = merged[merged.length - 1]
    // 짧은 앞 챕터는 이름을 그대로 두고 다음 챕터를 흡수한다
    if (last && last.endMs - last.startMs < MIN_CHAPTER_MS) last.endMs = c.endMs
    else merged.push({ ...c })
  }
  const lastC = merged[merged.length - 1]
  if (merged.length > 1 && lastC && lastC.endMs - lastC.startMs < MIN_CHAPTER_MS) {
    merged[merged.length - 2].endMs = lastC.endMs
    merged.pop()
  }
  if (merged[0]) merged[0].startMs = 0
  return merged.map(({ startMs, title }) => ({ startMs, title }))
}

function defaultChapterName(slide: Slide): string {
  if (slide.type === 'title') return '인트로'
  if (slide.type === 'concept') return slide.data.heading
  return SLIDE_TYPE_LABELS[slide.type]
}

export function formatClock(ms: number): string {
  const s = Math.floor(ms / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = String(s % 60).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`
}
