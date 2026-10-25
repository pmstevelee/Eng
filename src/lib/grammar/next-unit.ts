// 학생의 "다음 단원" 고르기 — 계획서 "다음 단원을 고르는 규칙" 1~4번
//
// 1. 학습 중인 단원이 있으면 그 단원 (가장 최근에 손댄 것)
// 4. 취약 포인트가 3일 이상 방치되면 그 포인트를 먼저 제안 (배정·코스보다 앞, 학습 중 단원보다는 뒤)
// 2. 배정된 단원 중 아직 통과 안 한 것, 마감일이 빠른 순 (마감일 없는 것은 뒤)
// 3. 배정이 없으면(자율 모드) currentLevel에 맞는 본사 기본 코스의 다음 미통과 포인트
//
// vitest로 테스트하므로 @/ 경로를 쓰지 않는 순수 모듈로 둔다.

export type MasteryState = 'NOT_STARTED' | 'IN_PROGRESS' | 'PASSED' | 'MASTERED' | 'WEAK'

/** 취약 포인트를 "방치"로 보는 기준(일) */
export const WEAK_STALE_DAYS = 3

export interface NextUnitProgress {
  grammarPointId: string
  state: MasteryState
  lastActivityAt: Date
}

export interface NextUnitAssignment {
  grammarPointId: string
  dueDate: Date | null
  sortOrder: number
}

export interface NextUnitCourse {
  id: string
  targetLevel: number | null
  sortOrder: number
  /** 코스 순서대로 정렬된 포인트 id */
  pointIds: string[]
}

export type NextUnitReason = 'IN_PROGRESS' | 'WEAK_STALE' | 'ASSIGNED' | 'COURSE'

export interface NextUnit {
  grammarPointId: string
  reason: NextUnitReason
  dueDate: Date | null
}

export interface NextUnitInput {
  progresses: NextUnitProgress[]
  assignments: NextUnitAssignment[]
  /** 본사 기본 코스 목록 (자율 모드용) */
  courses: NextUnitCourse[]
  currentLevel: number
  /** 학생이 볼 수 있는 공개 포인트 id — 여기 없는 포인트는 고르지 않는다 */
  visiblePointIds: Set<string>
  now: Date
}

export function isPassedState(state: MasteryState | undefined): boolean {
  return state === 'PASSED' || state === 'MASTERED'
}

/**
 * 자율 모드 코스 — targetLevel이 currentLevel 이하인 것 중 가장 높은 코스.
 * 그런 코스가 없으면(레벨이 가장 낮은 코스보다 낮으면) 가장 낮은 코스.
 */
export function pickCourseForLevel<T extends { targetLevel: number | null; sortOrder: number }>(
  courses: T[],
  currentLevel: number,
): T | null {
  const leveled = courses
    .filter((c) => c.targetLevel !== null)
    .sort((a, b) => (a.targetLevel ?? 0) - (b.targetLevel ?? 0) || a.sortOrder - b.sortOrder)
  if (leveled.length === 0) return [...courses].sort((a, b) => a.sortOrder - b.sortOrder)[0] ?? null
  let picked = leveled[0]
  for (const c of leveled) {
    if ((c.targetLevel ?? 0) <= currentLevel) picked = c
  }
  return picked
}

/** 배정 목록을 "다음 단원" 순서(마감일 빠른 순, 마감일 없음은 뒤, 같으면 sortOrder)로 정렬 */
export function sortAssignments<T extends { dueDate: Date | null; sortOrder: number }>(list: T[]): T[] {
  return [...list].sort((a, b) => {
    if (a.dueDate && b.dueDate) {
      const diff = a.dueDate.getTime() - b.dueDate.getTime()
      if (diff !== 0) return diff
    } else if (a.dueDate) {
      return -1
    } else if (b.dueDate) {
      return 1
    }
    return a.sortOrder - b.sortOrder
  })
}

export function getNextGrammarUnit(input: NextUnitInput): NextUnit | null {
  const { progresses, assignments, courses, currentLevel, visiblePointIds, now } = input
  const visible = progresses.filter((p) => visiblePointIds.has(p.grammarPointId))
  const stateById = new Map(visible.map((p) => [p.grammarPointId, p.state]))
  const byRecent = (a: NextUnitProgress, b: NextUnitProgress) => b.lastActivityAt.getTime() - a.lastActivityAt.getTime()

  // 1. 학습 중
  const inProgress = visible.filter((p) => p.state === 'IN_PROGRESS').sort(byRecent)[0]
  if (inProgress) return { grammarPointId: inProgress.grammarPointId, reason: 'IN_PROGRESS', dueDate: null }

  // 4. 3일 이상 방치된 취약 포인트 (가장 오래 방치된 것)
  const staleBefore = now.getTime() - WEAK_STALE_DAYS * 24 * 60 * 60 * 1000
  const staleWeak = visible
    .filter((p) => p.state === 'WEAK' && p.lastActivityAt.getTime() <= staleBefore)
    .sort((a, b) => a.lastActivityAt.getTime() - b.lastActivityAt.getTime())[0]
  if (staleWeak) return { grammarPointId: staleWeak.grammarPointId, reason: 'WEAK_STALE', dueDate: null }

  // 2. 배정된 미통과 단원
  const visibleAssignments = assignments.filter((a) => visiblePointIds.has(a.grammarPointId))
  if (visibleAssignments.length > 0) {
    const next = sortAssignments(visibleAssignments).find((a) => !isPassedState(stateById.get(a.grammarPointId)))
    // 배정이 있으면 자율 모드로 넘어가지 않는다 (모두 통과했으면 null)
    return next ? { grammarPointId: next.grammarPointId, reason: 'ASSIGNED', dueDate: next.dueDate } : null
  }

  // 3. 자율 모드 — 레벨에 맞는 본사 코스의 다음 미통과 포인트
  const course = pickCourseForLevel(courses, currentLevel)
  if (!course) return null
  const nextId = course.pointIds.find((id) => visiblePointIds.has(id) && !isPassedState(stateById.get(id)))
  return nextId ? { grammarPointId: nextId, reason: 'COURSE', dueDate: null } : null
}
