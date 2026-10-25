// AI 강의 영상 장면 데이터 (GrammarLectureScript.scenesJson) 타입과 파서
// 참고 샘플(영문법 영상 샘플: 수동태)의 장면 틀 8종·SCRIPT 구조를 그대로 옮긴 것이다.
// DB·AI 응답의 JSON은 형식이 보장되지 않으므로 parseVideoScenes로 검증한 뒤 쓴다.

/** 문장 성분 색 역할 — subj 주어(파랑), obj 목적어(주황), verb 동사(초록 칩), warn 경고(빨강), strike 생략(빨간 취소선), hl 바뀌는 부분(초록 강조) */
export type TokenRole = 'subj' | 'obj' | 'verb' | 'warn' | 'strike' | 'hl'

/** 화면 문장 조각. 조각 사이는 공백 하나로 잇고, 문장부호·괄호 앞뒤는 붙인다(joinTokens 참고) */
export interface Token {
  text: string
  role?: TokenRole
}

export type VideoLang = 'ko' | 'en'

/**
 * 나레이션 세그먼트 1개 = 음성 1개 = 자막 1줄.
 * 샘플 SCRIPT의 r → reveal, a → answer, w → waitMs, timer → timer.
 */
export interface Segment {
  /** 스크립트 안에서 유일 (음성 파일 경로에 쓰임) */
  id: string
  lang: VideoLang
  /** 읽을 문장. 대기 세그먼트(waitMs)는 빈 문자열 */
  text: string
  /** 이 문장을 읽기 전에 보여 줄 등장 단계 (그 이하 step 항목이 모두 보임) */
  reveal?: number
  /** 퀴즈: 이 문장을 읽기 전에 공개할 정답 번호 (1부터, 그 이하 모두 공개) */
  answer?: number
  /** 말 없이 기다리는 시간(ms) — 퀴즈 생각 시간 */
  waitMs?: number
  /** 대기 동안 타이머 막대 표시 */
  timer?: boolean
  /** Storage 경로 (2-5-3 음성 생성 후) */
  audioPath?: string
  /** 실제 음성 길이(초) */
  durationSec?: number
  /** 음성을 만든 문장의 해시 — 문장이 바뀌면 달라져 다시 생성 대상이 된다 */
  textHash?: string
}

export interface OpeningData {
  /** 예: "영문법 핵심 정리 #1" */
  seriesLabel: string
  titleKo: string
  titleEn: string
  /** 한 줄 훅 */
  hook: string
  hookStep: number
}

export interface CompareRow {
  /** 예: 능동태 */
  label: string
  /** 예: 주어가 직접 한다 */
  sub: string
  sentence: Token[]
  ko: string
  step: number
}

export interface CompareData {
  title: string
  rows: CompareRow[]
  note?: { text: string; step: number }
}

export interface StepCard {
  title: string
  example: Token[]
  step: number
}

export interface StepsData {
  title: string
  steps: StepCard[]
  formula: Token[]
  formulaStep: number
}

export interface VariationRow {
  /** 예: 현재 / 과거 / 미래 */
  label: string
  sentence: Token[]
  step: number
}

export interface VariationsData {
  title: string
  subtitle?: string
  rows: VariationRow[]
}

export interface CaseItem {
  title: string
  sentence: Token[]
  ko: string
  step: number
}

export interface CasesData {
  title: string
  cases: CaseItem[]
}

export interface WarningData {
  title: string
  rule: string
  /** ✗ 틀린 문장 (기호는 렌더러가 붙인다) */
  wrong: string
  /** ✓ 바른 문장 */
  right: string
  /** 자주 틀리는 단어 */
  words: string[]
  ruleStep: number
  wrongStep: number
  rightStep: number
  wordsStep: number
}

export interface QuizItem {
  before: string
  answer: string
  after: string
  /** 괄호 안 힌트 (예: love) */
  hint: string
}

export interface QuizData {
  title: string
  subtitle: string
  items: QuizItem[]
  /** 문제·타이머가 나타나는 단계 */
  itemsStep: number
}

export interface SummaryData {
  title: string
  /** 핵심 줄. 줄 i(0부터)는 등장 단계 i+1 */
  lines: Token[][]
  cta: string
  ctaStep: number
}

