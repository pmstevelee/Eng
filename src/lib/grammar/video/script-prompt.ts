// AI 강의 스크립트 — 프롬프트·AI 응답 정리·구조 검사·원문 대조·빈 장면 (순수 함수, 서버·화면 공용)
// vitest에서 쓰므로 @/ 대신 상대 경로.

import {
  joinTokens,
  VIDEO_TEMPLATE_LABELS,
  type Segment,
  type VideoScene,
  type VideoTemplate,
} from '../../../types/grammar-video'

/** 나레이션 분량 기준 — 분당 약 650자 (한국어 기준, 영어 예문 포함) */
export const NARRATION_CHARS_PER_MINUTE = 650
export const SCRIPT_MINUTES = [2, 3, 5] as const
export type ScriptMinutes = (typeof SCRIPT_MINUTES)[number]
export type ScriptAudience = 'middle' | 'high'
export const SCRIPT_AUDIENCE_LABELS: Record<ScriptAudience, string> = { middle: '중학생', high: '고등학생' }
export const SCENE_COUNT = { min: 6, max: 10 } as const
/** 붙여넣기 대본 최대 길이 */
export const PASTED_SCRIPT_MAX = 12000

export function narrationTargetChars(minutes: number): number {
  return Math.round(minutes * NARRATION_CHARS_PER_MINUTE)
}

/** 나레이션 글자 수 (대기 세그먼트 제외) */
export function narrationChars(scenes: VideoScene[]): number {
  return scenes.reduce((n, s) => n + s.segments.reduce((m, g) => m + (g.waitMs ? 0 : g.text.replace(/\s+/g, ' ').trim().length), 0), 0)
}

// ── 프롬프트 ────────────────────────────────────────────────

const SCENE_FORMAT = `장면 틀(template)과 data 형식 — 항목마다 등장 단계(step) 번호가 있고, 세그먼트의 reveal 번호가 그 단계까지 화면에 보여 준다.
- opening: { seriesLabel, titleKo, titleEn, hook, hookStep } — 남색 표지. seriesLabel 예: "영문법 핵심 정리 #3"
- compare: { title, rows: [{ label, sub, sentence: Token[], ko, step }] (2~4개), note?: { text, step } } — 두 문장 나란히 비교
- steps: { title, steps: [{ title, example: Token[], step }] (2~4개), formula: Token[], formulaStep } — 만드는 순서 + 공식
- variations: { title, subtitle?, rows: [{ label, sentence: Token[], step }] (2~6개) } — 시제·주어 등 바꿔 보기 표
- cases: { title, cases: [{ title, sentence: Token[], ko, step }] (1~3개) } — 쓰는 경우별 예문
- warning: { title, rule, wrong, right, words: string[] (0~6개), ruleStep, wrongStep, rightStep, wordsStep } — 자주 하는 실수 ✗/✓
- quiz: { title, subtitle, items: [{ before, answer, after, hint }] (1~4개), itemsStep } — 빈칸 퀴즈
- summary: { title, lines: Token[][] (1~4줄, 줄 i의 등장 단계는 i+1), cta, ctaStep } — 남색 정리 화면
Token = { "text": "문장 조각", "role"?: 색 역할 }. 조각은 공백 하나로 이어 붙여 화면에 보인다(마침표 같은 문장부호는 따로 조각).`

const COLOR_RULES = `색 역할(role) 규칙:
- subj 주어(파랑), obj 목적어(주황), verb 동사·핵심 형태(초록 칩), warn 틀린 부분(빨강), strike 생략되는 말(회색 취소선), hl 바뀌는 부분 강조(초록).
- 한 문장에서 이 포인트의 핵심이 되는 부분에만 색을 준다. 색 없는 조각은 role을 뺀다.
- 비교 장면은 같은 성분에 같은 색을 써서 자리 이동이 보이게 한다.`

