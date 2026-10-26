// 문법 진도 배정 계산 — 코스 불러오기 마감일, 중복 제외, 순서 변경, 반 진도 요약
//
// vitest로 테스트하므로 @/ 경로를 쓰지 않는 순수 모듈로 둔다. 날짜는 KST 날짜 키('YYYY-MM-DD')로만 다룬다.

/** 코스 불러오기 단원 간격(일) */
export const ASSIGN_INTERVAL_RANGE = { min: 1, max: 30 } as const
/** 한 번에 배정할 수 있는 포인트 수 상한 (반 배정·개인 배정·코스 템플릿 공통) */
export const MAX_ASSIGN_POINTS = 300
/** 학원 통과 기준 설정 단위(%) */
export const PASS_SCORE_STEP = 5

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/

export function isValidDateKey(value: unknown): value is string {
  if (typeof value !== 'string' || !DATE_KEY.test(value)) return false
  const d = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value
}

export function addDaysToKey(key: string, days: number): string {
  const d = new Date(`${key}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export interface ScheduledUnit {
  startKey: string
  dueKey: string
}

/**
 * 코스 불러오기 날짜 — 모든 단원은 시작일부터 보이고(학생 홈은 시작 전 배정을 숨김),
 * 마감일은 단원 간격마다 하나씩: i번째 단원 마감 = 시작일 + (i+1)×간격 − 1.
 * 예) 시작 10/27, 간격 7일 → 11/2, 11/9, 11/16 …
 */
export function scheduleCourseDates(startKey: string, intervalDays: number, count: number): ScheduledUnit[] {
  const units: ScheduledUnit[] = []
  for (let i = 0; i < count; i++) {
    units.push({ startKey, dueKey: addDaysToKey(startKey, (i + 1) * intervalDays - 1) })
  }
  return units
}

export interface ImportPlan {
  /** 새로 배정할 포인트 (코스 순서 유지) */
  toAdd: string[]
  /** 이미 배정돼 있어 뺀 수 */
  skippedDuplicate: number
  /** 공개 전·볼 수 없는 포인트라 뺀 수 */
  skippedHidden: number
}

/** 코스·트리에서 고른 포인트 중 실제로 새로 배정할 것 — 중복·비공개 제외, 고른 목록 안의 중복도 하나로 */
export function planAssignmentImport(params: {
  pointIds: string[]
  existingPointIds: Iterable<string>
  visiblePointIds: Set<string>
}): ImportPlan {
  const existing = new Set(params.existingPointIds)
  const seen = new Set<string>()
  const toAdd: string[] = []
  let skippedDuplicate = 0
  let skippedHidden = 0
  for (const id of params.pointIds) {
    if (seen.has(id)) continue
    seen.add(id)
    if (!params.visiblePointIds.has(id)) {
      skippedHidden++
      continue
    }
    if (existing.has(id)) {
      skippedDuplicate++
      continue
    }
    toAdd.push(id)
  }
  return { toAdd, skippedDuplicate, skippedHidden }
}

/**
 * 위/아래로 한 칸 옮긴 뒤의 순서 — 바뀐 행만 돌려준다.
 * 목록 전체를 0부터 다시 매겨 sortOrder가 겹치거나 비어 있어도 정리된다.
 */
export function moveInOrder<T extends { id: string; sortOrder: number }>(
  items: T[],
  id: string,
  direction: 'up' | 'down',
): { id: string; sortOrder: number }[] {
  const sorted = [...items].sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id))
  const index = sorted.findIndex((i) => i.id === id)
  const target = direction === 'up' ? index - 1 : index + 1
  if (index < 0 || target < 0 || target >= sorted.length) return []
  const next = [...sorted]
  ;[next[index], next[target]] = [next[target], next[index]]
  const changed: { id: string; sortOrder: number }[] = []
  next.forEach((item, i) => {
    if (item.sortOrder !== i) changed.push({ id: item.id, sortOrder: i })
  })
  return changed
}

export interface ClassAssignmentForSummary {
  grammarPointId: string
  dueKey: string | null
}

export interface ClassProgressSummary {
  /** 반 평균 진도율(%) — 학생별 (통과+숙달 배정 포인트 / 배정 포인트) 평균, 학생·배정이 없으면 null */
  averagePercent: number | null
  /** 마감이 지났는데 통과하지 못한 배정이 하나라도 있는 학생 수 */
  overdueStudents: number
}

/** passed: `${studentId}:${grammarPointId}` 키 집합 (PASSED·MASTERED) */
export function passKey(studentId: string, grammarPointId: string): string {
  return `${studentId}:${grammarPointId}`
}

export function summarizeClassProgress(params: {
  studentIds: string[]
  assignments: ClassAssignmentForSummary[]
  passed: Set<string>
  todayKey: string
}): ClassProgressSummary {
  const { studentIds, passed, todayKey } = params
  const byPoint = new Map<string, ClassAssignmentForSummary>()
  for (const a of params.assignments) {
    // 같은 포인트가 두 번 들어와도 한 번만 센다 (마감일은 빠른 쪽)
    const prev = byPoint.get(a.grammarPointId)
    if (!prev || (a.dueKey && (!prev.dueKey || a.dueKey < prev.dueKey))) byPoint.set(a.grammarPointId, a)
  }
  const assignments = Array.from(byPoint.values())
  if (studentIds.length === 0 || assignments.length === 0) return { averagePercent: null, overdueStudents: 0 }

  let percentSum = 0
  let overdueStudents = 0
  for (const sid of studentIds) {
    let done = 0
    let overdue = false
    for (const a of assignments) {
      const ok = passed.has(passKey(sid, a.grammarPointId))
      if (ok) done++
      else if (a.dueKey && a.dueKey < todayKey) overdue = true
    }
    percentSum += (done / assignments.length) * 100
    if (overdue) overdueStudents++
  }
  return { averagePercent: Math.round(percentSum / studentIds.length), overdueStudents }
}

/** 학원 통과 기준 입력 검사 — 60~100, 5% 단위 */
export function isValidPassScore(value: unknown, range: { min: number; max: number }): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= range.min &&
    value <= range.max &&
    value % PASS_SCORE_STEP === 0
  )
}