interface SceneBase {
  /** 스크립트 안에서 유일 */
  id: string
  /** 챕터 이름 (YouTube 챕터·장면 목록) */
  name: string
  segments: Segment[]
}

export type VideoScene =
  | (SceneBase & { template: 'opening'; data: OpeningData })
  | (SceneBase & { template: 'compare'; data: CompareData })
  | (SceneBase & { template: 'steps'; data: StepsData })
  | (SceneBase & { template: 'variations'; data: VariationsData })
  | (SceneBase & { template: 'cases'; data: CasesData })
  | (SceneBase & { template: 'warning'; data: WarningData })
  | (SceneBase & { template: 'quiz'; data: QuizData })
  | (SceneBase & { template: 'summary'; data: SummaryData })

export type VideoTemplate = VideoScene['template']

export const VIDEO_TEMPLATES: readonly VideoTemplate[] = [
  'opening',
  'compare',
  'steps',
  'variations',
  'cases',
  'warning',
  'quiz',
  'summary',
] as const

export const VIDEO_TEMPLATE_LABELS: Record<VideoTemplate, string> = {
  opening: '오프닝',
  compare: '비교',
  steps: '단계',
  variations: '변형표',
  cases: '사례',
  warning: '주의',
  quiz: '퀴즈',
  summary: '정리',
}

export const TOKEN_ROLES: readonly TokenRole[] = ['subj', 'obj', 'verb', 'warn', 'strike', 'hl'] as const

/** 퀴즈 대기 최대(ms) — 그 이상은 실수로 본다 */
const MAX_WAIT_MS = 30000

// ── 문장 조각 잇기 ───────────────────────────────────────────

const NO_SPACE_BEFORE = /^[.,!?;:)\]’'"…]/
const NO_SPACE_AFTER = /[([‘"]$/

/** 앞뒤 조각 사이에 공백이 필요한지 */
export function needsSpaceBetween(prev: string, next: string): boolean {
  if (!prev || !next) return false
  if (/\s$/.test(prev) || /^\s/.test(next)) return false
  if (NO_SPACE_BEFORE.test(next)) return false
  if (NO_SPACE_AFTER.test(prev)) return false
  return true
}

/** 조각을 화면 문장 하나로 잇는다 (자막·원문 비교용) */
export function joinTokens(tokens: Token[]): string {
  let out = ''
  tokens.forEach((t, i) => {
    if (i > 0 && needsSpaceBetween(tokens[i - 1].text, t.text)) out += ' '
    out += t.text
  })
  return out
}

// ── 파서 ───────────────────────────────────────────────────

export interface VideoSceneError {
  /** 장면 순서 (0부터, 전체 형식 오류면 -1) */
  sceneIndex: number
  sceneId?: string
  /** 문제 위치 (예: "data.rows[1].sentence") */
  path: string
  /** 한국어 이유 */
  message: string
}

export interface ParseVideoScenesResult {
  /** 오류가 없는 장면만 (오류 장면은 errors에 이유와 함께 남는다) */
  scenes: VideoScene[]
  errors: VideoSceneError[]
  ok: boolean
}

type Rec = Record<string, unknown>

function asRecord(value: unknown): Rec | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Rec) : null
}

/** 장면 하나를 검사하며 오류를 모으는 도우미 */
class SceneReader {
  errors: string[][] = []

  fail(path: string, message: string): void {
    this.errors.push([path, message])
  }

  str(obj: Rec, key: string, path: string, opts: { optional?: boolean; allowEmpty?: boolean } = {}): string {
    const v = obj[key]
    if (v === undefined || v === null) {
      if (!opts.optional) this.fail(`${path}${key}`, '값이 없어요')
      return ''
    }
    if (typeof v !== 'string') {
      this.fail(`${path}${key}`, '문자열이어야 해요')
      return ''
    }
    const t = v.trim()
    if (!t && !opts.allowEmpty && !opts.optional) this.fail(`${path}${key}`, '비어 있어요')
    return t
  }

  step(obj: Rec, key: string, path: string, fallback?: number): number {
    const v = obj[key]
    if (v === undefined || v === null) {
      if (fallback !== undefined) return fallback
      this.fail(`${path}${key}`, '등장 단계 번호가 없어요')
      return 0
    }
    if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v > 50) {
      this.fail(`${path}${key}`, '등장 단계는 0~50 정수여야 해요')
      return 0
    }
    return v
  }

  arr(obj: Rec, key: string, path: string, min: number, max: number): unknown[] {
    const v = obj[key]
    if (!Array.isArray(v)) {
      this.fail(`${path}${key}`, '목록이어야 해요')
      return []
    }
    if (v.length < min || v.length > max) {
      this.fail(`${path}${key}`, `항목은 ${min}~${max}개여야 해요 (지금 ${v.length}개)`)
    }
    return v
  }

  rec(value: unknown, path: string): Rec | null {
    const r = asRecord(value)
    if (!r) this.fail(path, '객체여야 해요')
    return r
  }

  tokens(value: unknown, path: string): Token[] {
    if (!Array.isArray(value) || value.length === 0) {
      this.fail(path, '문장 조각 목록이 비어 있거나 형식이 달라요')
      return []
    }
    const out: Token[] = []
    value.forEach((item, i) => {
      // 문자열만 온 조각은 색 없는 조각으로 받아 준다
      if (typeof item === 'string') {
        if (item.trim()) out.push({ text: item })
        else this.fail(`${path}[${i}]`, '빈 조각이에요')
        return
      }
      const r = asRecord(item)
      if (!r) {
        this.fail(`${path}[${i}]`, '조각은 { text, role } 형식이어야 해요')
        return
      }
      const text = typeof r.text === 'string' ? r.text : ''
      if (!text.trim()) {
        this.fail(`${path}[${i}].text`, '빈 조각이에요')
        return
      }
      if (r.role === undefined || r.role === null || r.role === '') {
        out.push({ text })
        return
      }
      if (typeof r.role !== 'string' || !(TOKEN_ROLES as readonly string[]).includes(r.role)) {
        this.fail(`${path}[${i}].role`, `색 역할은 ${TOKEN_ROLES.join('/')} 중 하나여야 해요`)
        return
      }
      out.push({ text, role: r.role as TokenRole })
    })
    return out
  }
}

