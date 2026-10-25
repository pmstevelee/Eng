// AI 강의 스크립트 생성 (관리자 전용) — 관리자 원고·개념 정리로 장면 목록을 만들거나, 붙여넣은 대본을 장면으로 나눈다.
// 결과는 DB에 쓰지 않는다. 저장·보완 요청 기록은 호출한 서버 액션(lecture-script-actions.ts)이 한다.

import { EASY_EXPLANATION_RULES, requestJson } from '@/lib/openai/grammar-point-draft'
import { formatVideoSceneErrors, parseVideoScenes, type VideoScene } from '@/types/grammar-video'
import sample from './samples/passive-voice.json'
import {
  buildConvertSystemPrompt,
  buildConvertUserPrompt,
  buildGenerateUserPrompt,
  buildRetryMessage,
  buildScriptSystemPrompt,
  checkScriptStructure,
  compareNarration,
  fillConvertedNarration,
  normalizeAiScript,
  repairReveals,
  splitScriptSentences,
  scenesWithFewExamples,
  type NarrationDiff,
  type ScriptAudience,
  type ScriptGapDraft,
  type ScriptPointInfo,
} from './script-prompt'

const EXAMPLE_JSON = JSON.stringify(sample)

type Messages = Parameters<typeof requestJson>[0]

export type VideoScriptResult =
  | {
      ok: true
      title: string
      scenes: VideoScene[]
      gaps: ScriptGapDraft[]
      /** 저장은 되지만 관리자가 확인할 점 */
      warnings: string[]
    }
  | { ok: false; error: string }

/** AI가 준 장면 배열을 id 정리 전에 고치는 단계 (붙여넣기: 문장 번호 → 원문 문장) */
type Transform = (scenes: unknown[]) => { scenes: unknown[]; notes: string[] }

/** 응답 검증 → 문제 목록 (비면 통과) */
function validate(json: unknown, structure: boolean, transform?: Transform) {
  let notes: string[] = []
  let input = json
  const r = json && typeof json === 'object' && !Array.isArray(json) ? (json as Record<string, unknown>) : null
  let list = Array.isArray(json) ? json : r && Array.isArray(r.scenes) ? r.scenes : null
  if (list) {
    if (transform) {
      const t = transform(list)
      notes = t.notes
      list = t.scenes
    }
    // 등장 단계 누락은 재요청 대신 코드로 맞춘다
    const fixed = repairReveals(list)
    notes = [...notes, ...fixed.notes]
    input = r ? { ...r, scenes: fixed.scenes } : fixed.scenes
  }
  const norm = normalizeAiScript(input)
  if (!norm) return { problems: ['응답에 scenes 배열이 없어요'], norm: null, scenes: [] as VideoScene[], notes }
  const parsed = parseVideoScenes(norm.scenes)
  const problems = formatVideoSceneErrors(parsed.errors)
  if (parsed.ok && structure) problems.push(...checkScriptStructure(parsed.scenes))
  return { problems, norm, scenes: parsed.scenes, notes }
}

/** 한 번 요청하고, 형식 문제가 있으면 문제 목록을 넣어 한 번 더 요청한다 */
async function requestScenes(
  messages: Messages,
  maxTokens: number,
  structure: boolean,
  transform?: Transform,
): Promise<
  | { ok: true; title: string; scenes: VideoScene[]; gaps: ScriptGapDraft[]; softProblems: string[]; notes: string[] }
  | { ok: false; error: string }
