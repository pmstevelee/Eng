// 문법 콘텐츠 AI — 관리자 원고(스크립트)를 바탕으로 포인트 개념 정리 초안을 만들고, 원고의 빈 곳을 찾아 보완을 요청한다.
// 관리자 화면 전용. 결과는 DB에 바로 쓰지 않고 호출한 서버 액션이 저장 여부를 정한다.

import OpenAI from 'openai'
import { AI_CONTENT_MODEL, AI_FALLBACK_MODEL, completionParams } from '@/lib/openai/models'
import { getLevelInfo } from '@/lib/constants/levels'
import {
  parseCategoryAnalysis,
  parseGrammarPointDraft,
  type GrammarContentGapDraft,
  type GrammarPointDraft,
  type PointCoverageResult,
} from '@/lib/grammar/point-editing'

// ─── 공통 ────────────────────────────────────────────────────────────────────

const REQUEST_TIMEOUT_MS = 90_000

/** 학생이 이해하기 쉬운 설명·예문 기준 — 초안과 분석이 같이 쓴다 (강의 스크립트도 이 기준을 따를 것) */
const EASY_EXPLANATION_RULES = `- 대상은 한국 중학생. 설명·해석·이유는 모두 한국어, 문법 용어는 국내 교과서 용어(예: 과거분사, 관계대명사)를 쓰고 처음 나올 때 쉬운 말로 풀어 준다.
- 한 문장에 한 가지만 말한다. 규칙은 "언제 쓰는지 → 어떻게 만드는지 → 주의할 점" 순서로 쌓는다.
- 예문은 지정한 레벨 범위의 쉬운 어휘·짧은 문장으로 쓴다. 어려운 단어·고유명사·관용어는 쓰지 않는다.
- 예문은 학교·가족·친구·취미 같은 일상 주제로, 이 문법 포인트가 분명히 드러나야 한다. 이 포인트 밖의 문법은 넣지 않는다.
- 문법 설명은 정확해야 한다. "반드시", "항상" 같은 단정은 예외가 없을 때만 쓰고, 예외가 있으면 규칙에 함께 적는다.
- 한국어 해석은 번역투("~에 의해 ~되었다")를 줄이고 자연스럽게 쓴다.`

type ChatMessages = OpenAI.Chat.Completions.ChatCompletionMessageParam[]

/** 모델 설정·파라미터 문제로 거부된 경우 — 기본 모델로 한 번 더 시도할 만하다 */
function isRejectedByModel(e: unknown): boolean {
  return e instanceof OpenAI.APIError && !(e instanceof OpenAI.APIConnectionError) && (e.status === 400 || e.status === 404)
}

function failureReason(e: unknown): string {
  if (e instanceof OpenAI.APIConnectionTimeoutError) return 'AI 응답이 너무 오래 걸려 중단됐습니다. 다시 시도해 주세요.'
  if (e instanceof OpenAI.APIConnectionError) return 'AI 서비스에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.'
  if (e instanceof OpenAI.APIError) {
    if (e.status === 401 || e.status === 403) return 'AI 서비스 인증 오류입니다. OPENAI_API_KEY를 확인해 주세요.'
    if (e.status === 429) return 'AI 사용량이 많아 잠시 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.'
    return `AI 요청이 실패했습니다${e.status ? ` (오류 ${e.status})` : ''}. 다시 시도해 주세요.`
  }
  return 'AI 응답을 처리하지 못했습니다. 다시 시도해 주세요.'
}

/** JSON 응답 호출. 설정 모델이 거부하면 기본 모델로 한 번 재시도 */
async function requestJson(
  messages: ChatMessages,
  maxTokens: number,
): Promise<{ ok: true; json: unknown } | { ok: false; error: string }> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return { ok: false, error: 'OPENAI_API_KEY가 설정되지 않았습니다.' }
  const openai = new OpenAI({ apiKey, timeout: REQUEST_TIMEOUT_MS, maxRetries: 1 })

  const call = (model: string) =>
    openai.chat.completions.create({
      model,
      response_format: { type: 'json_object' },
      messages,
      ...completionParams(model, { maxTokens, temperature: 0.5 }),
    })

  let raw: string | null | undefined
  try {
    let completion
    try {
      completion = await call(AI_CONTENT_MODEL)
    } catch (e) {
      if (AI_CONTENT_MODEL === AI_FALLBACK_MODEL || !isRejectedByModel(e)) throw e
      console.error('[grammar-content] 모델 거부, 기본 모델로 재시도', { model: AI_CONTENT_MODEL })
      completion = await call(AI_FALLBACK_MODEL)
    }
    raw = completion.choices[0]?.message?.content
  } catch (e) {
    console.error('[grammar-content] OpenAI 호출 실패:', e)
    return { ok: false, error: failureReason(e) }
  }

  if (!raw) return { ok: false, error: 'AI 응답이 비어 있습니다. 다시 시도해 주세요.' }
  try {
    return { ok: true, json: JSON.parse(raw) }
  } catch {
    return { ok: false, error: 'AI 응답 형식이 올바르지 않습니다. 다시 시도해 주세요.' }
  }
}

