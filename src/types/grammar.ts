// 문법 포인트 JSON 필드(GrammarPoint.rulesJson / examplesJson / commonErrorsJson) 타입과 파서
// DB의 Json 값은 형식이 보장되지 않으므로 화면에 쓰기 전에 parse*로 걸러서 쓴다.

/** 핵심 규칙 1개 */
export interface GrammarRule {
  /** 규칙 한 줄 (예: "be동사 + 과거분사로 만든다") */
  text: string
  /** 형태 공식 (선택, 예: "be + p.p.") */
  formula?: string
}

/** 대표 예문 1개 */
export interface GrammarExample {
  en: string
  ko: string
  /** 강조할 부분 (선택, 예문 안의 문자열) */
  highlight?: string
}

/** 흔한 오류 1개 */
export interface GrammarCommonError {
  wrong: string
  correct: string
  reason: string
}

/** 시도 답안 1개 (GrammarAttempt.answersJson 항목) */
export interface GrammarAttemptAnswer {
  questionId: string
  answer: string
  isCorrect: boolean
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

export function parseGrammarRules(value: unknown): GrammarRule[] {
  return asArray(value).flatMap((item) => {
    const r = asRecord(item)
    const text = nonEmptyString(r?.text)
    if (!r || !text) return []
    const formula = nonEmptyString(r.formula)
    return [formula ? { text, formula } : { text }]
  })
}

export function parseGrammarExamples(value: unknown): GrammarExample[] {
  return asArray(value).flatMap((item) => {
    const r = asRecord(item)
    const en = nonEmptyString(r?.en)
    const ko = nonEmptyString(r?.ko)
    if (!r || !en || !ko) return []
    const highlight = nonEmptyString(r.highlight)
    return [highlight ? { en, ko, highlight } : { en, ko }]
  })
}

export function parseGrammarCommonErrors(value: unknown): GrammarCommonError[] {
  return asArray(value).flatMap((item) => {
    const r = asRecord(item)
    const wrong = nonEmptyString(r?.wrong)
    const correct = nonEmptyString(r?.correct)
    const reason = nonEmptyString(r?.reason)
    if (!wrong || !correct || !reason) return []
    return [{ wrong, correct, reason }]
  })
}

export function parseGrammarAttemptAnswers(value: unknown): GrammarAttemptAnswer[] {
  return asArray(value).flatMap((item) => {
    const r = asRecord(item)
    const questionId = nonEmptyString(r?.questionId)
    if (!r || !questionId || typeof r.isCorrect !== 'boolean') return []
    return [{ questionId, answer: typeof r.answer === 'string' ? r.answer : '', isCorrect: r.isCorrect }]
  })
}
