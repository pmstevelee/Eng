// 문법 성취도 집계 — 반 히트맵·학생 문법 탭·학원장 분석 카드 공용 순수 함수 (@/ 없이 — vitest)

import type { GrammarMasteryState } from '../../generated/prisma'

/** 통과로 세는 상태 */
export const PASSED_STATE_LIST: GrammarMasteryState[] = ['PASSED', 'MASTERED']

/** 통과율이 이 값(%) 미만이면 "반 전체가 막힌 포인트" */
export const STUCK_PASS_RATE = 50

export function isPassedState(state: GrammarMasteryState): boolean {
  return state === 'PASSED' || state === 'MASTERED'
}

// ─── 반 히트맵 ───────────────────────────────────────────────────────────────

export interface HeatmapCell {
  state: GrammarMasteryState
  bestCheckScore: number | null
  checkAttempts: number
}

export interface HeatmapInput {
  studentIds: string[]
  pointIds: string[]
  /** 진도 행 — 없는 칸은 미학습 */
  progress: { studentId: string; grammarPointId: string; state: GrammarMasteryState; bestCheckScore: number | null; checkAttempts: number }[]
}

export interface HeatmapSummary {
  /** `${studentId}:${pointId}` → 칸 */
  cells: Map<string, HeatmapCell>
  /** 포인트별 통과율(%) — 학생이 없으면 null */
  pointPassRate: Map<string, number | null>
  /** 학생별 진도율(%) — 배정이 없으면 null */
  studentPercent: Map<string, number | null>
  /** 통과율 STUCK_PASS_RATE 미만 포인트 */
  stuckPointIds: Set<string>
  /** 반 전체 진도율(%) */
  classPercent: number | null
}

export function cellKey(studentId: string, pointId: string): string {
  return `${studentId}:${pointId}`
}

const EMPTY_CELL: HeatmapCell = { state: 'NOT_STARTED', bestCheckScore: null, checkAttempts: 0 }

export function cellOf(summary: Pick<HeatmapSummary, 'cells'>, studentId: string, pointId: string): HeatmapCell {
  return summary.cells.get(cellKey(studentId, pointId)) ?? EMPTY_CELL
}

export function summarizeHeatmap({ studentIds, pointIds, progress }: HeatmapInput): HeatmapSummary {
  const studentSet = new Set(studentIds)
  const pointSet = new Set(pointIds)
  const cells = new Map<string, HeatmapCell>()
  for (const p of progress) {
    if (!studentSet.has(p.studentId) || !pointSet.has(p.grammarPointId)) continue
    cells.set(cellKey(p.studentId, p.grammarPointId), {
      state: p.state,
      bestCheckScore: p.bestCheckScore,
      checkAttempts: p.checkAttempts,
    })
  }

  const passedByPoint = new Map<string, number>()
  const passedByStudent = new Map<string, number>()
  cells.forEach((cell, key) => {
    if (!isPassedState(cell.state)) return
    const [sid, pid] = key.split(':')
    passedByPoint.set(pid, (passedByPoint.get(pid) ?? 0) + 1)
    passedByStudent.set(sid, (passedByStudent.get(sid) ?? 0) + 1)
  })

  const pointPassRate = new Map<string, number | null>()
  const stuckPointIds = new Set<string>()
  for (const pid of pointIds) {
    const rate = studentIds.length > 0 ? Math.round(((passedByPoint.get(pid) ?? 0) / studentIds.length) * 100) : null
    pointPassRate.set(pid, rate)
    if (rate !== null && rate < STUCK_PASS_RATE) stuckPointIds.add(pid)
  }

  const studentPercent = new Map<string, number | null>()
  let sum = 0
  for (const sid of studentIds) {
    const percent = pointIds.length > 0 ? Math.round(((passedByStudent.get(sid) ?? 0) / pointIds.length) * 100) : null
    studentPercent.set(sid, percent)
    if (percent !== null) sum += ((passedByStudent.get(sid) ?? 0) / pointIds.length) * 100
  }
  const classPercent = studentIds.length > 0 && pointIds.length > 0 ? Math.round(sum / studentIds.length) : null

  return { cells, pointPassRate, studentPercent, stuckPointIds, classPercent }
}

// ─── 학생 문법 탭 ────────────────────────────────────────────────────────────

export interface StudentPointRowInput {
  pointId: string
  code: string
  title: string
  /** 대분류 (정렬·그룹) */
  groupId: string
  groupName: string
  groupOrder: number
  /** 중분류 → 포인트 정렬 */
  subOrder: number
  pointOrder: number
  state: GrammarMasteryState
  bestCheckScore: number | null
  checkAttempts: number
  assigned: 'CLASS' | 'STUDENT' | null
}

export interface StudentPointGroup<T extends StudentPointRowInput> {
  id: string
  name: string
  rows: T[]
  passedCount: number
}

/** 대분류별로 묶고 커리큘럼 순서로 정렬 */
export function groupStudentPoints<T extends StudentPointRowInput>(rows: T[]): StudentPointGroup<T>[] {
  const groups = new Map<string, { order: number; group: StudentPointGroup<T> }>()
  for (const r of rows) {
    const entry = groups.get(r.groupId) ?? {
      order: r.groupOrder,
      group: { id: r.groupId, name: r.groupName, rows: [], passedCount: 0 },
    }
    entry.group.rows.push(r)
    if (isPassedState(r.state)) entry.group.passedCount++
    groups.set(r.groupId, entry)
  }
  return Array.from(groups.values())
    .sort((a, b) => a.order - b.order)
    .map(({ group }) => ({
      ...group,
      rows: group.rows.sort((a, b) => a.subOrder - b.subOrder || a.pointOrder - b.pointOrder || a.code.localeCompare(b.code)),
    }))
}

// ─── 학원장 분석 카드 ────────────────────────────────────────────────────────

/** 상태별 groupBy 결과 → 통과·숙달 수 */
export function countPassedStates(groups: { state: GrammarMasteryState; count: number }[]): { passed: number; mastered: number } {
  let passed = 0
  let mastered = 0
  for (const g of groups) {
    if (g.state === 'PASSED') passed += g.count
    else if (g.state === 'MASTERED') mastered += g.count
  }
  return { passed, mastered }
}