const SEGMENT_RULES = `나레이션 세그먼트(segments) 규칙:
- 세그먼트 = 자막 한 줄 = 음성 한 개. { id, lang: "ko"|"en", text, reveal?, answer?, waitMs?, timer? }
- 말투: 친근한 구어체 존댓말("~해요", "~볼까요?"). 한 세그먼트는 한두 문장(60자 이내).
- 영어 예문은 반드시 lang "en" 세그먼트로 따로 읽는다. 한국어 세그먼트에 영어 문장을 섞지 않는다(단어 하나 정도는 괜찮다).
- 화면 항목은 그 항목을 설명하기 직전 세그먼트의 reveal로 공개한다. 모든 step이 어느 세그먼트의 reveal 이하가 되어야 한다(공개 안 된 항목은 끝까지 안 보인다).
- 퀴즈: 문제를 보여 준 뒤 { "lang": "ko", "text": "", "waitMs": 5000, "timer": true } 대기 세그먼트를 넣고, 정답 문장(en)을 answer 1, 2, 3…으로 하나씩 공개한다.
- id는 스크립트 전체에서 겹치지 않게 "장면id-번호" 형식.`

/** AI 스크립트 생성 시스템 프롬프트 */
export function buildScriptSystemPrompt(easyRules: string, exampleJson: string): string {
  return `너는 한국 영어학원의 문법 강의 영상 작가야. 관리자가 준 원고와 개념 정리로 YouTube 강의 영상 스크립트(장면 목록)를 쓴다.
반드시 JSON 객체 하나로만 응답해: { "title": "영상 제목(한국어)", "scenes": [장면…], "gaps": [{ "message": "원고에서 부족한 부분", "request": "관리자에게 받을 보완 원고 내용" }] }

장면 구성 규칙:
- 총 ${SCENE_COUNT.min}~${SCENE_COUNT.max}장면. 첫 장면은 opening, 끝에서 두 번째쯤 quiz, 마지막은 summary — 셋은 반드시 넣는다.
- 가운데 장면은 포인트에 맞는 틀(compare/steps/variations/cases/warning)을 고른다. 같은 틀을 연달아 쓰지 않는다.
- 예문을 보여 주는 장면(compare/steps/variations/cases)에는 영어 예문 en 세그먼트를 2개 이상 넣는다.
- 장면마다 id(영문 소문자·숫자·하이픈)와 name(챕터 이름, 한국어 10자 이내)을 넣는다.

원고 사용 규칙:
- 관리자 원고의 설명·용어·예문·순서를 최우선으로 따른다. 원고와 다른 설명을 하지 않는다.
- 원고에 없는 설명이 꼭 필요하면 일반 문법 지식으로 쓰되 그 부분을 gaps에 적는다. 원고가 충분하면 gaps는 빈 배열.

${SCENE_FORMAT}

${COLOR_RULES}

${SEGMENT_RULES}

쉬운 설명 기준:
${easyRules}

예시(수동태, 8장면 — 형식·말투·등장 단계 참고용. 내용은 따라 하지 말 것):
${exampleJson}`
}

export interface ScriptPointInfo {
  code: string
  title: string
  category: string
  levelLabel: string
  summary: string | null
  rules: string[]
  examples: string[]
  commonErrors: string[]
}

function pointBlock(point: ScriptPointInfo): string {
  const list = (items: string[]) => (items.length ? items.map((x) => `- ${x}`).join('\n') : '(없음)')
  return `- 포인트: ${point.code} ${point.title}
- 분류: ${point.category}
- 레벨: ${point.levelLabel}

## 개념 정리 (요약)
${point.summary || '(없음)'}

## 규칙
${list(point.rules)}

## 예문
${list(point.examples)}

## 흔한 오류
${list(point.commonErrors)}`
}