function readSegments(r: SceneReader, raw: unknown): Segment[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    r.fail('segments', '나레이션 세그먼트가 없어요')
    return []
  }
  const out: Segment[] = []
  raw.forEach((item, i) => {
    const p = `segments[${i}].`
    const s = r.rec(item, `segments[${i}]`)
    if (!s) return
    const id = r.str(s, 'id', p)
    const waitMs = s.waitMs
    let wait: number | undefined
    if (waitMs !== undefined && waitMs !== null) {
      if (typeof waitMs !== 'number' || !Number.isFinite(waitMs) || waitMs <= 0 || waitMs > MAX_WAIT_MS) {
        r.fail(`${p}waitMs`, `대기 시간은 1~${MAX_WAIT_MS}ms여야 해요`)
      } else wait = Math.round(waitMs)
    }
    const lang = s.lang === undefined && wait ? 'ko' : s.lang
    if (lang !== 'ko' && lang !== 'en') r.fail(`${p}lang`, "언어는 'ko' 또는 'en'이어야 해요")
    const text = r.str(s, 'text', p, { optional: Boolean(wait) })
    if (wait && text) r.fail(`${p}text`, '대기 세그먼트에는 문장을 넣지 않아요')
    if (s.timer !== undefined && typeof s.timer !== 'boolean') r.fail(`${p}timer`, 'true/false여야 해요')
    if (s.timer === true && !wait) r.fail(`${p}timer`, '타이머는 대기 세그먼트에만 쓸 수 있어요')

    const seg: Segment = { id, lang: lang === 'en' ? 'en' : 'ko', text }
    if (s.reveal !== undefined && s.reveal !== null) seg.reveal = r.step(s, 'reveal', p)
    if (s.answer !== undefined && s.answer !== null) {
      if (typeof s.answer !== 'number' || !Number.isInteger(s.answer) || s.answer < 1) {
        r.fail(`${p}answer`, '정답 번호는 1 이상 정수여야 해요')
      } else seg.answer = s.answer
    }
    if (wait) seg.waitMs = wait
    if (s.timer === true) seg.timer = true
    if (typeof s.audioPath === 'string' && s.audioPath) seg.audioPath = s.audioPath
    if (typeof s.durationSec === 'number' && Number.isFinite(s.durationSec) && s.durationSec > 0) {
      seg.durationSec = s.durationSec
    }
    if (typeof s.textHash === 'string' && s.textHash) seg.textHash = s.textHash
    out.push(seg)
  })
  return out
}

