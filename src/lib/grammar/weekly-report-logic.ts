// 주간 문법 리포트 순수 계산 — 서버 조회(weekly-report.ts)와 테스트가 같이 쓴다 (@/ 없이 — vitest)

import type { GrammarAttemptAnswer } from '../../types/grammar'

export const REPORT_DAYS = 7
export const WEAK_TOP = 3
/** AI 코멘트 근거 틀린 문장 수 */
export const SAMPLE_MAX = 5
/** 이보다 적으면 코멘트를 만들지 않는다 (패턴을 말하기 어려움) */
export const SAMPLE_MIN = 2

export interface WeekAttempt {
  grammarPointId: string | null
  correctCount: number
  totalCount: number
  answers: GrammarAttemptAnswer[]
}

export interface WeekTotals {
  solved: number
  correct: number
  /** 0~100, 푼 문항이 없으면 null */
  accuracy: number | null
}

export function sumAttempts(attempts: Pick<WeekAttempt, 'correctCount' | 'totalCount'>[]): WeekTotals {
  let solved = 0
  let correct = 0
  for (const a of attempts) {
    solved += a.totalCount
    correct += a.correctCount
  }
  return { solved, correct, accuracy: solved > 0 ? Math.round((correct / solved) * 100) : null }
}

export interface WeakCandidate {
  pointId: string
  /** ISO */
  lastActivityAt: string
}

/**
 * 취약 포인트 상위 N개 — 현재 WEAK인 포인트 중 이번 주 틀린 문항이 많은 순, 같으면 최근 학습 순
 */
export function rankWeakPoints(candidates: WeakCandidate[], weekAttempts: WeekAttempt[], limit = WEAK_TOP): { pointId: string; weekWrong: number }[] {
  const wrong = new Map<string, number>()
  for (const a of weekAttempts) {
    if (!a.grammarPointId) continue
    wrong.set(a.grammarPointId, (wrong.get(a.grammarPointId) ?? 0) + (a.totalCount - a.correctCount))
  }
  return candidates
    .map((c) => ({ ...c, weekWrong: wrong.get(c.pointId) ?? 0 }))
    .sort((a, b) => b.weekWrong - a.weekWrong || b.lastActivityAt.localeCompare(a.lastActivityAt))
    .slice(0, limit)
    .map(({ pointId, weekWrong }) => ({ pointId, weekWrong }))
}

/**
 * 포인트별 최근 틀린 문항 — 최신 시도부터, 같은 문항은 한 번만. 시도 목록은 최신순으로 넘길 것
 * 결과: pointId → [{ questionId, answer }]
 */
export function collectWrongAnswers(
  attempts: { grammarPointId: string | null; answers: GrammarAttemptAnswer[] }[],
  pointIds: string[],
  max = SAMPLE_MAX,
): Map<string, { questionId: string; answer: string }[]> {
  const wanted = new Set(pointIds)
  const out = new Map<string, { questionId: string; answer: string }[]>()
  const seen = new Set<string>()
  for (const a of attempts) {
    if (!a.grammarPointId || !wanted.has(a.grammarPointId)) continue
    const list = out.get(a.grammarPointId) ?? []
    for (const ans of a.answers) {
      if (list.length >= max) break
      if (ans.isCorrect || !ans.answer.trim() || seen.has(ans.questionId)) continue
      seen.add(ans.questionId)
      list.push({ questionId: ans.questionId, answer: ans.answer })
    }
    out.set(a.grammarPointId, list)
  }
  return out
}

/** KST 날짜 키 → 그 주 월요일 키 */
export function weekStartKey(dateKey: string): string {
  const d = new Date(`${dateKey}T00:00:00Z`)
  const dow = d.getUTCDay() // 0=일
  d.setUTCDate(d.getUTCDate() + (dow === 0 ? -6 : 1 - dow))
  return d.toISOString().slice(0, 10)
}

/** AI 코멘트 응답 → 2~3문장 문자열 (형식이 틀리면 null) */
export function parseWeakComment(json: unknown): string | null {
  if (!json || typeof json !== 'object' || Array.isArray(json)) return null
  const comment = (json as Record<string, unknown>).comment
  if (typeof comment !== 'string') return null
  const text = comment.replace(/\s+/g, ' ').trim()
  if (text.length < 10) return null
  return text.length > 400 ? `${text.slice(0, 399)}…` : text
}

/** 표시용 — 'YYYY-MM-DD' 두 개를 '10월 20일 ~ 10월 26일'로 */
export function formatReportRange(fromKey: string, toKey: string): string {
  const f = (k: string) => {
    const [, m, d] = k.split('-').map(Number)
    return `${m}월 ${d}일`
  }
  return `${f(fromKey)} ~ ${f(toKey)}`
}
