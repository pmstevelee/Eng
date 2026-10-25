// 관리자 문법 포인트 편집 — 입력 검증·상태 변경 규칙·AI 초안 응답 검증 (서버·클라이언트 공용, DB 접근 없음)

import type { GrammarPointStatus } from '@/generated/prisma'
import {
  parseGrammarCommonErrors,
  parseGrammarExamples,
  parseGrammarRules,
  type GrammarCommonError,
  type GrammarExample,
  type GrammarRule,
} from '../../types/grammar' // vitest에 @/ 별칭이 없어 상대 경로
import { MIN_PUBLISH_QUESTIONS } from './constants'

export const POINT_TITLE_MAX = 100
export const POINT_SUMMARY_MAX = 300
export const POINT_LIST_MAX = 12

/** 편집 폼 값 (저장 액션 입력) */
export interface GrammarPointFormInput {
  title: string
  levelMin: number
  levelMax: number
  summary: string
  rules: GrammarRule[]
  examples: GrammarExample[]
  commonErrors: GrammarCommonError[]
  prerequisiteIds: string[]
}

/** AI 초안 결과 — 폼에 채우기만 하고 저장은 관리자가 한다 */
export interface GrammarPointDraft {
  summary: string
  rules: GrammarRule[]
  examples: GrammarExample[]
  commonErrors: GrammarCommonError[]
}

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; error: string }

function isLevel(n: unknown): n is number {
  return typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= 10
}

/**
 * 저장 전 입력 검증·정리. 빈 행은 버리고 앞뒤 공백을 지운다.
 * 클라이언트 입력은 신뢰하지 않으므로 unknown으로 받는다.
 */
export function validateGrammarPointInput(input: unknown, selfId: string): ValidationResult<GrammarPointFormInput> {
  if (!input || typeof input !== 'object') return { ok: false, error: '입력값이 올바르지 않습니다.' }
  const r = input as Record<string, unknown>

  const title = typeof r.title === 'string' ? r.title.trim() : ''
  if (!title) return { ok: false, error: '제목을 입력해 주세요.' }
  if (title.length > POINT_TITLE_MAX) return { ok: false, error: `제목은 ${POINT_TITLE_MAX}자 이내로 입력해 주세요.` }

  if (!isLevel(r.levelMin) || !isLevel(r.levelMax)) return { ok: false, error: '레벨은 1~10 사이로 선택해 주세요.' }
  if (r.levelMin > r.levelMax) return { ok: false, error: '최소 레벨이 최대 레벨보다 클 수 없습니다.' }

  const summary = typeof r.summary === 'string' ? r.summary.trim() : ''
  if (summary.length > POINT_SUMMARY_MAX) {
    return { ok: false, error: `요약은 ${POINT_SUMMARY_MAX}자 이내로 입력해 주세요.` }
  }

  const rules = parseGrammarRules(r.rules)
  const examples = parseGrammarExamples(r.examples)
  const commonErrors = parseGrammarCommonErrors(r.commonErrors)
  if (rules.length > POINT_LIST_MAX || examples.length > POINT_LIST_MAX || commonErrors.length > POINT_LIST_MAX) {
    return { ok: false, error: `규칙·예문·흔한 오류는 각각 ${POINT_LIST_MAX}개까지 입력할 수 있습니다.` }
  }

  const rawPrereq = Array.isArray(r.prerequisiteIds) ? r.prerequisiteIds : []
  const prerequisiteIds = Array.from(
    new Set(rawPrereq.filter((id): id is string => typeof id === 'string' && id.length > 0)),
  )
  if (prerequisiteIds.includes(selfId)) return { ok: false, error: '자기 자신을 선수 포인트로 지정할 수 없습니다.' }

  return {
    ok: true,
    value: { title, levelMin: r.levelMin, levelMax: r.levelMax, summary, rules, examples, commonErrors, prerequisiteIds },
  }
}

/** 공개할 수 없는 이유 (공개 가능하면 null) */
export function getPublishBlockReason(verifiedQuestionCount: number): string | null {
  if (verifiedQuestionCount >= MIN_PUBLISH_QUESTIONS) return null
  return `검수 완료 문항이 ${verifiedQuestionCount}개입니다. 공개하려면 ${MIN_PUBLISH_QUESTIONS}개 이상(연습 12 + 확인 10)이 필요합니다.`
}

/** 상태 변경 가능 여부 — 가능하면 null, 아니면 이유 */
export function getStatusChangeBlockReason(
  from: GrammarPointStatus,
  to: GrammarPointStatus,
  verifiedQuestionCount: number,
): string | null {
  if (from === to) return '이미 같은 상태입니다.'
  if (to === 'REVIEW' && from !== 'DRAFT') return '초안 상태에서만 검수를 요청할 수 있습니다.'
  if (to === 'PUBLISHED') return getPublishBlockReason(verifiedQuestionCount)
  return null
}