export function buildGenerateUserPrompt(input: {
  point: ScriptPointInfo
  minutes: number
  audience: ScriptAudience
  seriesNo: number | null
  sourceText: string
}): string {
  const series = input.seriesNo ? `영문법 핵심 정리 #${input.seriesNo}` : '영문법 핵심 정리'
  return `아래 문법 포인트로 약 ${input.minutes}분짜리 강의 영상 스크립트를 써줘.
- 대상: ${SCRIPT_AUDIENCE_LABELS[input.audience]}
- 나레이션 분량: 모든 세그먼트 text 합계 약 ${narrationTargetChars(input.minutes)}자 (분당 ${NARRATION_CHARS_PER_MINUTE}자 기준)
- opening의 seriesLabel: "${series}"

${pointBlock(input.point)}

## 관리자 원고
${input.sourceText.trim() || '(관리자 원고가 아직 없습니다. 개념 정리로 쓰고, gaps에 "이 포인트 원고 없음"과 필요한 원고 내용을 적어 주세요.)'}`
}

const CONVERT_EXAMPLE = JSON.stringify([
  {
    id: 'compare',
    name: '능동 vs 수동',
    template: 'compare',
    data: {
      title: '능동태와 수동태',
      rows: [
        { label: '능동태', sub: '주어가 직접 한다', sentence: [{ text: 'Tom', role: 'subj' }, { text: 'wrote', role: 'verb' }, { text: 'the letter', role: 'obj' }, { text: '.' }], ko: '톰이 편지를 썼다.', step: 1 },
        { label: '수동태', sub: '주어가 당한다', sentence: [{ text: 'The letter', role: 'obj' }, { text: 'was written', role: 'verb' }, { text: 'by Tom', role: 'subj' }, { text: '.' }], ko: '편지는 톰이 썼다.', step: 2 },
      ],
    },
    segments: [{ s: 4, reveal: 1 }, { s: 5 }, { s: 6, reveal: 2 }, { s: 7 }],
  },
  {
    id: 'quiz',
    name: '퀴즈',
    template: 'quiz',
    data: { title: '퀴즈', subtitle: '괄호 안 동사를 바꿔 보세요', items: [{ before: 'The window', answer: 'was broken', after: 'yesterday.', hint: 'break' }], itemsStep: 1 },
    segments: [{ s: 12, reveal: 1 }, { waitMs: 5000, timer: true }, { s: 13, answer: 1 }],
  },
])

/**
 * 붙여넣은 대본 변환 시스템 프롬프트.
 * 나레이션을 글자 그대로 지키기 위해 AI에게 문장을 쓰게 하지 않는다 — 번호 붙인 문장 목록을 주고,
 * 세그먼트에는 문장 번호(s)만 받는다. 실제 문장은 fillConvertedNarration이 원문에서 채운다.
 */
export function buildConvertSystemPrompt(): string {
  return `너는 강의 영상 편집자야. 관리자가 쓴 강의 대본(번호 붙은 문장 목록)을 영상 장면 목록으로 나눈다.
반드시 JSON 객체 하나로만 응답해: { "title": "영상 제목(한국어)", "scenes": [장면…] }

가장 중요한 규칙 — 나레이션은 문장 번호로만:
- 세그먼트에는 문장을 쓰지 말고 문장 번호만 넣는다: { "s": 3, "reveal"?: 2, "answer"?: 1 }
- 1번부터 마지막 번호까지 모든 문장을 빠짐없이, 번호 순서대로, 한 번씩만 쓴다. 문장을 새로 만들거나 고치지 않는다.
- 너가 정하는 것: 장면 나누기, 장면 틀 선택, 화면 데이터(data), 색 역할, 등장 단계(reveal/answer), 퀴즈 대기.
- 화면 데이터(data)의 문장·예문은 대본에 나온 표현을 그대로 쓴다.
- 대본에 퀴즈가 있으면 문제를 보여 준 뒤 대기 세그먼트 { "waitMs": 5000, "timer": true }를 넣고, 정답 문장 세그먼트에 answer 1, 2…를 준다.
- 장면 수는 대본 흐름에 맞게 정한다(${SCENE_COUNT.min}~${SCENE_COUNT.max}개 권장, 대본이 짧으면 더 적어도 된다). 첫 장면 opening, 마지막 summary를 권장한다.

장면 하나의 모양: { "id": "영문 소문자·숫자·하이픈", "name": "챕터 이름(한국어 10자 이내)", "template": "장면 틀 이름", "data": { 틀별 화면 데이터 }, "segments": [ { "s": 1, "reveal": 1 }, { "s": 2 } ] }
template·data·segments는 모든 장면에 반드시 넣는다.

${SCENE_FORMAT}

${COLOR_RULES}

예시 장면 두 개(형식 참고용):
${CONVERT_EXAMPLE}

등장 단계 규칙:
- 화면 항목은 그 항목을 설명하기 직전 세그먼트의 reveal로 공개한다. 모든 step이 어느 세그먼트의 reveal 이하가 되어야 한다.`
}