function levelLabel(level: number): string {
  const info = getLevelInfo(level)
  return `Level ${info.level}(${info.cefr})`
}

// ─── 포인트 개념 정리 초안 ───────────────────────────────────────────────────

export interface GrammarPointDraftInput {
  code: string
  title: string
  categoryName: string
  parentCategoryName: string | null
  levelMin: number
  levelMax: number
  /** 선수 포인트 제목 — 이미 배운 내용으로 안내 */
  prerequisiteTitles: string[]
  /** formatScriptsForPrompt로 합친 관리자 원고 (없으면 빈 문자열) */
  sourceText: string
}

export type GrammarPointDraftResult =
  | { ok: true; draft: GrammarPointDraft; gaps: GrammarContentGapDraft[] }
  | { ok: false; error: string }

const DRAFT_SYSTEM = `너는 한국 영어학원의 문법 교재 집필자야. 관리자가 준 "원고"를 바탕으로, 한국 중학생이 혼자 읽고 이해할 수 있는 문법 개념 정리를 쓴다.
반드시 JSON 객체 하나로만 응답해. 다른 텍스트는 넣지 마.

형식:
{
  "summary": "이 문법 포인트를 한 문장으로 요약 (한국어, 80자 이내)",
  "rules": [{ "text": "핵심 규칙 한 줄 (한국어)", "formula": "형태 공식 (선택, 예: be + p.p.)" }],
  "examples": [{ "en": "영어 예문", "ko": "자연스러운 한국어 해석", "highlight": "예문 속에서 강조할 부분 (예문에 실제로 있는 문자열)" }],
  "commonErrors": [{ "wrong": "한국 학생이 자주 쓰는 틀린 문장", "correct": "고친 문장", "reason": "왜 틀렸는지 (한국어, 1~2문장)" }],
  "gaps": [{ "message": "원고에서 부족한 부분 (한국어)", "request": "관리자에게 보내 달라고 할 보완 원고 내용 (한국어, 구체적으로)" }]
}

원고 사용 규칙:
- 원고의 설명·용어·예문·순서를 최우선으로 따른다. 원고와 다른 설명을 하지 않는다.
- 원고 예문은 살리고, 부족한 수만큼 같은 수준의 예문을 더 만든다.
- 원고에 이 포인트 설명이 없거나, 규칙·예외·흔한 실수 중 빠진 것이 있으면 일반적인 문법 지식으로 채우되 그 부분을 gaps에 적는다.
- 원고가 충분하면 gaps는 빈 배열.

분량:
- rules 3~5개, commonErrors 3~4개.
- examples 6~10개. 한 가지 문장만 반복하지 말고 긍정문·부정문·의문문, 여러 주어(I/you/he/they 등), 해당되면 여러 시제를 고루 섞는다. 모든 예문에 highlight를 넣는다.

쉬운 설명 기준:
${EASY_EXPLANATION_RULES}`