/** 틀별 화면 데이터 검증. 반환값의 단계 번호는 기본값까지 채운 상태 */
function readData(r: SceneReader, template: VideoTemplate, raw: unknown): VideoScene['data'] | null {
  const d = r.rec(raw, 'data')
  if (!d) return null
  const p = 'data.'
  switch (template) {
    case 'opening':
      return {
        seriesLabel: r.str(d, 'seriesLabel', p),
        titleKo: r.str(d, 'titleKo', p),
        titleEn: r.str(d, 'titleEn', p),
        hook: r.str(d, 'hook', p),
        hookStep: r.step(d, 'hookStep', p, 1),
      } satisfies OpeningData
    case 'compare': {
      const rows = r.arr(d, 'rows', p, 2, 4).flatMap((item, i): CompareRow[] => {
        const rp = `${p}rows[${i}]`
        const row = r.rec(item, rp)
        if (!row) return []
        return [
          {
            label: r.str(row, 'label', `${rp}.`),
            sub: r.str(row, 'sub', `${rp}.`, { optional: true }),
            sentence: r.tokens(row.sentence, `${rp}.sentence`),
            ko: r.str(row, 'ko', `${rp}.`),
            step: r.step(row, 'step', `${rp}.`),
          },
        ]
      })
      const data: CompareData = { title: r.str(d, 'title', p), rows }
      if (d.note !== undefined && d.note !== null) {
        // 문자열만 오면 마지막 행 다음 단계로 둔다
        if (typeof d.note === 'string') {
          if (d.note.trim()) data.note = { text: d.note.trim(), step: Math.max(0, ...rows.map((x) => x.step)) + 1 }
        } else {
          const n = r.rec(d.note, `${p}note`)
          if (n) data.note = { text: r.str(n, 'text', `${p}note.`), step: r.step(n, 'step', `${p}note.`) }
        }
      }
      return data
    }
    case 'steps': {
      const steps = r.arr(d, 'steps', p, 2, 4).flatMap((item, i): StepCard[] => {
        const sp = `${p}steps[${i}]`
        const st = r.rec(item, sp)
        if (!st) return []
        return [
          {
            title: r.str(st, 'title', `${sp}.`),
            example: r.tokens(st.example, `${sp}.example`),
            step: r.step(st, 'step', `${sp}.`),
          },
        ]
      })
      return {
        title: r.str(d, 'title', p),
        steps,
        formula: r.tokens(d.formula, `${p}formula`),
        formulaStep: r.step(d, 'formulaStep', p, Math.max(0, ...steps.map((x) => x.step)) + 1),
      } satisfies StepsData
    }
    case 'variations': {
      const rows = r.arr(d, 'rows', p, 2, 6).flatMap((item, i): VariationRow[] => {
        const rp = `${p}rows[${i}]`
        const row = r.rec(item, rp)
        if (!row) return []
        return [
          {
            label: r.str(row, 'label', `${rp}.`),
            sentence: r.tokens(row.sentence, `${rp}.sentence`),
            step: r.step(row, 'step', `${rp}.`),
          },
        ]
      })
      const data: VariationsData = { title: r.str(d, 'title', p), rows }
      const subtitle = r.str(d, 'subtitle', p, { optional: true })
      if (subtitle) data.subtitle = subtitle
      return data
    }
    case 'cases': {
      const cases = r.arr(d, 'cases', p, 1, 3).flatMap((item, i): CaseItem[] => {
        const cp = `${p}cases[${i}]`
        const c = r.rec(item, cp)
        if (!c) return []
        return [
          {
            title: r.str(c, 'title', `${cp}.`),
            sentence: r.tokens(c.sentence, `${cp}.sentence`),
            ko: r.str(c, 'ko', `${cp}.`),
            step: r.step(c, 'step', `${cp}.`),
          },
        ]
      })
      return { title: r.str(d, 'title', p), cases } satisfies CasesData
    }
    case 'warning': {
      const words = r.arr(d, 'words', p, 0, 6).flatMap((w, i) => {
        if (typeof w === 'string' && w.trim()) return [w.trim()]
        r.fail(`${p}words[${i}]`, '단어는 빈 값이 아닌 문자열이어야 해요')
        return []
      })
      return {
        title: r.str(d, 'title', p),
        rule: r.str(d, 'rule', p),
        wrong: r.str(d, 'wrong', p),
        right: r.str(d, 'right', p),
        words,
        ruleStep: r.step(d, 'ruleStep', p, 1),
        wrongStep: r.step(d, 'wrongStep', p, 2),
        rightStep: r.step(d, 'rightStep', p, 3),
        wordsStep: r.step(d, 'wordsStep', p, 4),
      } satisfies WarningData
    }
    case 'quiz': {
      const items = r.arr(d, 'items', p, 1, 4).flatMap((item, i): QuizItem[] => {
        const qp = `${p}items[${i}]`
        const q = r.rec(item, qp)
        if (!q) return []
        return [
          {
            before: r.str(q, 'before', `${qp}.`, { allowEmpty: true }),
            answer: r.str(q, 'answer', `${qp}.`),
            after: r.str(q, 'after', `${qp}.`, { allowEmpty: true }),
            hint: r.str(q, 'hint', `${qp}.`, { optional: true }),
          },
        ]
      })
      return {
        title: r.str(d, 'title', p),
        subtitle: r.str(d, 'subtitle', p, { optional: true }),
        items,
        itemsStep: r.step(d, 'itemsStep', p, 1),
      } satisfies QuizData
    }
    case 'summary': {
      const lines = r.arr(d, 'lines', p, 1, 4).map((line, i) => r.tokens(line, `${p}lines[${i}]`))
      return {
        title: r.str(d, 'title', p),
        lines,
        cta: r.str(d, 'cta', p),
        ctaStep: r.step(d, 'ctaStep', p, lines.length + 1),
      } satisfies SummaryData
    }
  }
}

