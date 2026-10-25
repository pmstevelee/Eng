// 문법 포인트 개념 정리 AI 초안 — 관리자 편집 화면 전용 (DB 저장 안 함)

import OpenAI from 'openai'
import { AI_MODEL, completionParams } from '@/lib/openai/models'
import { getLevelInfo } from '@/lib/constants/levels'
import { parseGrammarPointDraft, type GrammarPointDraft } from '@/lib/grammar/point-editing'

export interface GrammarPointDraftInput {
  code: string
  title: string
  categoryName: string
  parentCategoryName: string | null
  levelMin: number
  levelMax: number
  /** 선수 포인트 제목 — 이미 배운 내용으로 안내 */
  prerequisiteTitles: string[]
}

export type GrammarPointDraftResult = { ok: true; draft: GrammarPointDraft } | { ok: false; error: string }

function levelLabel(level: number): string {
  const info = getLevelInfo(level)
  return `Level ${info.level}(${info.cefr})`
}

function buildPrompts(input: GrammarPointDraftInput): { system: string; user: string } {
  const system = `너는 한국 영어학원의 문법 교재 집필자야. 한국 중학생이 혼자 읽고 이해할 수 있는 문법 개념 정리를 쓴다.
반드시 JSON 객체 하나로만 응답해. 다른 텍스트는 넣지 마.

형식:
{
  "summary": "이 문법 포인트를 한 문장으로 요약 (한국어, 80자 이내)",
  "rules": [{ "text": "핵심 규칙 한 줄 (한국어)", "formula": "형태 공식 (선택, 예: be + p.p.)" }],
  "examples": [{ "en": "영어 예문", "ko": "자연스러운 한국어 해석", "highlight": "예문 속에서 강조할 부분 (예문에 실제로 있는 문자열)" }],
  "commonErrors": [{ "wrong": "한국 학생이 자주 쓰는 틀린 문장", "correct": "고친 문장", "reason": "왜 틀렸는지 (한국어, 1~2문장)" }]
}

규칙:
- 대상은 한국 중학생. 설명·해석·이유는 모두 한국어, 문법 용어는 국내 교과서 용어(예: 과거분사, 관계대명사)를 쓴다.
- rules 3~5개, examples 4~6개, commonErrors 3~4개.
- 예문은 지정한 레벨 범위의 어휘·문장 길이로 제한한다. 어려운 단어·고유명사·관용어는 쓰지 않는다.
- 예문은 학교·가족·친구·취미 같은 일상 주제로, 이 문법 포인트가 분명히 드러나야 한다.
- 이 포인트 밖의 문법(아직 배우지 않은 구조)은 예문에 넣지 않는다.
- commonErrors는 한국어 간섭으로 생기는 실제 실수 위주로 쓴다.
- 문법 설명은 정확해야 한다. "반드시", "항상" 같은 단정은 예외가 없을 때만 쓰고, 예외가 있으면 규칙에 함께 적는다.
- 한국어 해석은 번역투("~에 의해 ~되었다")를 줄이고 자연스럽게 쓴다.`

  const prereq = input.prerequisiteTitles.length ? input.prerequisiteTitles.join(', ') : '없음'
  const category = input.parentCategoryName ? `${input.parentCategoryName} > ${input.categoryName}` : input.categoryName

  const user = `아래 문법 포인트의 개념 정리 초안을 만들어줘.

- 포인트 코드: ${input.code}
- 분류: ${category}
- 포인트 제목: ${input.title}
- 레벨 범위: ${levelLabel(input.levelMin)} ~ ${levelLabel(input.levelMax)}
- 먼저 배운 포인트(설명에서 아는 것으로 가정해도 됨): ${prereq}`

  return { system, user }
}

/** GPT로 summary·rules·examples·commonErrors 초안 생성. 응답 형식이 틀리면 ok:false */
export async function generateGrammarPointDraft(input: GrammarPointDraftInput): Promise<GrammarPointDraftResult> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return { ok: false, error: 'OPENAI_API_KEY가 설정되지 않았습니다.' }

  const openai = new OpenAI({ apiKey })
  const { system, user } = buildPrompts(input)

  let raw: string | null | undefined
  try {
    const completion = await openai.chat.completions.create({
      model: AI_MODEL,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      ...completionParams(AI_MODEL, { maxTokens: 2000, temperature: 0.5 }),
    })
    raw = completion.choices[0]?.message?.content
  } catch (error) {
    console.error('[grammar-point-draft] OpenAI 호출 실패:', error)
    return { ok: false, error: 'AI 초안 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.' }
  }

  if (!raw) return { ok: false, error: 'AI 응답이 비어 있습니다. 다시 시도해 주세요.' }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { ok: false, error: 'AI 응답 형식이 올바르지 않습니다. 다시 시도해 주세요.' }
  }

  const draft = parseGrammarPointDraft(parsed)
  if (!draft) return { ok: false, error: 'AI 응답에 필요한 항목이 빠져 있습니다. 다시 시도해 주세요.' }
  return { ok: true, draft }
}
