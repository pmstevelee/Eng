// 위고업잉글리시 문법 강의 영상 파이프라인 — 대본(script.json) 형식과 검증
// lectures/{slug}/script.json 하나가 슬라이드(화면)와 세그먼트(음성 1개 = 자막 조각 1개)를 모두 담는다.
// Remotion 번들러도 이 파일을 읽으므로 '@/' 별칭 없이 상대 경로만 쓴다.

export type Lang = 'ko' | 'en'
export type Emotion = '설명' | '강조' | '질문' | '칭찬'
export const EMOTIONS: readonly Emotion[] = ['설명', '강조', '질문', '칭찬'] as const

/** 문장 성분 색 — subject 주어(틸), verb 동사(인디고), object 목적어(네이비), error 오류(레드), correct 정답(그린) */
export type Role = 'subject' | 'verb' | 'object' | 'error' | 'correct'
export const ROLES: readonly Role[] = ['subject', 'verb', 'object', 'error', 'correct'] as const

/** 화면 문장 조각. point=true면 이번 문법 포인트(색 + 밑줄 강조) */
export interface Token {
  text: string
  role?: Role
  point?: boolean
}

export interface Segment {
  /** 대본 안에서 유일 (음성 파일 이름) */
  id: string
  slideId: string
  lang: Lang
  /** 읽을 문장 (원문 — 발음 사전 변환 전). 대기 세그먼트는 빈 문자열 */
  text: string
  emotion: Emotion
  /** 이 문장을 읽기 시작할 때 슬라이드의 n단계까지 보인다 (1부터) */
  reveal?: number
  /** 말없이 기다리는 시간(초) — 퀴즈 카운트다운 */
  waitSec?: number
  /** 한 문장을 언어별로 나눈 조각 — 다음 조각과 짧게 이어 읽고, 자막도 하나로 합친다 */
  joinNext?: boolean
}

export interface TitleData { title: string; subtitle?: string; series?: string }
export interface GoalData { heading?: string; goals: string[] }
/** lines 안의 **굵은 글자**는 키워드 하이라이트 */
export interface ConceptData { heading: string; lines: string[] }
export interface FormulaBlock { text: string; role?: Role; note?: string }
export interface FormulaData { heading?: string; blocks: FormulaBlock[]; example?: Token[]; exampleKo?: string }
export interface ExampleData { heading?: string; sentence: Token[]; ko: string; note?: string }
export interface CompareRow { sentence: Token[]; correct: boolean; ko?: string }
export interface CompareData { heading?: string; rows: CompareRow[] }
export interface MistakeData { heading?: string; wrong: string; right: Token[]; why: string }
export interface QuizData { question: string; sentence?: string; choices: string[]; answer: number; explanation?: string }
export interface SummaryData { heading?: string; points: string[] }
export interface OutroData { message?: string; next?: string }

interface SlideBase {
  id: string
  /** YouTube 챕터 이름 (같은 이름이 이어지면 한 챕터) */
  chapter?: string
}

export type Slide =
  | (SlideBase & { type: 'title'; data: TitleData })
  | (SlideBase & { type: 'goal'; data: GoalData })
  | (SlideBase & { type: 'concept'; data: ConceptData })
  | (SlideBase & { type: 'formula'; data: FormulaData })
  | (SlideBase & { type: 'example'; data: ExampleData })
  | (SlideBase & { type: 'compare'; data: CompareData })
  | (SlideBase & { type: 'mistake'; data: MistakeData })
  | (SlideBase & { type: 'quiz'; data: QuizData })
  | (SlideBase & { type: 'summary'; data: SummaryData })
  | (SlideBase & { type: 'outro'; data: OutroData })

export type SlideType = Slide['type']
export const SLIDE_TYPES: readonly SlideType[] = [
  'title', 'goal', 'concept', 'formula', 'example', 'compare', 'mistake', 'quiz', 'summary', 'outro',
] as const

export const SLIDE_TYPE_LABELS: Record<SlideType, string> = {
  title: '제목', goal: '학습목표', concept: '핵심 개념', formula: '문장 공식', example: '예문',
  compare: '맞는 문장 vs 틀린 문장', mistake: '자주 하는 실수', quiz: '퀴즈', summary: '핵심 정리', outro: '마무리',
}

export interface LectureScript {
  version: 1
  slug: string
  title: string
  /** 연결한 문법 포인트 (문법학습관리) */
  grammarPoint?: { code: string; title: string } | null
  targetMinutes: number
  createdAt: string
  slides: Slide[]
  segments: Segment[]
}