export function buildConvertUserPrompt(input: { point: ScriptPointInfo; sentences: string[] }): string {
  return `아래 대본을 장면 목록으로 나눠줘. 세그먼트에는 문장 번호(s)만 넣어. 문장은 모두 ${input.sentences.length}개야.
- 포인트: ${input.point.code} ${input.point.title} (${input.point.category}, ${input.point.levelLabel})

## 대본 (번호. 문장)
${input.sentences.map((s, i) => `${i + 1}. ${s}`).join('\n')}`
}

/** 문장 언어 — 한글이 없고 영문자가 있으면 영어 */
export function detectSentenceLang(sentence: string): 'ko' | 'en' {
  return !/[가-힣]/.test(sentence) && /[A-Za-z]/.test(sentence) ? 'en' : 'ko'
}

/**
 * 변환 응답의 문장 번호(s)를 원문 문장으로 채운다 — 나레이션이 원문과 글자 그대로 같아지게.
 * - 번호 없는 말 세그먼트(AI가 지어낸 문장)는 버린다 / 이미 쓴 번호·없는 번호도 버린다
 * - 빠진 번호는 바로 앞 번호 문장 뒤에 끼워 넣는다 (없으면 첫 장면 맨 앞)
 * notes: 관리자에게 알릴 보정 내용
 */
