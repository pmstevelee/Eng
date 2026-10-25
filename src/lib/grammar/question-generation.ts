// 문법 포인트별 AI 문항 생성 — 프롬프트 규칙·응답 검증 (순수 함수, DB·@/ 의존 없음)
//
// 생성 형식은 기존 채점기(answer-checker의 isAnswerMatch)가 그대로 채점할 수 있는 것만 쓴다.
//  - multiple_choice: 보기 4개(접두어 없이), correct_answer = "A"~"D"
//    (빈칸 고르기 · 어법상 틀린 것 찾기 · 바른 어순 고르기 모두 이 형식)
//  - fill_blank: 문장 속 "____" 한 칸, correct_answer = 한 단어(또는 짧은 구), 괄호로 기본형 힌트
// 저장 전에 "정답이 정답으로, 오답 보기가 오답으로 채점되는지" 자체 검사를 통과한 문항만 남긴다.
// 관리자 화면(본사 공용)과 3-1 학원 전용 생성이 같이 쓴다.

import { isAnswerMatch, normalizeAnswer } from '../assessment/answer-checker'

/** "AI로 생성" 1회 저장 문항 수 */
export const GENERATED_QUESTION_COUNT = 10

/** AI에 요청하는 문항 수 — 검토에서 몇 개 빠져도 10개를 채우도록 넉넉히 */
export const REQUESTED_QUESTION_COUNT = 12

export type GeneratedQuestionType = 'multiple_choice' | 'fill_blank'

/** 저장할 contentJson (Question.contentJson) */
export interface GeneratedQuestionContent {
  type: GeneratedQuestionType
  question_text: string
  question_text_ko?: string
  options?: string[]
  correct_answer: string
  explanation: string
}

export interface GeneratedQuestion {
  content: GeneratedQuestionContent
  /** 1~10, 포인트 레벨 범위 안 */
  difficulty: number
}

export interface ParsedGeneration {
  questions: GeneratedQuestion[]
  /** 형식 오류·중복·자체 채점 실패로 버린 수 */
  dropped: number
}

const LETTERS = ['A', 'B', 'C', 'D'] as const
const BLANK = /_{3,}/

// ─── 프롬프트 ────────────────────────────────────────────────────────────────

export const GENERATION_FORMAT_RULES = `형식 (JSON 객체 하나):
{
  "questions": [
    {
      "type": "multiple_choice",
      "kind": "blank | error | order",
      "question_text": "영어 문제 (빈칸은 ____ 로)",
      "question_text_ko": "학생에게 보여 줄 한국어 지시문 (예: 빈칸에 알맞은 것을 고르세요.)",
      "options": ["보기1", "보기2", "보기3", "보기4"],
      "correct_answer": "A",
      "explanation": "한국어 해설 1~2문장 — 왜 정답인지 + 오답이 왜 틀린지",
      "difficulty": 레벨 숫자
    },
    {
      "type": "fill_blank",
      "question_text": "She ____ (go) to school yesterday.",
      "question_text_ko": "괄호 안의 단어를 알맞은 형태로 바꿔 빈칸에 쓰세요.",
      "correct_answer": "went",
      "explanation": "한국어 해설",
      "difficulty": 레벨 숫자
    }
  ]
}

문항 구성 (questions 배열에 정확히 ${REQUESTED_QUESTION_COUNT}개):
- multiple_choice 빈칸 고르기(kind blank) 5개: 문장 속 ____ 한 칸, 보기 4개 중 정답 1개.
- multiple_choice 어법상 틀린 것 찾기(kind error) 2개: question_text는 "Which sentence is NOT correct?" 같은 지시, 보기는 완전한 문장 4개 중 틀린 문장이 정확히 1개, correct_answer는 그 틀린 문장의 문자.
- multiple_choice 바른 어순 고르기(kind order) 1개: 보기는 같은 단어로 만든 문장 4개 중 어순이 맞는 문장이 정확히 1개.
- fill_blank 4개: 문장 속 ____ 한 칸, 문장에 시제 단서를 꼭 넣고, 괄호 안 기본형을 바꿔 쓰는 문제. 정답은 한 가지로만 쓸 수 있어야 한다(축약형·다른 시제가 같이 맞으면 안 됨). correct_answer는 빈칸에 들어갈 말만.

보기·정답 규칙:
- options에는 "A)" 같은 문자 접두어를 붙이지 않는다. 보기 4개는 서로 달라야 한다.
- correct_answer는 multiple_choice면 "A"~"D" 중 하나. 정답 위치를 고르게 섞는다.
- 오답 보기는 한국 학생이 실제로 헷갈리는 형태(이 포인트의 흔한 오류)로 만든다. 정답이 두 개가 되면 안 된다.
- 이 포인트를 모르면 못 푸는 문제여야 한다. 다른 문법·어휘 지식으로 풀리는 문제는 만들지 않는다.
- 정답이 하나뿐이어야 한다. 시제·수·인칭에 따라 답이 갈리면 문장에 단서(yesterday, every day, now, last year, 주어의 수 등)를 꼭 넣는다.
  나쁜 예: "The song ____ by the choir." (is sung / was sung 둘 다 가능) → 좋은 예: "The song ____ by the choir last night." (was sung만 가능)
- 해설은 정답 근거(단서 포함)와 오답이 틀린 이유를 정답과 어긋나지 않게 쓴다.`

