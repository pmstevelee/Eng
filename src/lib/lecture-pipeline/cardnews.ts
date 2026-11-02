// 인스타그램·쓰레드 카드뉴스 (1080×1350, 4:5 PNG) — 본 강의 대본으로 8~10장
// cardnews/cardnews.json(카드 문구)을 사람이 고치고, 렌더는 이 파일만 읽는다.
// 규칙: 한 장 텍스트 최대 5줄, 글자 최소 40px, 오른쪽 아래 페이지 번호.

import { textUnits } from './shorts'
import { WEBSITE } from './types'

export const CARD = { width: 1080, height: 1350 } as const
export const CARD_MIN_FONT = 40
export const CARD_MAX_LINES = 5
/** 글을 쓸 수 있는 폭 (좌우 여백 90px) */
export const CARD_TEXT_WIDTH = CARD.width - 180

export interface CardExample { en: string; ko: string }
export interface MistakeItem { wrong: string; right: string }

export type Card =
  | { type: 'cover'; topic: string; hook: string; label?: string }
  | { type: 'question'; sentence: string; prompt?: string; hint?: string }
  | { type: 'rule'; heading: string; formula?: string[]; lines: string[]; example?: CardExample }
  | { type: 'mistakes'; heading?: string; items: MistakeItem[] }
  | { type: 'quiz'; question: string; sentence?: string; choices: string[] }
  | { type: 'answer'; answer: string; sentence?: string; explanation: string }
  | { type: 'pattern'; pattern: string; slot?: string; ko: string; example?: CardExample }
  | { type: 'cta'; lectureTitle: string; message?: string }

export type CardType = Card['type']
export const CARD_LABELS: Record<CardType, string> = {
  cover: '표지', question: '이거 맞을까요?', rule: '핵심 문법', mistakes: '흔한 실수 TOP 3', quiz: '퀴즈', answer: '정답과 해설', pattern: '오늘의 일상회화 패턴', cta: '저장·팔로우',
}

export interface CardNews {
  version: 1
  slug: string
  title: string
  cards: Card[]
}

/**
 * 카드 안 글 블록과 글자 크기 — 렌더러와 줄 수 검사가 같은 값을 쓴다.
 * perLine: 한 줄에 놓이는 항목 수 (보기 2개씩 한 줄 등)
 */
export interface TextBlock { text: string; size: number; perLine?: number }

export function cardTextBlocks(c: Card): TextBlock[] {
  switch (c.type) {
    case 'cover': return [{ text: c.topic, size: 104 }, { text: c.hook, size: 54 }]
    case 'question': return [{ text: c.prompt || '이거 맞을까요?', size: 64 }, { text: c.sentence, size: 72 }, ...(c.hint ? [{ text: c.hint, size: 44 }] : [])]
    case 'rule': return [
      { text: c.heading, size: 60 },
      ...(c.formula?.length ? [{ text: c.formula.join(' + '), size: 48 }] : []),
      ...c.lines.map((l) => ({ text: l.replace(/\*\*/g, ''), size: 46 })),
      ...(c.example ? [{ text: c.example.en, size: 48 }, { text: c.example.ko, size: 42 }] : []),
    ]
    case 'mistakes': return [{ text: c.heading || '흔한 실수 TOP 3', size: 60 }, ...c.items.map((m) => ({ text: `${m.wrong} → ${m.right}`, size: 46 }))]
    case 'quiz': return [
      { text: c.question, size: 52 },
      ...(c.sentence ? [{ text: c.sentence, size: 58 }] : []),
      ...pairs(c.choices).map((p) => ({ text: p.join('      '), size: 48 })),
    ]
    case 'answer': return [{ text: c.answer, size: 80 }, ...(c.sentence ? [{ text: c.sentence, size: 52 }] : []), { text: c.explanation, size: 44 }]
    case 'pattern': return [
      { text: c.pattern.replace(/~+/g, c.slot ? ` ${c.slot} ` : ' ~ '), size: 76 },
      { text: c.ko, size: 52 },
      ...(c.example ? [{ text: c.example.en, size: 48 }, { text: c.example.ko, size: 42 }] : []),
    ]
    case 'cta': return [{ text: c.message || '저장하고 복습하세요', size: 64 }, { text: '팔로우하면 매일 영어 한 장', size: 46 }, { text: WEBSITE.cta, size: 46 }, { text: WEBSITE.host, size: 52 }]
  }
}

function pairs<T>(list: T[]): T[][] {
  const out: T[][] = []
  for (let i = 0; i < list.length; i += 2) out.push(list.slice(i, i + 2))
  return out
}

/** 한 블록이 차지하는 줄 수 (글자 폭 어림) */
export function blockLines(b: TextBlock, width = CARD_TEXT_WIDTH): number {
  return Math.max(1, Math.ceil((textUnits(b.text) * b.size) / width))
}