export function fillConvertedNarration(scenes: unknown[], sentences: string[]): { scenes: unknown[]; notes: string[] } {
  const used = new Set<number>()
  let invented = 0
  let duplicated = 0
  type Seg = Record<string, unknown>
  const out = scenes.map((item) => {
    const s = asRecord(item)
    if (!s || !Array.isArray(s.segments)) return item
    const segments: Seg[] = []
    for (const raw of s.segments) {
      const g = asRecord(raw)
      if (!g) continue
      if (typeof g.waitMs === 'number' && g.waitMs > 0) {
        segments.push({ ...g, lang: 'ko', text: '' })
        continue
      }
      const n = typeof g.s === 'number' ? g.s : typeof g.s === 'string' ? Number(g.s) : NaN
      if (!Number.isInteger(n) || n < 1 || n > sentences.length) {
        invented += 1
        continue
      }
      if (used.has(n)) {
        duplicated += 1
        continue
      }
      used.add(n)
      const { s: _s, text: _t, ...rest } = g
      void _s
      void _t
      segments.push({ ...rest, s: n, lang: detectSentenceLang(sentences[n - 1]), text: sentences[n - 1] })
    }
    return { ...s, segments }
  })

  // 빠진 번호 끼워 넣기 — 앞 번호가 있는 세그먼트 뒤로
  const missing = sentences.map((_, i) => i + 1).filter((n) => !used.has(n))
  for (const n of missing) {
    let placed = false
    for (let prev = n - 1; prev >= 1 && !placed; prev--) {
      for (const sc of out) {
        const segs = (asRecord(sc)?.segments ?? null) as Seg[] | null
        if (!segs) continue
        const at = segs.findIndex((g) => g.s === prev)
        if (at >= 0) {
          segs.splice(at + 1, 0, { s: n, lang: detectSentenceLang(sentences[n - 1]), text: sentences[n - 1] })
          placed = true
          break
        }
      }
    }
    if (!placed) {
      const first = asRecord(out[0])
      if (first && Array.isArray(first.segments)) {
        ;(first.segments as Seg[]).unshift({ s: n, lang: detectSentenceLang(sentences[n - 1]), text: sentences[n - 1] })
      }
    }
  }

  // s는 내부 표시용 — 저장 전에 지운다
  const cleaned = out.map((sc) => {
    const s = asRecord(sc)
    if (!s || !Array.isArray(s.segments)) return sc
    return {
      ...s,
      segments: (s.segments as Seg[]).map((g) => {
        const { s: _n, ...rest } = g
        void _n
        return rest
      }),
    }
  })

  const notes: string[] = []
  if (missing.length) notes.push(`AI가 빠뜨린 대본 문장 ${missing.length}개를 앞 문장 뒤에 넣었어요. 위치를 확인해 주세요.`)
  if (invented) notes.push(`AI가 대본에 없는 나레이션 ${invented}개를 만들어 빼냈어요.`)
  if (duplicated) notes.push(`같은 문장을 두 번 쓴 곳 ${duplicated}개를 하나로 줄였어요.`)
  return { scenes: cleaned, notes }
}

/** 검증 실패 시 재요청 메시지 */
export function buildRetryMessage(problems: string[]): string {
  return `방금 응답에 아래 문제가 있어. 같은 JSON 형식으로 전체를 다시 써줘(문제 없는 장면도 모두 포함).\n${problems
    .slice(0, 20)
    .map((p) => `- ${p}`)
    .join('\n')}`
}

// ── AI 응답 정리 ────────────────────────────────────────────

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null
}

function slug(value: unknown, fallback: string): string {
  const s = typeof value === 'string' ? value.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24) : ''
  return s || fallback
}

export interface ScriptGapDraft {
  message: string
  request: string
}

export interface RawScriptResponse {
  title: string
  /** parseVideoScenes에 넣을 장면 배열 (id 정리·음성 필드 제거 끝) */
  scenes: unknown[]
  gaps: ScriptGapDraft[]
}

/**
 * AI 응답을 파서에 넣기 전에 정리한다.
 * - 장면 id를 영문 slug로, 겹치면 번호를 붙여 유일하게
 * - 세그먼트 id는 "장면id-번호"로 다시 매긴다 (AI가 겹치게 쓰는 일이 잦다)
 * - AI가 지어낸 음성 필드(audioPath·durationSec·textHash)는 지운다
 */
export function normalizeAiScript(raw: unknown): RawScriptResponse | null {
  const r = asRecord(raw)
  const list = Array.isArray(raw) ? raw : r && Array.isArray(r.scenes) ? r.scenes : null
  if (!list) return null
  const used = new Set<string>()
  const scenes = list.map((item, i) => {
    const s = asRecord(item)
    if (!s) return item
    let id = slug(s.id, `scene-${i + 1}`)
    if (used.has(id)) {
      let n = 2
      while (used.has(`${id}-${n}`)) n++
      id = `${id}-${n}`
    }
    used.add(id)
    const segments = Array.isArray(s.segments)
      ? s.segments.map((seg, j) => {
          const g = asRecord(seg)
          if (!g) return seg
          const { audioPath: _a, durationSec: _d, textHash: _h, ...rest } = g
          void _a
          void _d
          void _h
          return { ...rest, id: `${id}-${j + 1}` }
        })
      : s.segments
    return { ...s, id, segments }
  })
  const gaps: ScriptGapDraft[] = []
  if (r && Array.isArray(r.gaps)) {
    for (const g of r.gaps) {
      if (typeof g === 'string' && g.trim()) gaps.push({ message: g.trim().slice(0, 500), request: '' })
      const o = asRecord(g)
      if (o && typeof o.message === 'string' && o.message.trim()) {
        gaps.push({ message: o.message.trim().slice(0, 500), request: typeof o.request === 'string' ? o.request.trim().slice(0, 1000) : '' })
      }
    }
  }
  const title = r && typeof r.title === 'string' ? r.title.trim().slice(0, 120) : ''
  return { title, scenes, gaps: gaps.slice(0, 5) }
}