// ─── 검증 ────────────────────────────────────────────────────────────────────

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null
}

function str(value: unknown, max = 500): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : ''
}

/** "B", "b", "B)", "(B)", "B. were" → "B". 보기 본문과 같으면 그 보기 문자. 못 찾으면 null */
export function toAnswerLetter(raw: string, options: string[]): (typeof LETTERS)[number] | null {
  const s = raw.trim()
  const m = s.match(/^\(?([A-Da-d])\)?(?:[.)]|\s|$)/)
  if (m && (s.length <= 3 || /^\(?[A-Da-d][.)]\s/.test(s))) return LETTERS[m[1].toUpperCase().charCodeAt(0) - 65]
  const idx = options.findIndex((o) => normalizeAnswer(o) === normalizeAnswer(s))
  return idx >= 0 && idx < LETTERS.length ? LETTERS[idx] : null
}

/** 보기 앞의 "A) " 같은 접두어 제거 */
function stripPrefix(option: string): string {
  return option.replace(/^\(?[A-Da-d][.)]\s+/, '').trim()
}

function clampDifficulty(value: unknown, levelMin: number, levelMax: number, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(levelMax, Math.max(levelMin, Math.round(n)))
}

/** 레벨 범위 안에서 i번째 문항의 기본 난이도 (고르게 퍼뜨림) */
export function spreadDifficulty(i: number, count: number, levelMin: number, levelMax: number): number {
  if (levelMax <= levelMin || count <= 1) return levelMin
  return levelMin + Math.round((i * (levelMax - levelMin)) / (count - 1))
}

/**
 * 저장한 형식 그대로 기존 채점기로 채점해 본다.
 * 정답 보기(또는 정답 문자열)는 정답, 나머지 보기는 오답이어야 통과.
 */
export function selfGradeCheck(content: GeneratedQuestionContent): boolean {
  if (content.type === 'fill_blank') {
    return isAnswerMatch(content.correct_answer, content.correct_answer) && !isAnswerMatch('', content.correct_answer)
  }
  const options = content.options ?? []
  if (options.length !== 4) return false
  const correctIdx = LETTERS.indexOf(content.correct_answer as (typeof LETTERS)[number])
  if (correctIdx < 0) return false
  return options.every((opt, i) => {
    const byLetter = isAnswerMatch(LETTERS[i], content.correct_answer, options)
    const byText = isAnswerMatch(opt, content.correct_answer, options)
    return i === correctIdx ? byLetter && byText : !byLetter && !byText
  })
}