/** 화면 항목의 등장 단계 목록 (나레이션 공개 여부 검사용) */
export function sceneSteps(scene: VideoScene): number[] {
  switch (scene.template) {
    case 'opening':
      return [scene.data.hookStep]
    case 'compare':
      return [...scene.data.rows.map((x) => x.step), ...(scene.data.note ? [scene.data.note.step] : [])]
    case 'steps':
      return [...scene.data.steps.map((x) => x.step), scene.data.formulaStep]
    case 'variations':
      return scene.data.rows.map((x) => x.step)
    case 'cases':
      return scene.data.cases.map((x) => x.step)
    case 'warning':
      return [scene.data.ruleStep, scene.data.wrongStep, scene.data.rightStep, scene.data.wordsStep]
    case 'quiz':
      return [scene.data.itemsStep]
    case 'summary':
      return [...scene.data.lines.map((_, i) => i + 1), scene.data.ctaStep]
  }
}

/** 장면 하나 검증 — 오류가 있으면 scene은 null */
function parseScene(raw: unknown): { scene: VideoScene | null; errors: string[][]; id?: string } {
  const r = new SceneReader()
  const s = asRecord(raw)
  if (!s) return { scene: null, errors: [['', '장면은 객체여야 해요']] }
  const id = r.str(s, 'id', '')
  const name = r.str(s, 'name', '')
  const template = s.template
  if (typeof template !== 'string' || !(VIDEO_TEMPLATES as readonly string[]).includes(template)) {
    r.fail('template', `장면 틀은 ${VIDEO_TEMPLATES.join('/')} 중 하나여야 해요`)
    return { scene: null, errors: r.errors, id: id || undefined }
  }
  const data = readData(r, template as VideoTemplate, s.data)
  const segments = readSegments(r, s.segments)
  if (!data || r.errors.length > 0) return { scene: null, errors: r.errors, id: id || undefined }

  const scene = { id, name, template, data, segments } as VideoScene

  // 나레이션과 화면이 맞물리는지 — 공개되지 않는 항목은 영상에서 끝까지 안 보인다
  const maxReveal = Math.max(-1, ...segments.map((x) => (x.reveal === undefined ? -1 : x.reveal)))
  const hidden = Array.from(new Set(sceneSteps(scene).filter((st) => st > maxReveal && st > 0)))
  // 단계 0 항목은 첫 세그먼트에서 reveal 0을 줘야 보인다
  const needsZero = sceneSteps(scene).includes(0) && !segments.some((x) => x.reveal !== undefined)
  if (needsZero) r.fail('segments', '등장 단계 0인 항목이 있는데 reveal을 쓰는 세그먼트가 없어요')
  if (hidden.length) {
    r.fail('segments', `등장 단계 ${hidden.sort((a, b) => a - b).join(', ')}이(가) 나레이션에서 공개되지 않아요 (reveal 확인)`)
  }
  if (scene.template === 'quiz') {
    const maxAnswer = Math.max(0, ...segments.map((x) => x.answer ?? 0))
    if (maxAnswer < scene.data.items.length) {
      r.fail('segments', `퀴즈 정답 ${maxAnswer + 1}~${scene.data.items.length}번이 공개되지 않아요 (answer 확인)`)
    }
    if (segments.some((x) => (x.answer ?? 0) > scene.data.items.length)) {
      r.fail('segments', '퀴즈 문제 수보다 큰 정답 번호가 있어요')
    }
  } else if (segments.some((x) => x.answer !== undefined)) {
    r.fail('segments', '정답 공개(answer)는 퀴즈 장면에서만 써요')
  }
  if (segments.every((x) => !x.text)) r.fail('segments', '읽을 문장이 하나도 없어요')

  if (r.errors.length > 0) return { scene: null, errors: r.errors, id }
  return { scene, errors: [], id }
}

