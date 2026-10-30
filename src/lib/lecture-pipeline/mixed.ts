// 한국어 세그먼트 안의 영어를 별도 영어 세그먼트로 나눈다.
// 한국어 보이스가 영어를 읽지 않게 하려는 규칙 — 발음 사전에 있는 말(to부정사, p.p. 등)은 나누지 않는다.
// 나뉜 조각은 joinNext로 이어 읽고(쉼 0.15초) 자막에서도 한 줄로 합친다.

import { maskDictTerms, type PronunciationDict } from './normalize'
import type { Segment } from './types'

/** 영어 단어가 이어진 구간 (단어 사이 공백·쉼표·하이픈 허용, 끝 문장부호 포함) */
const EN_RUN = /[A-Za-z][A-Za-z0-9'’-]*(?:[ ,]+[A-Za-z0-9][A-Za-z0-9'’-]*)*(?:[.!?](?=\s|$|["”’']))?/g
const QUOTES = /["“”‘’']/g

export interface SplitNote {
  segmentId: string
  message: string
}

function hasHangul(s: string): boolean {
  return /[가-힣]/.test(s)
}

/** 나눌 영어 구간 [시작, 끝) 목록 */
function englishRuns(text: string, dict: PronunciationDict): [number, number][] {
  const masked = maskDictTerms(text, dict)
  const runs: [number, number][] = []
  for (const m of Array.from(masked.matchAll(EN_RUN))) {
    const word = m[0].replace(/[ ,.!?]+$/, '')
    // 한 글자 기호(A, B)는 그대로 둔다 — I는 영어 문장으로 본다
    if (word.length < 2 && word !== 'I') continue
    runs.push([m.index ?? 0, (m.index ?? 0) + m[0].length])
  }
  return runs
}

/**
 * 한국어 세그먼트 하나를 [한국어, 영어, 한국어 …] 조각으로 나눈다. 영어가 없으면 그대로.
 * 첫 조각이 원래 id·reveal을 갖고, 마지막 조각이 원래 joinNext를 이어받는다.
 */
export function splitMixedSegment(seg: Segment, dict: PronunciationDict): { parts: Segment[]; notes: SplitNote[] } {
  if (seg.lang !== 'ko' || !seg.text) return { parts: [seg], notes: [] }
  const runs = englishRuns(seg.text, dict)
  if (runs.length === 0) return { parts: [seg], notes: [] }

  const pieces: { lang: 'ko' | 'en'; text: string }[] = []
  let pos = 0
  for (const [start, end] of runs) {
    pieces.push({ lang: 'ko', text: seg.text.slice(pos, start) })
    pieces.push({ lang: 'en', text: seg.text.slice(start, end) })
    pos = end
  }
  pieces.push({ lang: 'ko', text: seg.text.slice(pos) })

  const notes: SplitNote[] = []
  const cleaned = pieces
    .map((p) => ({ ...p, text: p.text.replace(QUOTES, '').trim() }))
    .filter((p) => (p.lang === 'ko' ? hasHangul(p.text) : /[A-Za-z]/.test(p.text)))

  cleaned.forEach((p, i) => {
    // 영어 바로 뒤에 붙은 조사("have를")는 따로 읽으면 어색하다 — 검토 때 고치도록 알린다
    if (p.lang === 'ko' && i > 0 && /^(을|를|가|은|는|와|과|의|에|로|으로|도|만|랑|이랑)(\s|$)/.test(p.text)) {
      notes.push({ segmentId: seg.id, message: `영어 뒤에 조사가 바로 붙어 있어요: "${p.text.slice(0, 12)}…" (예: "have 다음에"처럼 바꾸면 자연스러워요)` })
    }
  })
  if (cleaned.length <= 1) {
    const only = cleaned[0]
    return only ? { parts: [{ ...seg, lang: only.lang, text: only.text }], notes } : { parts: [seg], notes }
  }

  const suffix = 'bcdefghijklmnop'
  const parts = cleaned.map((p, i): Segment => {
    const last = i === cleaned.length - 1
    const part: Segment = {
      id: i === 0 ? seg.id : `${seg.id}${suffix[i - 1] ?? i}`,
      slideId: seg.slideId,
      lang: p.lang,
      text: p.text,
      emotion: seg.emotion,
    }
    if (i === 0 && seg.reveal) part.reveal = seg.reveal
    if (!last || seg.joinNext) part.joinNext = true
    return part
  })
  return { parts, notes }
}

/** 대본 전체에 적용 — 바뀐 세그먼트 수와 검토 메모를 함께 돌려준다 */
export function splitMixedSegments(segments: Segment[], dict: PronunciationDict): { segments: Segment[]; changed: number; notes: SplitNote[] } {
  const out: Segment[] = []
  const notes: SplitNote[] = []
  let changed = 0
  for (const seg of segments) {
    const r = splitMixedSegment(seg, dict)
    if (r.parts.length > 1 || r.parts[0] !== seg) changed++
    out.push(...r.parts)
    notes.push(...r.notes)
  }
  // 나눈 조각 id가 다른 세그먼트와 겹치지 않게
  const seen = new Set<string>()
  for (const s of out) {
    let id = s.id
    let n = 2
    while (seen.has(id)) id = `${s.id}-${n++}`
    s.id = id
    seen.add(id)
  }
  return { segments: out, changed, notes }
}