/** 장면 구성 규칙 위반 (AI 생성 결과 재요청용) — 비어 있으면 통과 */
export function checkScriptStructure(scenes: VideoScene[]): string[] {
  const problems: string[] = []
  if (scenes.length < SCENE_COUNT.min || scenes.length > SCENE_COUNT.max) {
    problems.push(`장면은 ${SCENE_COUNT.min}~${SCENE_COUNT.max}개여야 해요 (지금 ${scenes.length}개)`)
  }
  if (scenes[0]?.template !== 'opening') problems.push('첫 장면은 opening이어야 해요')
  if (scenes[scenes.length - 1]?.template !== 'summary') problems.push('마지막 장면은 summary여야 해요')
  if (!scenes.some((s) => s.template === 'quiz')) problems.push('quiz 장면이 없어요')
  return problems
}

/** 예문 장면에 영어 예문이 2개 미만인 장면 (경고용) */
export function scenesWithFewExamples(scenes: VideoScene[]): string[] {
  const exampleTemplates: VideoTemplate[] = ['compare', 'steps', 'variations', 'cases']
  return scenes
    .filter((s) => exampleTemplates.includes(s.template) && s.segments.filter((g) => g.lang === 'en' && g.text.trim()).length < 2)
    .map((s) => s.name || s.id)
}

// ── 붙여넣기 원문 대조 ──────────────────────────────────────

/** 비교용 정리: 공백·따옴표 모양 차이는 무시 */
function normalizeForCompare(text: string): string {
  return text
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, '')
    .trim()
}