/** 토큰을 화면 문장 하나로 잇는다 (문장부호 앞은 붙임) */
export function joinTokens(tokens: Token[]): string {
  let out = ''
  for (const t of tokens) {
    const text = t.text.trim()
    if (!text) continue
    if (out && !/^[.,!?;:)'’]/.test(text) && !/[(‘]$/.test(out)) out += ' '
    out += text
  }
  return out
}

/** 슬라이드에서 순서대로 등장하는 요소 수 (segment.reveal이 가리키는 단계) */
export function slideStepCount(slide: Slide): number {
  switch (slide.type) {
    case 'title': return 0
    case 'goal': return slide.data.goals.length
    case 'concept': return slide.data.lines.length
    case 'formula': return slide.data.blocks.length + (slide.data.example?.length ? 1 : 0)
    case 'example': return 2
    case 'compare': return slide.data.rows.length
    case 'mistake': return 3
    case 'quiz': return 1
    case 'summary': return slide.data.points.length
    case 'outro': return slide.data.next ? 1 : 0
  }
}

// ── 검증 ───────────────────────────────────────────────────

export interface ScriptIssue {
  level: 'error' | 'warn'
  where: string
  message: string
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')
const strList = (v: unknown): string[] => (Array.isArray(v) ? v.map(str).filter(Boolean) : [])

function tokens(v: unknown): Token[] {
  if (typeof v === 'string') return v.trim() ? [{ text: v.trim() }] : []
  if (!Array.isArray(v)) return []
  const out: Token[] = []
  for (const t of v) {
    if (typeof t === 'string') {
      if (t.trim()) out.push({ text: t.trim() })
      continue
    }
    if (!isObj(t)) continue
    const text = str(t.text)
    if (!text) continue
    const role = ROLES.includes(t.role as Role) ? (t.role as Role) : undefined
    out.push({ text, ...(role ? { role } : {}), ...(t.point === true ? { point: true } : {}) })
  }
  return out
}

/** AI·사람이 쓴 슬라이드 데이터를 형식에 맞게 정리 (없는 값은 빈 값) */
function cleanSlideData(type: SlideType, d: Record<string, unknown>): Slide['data'] {
  switch (type) {
    case 'title': return { title: str(d.title), subtitle: str(d.subtitle) || undefined, series: str(d.series) || undefined }
    case 'goal': return { heading: str(d.heading) || undefined, goals: strList(d.goals) }
    case 'concept': return { heading: str(d.heading), lines: strList(d.lines) }
    case 'formula': {
      const blocks = Array.isArray(d.blocks)
        ? d.blocks.flatMap((b): FormulaBlock[] => {
            if (typeof b === 'string') return b.trim() ? [{ text: b.trim() }] : []
            if (!isObj(b) || !str(b.text)) return []
            const role = ROLES.includes(b.role as Role) ? (b.role as Role) : undefined
            return [{ text: str(b.text), ...(role ? { role } : {}), ...(str(b.note) ? { note: str(b.note) } : {}) }]
          })
        : []
      const example = tokens(d.example)
      return { heading: str(d.heading) || undefined, blocks, ...(example.length ? { example, exampleKo: str(d.exampleKo) || undefined } : {}) }
    }
    case 'example': return { heading: str(d.heading) || undefined, sentence: tokens(d.sentence), ko: str(d.ko), note: str(d.note) || undefined }
    case 'compare': {
      const rows = Array.isArray(d.rows)
        ? d.rows.flatMap((r): CompareRow[] => {
            if (!isObj(r)) return []
            const sentence = tokens(r.sentence)
            return sentence.length ? [{ sentence, correct: r.correct === true, ko: str(r.ko) || undefined }] : []
          })
        : []
      return { heading: str(d.heading) || undefined, rows }
    }
    case 'mistake': return { heading: str(d.heading) || undefined, wrong: str(d.wrong), right: tokens(d.right), why: str(d.why) }
    case 'quiz': {
      const choices = strList(d.choices)
      const answer = typeof d.answer === 'number' && Number.isInteger(d.answer) ? d.answer : -1
      return { question: str(d.question), sentence: str(d.sentence) || undefined, choices, answer, explanation: str(d.explanation) || undefined }
    }
    case 'summary': return { heading: str(d.heading) || undefined, points: strList(d.points) }
    case 'outro': return { message: str(d.message) || undefined, next: str(d.next) || undefined }
  }
}

/** 화면 글자 길이 상한 — 48px 이상·4줄 이내를 지키기 위한 기준 (넘으면 경고) */
const MAX_LEN = { heading: 26, line: 40, sentence: 56, ko: 40, card: 34 }

function lengthWarnings(slide: Slide): string[] {
  const w: string[] = []
  const check = (label: string, text: string | undefined, max: number) => {
    if (text && text.replace(/\*\*/g, '').length > max) w.push(`${label}이(가) 길어요 (${text.length}자, 권장 ${max}자 이하)`)
  }
  const d = slide.data as unknown as Record<string, unknown>
  check('제목', str(d.heading) || undefined, MAX_LEN.heading)
  switch (slide.type) {
    case 'goal': slide.data.goals.forEach((g, i) => check(`목표 ${i + 1}`, g, MAX_LEN.card)); break
    case 'concept': slide.data.lines.forEach((l, i) => check(`설명 ${i + 1}`, l, MAX_LEN.line)); break
    case 'example': check('예문', joinTokens(slide.data.sentence), MAX_LEN.sentence); check('해석', slide.data.ko, MAX_LEN.ko); break
    case 'compare': slide.data.rows.forEach((r, i) => check(`문장 ${i + 1}`, joinTokens(r.sentence), MAX_LEN.sentence)); break
    case 'mistake': check('틀린 문장', slide.data.wrong, MAX_LEN.sentence); check('이유', slide.data.why, MAX_LEN.line); break
    case 'summary': slide.data.points.forEach((p, i) => check(`정리 ${i + 1}`, p, MAX_LEN.card)); break
    default: break
  }
  return w
}

const LIST_LIMITS: Partial<Record<SlideType, { key: string; min: number; max: number }>> = {
  goal: { key: 'goals', min: 1, max: 4 },
  concept: { key: 'lines', min: 1, max: 3 },
  formula: { key: 'blocks', min: 2, max: 5 },
  compare: { key: 'rows', min: 2, max: 2 },
  summary: { key: 'points', min: 2, max: 4 },
}

export interface ParseResult {
  script: LectureScript | null
  issues: ScriptIssue[]
}

/** script.json 검증. error가 하나라도 있으면 음성·렌더를 진행하지 않는다 */
export function parseLectureScript(input: unknown): ParseResult {
  const issues: ScriptIssue[] = []
  const err = (where: string, message: string) => issues.push({ level: 'error', where, message })
  const warn = (where: string, message: string) => issues.push({ level: 'warn', where, message })
  if (!isObj(input)) return { script: null, issues: [{ level: 'error', where: '전체', message: 'JSON 객체가 아니에요' }] }

  const slides: Slide[] = []
  const slideIds = new Set<string>()
  const rawSlides = Array.isArray(input.slides) ? input.slides : []
  if (rawSlides.length === 0) err('전체', 'slides가 비어 있어요')
  rawSlides.forEach((s, i) => {
    if (!isObj(s)) return err(`슬라이드 ${i + 1}`, '형식이 올바르지 않아요')
    const id = str(s.id) || `s${i + 1}`
    const type = s.type as SlideType
    if (!SLIDE_TYPES.includes(type)) return err(`슬라이드 ${id}`, `알 수 없는 type "${String(s.type)}"`)
    if (slideIds.has(id)) return err(`슬라이드 ${id}`, 'id가 중복돼요')
    slideIds.add(id)
    const data = cleanSlideData(type, isObj(s.data) ? s.data : {})
    const slide = { id, type, data, ...(str(s.chapter) ? { chapter: str(s.chapter) } : {}) } as Slide
    const where = `슬라이드 ${id}(${SLIDE_TYPE_LABELS[type]})`

    const limit = LIST_LIMITS[type]
    if (limit) {
      const n = ((data as unknown as Record<string, unknown[]>)[limit.key] ?? []).length
      if (n < limit.min) err(where, `${limit.key}가 ${limit.min}개 이상 필요해요`)
      if (n > limit.max) err(where, `${limit.key}는 최대 ${limit.max}개예요 (한 화면 4줄 규칙)`)
    }
    if (slide.type === 'title' && !slide.data.title) err(where, 'title이 비어 있어요')
    if (slide.type === 'concept' && !slide.data.heading) err(where, 'heading이 비어 있어요')
    if (slide.type === 'example' && (!slide.data.sentence.length || !slide.data.ko)) err(where, '예문(sentence)과 해석(ko)이 필요해요')
    if (slide.type === 'mistake' && (!slide.data.wrong || !slide.data.right.length)) err(where, '틀린 문장(wrong)과 고친 문장(right)이 필요해요')
    if (slide.type === 'compare' && !slide.data.rows.some((r) => r.correct)) err(where, '맞는 문장(correct: true)이 하나는 있어야 해요')
    if (slide.type === 'quiz') {
      if (!slide.data.question) err(where, 'question이 비어 있어요')
      if (slide.data.choices.length < 2 || slide.data.choices.length > 4) err(where, '보기(choices)는 2~4개예요')
      if (slide.data.answer < 0 || slide.data.answer >= slide.data.choices.length) err(where, 'answer는 보기 번호(0부터)여야 해요')
    }
    lengthWarnings(slide).forEach((m) => warn(where, m))
    slides.push(slide)
  })

  const segments: Segment[] = []
  const segIds = new Set<string>()
  const rawSegs = Array.isArray(input.segments) ? input.segments : []
  if (rawSegs.length === 0) err('전체', 'segments가 비어 있어요')
  let lastSlideIndex = 0
  rawSegs.forEach((g, i) => {
    if (!isObj(g)) return err(`세그먼트 ${i + 1}`, '형식이 올바르지 않아요')
    const id = str(g.id) || `g${i + 1}`
    const where = `세그먼트 ${id}`
    if (segIds.has(id)) return err(where, 'id가 중복돼요')
    segIds.add(id)
    const slideId = str(g.slideId)
    const slideIndex = slides.findIndex((s) => s.id === slideId)
    if (slideIndex < 0) return err(where, `slideId "${slideId}" 슬라이드가 없어요`)
    if (slideIndex < lastSlideIndex) err(where, '슬라이드 순서가 뒤로 돌아갔어요 (세그먼트는 슬라이드 순서대로)')
    lastSlideIndex = slideIndex
    const lang: Lang = g.lang === 'en' ? 'en' : 'ko'
    if (g.lang !== 'ko' && g.lang !== 'en') warn(where, 'lang이 없어 ko로 봤어요')
    const emotion: Emotion = EMOTIONS.includes(g.emotion as Emotion) ? (g.emotion as Emotion) : '설명'
    const text = str(g.text)
    const waitSec = typeof g.waitSec === 'number' && g.waitSec > 0 ? Math.min(g.waitSec, 15) : undefined
    if (!text && !waitSec) return err(where, 'text가 비어 있어요')
    const steps = slideStepCount(slides[slideIndex])
    let reveal = typeof g.reveal === 'number' && g.reveal > 0 ? Math.floor(g.reveal) : undefined
    // 단계 수보다 큰 reveal은 마지막 단계로 맞춘다 (단계가 없는 슬라이드는 지움)
    if (reveal && reveal > steps) reveal = steps > 0 ? steps : undefined
    if (lang === 'ko' && /[가-힣]/.test(text) === false && text) warn(where, '한국어 세그먼트에 한글이 없어요 (lang 확인)')
    if (lang === 'en' && /[가-힣]/.test(text)) err(where, '영어 세그먼트에 한글이 섞여 있어요')
    segments.push({
      id, slideId, lang, text: waitSec ? '' : text, emotion,
      ...(reveal ? { reveal } : {}), ...(waitSec ? { waitSec } : {}), ...(g.joinNext === true ? { joinNext: true } : {}),
    })
  })

  for (const s of slides) {
    const own = segments.filter((g) => g.slideId === s.id)
    if (own.length === 0) err(`슬라이드 ${s.id}`, '읽을 세그먼트가 없어요')
    if (s.type === 'quiz') {
      const waitIdx = own.findIndex((g) => g.waitSec)
      const answerIdx = own.findIndex((g) => (g.reveal ?? 0) >= 1)
      if (waitIdx < 0) warn(`슬라이드 ${s.id}(퀴즈)`, '카운트다운 대기 세그먼트(waitSec)가 없어요')
      if (answerIdx < 0) err(`슬라이드 ${s.id}(퀴즈)`, '정답을 공개하는 세그먼트(reveal: 1)가 없어요')
      else if (waitIdx >= 0 && answerIdx < waitIdx) err(`슬라이드 ${s.id}(퀴즈)`, '정답 공개는 카운트다운 뒤에 와야 해요')
    }
  }

  const title = str(input.title)
  const slug = str(input.slug)
  if (!title) err('전체', 'title이 비어 있어요')
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) err('전체', 'slug는 영문 소문자·숫자·하이픈만 써요')
  const gp = isObj(input.grammarPoint) && str(input.grammarPoint.code)
    ? { code: str(input.grammarPoint.code), title: str(input.grammarPoint.title) }
    : null

  const script: LectureScript = {
    version: 1,
    slug,
    title,
    grammarPoint: gp,
    targetMinutes: typeof input.targetMinutes === 'number' ? input.targetMinutes : 10,
    createdAt: str(input.createdAt) || new Date().toISOString(),
    slides,
    segments,
  }
  return { script: issues.some((i) => i.level === 'error') ? null : script, issues }
}

export function formatIssues(issues: ScriptIssue[]): string[] {
  return issues.map((i) => `${i.level === 'error' ? '✖' : '⚠'} [${i.where}] ${i.message}`)
}