> {
  let res = await requestJson(messages, maxTokens, { temperature: 0.6 })
  if (!res.ok) return res
  let check = validate(res.json, structure, transform)

  if (check.problems.length > 0) {
    console.warn('[grammar-video-script] 형식 문제로 재요청:', check.problems.slice(0, 5))
    res = await requestJson(
      [...messages, { role: 'assistant', content: JSON.stringify(res.json) }, { role: 'user', content: buildRetryMessage(check.problems) }],
      maxTokens,
      { temperature: 0.4 },
    )
    if (!res.ok) return res
    check = validate(res.json, structure, transform)
  }

  if (!check.norm) return { ok: false, error: 'AI 응답 형식이 올바르지 않습니다. 다시 시도해 주세요.' }
  const parsed = parseVideoScenes(check.norm.scenes)
  if (!parsed.ok) {
    const first = formatVideoSceneErrors(parsed.errors).slice(0, 3).join(' / ')
    return { ok: false, error: `AI가 만든 장면에 오류가 남아 있습니다. 다시 시도해 주세요. (${first})` }
  }
  // 구조 규칙(장면 수·필수 틀)은 다시 시도해도 어긋나면 경고로만 남기고 관리자가 고친다
  const softProblems = structure ? checkScriptStructure(parsed.scenes) : []
  return { ok: true, title: check.norm.title, scenes: parsed.scenes, gaps: check.norm.gaps, softProblems, notes: check.notes }
}

/** 출력 토큰 상한 — 장면 JSON이 길어 나레이션 글자 수보다 넉넉히 */
function maxTokensFor(minutes: number): number {
  return Math.min(14000, 4000 + minutes * 1800)
}

export interface GenerateVideoScriptInput {
  point: ScriptPointInfo
  minutes: number
  audience: ScriptAudience
  seriesNo: number | null
  /** formatScriptsForPrompt로 합친 관리자 원고 */
  sourceText: string
}

/** 관리자 원고·개념 정리 → 장면 목록 (원고에 없는 설명은 gaps로) */
export async function generateVideoScript(input: GenerateVideoScriptInput): Promise<VideoScriptResult> {
  const res = await requestScenes(
    [
      { role: 'system', content: buildScriptSystemPrompt(EASY_EXPLANATION_RULES, EXAMPLE_JSON) },
      { role: 'user', content: buildGenerateUserPrompt(input) },
    ],
    maxTokensFor(input.minutes),
    true,
  )
  if (!res.ok) return res
  const few = scenesWithFewExamples(res.scenes)
  const warnings = [
    ...res.notes,
    ...res.softProblems,
    ...(few.length ? [`영어 예문이 2개 미만인 장면: ${few.join(', ')}`] : []),
  ]
  return { ok: true, title: res.title, scenes: res.scenes, gaps: res.gaps, warnings }
}

export type ConvertScriptResult =
  | { ok: true; title: string; scenes: VideoScene[]; diff: NarrationDiff; warnings: string[] }
  | { ok: false; error: string }

/**
 * 붙여넣은 대본 → 장면 목록. AI는 문장 번호만 고르고 문장은 원문에서 채우므로 나레이션은 글자 그대로다.
 * 그래도 원문과 대조해(diff) 다른 곳이 있으면 알려 준다.
 */
export async function convertPastedScript(text: string, point: ScriptPointInfo): Promise<ConvertScriptResult> {
  const sentences = splitScriptSentences(text)
  if (sentences.length === 0) return { ok: false, error: '대본에서 문장을 찾지 못했습니다.' }
  const res = await requestScenes(
    [
      { role: 'system', content: buildConvertSystemPrompt() },
      { role: 'user', content: buildConvertUserPrompt({ point, sentences }) },
    ],
    Math.min(14000, 3000 + sentences.length * 120),
    false,
    (scenes) => fillConvertedNarration(scenes, sentences),
  )
  if (!res.ok) return res
  const diff = compareNarration(text, res.scenes)
  const warnings: string[] = [...res.notes]
  if (diff.missing.length) warnings.push(`대본 문장 ${diff.missing.length}개가 나레이션에 그대로 들어가지 않았어요.`)
  if (diff.added.length) warnings.push(`대본에 없는 나레이션 ${diff.added.length}개가 생겼어요.`)
  return { ok: true, title: res.title, scenes: res.scenes, diff, warnings }
}