function parseOne(raw: unknown): GeneratedQuestionContent | null {
  const r = asRecord(raw)
  if (!r) return null
  const type = str(r.type, 30)
  const questionText = str(r.question_text, 600)
  const questionTextKo = str(r.question_text_ko, 200)
  const explanation = str(r.explanation, 600)
  if (!questionText || !explanation) return null

  if (type === 'multiple_choice') {
    const options = Array.isArray(r.options) ? r.options.map((o) => stripPrefix(str(o, 200))) : []
    if (options.length !== 4 || options.some((o) => !o)) return null
    if (new Set(options.map((o) => normalizeAnswer(o))).size !== 4) return null
    const letter = toAnswerLetter(str(r.correct_answer, 200), options)
    if (!letter) return null
    return {
      type,
      question_text: questionText,
      ...(questionTextKo ? { question_text_ko: questionTextKo } : {}),
      options,
      correct_answer: letter,
      explanation,
    }
  }

  if (type === 'fill_blank' || type === 'fill_in_blank') {
    const answer = str(r.correct_answer, 60)
    // 한 칸만, 정답은 짧게(최대 3단어), 보기 문자처럼 보이는 답 금지
    if (!answer || answer.split(' ').length > 3 || /^[A-Da-d]$/.test(answer)) return null
    if ((questionText.match(/_{3,}/g) ?? []).length !== 1 || !BLANK.test(questionText)) return null
    return {
      type: 'fill_blank',
      question_text: questionText,
      ...(questionTextKo ? { question_text_ko: questionTextKo } : {}),
      correct_answer: answer,
      explanation,
    }
  }
  return null
}

/**
 * AI 응답 → 저장할 문항. 형식이 틀리거나, 이미 있는 문항·같은 응답 안의 문항과 본문이 같거나,
 * 자체 채점에 실패한 문항은 버린다.
 */
export function parseGeneratedQuestions(
  json: unknown,
  opts: { levelMin: number; levelMax: number; existingTexts?: string[]; maxCount?: number },
): ParsedGeneration {
  const maxCount = opts.maxCount ?? GENERATED_QUESTION_COUNT
  const root = asRecord(json)
  const rows = root && Array.isArray(root.questions) ? root.questions.slice(0, maxCount * 2) : []
  const seen = new Set((opts.existingTexts ?? []).map((t) => normalizeAnswer(t)))
  const questions: GeneratedQuestion[] = []
  let dropped = 0

  rows.forEach((row, i) => {
    const content = parseOne(row)
    const key = content ? normalizeAnswer(`${content.question_text} ${(content.options ?? []).join(' ')}`) : ''
    const textKey = content ? normalizeAnswer(content.question_text) : ''
    const isDuplicate = content
      ? seen.has(key) || (content.type === 'fill_blank' && seen.has(textKey))
      : false
    if (!content || isDuplicate || !selfGradeCheck(content) || hasTenseAmbiguity(content) || questions.length >= maxCount) {
      dropped++
      return
    }
    seen.add(key)
    if (content.type === 'fill_blank') seen.add(textKey)
    const fallback = spreadDifficulty(i, rows.length, opts.levelMin, opts.levelMax)
    questions.push({
      content,
      difficulty: clampDifficulty(asRecord(row)?.difficulty, opts.levelMin, opts.levelMax, fallback),
    })
  })

  return { questions, dropped }
}

/** 중복 검사용 — 기존 문항 contentJson에서 비교 문자열 만들기 (parseGeneratedQuestions의 existingTexts) */
export function questionDedupKeys(contentJson: unknown): string[] {
  const c = asRecord(contentJson)
  if (!c) return []
  const text = str(c.question_text, 600)
  if (!text) return []
  const options = Array.isArray(c.options) ? c.options.map((o) => str(o, 200)) : []
  return options.length ? [`${text} ${options.join(' ')}`, text] : [text]
}

// ─── 시제 모호성 검사 ────────────────────────────────────────────────────────

/** 시점·빈도를 알려 주는 표현 — 있으면 현재/과거 중 하나로 정해진다 */
const TIME_CUE =
  /\b(yesterday|ago|last|tomorrow|next|now|today|tonight|every|usually|always|often|sometimes|never|already|just|yet|since|soon|later|then|recently|currently|these days|at the moment|in (?:1[89]|20)\d\d|this (?:morning|week|month|year))\b/i

const BE_SWAP: Record<string, string> = { is: 'was', was: 'is', are: 'were', were: 'are', am: 'was' }

function swapBe(text: string): string | null {
  const m = text.trim().toLowerCase().match(/^(is|was|are|were|am)\b(.*)$/)
  return m ? `${BE_SWAP[m[1]]}${m[2]}` : null
}