/** 관리자 원고를 바탕으로 summary·rules·examples·commonErrors 초안 + 원고 보완 요청(gaps) 생성 */
export async function generateGrammarPointDraft(input: GrammarPointDraftInput): Promise<GrammarPointDraftResult> {
  const prereq = input.prerequisiteTitles.length ? input.prerequisiteTitles.join(', ') : '없음'
  const category = input.parentCategoryName ? `${input.parentCategoryName} > ${input.categoryName}` : input.categoryName
  const source = input.sourceText.trim()
    ? input.sourceText
    : '(관리자 원고가 아직 없습니다. 일반적인 문법 지식으로 쓰고, gaps에 "이 포인트 원고 없음"과 필요한 원고 내용을 적어 주세요.)'

  const user = `아래 문법 포인트의 개념 정리 초안을 만들어줘.

- 포인트 코드: ${input.code}
- 분류: ${category}
- 포인트 제목: ${input.title}
- 레벨 범위: ${levelLabel(input.levelMin)} ~ ${levelLabel(input.levelMax)}
- 먼저 배운 포인트(설명에서 아는 것으로 가정해도 됨): ${prereq}

## 관리자 원고
${source}`

  const res = await requestJson(
    [
      { role: 'system', content: DRAFT_SYSTEM },
      { role: 'user', content: user },
    ],
    3000,
  )
  if (!res.ok) return res

  const parsed = parseGrammarPointDraft(res.json)
  if (!parsed) return { ok: false, error: 'AI 응답에 필요한 항목(요약·규칙·예문 4개 이상·흔한 오류)이 빠져 있습니다. 다시 시도해 주세요.' }
  const { gaps, ...draft } = parsed
  return { ok: true, draft, gaps }
}

// ─── 분류 원고 분석 (보완 요청) ──────────────────────────────────────────────

export interface CategoryAnalysisInput {
  categoryCode: string
  categoryName: string
  parentCategoryName: string | null
  points: { code: string; title: string; levelMin: number; levelMax: number }[]
  sourceText: string
}

export type CategoryAnalysisResult = { ok: true; points: PointCoverageResult[] } | { ok: false; error: string }

const ANALYZE_SYSTEM = `너는 한국 영어학원의 문법 교재 편집자야. 관리자가 쓴 문법 설명 원고를 검토해서, 포인트마다 학생 강의·개념 정리를 만들기에 원고가 충분한지 판단하고 부족한 부분은 관리자에게 보완을 요청한다.
반드시 JSON 객체 하나로만 응답해.

형식:
{
  "points": [
    {
      "code": "포인트 코드 (받은 목록 그대로)",
      "coverage": "ENOUGH | PARTIAL | MISSING",
      "gaps": [{ "message": "부족한 부분 (한국어, 구체적으로)", "request": "보완 원고에 담아 달라는 내용 (한국어, 예: '부정문·의문문 만드는 법과 예문 3개')" }]
    }
  ]
}

판단 기준:
- ENOUGH: 언제 쓰는지, 형태(만드는 법), 주의할 점·예외, 예문 3개 이상이 원고에 있다.
- PARTIAL: 일부는 있지만 위 항목 중 빠진 것이 있거나 설명이 학생에게 어렵다.
- MISSING: 이 포인트를 다루는 내용이 원고에 거의 없다.
- 받은 포인트를 빠짐없이 한 번씩 적는다. ENOUGH면 gaps는 빈 배열, 아니면 1~3개.
- request는 관리자가 바로 쓸 수 있게 구체적으로 적는다. 막연한 "더 자세히"는 쓰지 않는다.

학생용 설명 기준(이 기준에 못 미치면 PARTIAL):
${EASY_EXPLANATION_RULES}`

/** 중분류 원고를 포인트별로 검토해 충분도와 보완 요청을 돌려준다 */
export async function analyzeCategoryScripts(input: CategoryAnalysisInput): Promise<CategoryAnalysisResult> {
  if (input.points.length === 0) return { ok: false, error: '분석할 포인트가 없습니다.' }
  if (!input.sourceText.trim()) return { ok: false, error: '분석할 원고가 없습니다. 원고를 먼저 추가해 주세요.' }

  const category = input.parentCategoryName ? `${input.parentCategoryName} > ${input.categoryName}` : input.categoryName
  const pointList = input.points
    .map((p) => `- ${p.code} ${p.title} (${levelLabel(p.levelMin)}~${levelLabel(p.levelMax)})`)
    .join('\n')

  const user = `분류 ${input.categoryCode} ${category}의 원고를 검토해줘.

## 포인트 목록
${pointList}

## 관리자 원고
${input.sourceText}`

  const res = await requestJson(
    [
      { role: 'system', content: ANALYZE_SYSTEM },
      { role: 'user', content: user },
    ],
    3000,
  )
  if (!res.ok) return res

  const points = parseCategoryAnalysis(
    res.json,
    input.points.map((p) => p.code),
  )
  if (!points || points.length === 0) return { ok: false, error: 'AI 분석 결과 형식이 올바르지 않습니다. 다시 시도해 주세요.' }
  return { ok: true, points }
}
