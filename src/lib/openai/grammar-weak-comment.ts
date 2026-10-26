// 취약 포인트 AI 코멘트 — 포인트 규칙 + 학생의 틀린 문장 → "어떤 오류 패턴인지 + 다시 볼 선수 포인트" 2~3문장
// 학생 수만큼 호출되므로 기본 모델(AI_MODEL). 크레딧은 차감하지 않는다(2026-10-26 결정).

import { AI_MODEL } from '@/lib/openai/models'
import { requestJson } from '@/lib/openai/grammar-point-draft'
import { parseWeakComment } from '@/lib/grammar/weekly-report-logic'
import type { GrammarCommonError, GrammarRule } from '@/types/grammar'

export interface WeakCommentSample {
  question: string
  myAnswer: string
  correctAnswer: string
}

export interface WeakCommentInput {
  pointTitle: string
  summary: string | null
  rules: GrammarRule[]
  commonErrors: GrammarCommonError[]
  /** 선수 포인트 제목 — 이 목록에서만 다시 볼 것을 고른다 */
  prerequisiteTitles: string[]
  samples: WeakCommentSample[]
}

const SYSTEM = `너는 한국 중학생을 가르치는 영어 문법 선생님이다. 학생이 틀린 문제를 보고 짧은 코멘트를 쓴다.
- 2~3문장, 한국어, "~해요"체. 학생과 담당 선생님이 함께 읽는다.
- 1문장: 학생 답과 정답을 비교해 실제로 보이는 실수를 구체적으로 짚는다. 실수가 여러 종류면 가장 많은 것 1~2개만 말한다.
  좋은 예: "be동사를 빼고 동사만 쓰거나(made), 과거분사 대신 과거형(wrote)을 쓰는 실수가 반복돼요."
  나쁜 예: "수동태를 제대로 사용하지 못해요." (무엇이 틀렸는지 안 보임)
- 2문장: 그 실수를 고치려면 무엇을 기억하면 되는지 규칙 한 가지로 말한다.
- 선수 포인트 목록에 그 실수와 직접 관련된 것이 있을 때만, 목록의 제목 그대로 "'제목'을 다시 보면 좋아요"처럼 3문장으로 권한다. 목록에 없는 단원 이름은 만들지 않는다.
- 아래 규칙과 다른 설명을 하지 않는다. "주어진 규칙", "목록" 같은 말은 쓰지 않는다. "항상", "반드시"는 쓰지 않는다. 꾸중하거나 겁주는 말은 쓰지 않는다.
- {"comment": "..."} JSON으로만 답한다.`

function buildUserMessage(input: WeakCommentInput): string {
  const lines: string[] = [`포인트: ${input.pointTitle}`]
  if (input.summary) lines.push(`요약: ${input.summary}`)
  if (input.rules.length > 0) {
    lines.push('규칙:')
    input.rules.forEach((r, i) => lines.push(`${i + 1}. ${r.text}${r.formula ? ` (${r.formula})` : ''}`))
  }
  if (input.commonErrors.length > 0) {
    lines.push('흔한 오류:')
    input.commonErrors.slice(0, 4).forEach((e) => lines.push(`- ${e.wrong} → ${e.correct} (${e.reason})`))
  }
  lines.push(`선수 포인트: ${input.prerequisiteTitles.length > 0 ? input.prerequisiteTitles.map((t) => `'${t}'`).join(', ') : '없음'}`)
  lines.push('학생이 틀린 문제:')
  input.samples.forEach((s, i) => lines.push(`${i + 1}. 문제: ${s.question}\n   학생 답: ${s.myAnswer}\n   정답: ${s.correctAnswer}`))
  return lines.join('\n')
}

export async function generateWeakComment(
  input: WeakCommentInput,
): Promise<{ ok: true; comment: string; model: string } | { ok: false; error: string }> {
  const res = await requestJson(
    [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: buildUserMessage(input) },
    ],
    400,
    { model: AI_MODEL, temperature: 0.3 },
  )
  if (!res.ok) return res
  const comment = parseWeakComment(res.json)
  if (!comment) return { ok: false, error: 'AI 응답 형식이 올바르지 않습니다.' }
  return { ok: true, comment, model: AI_MODEL }
}