export function cardLines(c: Card): number {
  return cardTextBlocks(c).reduce((a, b) => a + blockLines(b), 0)
}

// ── 검증 ───────────────────────────────────────────────────

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')
const strList = (v: unknown): string[] => (Array.isArray(v) ? v.map(str).filter(Boolean) : [])
const example = (v: unknown): CardExample | undefined => (isObj(v) && str(v.en) ? { en: str(v.en), ko: str(v.ko) } : undefined)

function cleanCard(v: Record<string, unknown>): Card | null {
  switch (v.type) {
    case 'cover': return { type: 'cover', topic: str(v.topic), hook: str(v.hook), ...(str(v.label) ? { label: str(v.label) } : {}) }
    case 'question': return { type: 'question', sentence: str(v.sentence), ...(str(v.prompt) ? { prompt: str(v.prompt) } : {}), ...(str(v.hint) ? { hint: str(v.hint) } : {}) }
    case 'rule': {
      const formula = strList(v.formula)
      const ex = example(v.example)
      return { type: 'rule', heading: str(v.heading), ...(formula.length ? { formula } : {}), lines: strList(v.lines), ...(ex ? { example: ex } : {}) }
    }
    case 'mistakes': {
      const items = Array.isArray(v.items) ? v.items.flatMap((m): MistakeItem[] => (isObj(m) && str(m.wrong) && str(m.right) ? [{ wrong: str(m.wrong), right: str(m.right) }] : [])) : []
      return { type: 'mistakes', ...(str(v.heading) ? { heading: str(v.heading) } : {}), items }
    }
    case 'quiz': return { type: 'quiz', question: str(v.question), ...(str(v.sentence) ? { sentence: str(v.sentence) } : {}), choices: strList(v.choices) }
    case 'answer': return { type: 'answer', answer: str(v.answer), ...(str(v.sentence) ? { sentence: str(v.sentence) } : {}), explanation: str(v.explanation) }
    case 'pattern': {
      const ex = example(v.example)
      return { type: 'pattern', pattern: str(v.pattern), ...(str(v.slot) ? { slot: str(v.slot) } : {}), ko: str(v.ko), ...(ex ? { example: ex } : {}) }
    }
    case 'cta': return { type: 'cta', lectureTitle: str(v.lectureTitle), ...(str(v.message) ? { message: str(v.message) } : {}) }
    default: return null
  }
}

export interface CardIssue { level: 'error' | 'warn'; where: string; message: string }

export function parseCardNews(input: unknown): { cardnews: CardNews | null; issues: CardIssue[] } {
  const issues: CardIssue[] = []
  const err = (where: string, message: string) => issues.push({ level: 'error', where, message })
  const warn = (where: string, message: string) => issues.push({ level: 'warn', where, message })
  if (!isObj(input)) return { cardnews: null, issues: [{ level: 'error', where: '전체', message: 'JSON 객체가 아니에요' }] }
  const raw = Array.isArray(input.cards) ? input.cards : []
  const cards: Card[] = []
  raw.forEach((r, i) => {
    const where = `카드 ${i + 1}`
    const c = isObj(r) ? cleanCard(r) : null
    if (!c) return err(where, `알 수 없는 카드 type "${isObj(r) ? String(r.type) : ''}"`)
    const w = `${where}(${CARD_LABELS[c.type]})`
    if (c.type === 'cover' && (!c.topic || !c.hook)) err(w, 'topic(주제)과 hook(훅 문구)이 필요해요')
    if (c.type === 'question' && !c.sentence) err(w, 'sentence(흔한 실수 문장)가 필요해요')
    if (c.type === 'rule' && (!c.heading || c.lines.length === 0)) err(w, 'heading과 lines가 필요해요')
    if (c.type === 'mistakes' && c.items.length !== 3) err(w, '실수는 정확히 3개예요')
    if (c.type === 'quiz' && (c.choices.length < 2 || c.choices.length > 4)) err(w, '보기(choices)는 2~4개예요')
    if (c.type === 'quiz' && c.sentence && c.question.replace(/\s/g, '') === c.sentence.replace(/\s/g, '')) warn(w, 'question이 빈칸 문장과 같아요 (한국어 질문으로, 예: "빈칸에 알맞은 말은?")')
    if (c.type === 'answer' && (!c.answer || !c.explanation)) err(w, 'answer와 explanation이 필요해요')
    if (c.type === 'pattern' && !c.pattern.includes('~')) err(w, 'pattern에 빈칸(~)이 있어야 해요')
    if (c.type === 'cta' && !c.lectureTitle) err(w, 'lectureTitle이 필요해요')
    const lines = cardLines(c)
    if (lines > CARD_MAX_LINES) warn(w, `글이 약 ${lines}줄이에요 (최대 ${CARD_MAX_LINES}줄). 문장을 줄여 주세요`)
    cards.push(c)
  })
  if (cards.length < 8 || cards.length > 10) err('전체', `카드는 8~10장이에요 (지금 ${cards.length}장)`)
  if (cards[0] && cards[0].type !== 'cover') err('카드 1', '첫 장은 표지(cover)예요')
  if (cards.length && cards[cards.length - 1].type !== 'cta') err(`카드 ${cards.length}`, '마지막 장은 저장·팔로우(cta)예요')
  const quizAt = cards.findIndex((c) => c.type === 'quiz')
  if (quizAt >= 0 && cards[quizAt + 1]?.type !== 'answer') err(`카드 ${quizAt + 2}`, '퀴즈 다음 장은 정답(answer)이어야 해요')
  const slug = str(input.slug)
  const title = str(input.title)
  if (!slug || !title) err('전체', 'slug·title이 필요해요')
  return { cardnews: issues.some((i) => i.level === 'error') ? null : { version: 1, slug, title, cards }, issues }
}

