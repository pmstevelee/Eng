// 기존 문법 문항 → 문법 포인트 자동 태깅 — 프롬프트 조립·AI 응답 검증 (순수 함수, DB·@/ 의존 없음)
//
// 흐름: 미분류 문항 50개씩 AI에 보내 포인트 코드·확신도를 받는다 → GrammarTagSuggestion(PENDING)에 저장
// → 관리자가 /admin/grammar/tagging에서 확정하면 Question.grammarPointId가 채워진다.
// 비용 절감: 문항을 subCategory 순으로 묶고, 같은 subCategory 문자열은 묶음 머리에 한 번만 적는다.

/** 한 번의 AI 호출에 보내는 문항 수 */
export const TAG_BATCH_SIZE = 50

/** 이 확신도 이상이면 "일괄 확정" 대상 */
export const AUTO_ACCEPT_CONFIDENCE = 0.8

/** 프롬프트에 넣는 문항 본문 최대 글자 수 (긴 지문 문항 비용 방지) */
const QUESTION_TEXT_MAX = 300
const OPTION_TEXT_MAX = 60

export interface TaggingQuestionInput {
  id: string
  subCategory: string | null
  contentJson: unknown
}

export interface TaggingPointInput {
  code: string
  title: string
  /** 대분류 › 중분류 */
  group: string
}

export interface TagResult {
  questionId: string
  /** null: AI가 맞는 포인트를 못 찾음 */
  code: string | null
  /** 0~1 */
  confidence: number
}

// ─── 문항 미리보기 ───────────────────────────────────────────────────────────

export interface QuestionPreview {
  type: string
  text: string
  textKo: string | null
  options: string[]
  /** 정답 표시용 (보기 문자면 보기 본문까지) */
  answer: string | null
  /** 정답 보기 인덱스 (객관식, 없으면 -1) */
  answerIndex: number
  explanation: string | null
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null
}

function str(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function clip(text: string, max: number): string {
  const oneLine = text.replace(/\s+/g, ' ').trim()
  return oneLine.length > max ? `${oneLine.slice(0, max)}…` : oneLine
}

/** contentJson에서 화면·프롬프트에 쓸 부분만 꺼낸다 (형식이 깨진 데이터도 안전하게) */
export function getQuestionPreview(contentJson: unknown): QuestionPreview {
  const c = asRecord(contentJson) ?? {}
  const options = Array.isArray(c.options) ? c.options.map((o) => str(o)).filter(Boolean) : []
  const answer = str(c.correct_answer) || null
  let answerIndex = -1
  if (answer && options.length > 0) {
    const letter = answer.match(/^\(?([A-Ha-h])\)?[.)]?$/)
    if (letter) answerIndex = letter[1].toUpperCase().charCodeAt(0) - 65
    else answerIndex = options.findIndex((o) => o.toLowerCase() === answer.toLowerCase())
    if (answerIndex >= options.length) answerIndex = -1
  }
  const passage = str(c.passage)
  const text = str(c.question_text)
  return {
    type: str(c.type) || 'unknown',
    text: passage ? `${passage}\n\n${text}` : text,
    textKo: str(c.question_text_ko) || null,
    options,
    answer,
    answerIndex,
    explanation: str(c.explanation) || null,
  }
}

// ─── 프롬프트 ────────────────────────────────────────────────────────────────

export const TAGGING_SYSTEM = `너는 한국 영어학원의 문법 문항 분류 담당자야. 문항마다 정답을 가르는 문법이 무엇인지 먼저 적고, 그 문법을 다루는 포인트 하나를 포인트 목록에서 고른다.
반드시 JSON 객체 하나로만 응답해.

형식:
{ "results": [{ "n": 문항 번호, "tested": "정답을 가르는 문법 (한국어 20자 이내)", "code": "포인트 코드 또는 null", "confidence": 0~1 }] }

규칙:
- 받은 문항을 빠짐없이 한 번씩, 문항마다 따로 판단한다. 같은 "기존 분류" 아래 문항이라도 서로 다른 포인트일 수 있다.
- "기존 분류"는 출처 교재의 단원명이라 틀리거나 여러 문법이 섞여 있다. 참고만 하고 문항 내용으로 판단한다.
- tested는 보기들을 비교했을 때 정답과 오답을 가르는 것을 적는다 (예: "1형 조건문 if + 현재", "주어-동사 수일치 3인칭 단수", "구동사 look after").
- code는 tested를 직접 다루는 포인트만 고른다. 포인트 목록에 없는 내용(구동사·숙어·어휘 뜻·철자·독해)이면 null. "8품사 한눈에 보기"처럼 넓은 개요 포인트로 대신하지 않는다.
- confidence: 포인트 제목이 tested를 그대로 가리키면 0.9 이상, 관련은 있지만 다른 포인트일 수도 있으면 0.5~0.7, 추측이면 0.4 이하. null이면 0.`

