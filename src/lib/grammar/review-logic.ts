// 문법 복습·오답노트 계산 (DB 없는 순수 함수)
//
// - 포인트 복습 만기 판정: 통과·숙달 포인트 중 nextReviewAt이 오늘(KST) 안에 오는 것
// - 문항 복습·오답노트 묶기: 문항의 문법 포인트별로 묶고, 포인트가 없거나 학생이 볼 수 없는 포인트면 '기타'
// - 오답노트 "내 답": 최근 시도 기록에서 문항별 마지막 오답
//
// vitest로 테스트하므로 @/ 경로를 쓰지 않는다.

/** 포인트가 없는 문항 묶음의 키 (URL에도 쓴다) */
export const OTHER_GROUP_KEY = 'etc'
export const OTHER_GROUP_TITLE = '기타'

type MasteryState = 'NOT_STARTED' | 'IN_PROGRESS' | 'PASSED' | 'MASTERED' | 'WEAK'

/** 포인트 복습 대상인지 — 통과·숙달 상태이고 복습 예정일이 dueBy(오늘 끝) 이전 */
export function isPointReviewDue(p: { state: MasteryState; nextReviewAt: Date | null }, dueBy: Date): boolean {
  return (p.state === 'PASSED' || p.state === 'MASTERED') && p.nextReviewAt !== null && p.nextReviewAt < dueBy
}

/**
 * 복습 문항 세트 차수 — 복습 예정일이 같으면 같은 세트(새로고침해도 같은 문항),
 * 복습을 제출하면 예정일이 바뀌어 다음 세트가 된다.
 */
export function reviewRound(nextReviewAt: Date | null): number {
  return nextReviewAt ? Math.floor(nextReviewAt.getTime() / 1000) : 0
}

export interface PointInfo {
  code: string
  title: string
  categoryName: string
}

export interface QuestionGroup<T> {
  /** 포인트 code 또는 OTHER_GROUP_KEY */
  key: string
  title: string
  categoryName: string | null
  items: T[]
}

/**
 * 문항을 포인트별로 묶는다. 묶음 순서는 처음 나온 순서, '기타'는 항상 맨 뒤.
 * pointsById에 없는 포인트(미공개 등)의 문항도 '기타'로 보낸다.
 */
export function groupByPoint<T extends { grammarPointId: string | null }>(
  items: readonly T[],
  pointsById: ReadonlyMap<string, PointInfo>,
): QuestionGroup<T>[] {
  const groups = new Map<string, QuestionGroup<T>>()
  const other: QuestionGroup<T> = { key: OTHER_GROUP_KEY, title: OTHER_GROUP_TITLE, categoryName: null, items: [] }
  for (const item of items) {
    const point = item.grammarPointId ? pointsById.get(item.grammarPointId) : undefined
    if (!point) {
      other.items.push(item)
      continue
    }
    const group = groups.get(point.code) ?? { key: point.code, title: point.title, categoryName: point.categoryName, items: [] }
    group.items.push(item)
    groups.set(point.code, group)
  }
  const out = Array.from(groups.values())
  if (other.items.length > 0) out.push(other)
  return out
}

/** 묶음 키에 맞는 문항만 — 키가 포인트 code면 그 포인트, OTHER_GROUP_KEY면 묶음 없는 문항 */
export function filterByGroupKey<T extends { grammarPointId: string | null }>(
  items: readonly T[],
  key: string,
  pointsById: ReadonlyMap<string, PointInfo>,
): T[] {
  return items.filter((item) => {
    const point = item.grammarPointId ? pointsById.get(item.grammarPointId) : undefined
    return key === OTHER_GROUP_KEY ? !point : point?.code === key
  })
}

/**
 * 문항별 마지막 오답 — attempts는 최신순.
 * 가장 최근에 틀렸을 때의 답을 쓴다 (나중에 맞혔더라도 오답노트에는 틀린 답을 보여 준다).
 */
export function latestWrongAnswers(
  attempts: ReadonlyArray<ReadonlyArray<{ questionId: string; answer: string; isCorrect: boolean }>>,
): Map<string, string> {
  const out = new Map<string, string>()
  for (const answers of attempts) {
    for (const a of answers) {
      if (!a.isCorrect && a.answer && !out.has(a.questionId)) out.set(a.questionId, a.answer)
    }
  }
  return out
}

/** 쪽 번호 정리 — 1 이상, 마지막 쪽 이하 */
export function clampPage(raw: string | undefined, total: number, pageSize: number): number {
  const last = Math.max(1, Math.ceil(total / pageSize))
  const n = Number.parseInt(raw ?? '1', 10)
  return Number.isFinite(n) ? Math.min(Math.max(1, n), last) : 1
}