// ── 문서 ───────────────────────────────────────────────────

/** cardnews-script.md — 슬라이드별 문구 (검토용) */
export function buildCardScriptMd(cn: CardNews, notes: string[] = []): string {
  const out = [
    `# 카드뉴스 문구 — ${cn.title}`,
    '',
    `- ${cn.cards.length}장 · 1080×1350 PNG · 인스타그램·쓰레드 공용`,
    '- 고칠 곳은 `cardnews.json`에서 고친 뒤 `npm run cardnews:render -- ' + cn.slug + '`',
    `- 규칙: 한 장 최대 ${CARD_MAX_LINES}줄, 글자 ${CARD_MIN_FONT}px 이상`,
    '',
  ]
  if (notes.length) out.push('## 확인할 점', '', ...notes.map((n) => `- ⚠ ${n}`), '')
  cn.cards.forEach((c, i) => {
    out.push(`## ${i + 1}/${cn.cards.length} ${CARD_LABELS[c.type]} (약 ${cardLines(c)}줄)`, '')
    out.push(...cardLinesMd(c).map((l) => `> ${l}`), '')
  })
  return out.join('\n')
}

function cardLinesMd(c: Card): string[] {
  switch (c.type) {
    case 'cover': return [`**${c.topic}**`, c.hook, ...(c.label ? [`(${c.label})`] : [])]
    case 'question': return [c.prompt || '이거 맞을까요?', `**${c.sentence}**`, ...(c.hint ? [c.hint] : [])]
    case 'rule': return [`**${c.heading}**`, ...(c.formula?.length ? [c.formula.map((f) => `[${f}]`).join(' + ')] : []), ...c.lines, ...(c.example ? [`${c.example.en} — ${c.example.ko}`] : [])]
    case 'mistakes': return [`**${c.heading || '흔한 실수 TOP 3'}**`, ...c.items.map((m, i) => `${i + 1}. ❌ ~~${m.wrong}~~ → ✅ ${m.right}`)]
    case 'quiz': return [`Q. ${c.question}`, ...(c.sentence ? [c.sentence] : []), ...c.choices.map((ch, i) => `${String.fromCharCode(65 + i)}. ${ch}`), '(정답은 다음 장)']
    case 'answer': return [`정답: **${c.answer}**`, ...(c.sentence ? [c.sentence] : []), c.explanation]
    case 'pattern': return [`**${c.pattern.replace(/~+/g, `[${c.slot ?? '~'}]`)}**`, c.ko, ...(c.example ? [`${c.example.en} — ${c.example.ko}`] : [])]
    case 'cta': return [c.message || '저장하고 복습하세요', '팔로우하면 매일 영어 한 장', `${WEBSITE.cta} — ${WEBSITE.host}`]
  }
}

// ── 캡션 ───────────────────────────────────────────────────

export const INSTAGRAM_LIMIT = { bodyChars: 2000, minTags: 20, maxTags: 25 } as const
export const THREADS_LIMIT = { totalChars: 500, minTags: 3, maxTags: 5 } as const

/** 해시태그 정리 — # 붙이기, 공백 없애기, 중복 제거 */
export function cleanHashtags(tags: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const t of tags) {
    const tag = `#${t.replace(/^#+/, '').replace(/\s+/g, '').replace(/[^0-9A-Za-z_가-힣]/g, '')}`
    if (tag.length < 2 || seen.has(tag.toLowerCase())) continue
    seen.add(tag.toLowerCase())
    out.push(tag)
  }
  return out
}

/** 글자 수 (이모지·한글 모두 1자) */
export const charCount = (s: string) => Array.from(s).length
