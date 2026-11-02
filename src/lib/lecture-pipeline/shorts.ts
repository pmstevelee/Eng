// 유튜브 숏폼 (1080×1920, 45~60초) — 본 강의의 일상회화 패턴 1개 = 숏폼 1편
// 숏폼 대본도 script.json과 같은 형식(LectureScript, format "shorts")이라 음성·검수·타임라인을 그대로 쓴다.
// AI는 문구(ShortsDraft)만 쓰고, 슬라이드·세그먼트 순서는 여기서 정한다.

import { patternReading, REPEAT_SPEEDS, WEBSITE, type LectureScript, type PatternExample, type RepeatData, type Segment, type Slide, type Tempo } from './types'
import type { PatternGroup } from './patterns'
import type { TimedWord, Timeline } from './timing'

/** 숏폼 박자 — 한국어 1.1배, 영어는 자연스러운 속도, 쉼은 짧게, 따라 할 시간 = 음성 길이 × 1.2 */
export const SHORTS_TEMPO: Tempo = {
  koSpeedScale: 1.1,
  enSpeed: REPEAT_SPEEDS.natural,
  gapScale: 0.6,
  leadInMs: 250,
  tailMs: 1200,
  repeatPause: { factor: 1.2, extraSec: 0 },
}

export const SHORTS_LENGTH = { minSec: 45, maxSec: 60 } as const

/** AI가 쓰는 숏폼 문구 */
export interface ShortsDraft {
  /** 첫 2초 훅 질문 (예: "'곧 ~하려던 참이야' 영어로 바로 말할 수 있나요?") */
  hook: string
  /** 훅 아래 작은 글 (선택) */
  hookSub?: string
  /** 패턴 소개 한 문장 (원어민 패턴 읽기 전) */
  patternIntro: string
  /** 패턴 의미 설명 (원어민 패턴 읽기 후) */
  patternMeaning: string
  /** 예문 들어가기 전 한 마디 */
  examplesLead: string
  examples: PatternExample[]
  /** 따라하기 안내 */
  repeatLead: string
  repeat: RepeatData
  /** 마무리 (위고업잉글리시 안내) */
  ctaLine: string
}

const pad = (n: number) => String(n).padStart(2, '0')
export const shortsName = (n: number) => `shorts-${pad(n)}`

/** 숏폼 대본 만들기 — 슬라이드 5장(훅 → 패턴 → 예문 3개 → 따라하기 → 채널 안내) */
export function buildShortsScript(lecture: LectureScript, group: PatternGroup, d: ShortsDraft): LectureScript {
  const p = group.pattern.data
  const slides: Slide[] = [
    { id: 's1', type: 'hook', chapter: '훅', data: { question: d.hook, ...(d.hookSub ? { sub: d.hookSub } : {}) } },
    { id: 's2', type: 'pattern', chapter: '패턴', data: { pattern: p.pattern, ko: p.ko, ...(p.slot ? { slot: p.slot } : {}) } },
    { id: 's3', type: 'examples', chapter: '예문', data: { examples: d.examples.slice(0, 3) } },
    { id: 's4', type: 'repeat', chapter: '따라하기', data: d.repeat },
    { id: 's5', type: 'cta', chapter: '위고업잉글리시 안내', data: { lectureTitle: lecture.title, message: WEBSITE.cta } },
  ]
  const segs: Omit<Segment, 'id'>[] = [
    { slideId: 's1', lang: 'ko', text: d.hook, emotion: '질문' },
    { slideId: 's2', lang: 'ko', text: d.patternIntro, emotion: '설명' },
    { slideId: 's2', lang: 'en', type: 'pattern', text: patternReading(p.pattern), emotion: '강조', reveal: 1 },
    { slideId: 's2', lang: 'ko', text: d.patternMeaning, emotion: '강조', reveal: 2 },
    { slideId: 's3', lang: 'ko', text: d.examplesLead, emotion: '설명' },
    ...d.examples.slice(0, 3).flatMap((e, i): Omit<Segment, 'id'>[] => [
      { slideId: 's3', lang: 'en', text: e.en, emotion: '설명', reveal: i + 1 },
      { slideId: 's3', lang: 'ko', text: e.ko, emotion: '설명' },
    ]),
    { slideId: 's4', lang: 'ko', text: d.repeatLead, emotion: '설명' },
    { slideId: 's4', lang: 'en', type: 'repeat', text: d.repeat.sentence, speed: REPEAT_SPEEDS.natural, emotion: '설명' },
    { slideId: 's5', lang: 'ko', text: d.ctaLine, emotion: '칭찬' },
  ]
  const counter = new Map<string, number>()
  const segments = segs.map((g): Segment => {
    const n = (counter.get(g.slideId) ?? 0) + 1
    counter.set(g.slideId, n)
    return { ...g, id: `${g.slideId}-${n}` } as Segment
  })
  return {
    version: 1,
    slug: `${lecture.slug}-${shortsName(group.index)}`,
    title: `${lecture.title} 숏폼 ${group.index} — ${p.pattern}`,
    grammarPoint: lecture.grammarPoint ?? null,
    targetMinutes: 1,
    createdAt: new Date().toISOString(),
    format: 'shorts',
    tempo: SHORTS_TEMPO,
    slides,
    segments,
  }
}