/**
 * 시제 단서 없이 현재·과거가 둘 다 맞을 수 있는 문항인지 (예: "The song ____ by the choir." is sung / was sung).
 * - 객관식: 정답의 be동사를 현재↔과거로 바꾼 형태가 다른 보기에 있고 문장에 시제 단서가 없음
 * - 빈칸 쓰기: 정답이 be동사로 시작하고 문장에 시제 단서가 없음
 */
export function hasTenseAmbiguity(content: GeneratedQuestionContent): boolean {
  if (TIME_CUE.test(content.question_text)) return false
  if (content.type === 'fill_blank') return swapBe(content.correct_answer) !== null
  const options = content.options ?? []
  const idx = LETTERS.indexOf(content.correct_answer as (typeof LETTERS)[number])
  if (idx < 0 || !BLANK.test(content.question_text)) return false
  const swapped = swapBe(options[idx] ?? '')
  return swapped !== null && options.some((o, i) => i !== idx && normalizeAnswer(o) === normalizeAnswer(swapped))
}

// ─── AI 검토(2차) ────────────────────────────────────────────────────────────

export const REVIEW_SYSTEM = `너는 영어 문법 문제 검토자야. 받은 문제를 하나씩 풀어 보고 학생에게 내도 되는지 판정한다.
반드시 JSON 객체 하나로만 응답해.

형식: { "results": [{ "n": 문제 번호, "other_answers": ["표시된 정답 말고도 맞는 보기 문자나 답 (없으면 빈 배열)"], "ok": true 또는 false, "issue": "문제가 있으면 이유 (한국어 한 문장), 없으면 빈 문자열" }] }

먼저 문제를 직접 풀고, 시제 단서(yesterday, every day, now 등)가 없으면 현재·과거 형태가 모두 맞는지 따져 other_answers에 적는다.

ok=false로 판정할 때:
- 표시된 정답이 문법적으로 틀렸다.
- 정답 말고 다른 보기도 맞을 수 있다 (시제·수 단서가 없어 둘 다 가능한 경우 포함).
- "틀린 문장 찾기"인데 틀린 문장이 0개이거나 2개 이상이다.
- 빈칸 쓰기에서 정답 말고 다른 형태(다른 시제, 축약형, 다른 단어)도 자연스럽게 맞을 수 있다.
- 해설이 정답과 어긋나거나 틀린 설명을 한다.
애매하면 ok=false. 받은 문제를 빠짐없이 한 번씩 적는다.`

/** 검토 요청 본문 — 번호는 questions 순서(1부터) */
export function buildReviewUserPrompt(questions: GeneratedQuestionContent[]): string {
  const lines = questions.map((q, i) => {
    const parts = [`${i + 1}. [${q.type === 'fill_blank' ? '빈칸 쓰기' : '객관식'}] ${q.question_text_ko ? `${q.question_text_ko} ` : ''}${q.question_text}`]
    if (q.options) parts.push(`   보기: ${q.options.map((o, j) => `${LETTERS[j]}) ${o}`).join(' / ')}`)
    parts.push(`   정답: ${q.correct_answer}`)
    parts.push(`   해설: ${q.explanation}`)
    return parts.join('\n')
  })
  return `아래 문제 ${questions.length}개를 검토해줘.\n\n${lines.join('\n\n')}`
}

/** 검토 결과 → 문항별 통과 여부. 검토가 빠진 문항은 통과(관리자 검수가 최종). 형식이 아예 틀리면 null */
export function parseReviewResponse(json: unknown, count: number): { ok: boolean; issue: string }[] | null {
  const root = asRecord(json)
  if (!root || !Array.isArray(root.results)) return null
  const out = Array.from({ length: count }, () => ({ ok: true, issue: '' }))
  const seen = new Set<number>()
  for (const row of root.results) {
    const r = asRecord(row)
    if (!r) continue
    const n = typeof r.n === 'number' ? r.n : Number(r.n)
    if (!Number.isInteger(n) || n < 1 || n > count || seen.has(n)) continue
    seen.add(n)
    const others = Array.isArray(r.other_answers) ? r.other_answers.filter((a) => str(a, 100)).length : 0
    if (r.ok === false || r.ok === 'false' || others > 0) {
      out[n - 1] = { ok: false, issue: str(r.issue, 200) || '정답이 둘 이상입니다.' }
    }
  }
  return out
}
