// 문제 해설 보강 — 보기마다 "왜 맞는지 / 왜 틀린지"를 한 번 만들어 문제 contentJson.ai_explanation에 저장해 재사용한다.
// 학생 화면(오늘의 문법 미션)에서 정답 확인 후 호출. 문제당 1회만 생성되므로 기본 모델(AI_MODEL), 크레딧 차감 없음.

import { createHash } from 'crypto'
import { AI_MODEL } from '@/lib/openai/models'
import { requestJson, EASY_EXPLANATION_RULES } from '@/lib/openai/grammar-point-draft'
import { isAnswerMatch } from '@/lib/assessment/answer-checker'

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']

/** contentJson.ai_explanation 저장 형식 */
export interface StoredAiExplanation {
  /** 문제·보기·정답이 바뀌면 다시 만들도록 하는 지문(fingerprint) */
  key: string
  /** 문제 전체 해설 (원래 해설이 없을 때 보여 준다) */
  summary: string
  /** 보기 순서대로 각 보기가 왜 맞고 틀린지 */
  options: string[]
  model: string
}

export interface ExplainableContent {
  type?: string
  question_text?: string
  question_text_ko?: string
  passage?: string
  options?: string[]
  correct_answer?: string
  explanation?: string
  ai_explanation?: unknown
}

/** 보기 중 정답의 위치. 보기가 없거나 찾지 못하면 null */
export function findCorrectOptionIndex(content: ExplainableContent): number | null {
  const options = content.options ?? []
  const correct = content.correct_answer ?? ''
  if (options.length === 0 || !correct) return null
  for (let i = 0; i < options.length; i++) {
    if (isAnswerMatch(LETTERS[i] ?? String(i + 1), correct, options)) return i
  }
  return null
}

export function explanationKey(content: ExplainableContent): string {
  const src = JSON.stringify([
    content.question_text ?? '',
    content.passage ?? '',
    content.options ?? [],
    content.correct_answer ?? '',
    content.explanation ?? '',
  ])
  return createHash('sha1').update(src).digest('hex').slice(0, 16)
}

/** 저장된 해설이 지금 문제와 맞으면 반환 */
export function readStoredExplanation(content: ExplainableContent): StoredAiExplanation | null {
  const raw = content.ai_explanation
  if (!raw || typeof raw !== 'object') return null
  const s = raw as Partial<StoredAiExplanation>
  if (s.key !== explanationKey(content)) return null
  if (typeof s.summary !== 'string' || !Array.isArray(s.options)) return null
  if (s.options.length !== (content.options ?? []).length) return null
  if (!s.options.every((o) => typeof o === 'string')) return null
  return s as StoredAiExplanation
}

const SYSTEM = `너는 한국 중학생을 가르치는 영어 선생님이다. 학생이 방금 푼 문제의 해설을 쓴다.
${EASY_EXPLANATION_RULES}
- 정답은 주어진 정답이 기준이다. 정답을 바꾸거나 의심하지 않는다. 원래 해설이 있으면 그 설명과 다르게 말하지 않는다.
- summary: 이 문제가 묻는 문법 포인트와 정답인 이유를 2~3문장으로. 핵심 규칙을 한 번 짚는다.
- options: 보기 순서 그대로, 보기마다 1~2문장.
  - 정답 보기: 왜 맞는지 (문장 속 단서 → 규칙 → 그래서 이 형태).
  - 오답 보기: 왜 틀린지 구체적으로 (어떤 규칙에 어긋나는지, 이 보기를 쓰려면 문장이 어떻게 달라야 하는지 등). "정답이 아니에요"처럼 이유 없는 말은 쓰지 않는다.
  - 다른 문장에서는 쓸 수 있는 보기라면 "이 문장에서는"으로 한정해 말하고, 아예 못 쓰는 것처럼 말하지 않는다.
  - 보기 앞에 "A:", "정답:" 같은 머리말은 붙이지 않는다.
- "~해요"체. 영어 단어·표현은 그대로 쓴다.
- {"summary": "...", "options": ["...", "..."]} JSON으로만 답한다.`

function buildUserMessage(content: ExplainableContent, correctIdx: number | null): string {
  const lines: string[] = []
  if (content.passage) lines.push(`지문:\n${content.passage.slice(0, 2500)}`)
  lines.push(`문제: ${content.question_text ?? ''}`)
  if (content.question_text_ko) lines.push(`문제 해석: ${content.question_text_ko}`)
  const options = content.options ?? []
  if (options.length > 0) {
    lines.push('보기:')
    options.forEach((o, i) => lines.push(`${LETTERS[i] ?? i + 1}. ${o}`))
    lines.push(
      `정답: ${correctIdx !== null ? `${LETTERS[correctIdx]}. ${options[correctIdx]}` : content.correct_answer ?? ''}`,
    )
  } else {
    lines.push(`정답: ${content.correct_answer ?? ''}`)
  }
  if (content.explanation) lines.push(`원래 해설: ${content.explanation}`)
  lines.push(`options 배열 길이: ${options.length}`)
  return lines.join('\n')
}

/** AI가 붙인 "A.", "(B)", "C:", "정답:" 같은 머리말 제거 */
function stripLabel(text: string): string {
  return text
    .trim()
    .replace(/^\(?[A-Ha-h1-8]\)?\s*[.:)]\s*/, '')
    .replace(/^(정답|오답)\s*[:：]\s*/, '')
    .trim()
}

export async function generateQuestionExplanation(
  content: ExplainableContent,
): Promise<{ ok: true; data: StoredAiExplanation } | { ok: false; error: string }> {
  const options = content.options ?? []
  const correctIdx = findCorrectOptionIndex(content)
  const res = await requestJson(
    [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: buildUserMessage(content, correctIdx) },
    ],
    300 + options.length * 200,
    { model: AI_MODEL, temperature: 0.3 },
  )
  if (!res.ok) return res

  const json = res.json as { summary?: unknown; options?: unknown }
  const summary = typeof json.summary === 'string' ? json.summary.trim() : ''
  const opts = Array.isArray(json.options)
    ? json.options.map((o) => (typeof o === 'string' ? stripLabel(o) : ''))
    : []
  if (!summary || opts.length !== options.length || opts.some((o) => !o)) {
    return { ok: false, error: 'AI 해설 형식이 올바르지 않습니다.' }
  }
  return {
    ok: true,
    data: { key: explanationKey(content), summary, options: opts, model: AI_MODEL },
  }
}