// ── 자막 (단어 단위 하이라이트) ───────────────────────────

export type CaptionWord = TimedWord
export interface CaptionChunk {
  slideId: string
  startMs: number
  endMs: number
  lang: 'ko' | 'en'
  words: CaptionWord[]
}

/** 글자 폭 어림 (한글 1, 영문·숫자 0.56, 공백 0.3) */
export function textUnits(s: string): number {
  let u = 0
  for (const ch of Array.from(s)) u += /[가-힣ㄱ-ㅎ]/.test(ch) ? 1 : /\s/.test(ch) ? 0.3 : /[A-Za-z0-9]/.test(ch) ? 0.56 : 0.6
  return u
}

/**
 * 화면 단어에 시간 붙이기 — 읽은 단어(TTS 정렬) 수가 같으면 그대로 짝짓고,
 * 다르면(발음 사전으로 바꿔 읽은 경우 등) 글자 수 비율로 나눈다.
 */
export function timeWords(text: string, startMs: number, endMs: number, spoken?: TimedWord[]): CaptionWord[] {
  const shown = text.split(/\s+/).filter(Boolean)
  if (spoken && spoken.length === shown.length) return shown.map((w, i) => ({ text: w, startMs: spoken[i].startMs, endMs: spoken[i].endMs }))
  const total = shown.reduce((a, w) => a + Math.max(1, textUnits(w)), 0) || 1
  let t = startMs
  return shown.map((w) => {
    const d = ((endMs - startMs) * Math.max(1, textUnits(w))) / total
    const out = { text: w, startMs: Math.round(t), endMs: Math.round(t + d) }
    t += d
    return out
  })
}

/** 자막 조각 — 한 조각 최대 2줄(약 maxUnits 폭), 문장부호에서 먼저 끊는다 */
export function buildCaptionChunks(script: LectureScript, timeline: Timeline, maxUnits = 18): CaptionChunk[] {
  const textById = new Map(script.segments.map((s) => [s.id, s.text]))
  const chunks: CaptionChunk[] = []
  for (const seg of timeline.segments) {
    const text = textById.get(seg.id)
    if (!text || seg.wait) continue
    const words = timeWords(text, seg.startMs, seg.endMs, seg.words)
    const before = chunks.length
    let cur: CaptionWord[] = []
    let units = 0
    const flush = () => {
      if (!cur.length) return
      chunks.push({ slideId: seg.slideId, startMs: cur[0].startMs, endMs: cur[cur.length - 1].endMs, lang: seg.lang, words: cur })
      cur = []
      units = 0
    }
    words.forEach((w, i) => {
      const u = textUnits(w.text) + 0.3
      if (cur.length && units + u > maxUnits) flush()
      cur.push(w)
      units += u
      // 쉼표·마침표 뒤, 조각이 반 이상 찼으면 끊기
      if (/[,.?!]$/.test(w.text) && units > maxUnits * 0.5 && i < words.length - 1) flush()
    })
    flush()
    // 세그먼트 첫 조각은 말 시작에 맞춰 나타난다
    if (chunks[before]) chunks[before].startMs = Math.min(chunks[before].startMs, seg.startMs)
  }
  // 끝은 0.35초 더 보여 주되 다음 조각 전까지
  return chunks.map((c, i) => {
    const next = chunks[i + 1]
    return { ...c, endMs: next ? Math.min(c.endMs + 350, next.startMs) : c.endMs + 500 }
  })
}
