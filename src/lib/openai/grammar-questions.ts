// 문법 문항 AI — ① 기존 문항 → 포인트 태깅 제안 ② 포인트별 문항 생성
// 결과는 DB에 바로 쓰지 않는다. 저장은 호출한 서버 액션이 한다.

import { AI_CONTENT_MODEL, AI_MODEL } from '@/lib/openai/models'
import { EASY_EXPLANATION_RULES, levelLabel, requestJson } from '@/lib/openai/grammar-point-draft'
import {
  TAGGING_SYSTEM,
  buildTaggingUserPrompt,
  parseTaggingResponse,
  type TagResult,
  type TaggingPointInput,
  type TaggingQuestionInput,
} from '@/lib/grammar/question-tagging'
import {
  GENERATED_QUESTION_COUNT,
  GENERATION_FORMAT_RULES,
  REQUESTED_QUESTION_COUNT,
  REVIEW_SYSTEM,
  buildReviewUserPrompt,
  parseGeneratedQuestions,
  parseReviewResponse,
  questionDedupKeys,
  type ParsedGeneration,
} from '@/lib/grammar/question-generation'
import type { GrammarCommonError, GrammarExample, GrammarRule } from '@/types/grammar'

// ─── ① 태깅 제안 ─────────────────────────────────────────────────────────────

/** 문항 묶음(최대 TAG_BATCH_SIZE)을 포인트 목록과 함께 보내 포인트 코드·확신도를 받는다 (AI_MODEL — 단순·대량 작업) */
export async function suggestGrammarTags(
  questions: TaggingQuestionInput[],
  points: TaggingPointInput[],
): Promise<{ ok: true; results: TagResult[] } | { ok: false; error: string }> {
  if (questions.length === 0) return { ok: true, results: [] }
  const res = await requestJson(
    [
      { role: 'system', content: TAGGING_SYSTEM },
      { role: 'user', content: buildTaggingUserPrompt(questions, points) },
    ],
    // 문항당 {"n":12,"tested":"…","code":"G01-01-01","confidence":0.9} 약 40토큰
    questions.length * 60 + 300,
    { model: AI_MODEL, temperature: 0 },
  )
  if (!res.ok) return res
  const results = parseTaggingResponse(
    res.json,
    questions.map((q) => q.id),
    new Set(points.map((p) => p.code)),
  )
  return { ok: true, results }
}

// ─── ② 포인트별 문항 생성 ────────────────────────────────────────────────────

export interface GrammarQuestionGenInput {
  code: string
  title: string
  categoryName: string
  parentCategoryName: string | null
  levelMin: number
  levelMax: number
  summary: string | null
  rules: GrammarRule[]
  examples: GrammarExample[]
  commonErrors: GrammarCommonError[]
  /** 이 포인트에 이미 있는 문항의 contentJson — 겹치지 않게 프롬프트에 일부 넣고, 검증에서 중복 제거 */
  existingContents: unknown[]
  /** 기본 AI_CONTENT_MODEL. 학원 전용 생성(3-1)은 필요하면 다른 모델을 넘긴다 */
  model?: string
}

const GENERATION_SYSTEM = `너는 한국 영어학원의 문법 문제 출제자야. 주어진 문법 포인트 하나만 평가하는 문제를 만든다. 학생은 한국 중학생.
반드시 JSON 객체 하나로만 응답해.

${GENERATION_FORMAT_RULES}

해설·지시문 기준:
${EASY_EXPLANATION_RULES}`

const EXISTING_IN_PROMPT = 15

export async function generateGrammarQuestions(
  input: GrammarQuestionGenInput,
): Promise<({ ok: true } & ParsedGeneration) | { ok: false; error: string }> {
  const category = input.parentCategoryName ? `${input.parentCategoryName} > ${input.categoryName}` : input.categoryName
  const rules = input.rules.map((r) => `- ${r.text}${r.formula ? ` (${r.formula})` : ''}`).join('\n') || '(없음)'
  const examples = input.examples.slice(0, 8).map((e) => `- ${e.en} — ${e.ko}`).join('\n') || '(없음)'
  const errors =
    input.commonErrors.map((e) => `- ✗ ${e.wrong} → ✓ ${e.correct} (${e.reason})`).join('\n') || '(없음)'
  const existingKeys = input.existingContents.flatMap((c) => questionDedupKeys(c))
  const existing = input.existingContents
    .slice(0, EXISTING_IN_PROMPT)
    .map((c) => questionDedupKeys(c)[0])
    .filter(Boolean)
    .map((t) => `- ${t}`)
    .join('\n')

  const user = `아래 문법 포인트로 문제 ${REQUESTED_QUESTION_COUNT}개를 만들어줘.

- 포인트: ${input.code} ${input.title}
- 분류: ${category}
- 레벨 범위: ${levelLabel(input.levelMin)} ~ ${levelLabel(input.levelMax)} — difficulty는 ${input.levelMin}~${input.levelMax} 사이 숫자로, 쉬운 문제부터 고르게
- 요약: ${input.summary || '(없음)'}

## 핵심 규칙
${rules}

## 대표 예문 (그대로 쓰지 말고 비슷한 수준으로 새 문장을 만들 것)
${examples}

## 흔한 오류 (오답 보기에 활용)
${errors}
${existing ? `\n## 이미 있는 문제 (겹치지 않게)\n${existing}\n` : ''}`

  const model = input.model ?? AI_CONTENT_MODEL
  const res = await requestJson(
    [
      { role: 'system', content: GENERATION_SYSTEM },
      { role: 'user', content: user },
    ],
    4000,
    { model, temperature: 0.7 },
  )
  if (!res.ok) return res

  const parsed = parseGeneratedQuestions(res.json, {
    levelMin: input.levelMin,
    levelMax: input.levelMax,
    existingTexts: existingKeys,
    maxCount: REQUESTED_QUESTION_COUNT,
  })
  if (parsed.questions.length === 0) {
    return { ok: false, error: 'AI가 만든 문제가 형식 검사를 통과하지 못했습니다. 다시 시도해 주세요.' }
  }

  // 2차 검토: 정답이 둘 이상이거나 해설이 틀린 문항을 걸러낸다. 검토 호출이 실패하면 그대로 두고 관리자 검수에 맡긴다.
  let questions = parsed.questions
  let dropped = parsed.dropped
  const review = await requestJson(
    [
      { role: 'system', content: REVIEW_SYSTEM },
      { role: 'user', content: buildReviewUserPrompt(questions.map((q) => q.content)) },
    ],
    questions.length * 60 + 300,
    { model, temperature: 0 },
  )
  const verdicts = review.ok ? parseReviewResponse(review.json, questions.length) : null
  if (verdicts) {
    const kept = questions.filter((_, i) => verdicts[i].ok)
    dropped += questions.length - kept.length
    questions = kept
  } else {
    console.error('[grammar-questions] 2차 검토 실패, 검토 없이 저장', review.ok ? '형식 오류' : review.error)
  }

  if (questions.length === 0) {
    return { ok: false, error: 'AI가 만든 문제가 모두 검토에서 걸렸습니다(정답이 둘 이상 등). 다시 시도해 주세요.' }
  }
  dropped += Math.max(0, questions.length - GENERATED_QUESTION_COUNT)
  return { ok: true, questions: questions.slice(0, GENERATED_QUESTION_COUNT), dropped }
}