/** AI 초안에 요구하는 최소 예문 수 (프롬프트는 6~10개를 요청) */
export const DRAFT_MIN_EXAMPLES = 4

/** AI가 원고에서 부족하다고 본 부분 — 관리자에게 보완 원고를 요청한다 */
export interface GrammarContentGapDraft {
  /** 무엇이 부족한지 */
  message: string
  /** 관리자에게 요청하는 보완 내용 */
  request: string
}

function parseGapList(value: unknown): GrammarContentGapDraft[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (typeof item === 'string' && item.trim()) return [{ message: item.trim().slice(0, 500), request: '' }]
    if (!item || typeof item !== 'object') return []
    const g = item as Record<string, unknown>
    const message = typeof g.message === 'string' ? g.message.trim() : ''
    const request = typeof g.request === 'string' ? g.request.trim() : ''
    if (!message) return []
    return [{ message: message.slice(0, 500), request: request.slice(0, 500) }]
  }).slice(0, 5)
}

/**
 * AI 응답(JSON 파싱 결과) 검증 — 요약 1개, 규칙·흔한 오류 1개 이상, 예문 DRAFT_MIN_EXAMPLES개 이상이어야 통과.
 * gaps(원고에서 부족한 부분)는 선택.
 */
export function parseGrammarPointDraft(raw: unknown): (GrammarPointDraft & { gaps: GrammarContentGapDraft[] }) | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const r = raw as Record<string, unknown>
  const summary = typeof r.summary === 'string' ? r.summary.trim() : ''
  const rules = parseGrammarRules(r.rules).slice(0, POINT_LIST_MAX)
  const examples = parseGrammarExamples(r.examples).slice(0, POINT_LIST_MAX)
  const commonErrors = parseGrammarCommonErrors(r.commonErrors).slice(0, POINT_LIST_MAX)
  if (!summary || rules.length === 0 || examples.length < DRAFT_MIN_EXAMPLES || commonErrors.length === 0) return null
  return { summary: summary.slice(0, POINT_SUMMARY_MAX), rules, examples, commonErrors, gaps: parseGapList(r.gaps) }
}

// ─── 관리자 원고 ─────────────────────────────────────────────────────────────

/** 원고 1건 최대 글자 수 */
export const SCRIPT_CONTENT_MAX = 20000
/** AI에 함께 보내는 원고 총 글자 수 상한 */
export const SCRIPT_PROMPT_MAX = 40000

export interface SourceScriptForPrompt {
  /** 어디에 붙은 원고인지 (예: "대분류 G06 수동태", "포인트 G06-01-01") */
  scope: string
  title: string | null
  content: string
}

/**
 * 원고를 AI 프롬프트용 텍스트로 합친다. 앞쪽(좁은 범위·최신)을 우선 넣고 상한을 넘으면 뒤를 자른다.
 * 호출하는 쪽에서 우선순위대로 정렬해서 넘길 것.
 */
export function formatScriptsForPrompt(scripts: SourceScriptForPrompt[], max = SCRIPT_PROMPT_MAX): string {
  const parts: string[] = []
  let used = 0
  scripts.forEach((s, i) => {
    if (used >= max) return
    const header = `[원고 ${i + 1} · ${s.scope}${s.title ? ` · ${s.title}` : ''}]`
    const room = max - used - header.length - 2
    if (room <= 0) return
    const body = s.content.length > room ? `${s.content.slice(0, room)}\n…(이하 생략)` : s.content
    parts.push(`${header}\n${body}`)
    used += header.length + body.length + 2
  })
  return parts.join('\n\n')
}

/** 분류 원고 분석 결과 — 포인트별 원고 충분도 */
export type ScriptCoverage = 'ENOUGH' | 'PARTIAL' | 'MISSING'

export interface PointCoverageResult {
  code: string
  coverage: ScriptCoverage
  gaps: GrammarContentGapDraft[]
}

/** 분류 원고 분석 AI 응답 검증 — 알려준 포인트 코드만 받는다 */
export function parseCategoryAnalysis(raw: unknown, pointCodes: string[]): PointCoverageResult[] | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const list = (raw as Record<string, unknown>).points
  if (!Array.isArray(list)) return null
  const allowed = new Set(pointCodes)
  const seen = new Set<string>()
  const results: PointCoverageResult[] = []
  for (const item of list) {
    if (!item || typeof item !== 'object') continue
    const r = item as Record<string, unknown>
    const code = typeof r.code === 'string' ? r.code.trim() : ''
    if (!allowed.has(code) || seen.has(code)) continue
    const coverage: ScriptCoverage =
      r.coverage === 'ENOUGH' || r.coverage === 'PARTIAL' || r.coverage === 'MISSING' ? r.coverage : 'PARTIAL'
    seen.add(code)
    results.push({ code, coverage, gaps: coverage === 'ENOUGH' ? [] : parseGapList(r.gaps) })
  }
  return results
}
