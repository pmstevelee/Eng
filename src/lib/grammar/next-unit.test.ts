import { describe, expect, it } from 'vitest'
import { getNextGrammarUnit, pickCourseForLevel, sortAssignments, type NextUnitInput } from './next-unit'

const now = new Date('2026-10-26T03:00:00Z')
const daysAgo = (n: number) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000)

function input(partial: Partial<NextUnitInput>): NextUnitInput {
  return {
    progresses: [],
    assignments: [],
    courses: [],
    currentLevel: 1,
    visiblePointIds: new Set(['a', 'b', 'c', 'd', 'e']),
    now,
    ...partial,
  }
}

describe('getNextGrammarUnit', () => {
  it('1. 학습 중인 단원이 있으면 가장 최근 것을 고른다', () => {
    const r = getNextGrammarUnit(
      input({
        progresses: [
          { grammarPointId: 'a', state: 'IN_PROGRESS', lastActivityAt: daysAgo(5) },
          { grammarPointId: 'b', state: 'IN_PROGRESS', lastActivityAt: daysAgo(1) },
          { grammarPointId: 'c', state: 'WEAK', lastActivityAt: daysAgo(10) },
        ],
        assignments: [{ grammarPointId: 'd', dueDate: daysAgo(-1), sortOrder: 0 }],
      }),
    )
    expect(r).toEqual({ grammarPointId: 'b', reason: 'IN_PROGRESS', dueDate: null })
  })

  it('4. 3일 이상 방치된 취약 포인트를 배정보다 먼저 제안한다', () => {
    const r = getNextGrammarUnit(
      input({
        progresses: [
          { grammarPointId: 'a', state: 'WEAK', lastActivityAt: daysAgo(2) },
          { grammarPointId: 'b', state: 'WEAK', lastActivityAt: daysAgo(4) },
          { grammarPointId: 'c', state: 'WEAK', lastActivityAt: daysAgo(8) },
        ],
        assignments: [{ grammarPointId: 'd', dueDate: daysAgo(-1), sortOrder: 0 }],
      }),
    )
    expect(r?.grammarPointId).toBe('c')
    expect(r?.reason).toBe('WEAK_STALE')
  })

  it('최근 손댄 취약 포인트(3일 미만)는 배정을 앞서지 않는다', () => {
    const r = getNextGrammarUnit(
      input({
        progresses: [{ grammarPointId: 'a', state: 'WEAK', lastActivityAt: daysAgo(1) }],
        assignments: [{ grammarPointId: 'd', dueDate: null, sortOrder: 0 }],
      }),
    )
    expect(r?.grammarPointId).toBe('d')
  })

  it('2. 배정 단원 중 미통과를 마감일 빠른 순으로 고른다 (마감 없음은 뒤)', () => {
    const due1 = daysAgo(-2)
    const r = getNextGrammarUnit(
      input({
        progresses: [{ grammarPointId: 'a', state: 'PASSED', lastActivityAt: daysAgo(1) }],
        assignments: [
          { grammarPointId: 'e', dueDate: null, sortOrder: 0 },
          { grammarPointId: 'a', dueDate: daysAgo(-1), sortOrder: 1 },
          { grammarPointId: 'c', dueDate: daysAgo(-5), sortOrder: 2 },
          { grammarPointId: 'b', dueDate: due1, sortOrder: 3 },
        ],
      }),
    )
    expect(r).toEqual({ grammarPointId: 'b', reason: 'ASSIGNED', dueDate: due1 })
  })

  it('배정을 모두 통과하면 코스로 넘어가지 않고 null', () => {
    const r = getNextGrammarUnit(
      input({
        progresses: [{ grammarPointId: 'a', state: 'MASTERED', lastActivityAt: daysAgo(1) }],
        assignments: [{ grammarPointId: 'a', dueDate: null, sortOrder: 0 }],
        courses: [{ id: 'k', targetLevel: 1, sortOrder: 0, pointIds: ['b'] }],
      }),
    )
    expect(r).toBeNull()
  })

  it('3. 배정이 없으면 레벨에 맞는 코스의 다음 미통과 포인트', () => {
    const r = getNextGrammarUnit(
      input({
        currentLevel: 4,
        progresses: [{ grammarPointId: 'c', state: 'PASSED', lastActivityAt: daysAgo(1) }],
        courses: [
          { id: 'low', targetLevel: 2, sortOrder: 0, pointIds: ['a'] },
          { id: 'mid', targetLevel: 3, sortOrder: 1, pointIds: ['c', 'x', 'd'] },
          { id: 'high', targetLevel: 5, sortOrder: 2, pointIds: ['e'] },
        ],
      }),
    )
    // 'x'는 공개되지 않은 포인트라 건너뛴다
    expect(r).toEqual({ grammarPointId: 'd', reason: 'COURSE', dueDate: null })
  })

  it('공개되지 않은 포인트의 진도·배정은 무시한다', () => {
    const r = getNextGrammarUnit(
      input({
        visiblePointIds: new Set(['b']),
        progresses: [{ grammarPointId: 'a', state: 'IN_PROGRESS', lastActivityAt: daysAgo(0) }],
        assignments: [{ grammarPointId: 'a', dueDate: null, sortOrder: 0 }],
        courses: [{ id: 'k', targetLevel: 1, sortOrder: 0, pointIds: ['a', 'b'] }],
      }),
    )
    expect(r).toEqual({ grammarPointId: 'b', reason: 'COURSE', dueDate: null })
  })

  it('코스가 없으면 null', () => {
    expect(getNextGrammarUnit(input({}))).toBeNull()
  })
})

describe('pickCourseForLevel', () => {
  const courses = [
    { id: 'a', targetLevel: 2, sortOrder: 0 },
    { id: 'b', targetLevel: 5, sortOrder: 1 },
    { id: 'c', targetLevel: 9, sortOrder: 2 },
  ]
  it('레벨 이하 중 가장 높은 코스', () => {
    expect(pickCourseForLevel(courses, 6)?.id).toBe('b')
    expect(pickCourseForLevel(courses, 10)?.id).toBe('c')
  })
  it('가장 낮은 코스보다 레벨이 낮으면 가장 낮은 코스', () => {
    expect(pickCourseForLevel(courses, 1)?.id).toBe('a')
  })
})

describe('sortAssignments', () => {
  it('마감일 순, 같으면 sortOrder, 마감 없음은 뒤', () => {
    const d = new Date('2026-11-01')
    const list = sortAssignments([
      { id: 1, dueDate: null, sortOrder: 0 },
      { id: 2, dueDate: d, sortOrder: 5 },
      { id: 3, dueDate: d, sortOrder: 1 },
    ])
    expect(list.map((x) => x.id)).toEqual([3, 2, 1])
  })
})
