import { describe, expect, it } from 'vitest'
import {
  addDaysToKey,
  isValidDateKey,
  isValidPassScore,
  moveInOrder,
  passKey,
  planAssignmentImport,
  scheduleCourseDates,
  summarizeClassProgress,
} from './assignment-plan'

describe('isValidDateKey / addDaysToKey', () => {
  it('형식과 실제 날짜를 확인한다', () => {
    expect(isValidDateKey('2026-10-27')).toBe(true)
    expect(isValidDateKey('2026-02-30')).toBe(false)
    expect(isValidDateKey('2026-1-1')).toBe(false)
    expect(isValidDateKey(null)).toBe(false)
  })
  it('월·연 경계를 넘긴다', () => {
    expect(addDaysToKey('2026-10-31', 1)).toBe('2026-11-01')
    expect(addDaysToKey('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDaysToKey('2026-03-01', -1)).toBe('2026-02-28')
  })
})

describe('scheduleCourseDates', () => {
  it('시작일은 모두 같고 마감일은 간격마다', () => {
    expect(scheduleCourseDates('2026-10-27', 7, 3)).toEqual([
      { startKey: '2026-10-27', dueKey: '2026-11-02' },
      { startKey: '2026-10-27', dueKey: '2026-11-09' },
      { startKey: '2026-10-27', dueKey: '2026-11-16' },
    ])
  })
  it('간격 1일이면 첫 단원 마감이 시작일', () => {
    expect(scheduleCourseDates('2026-10-27', 1, 2).map((u) => u.dueKey)).toEqual(['2026-10-27', '2026-10-28'])
  })
  it('0개면 빈 배열', () => {
    expect(scheduleCourseDates('2026-10-27', 7, 0)).toEqual([])
  })
})

describe('planAssignmentImport', () => {
  it('중복·비공개·목록 안 중복을 뺀다', () => {
    const plan = planAssignmentImport({
      pointIds: ['a', 'b', 'c', 'a', 'd'],
      existingPointIds: ['b'],
      visiblePointIds: new Set(['a', 'b', 'd']),
    })
    expect(plan).toEqual({ toAdd: ['a', 'd'], skippedDuplicate: 1, skippedHidden: 1 })
  })
})

describe('moveInOrder', () => {
  const items = [
    { id: 'a', sortOrder: 0 },
    { id: 'b', sortOrder: 1 },
    { id: 'c', sortOrder: 2 },
  ]
  it('아래로 옮기면 두 행만 바뀐다', () => {
    expect(moveInOrder(items, 'a', 'down')).toEqual([
      { id: 'b', sortOrder: 0 },
      { id: 'a', sortOrder: 1 },
    ])
  })
  it('맨 위에서 위로는 변화 없음', () => {
    expect(moveInOrder(items, 'a', 'up')).toEqual([])
    expect(moveInOrder(items, 'c', 'down')).toEqual([])
    expect(moveInOrder(items, 'x', 'up')).toEqual([])
  })
  it('겹치거나 빈 sortOrder를 정리한다', () => {
    const messy = [
      { id: 'a', sortOrder: 5 },
      { id: 'b', sortOrder: 5 },
      { id: 'c', sortOrder: 9 },
    ]
    expect(moveInOrder(messy, 'c', 'up')).toEqual([
      { id: 'a', sortOrder: 0 },
      { id: 'c', sortOrder: 1 },
      { id: 'b', sortOrder: 2 },
    ])
  })
})

describe('summarizeClassProgress', () => {
  const assignments = [
    { grammarPointId: 'p1', dueKey: '2026-10-20' },
    { grammarPointId: 'p2', dueKey: '2026-11-10' },
  ]
  it('평균 진도율과 마감 지난 미통과 학생 수', () => {
    const passed = new Set([passKey('s1', 'p1'), passKey('s1', 'p2'), passKey('s2', 'p2')])
    expect(
      summarizeClassProgress({ studentIds: ['s1', 's2', 's3'], assignments, passed, todayKey: '2026-10-27' }),
    ).toEqual({ averagePercent: 50, overdueStudents: 2 })
  })
  it('마감일 당일은 아직 지난 것이 아니다', () => {
    expect(
      summarizeClassProgress({ studentIds: ['s1'], assignments, passed: new Set(), todayKey: '2026-10-20' }).overdueStudents,
    ).toBe(0)
  })
  it('학생이나 배정이 없으면 진도율 null', () => {
    expect(summarizeClassProgress({ studentIds: [], assignments, passed: new Set(), todayKey: '2026-10-27' })).toEqual({
      averagePercent: null,
      overdueStudents: 0,
    })
    expect(summarizeClassProgress({ studentIds: ['s1'], assignments: [], passed: new Set(), todayKey: '2026-10-27' })).toEqual({
      averagePercent: null,
      overdueStudents: 0,
    })
  })
})

describe('isValidPassScore', () => {
  const range = { min: 60, max: 100 }
  it('5% 단위만 허용', () => {
    expect(isValidPassScore(70, range)).toBe(true)
    expect(isValidPassScore(100, range)).toBe(true)
    expect(isValidPassScore(72, range)).toBe(false)
    expect(isValidPassScore(55, range)).toBe(false)
    expect(isValidPassScore('70', range)).toBe(false)
  })
})