/** 대본을 문장 단위로 나눈다 (줄바꿈·마침표·물음표·느낌표 기준) */
export function splitScriptSentences(text: string): string[] {
  return text
    .split(/\n+/)
    .flatMap((line) => line.match(/[^.!?。？！]+[.!?。？！]+["')\]]*|[^.!?。？！]+$/g) ?? [])
    .map((s) => s.trim())
    .filter((s) => normalizeForCompare(s).length > 0)
}

export interface NarrationDiff {
  /** 대본에는 있는데 나레이션에 그대로 없는 문장 */
  missing: string[]
  /** 나레이션에 있는데 대본에 없는 세그먼트 문장 */
  added: string[]
}

/**
 * 붙여넣은 대본과 변환된 나레이션을 대조한다 (공백 차이는 무시, 글자는 그대로 비교).
 * 대본 문장마다 나레이션 전체 이음 속에 그대로 들어 있는지, 세그먼트마다 대본 속에 그대로 들어 있는지 본다.
 */
export function compareNarration(sourceText: string, scenes: VideoScene[]): NarrationDiff {
  const narration = scenes.flatMap((s) => s.segments).filter((g) => !g.waitMs && g.text.trim())
  const joinedNarration = normalizeForCompare(narration.map((g) => g.text).join(''))
  const joinedSource = normalizeForCompare(sourceText)
  const missing = splitScriptSentences(sourceText).filter((s) => !joinedNarration.includes(normalizeForCompare(s)))
  const added = narration.map((g) => g.text.trim()).filter((t) => !joinedSource.includes(normalizeForCompare(t)))
  return { missing, added }
}

// ── 장면 편집 도우미 ────────────────────────────────────────

/** 이미 쓰는 id와 겹치지 않는 새 id */
export function uniqueId(base: string, used: Iterable<string>): string {
  const set = new Set(used)
  if (!set.has(base)) return base
  let n = 2
  while (set.has(`${base}-${n}`)) n++
  return `${base}-${n}`
}

function seg(id: string, text: string, extra: Partial<Segment> = {}): Segment {
  return { id, lang: 'ko', text, ...extra }
}

/**
 * 장면 추가용 빈 장면 — 파서를 통과하는 최소 데이터(관리자가 고쳐 쓴다).
 * id는 기존 장면·세그먼트와 겹치지 않게 만든다.
 */
export function createBlankScene(template: VideoTemplate, scenes: VideoScene[]): VideoScene {
  const id = uniqueId(template, scenes.map((s) => s.id))
  const segIds = new Set(scenes.flatMap((s) => s.segments.map((g) => g.id)))
  const sid = (n: number) => uniqueId(`${id}-${n}`, segIds)
  const name = VIDEO_TEMPLATE_LABELS[template]
  const sentence = [{ text: 'I', role: 'subj' as const }, { text: 'like', role: 'verb' as const }, { text: 'music', role: 'obj' as const }, { text: '.' }]
  const intro = seg(sid(1), '설명 문장을 입력하세요.', { reveal: 1 })
  switch (template) {
    case 'opening':
      return { id, name, template, data: { seriesLabel: '영문법 핵심 정리', titleKo: '제목', titleEn: 'Title', hook: '한 줄 소개', hookStep: 1 }, segments: [intro] }
    case 'compare':
      return {
        id,
        name,
        template,
        data: {
          title: '비교',
          rows: [
            { label: '문장 1', sub: '', sentence, ko: '해석', step: 1 },
            { label: '문장 2', sub: '', sentence, ko: '해석', step: 2 },
          ],
        },
        segments: [intro, seg(sid(2), 'I like music.', { lang: 'en', reveal: 2 })],
      }
    case 'steps':
      return {
        id,
        name,
        template,
        data: {
          title: '만드는 순서',
          steps: [
            { title: '1단계', example: sentence, step: 1 },
            { title: '2단계', example: sentence, step: 2 },
          ],
          formula: [{ text: '공식', role: 'verb' }],
          formulaStep: 3,
        },
        segments: [intro, seg(sid(2), '두 번째 단계를 설명하세요.', { reveal: 2 }), seg(sid(3), '공식을 정리하세요.', { reveal: 3 })],
      }
    case 'variations':
      return {
        id,
        name,
        template,
        data: {
          title: '바꿔 보기',
          rows: [
            { label: '현재', sentence, step: 1 },
            { label: '과거', sentence, step: 2 },
          ],
        },
        segments: [intro, seg(sid(2), 'I like music.', { lang: 'en', reveal: 2 })],
      }
    case 'cases':
      return { id, name, template, data: { title: '이럴 때 써요', cases: [{ title: '경우 1', sentence, ko: '해석', step: 1 }] }, segments: [intro] }
    case 'warning':
      return {
        id,
        name,
        template,
        data: { title: '주의', rule: '규칙', wrong: '틀린 문장', right: '바른 문장', words: [], ruleStep: 1, wrongStep: 1, rightStep: 1, wordsStep: 1 },
        segments: [intro],
      }
    case 'quiz':
      return {
        id,
        name,
        template,
        data: { title: '퀴즈', subtitle: '알맞은 말을 넣어 보세요', items: [{ before: 'I', answer: 'like', after: 'music.', hint: 'like' }], itemsStep: 1 },
        segments: [
          seg(sid(1), '퀴즈로 확인해 볼까요?', { reveal: 1 }),
          seg(sid(2), '', { waitMs: 5000, timer: true }),
          seg(sid(3), 'I like music.', { lang: 'en', answer: 1 }),
        ],
      }
    case 'summary':
      return {
        id,
        name,
        template,
        data: { title: '정리', lines: [[{ text: '핵심 정리' }]], cta: '구독과 좋아요 부탁해요!', ctaStep: 2 },
        segments: [intro, seg(sid(2), '오늘도 수고했어요.', { reveal: 2 })],
      }
  }
}

/** 장면 목록에서 화면 문장 미리보기 (Token[] → 문자열) */
export function tokensText(tokens: { text: string }[]): string {
  return joinTokens(tokens.map((t) => ({ text: t.text })))
}


// ── 등장 단계 자동 보정 ─────────────────────────────────────

/** 장면 data에서 등장 단계 번호를 모은다 (step·xxxStep 키 + summary 줄 번호) */
function collectRawSteps(template: unknown, data: unknown): number[] {
  const out: number[] = []
  const walk = (v: unknown) => {
    if (Array.isArray(v)) return v.forEach(walk)
    const r = asRecord(v)
    if (!r) return
    for (const [k, val] of Object.entries(r)) {
      if ((k === 'step' || /Step$/.test(k)) && typeof val === 'number' && Number.isInteger(val)) out.push(val)
      else if (typeof val === 'object') walk(val)
    }
  }
  walk(data)
  const d = asRecord(data)
  if (template === 'summary' && d && Array.isArray(d.lines)) d.lines.forEach((_, i) => out.push(i + 1))
  if (template === 'opening' && d && d.hookStep === undefined) out.push(1)
  return out
}

/**
 * AI가 화면 항목의 등장 단계를 나레이션에서 공개하지 않은 경우(reveal 누락) 자동으로 맞춘다.
 * 공개 안 된 단계를 마지막 reveal 뒤의 문장들에 차례로 나눠 주고, 문장이 모자라면 마지막 문장에 몰아 준다.
 * (파서의 "등장 단계가 공개되지 않아요" 오류를 AI 재요청 없이 고친다)
 */
export function repairReveals(scenes: unknown[]): { scenes: unknown[]; notes: string[] } {
  let fixed = 0
  const out = scenes.map((item) => {
    const s = asRecord(item)
    if (!s || !Array.isArray(s.segments)) return item
    const steps = Array.from(new Set(collectRawSteps(s.template, s.data))).sort((a, b) => a - b)
    const segs = s.segments.map((g) => ({ ...(asRecord(g) ?? {}) }))
    const reveals = segs.map((g) => (typeof g.reveal === 'number' ? g.reveal : -1))
    const maxReveal = Math.max(-1, ...reveals)
    const hidden = steps.filter((st) => st > maxReveal && (st > 0 || reveals.every((r) => r < 0)))
    if (hidden.length === 0) return item
    const spoken = (g: Record<string, unknown>) => !(typeof g.waitMs === 'number' && g.waitMs > 0)
    const lastRevealAt = maxReveal < 0 ? -1 : reveals.lastIndexOf(maxReveal)
    const free = segs.map((g, i) => i).filter((i) => i > lastRevealAt && spoken(segs[i]) && reveals[i] < 0)
    hidden.forEach((st, k) => {
      const at = k < free.length ? free[k] : null
      if (at !== null) segs[at].reveal = st
    })
    if (hidden.length > free.length) {
      const lastSpoken = segs.map((g, i) => i).filter((i) => spoken(segs[i])).pop()
      if (lastSpoken !== undefined) segs[lastSpoken].reveal = Math.max(hidden[hidden.length - 1], Number(segs[lastSpoken].reveal ?? -1))
    }
    fixed += 1
    return { ...s, segments: segs }
  })
  return { scenes: out, notes: fixed ? [`화면 항목이 나타나는 시점(reveal)을 ${fixed}개 장면에서 자동으로 맞췄어요. 장면 편집에서 확인해 주세요.`] : [] }
}