/** 포인트 목록 — 중분류마다 한 줄 머리 + 포인트 코드·제목 */
export function formatPointList(points: TaggingPointInput[]): string {
  const lines: string[] = []
  let group = ''
  for (const p of points) {
    if (p.group !== group) {
      group = p.group
      lines.push(`[${group}]`)
    }
    lines.push(`${p.code} ${p.title}`)
  }
  return lines.join('\n')
}

function formatQuestionLine(n: number, contentJson: unknown): string {
  const p = getQuestionPreview(contentJson)
  const parts = [`${n}. ${clip(p.text, QUESTION_TEXT_MAX) || '(본문 없음)'}`]
  if (p.options.length > 0) {
    parts.push(`보기: ${p.options.map((o, i) => `${String.fromCharCode(65 + i)}) ${clip(o, OPTION_TEXT_MAX)}`).join(' / ')}`)
  }
  if (p.answer) {
    const answerText = p.answerIndex >= 0 ? `${p.answer} (${clip(p.options[p.answerIndex], OPTION_TEXT_MAX)})` : p.answer
    parts.push(`정답: ${answerText}`)
  }
  return parts.join(' | ')
}

/**
 * 문항 묶음을 프롬프트 본문으로. 같은 subCategory는 "## 기존 분류: …" 머리 아래에 모아 한 번만 적는다.
 * 문항 번호(n)는 questions 배열 순서(1부터)이고, parseTaggingResponse가 같은 순서로 되돌린다.
 */
export function buildTaggingUserPrompt(questions: TaggingQuestionInput[], points: TaggingPointInput[]): string {
  const groups = new Map<string, number[]>()
  questions.forEach((q, i) => {
    const key = q.subCategory?.trim() || '(없음)'
    groups.set(key, [...(groups.get(key) ?? []), i])
  })

  const blocks = Array.from(groups.entries()).map(([sub, indexes]) => {
    const lines = indexes.map((i) => formatQuestionLine(i + 1, questions[i].contentJson))
    return `## 기존 분류(참고): ${sub}\n${lines.join('\n')}`
  })

  return `아래 문법 문항 ${questions.length}개를 포인트 목록에서 하나씩 골라 분류해줘.

# 포인트 목록
${formatPointList(points)}

# 문항
${blocks.join('\n\n')}`
}

/** AI 응답 검증 — 문항 순서대로 결과를 돌려준다. 빠진 문항은 code null·confidence 0 */
export function parseTaggingResponse(
  json: unknown,
  questionIds: string[],
  validCodes: ReadonlySet<string>,
): TagResult[] {
  const root = asRecord(json)
  const rows = root && Array.isArray(root.results) ? root.results : []
  const byIndex = new Map<number, { code: string | null; confidence: number }>()

  for (const row of rows) {
    const r = asRecord(row)
    if (!r) continue
    const n = typeof r.n === 'number' ? r.n : Number(r.n)
    if (!Number.isInteger(n) || n < 1 || n > questionIds.length || byIndex.has(n)) continue
    const rawCode = str(r.code).toUpperCase()
    const code = rawCode && validCodes.has(rawCode) ? rawCode : null
    const rawConf = typeof r.confidence === 'number' ? r.confidence : Number(r.confidence)
    const confidence = code && Number.isFinite(rawConf) ? Math.min(1, Math.max(0, rawConf)) : 0
    byIndex.set(n, { code, confidence: Math.round(confidence * 100) / 100 })
  }

  return questionIds.map((questionId, i) => {
    const hit = byIndex.get(i + 1)
    return { questionId, code: hit?.code ?? null, confidence: hit?.confidence ?? 0 }
  })
}