/**
 * scenesJson(장면 배열)을 검증한다. 잘못된 장면은 버리지 않고 errors에 이유를 남긴다.
 * ok는 오류가 하나도 없을 때만 true.
 */
export function parseVideoScenes(json: unknown): ParseVideoScenesResult {
  if (!Array.isArray(json)) {
    return { scenes: [], errors: [{ sceneIndex: -1, path: '', message: '장면 목록(배열)이 아니에요' }], ok: false }
  }
  if (json.length === 0) {
    return { scenes: [], errors: [{ sceneIndex: -1, path: '', message: '장면이 하나도 없어요' }], ok: false }
  }
  const errors: VideoSceneError[] = []
  const parsed: { index: number; scene: VideoScene }[] = []
  json.forEach((raw, i) => {
    const res = parseScene(raw)
    res.errors.forEach(([path, message]) => errors.push({ sceneIndex: i, sceneId: res.id, path, message }))
    if (res.scene) parsed.push({ index: i, scene: res.scene })
  })

  // 스크립트 전체에서 장면 id·세그먼트 id는 유일해야 한다 (음성 파일 경로에 쓰임)
  const sceneIds = new Map<string, number>()
  const segIds = new Map<string, number>()
  json.forEach((raw, i) => {
    const s = asRecord(raw)
    if (!s) return
    if (typeof s.id === 'string' && s.id) {
      if (sceneIds.has(s.id)) {
        errors.push({ sceneIndex: i, sceneId: s.id, path: 'id', message: `장면 id "${s.id}"가 겹쳐요` })
      } else sceneIds.set(s.id, i)
    }
    if (Array.isArray(s.segments)) {
      s.segments.forEach((seg, j) => {
        const g = asRecord(seg)
        if (!g || typeof g.id !== 'string' || !g.id) return
        if (segIds.has(g.id)) {
          errors.push({
            sceneIndex: i,
            sceneId: typeof s.id === 'string' ? s.id : undefined,
            path: `segments[${j}].id`,
            message: `세그먼트 id "${g.id}"가 겹쳐요`,
          })
        } else segIds.set(g.id, i)
      })
    }
  })

  const badIndexes = new Set(errors.map((e) => e.sceneIndex))
  return {
    scenes: parsed.filter((x) => !badIndexes.has(x.index)).map((x) => x.scene),
    errors,
    ok: errors.length === 0,
  }
}

/** 오류 목록을 사람이 읽을 문장으로 (AI 재요청·화면 안내용) */
export function formatVideoSceneErrors(errors: VideoSceneError[]): string[] {
  return errors.map((e) => {
    const where = e.sceneIndex < 0 ? '전체' : `장면 ${e.sceneIndex + 1}${e.sceneId ? `(${e.sceneId})` : ''}`
    return `${where}${e.path ? ` ${e.path}` : ''}: ${e.message}`
  })
}
