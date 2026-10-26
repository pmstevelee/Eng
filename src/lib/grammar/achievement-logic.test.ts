import { describe, expect, it } from 'vitest'
import { cellOf, countPassedStates, groupStudentPoints, summarizeHeatmap, type StudentPointRowInput } from './achievement-logic'

describe('summarizeHeatmap', () => {
  const studentIds = ['s1', 's2', 's3', 's4']
  const pointIds = ['p1', 'p2']

  it('포인트별 통과율·학생별 진도율·막힌 포인트를 계산한다', () => {
    const s = summarizeHeatmap({
      studentIds,
      pointIds,
      progress: [
        { studentId: 's1', grammarPointId: 'p1', state: 'PASSED', bestCheckScore: 90, checkAttempts: 1 },
        { studentId: 's2', grammarPointId: 'p1', state: 'MASTERED', bestCheckScore: 100, checkAttempts: 1 },
        { studentId: 's3', grammarPointId: 'p1', state: 'WEAK', bestCheckScore: 40, checkAttempts: 2 },
        { studentId: 's1', grammarPointId: 'p2', state: 'PASSED', bestCheckScore: 80, checkAttempts: 1 },
      ],
    })
    expect(s.pointPassRate.get('p1')).toBe(50)
    expect(s.pointPassRate.get('p2')).toBe(25)
    expect(Array.from(s.stuckPointIds)).toEqual(['p2'])
    expect(s.studentPercent.get('s1')).toBe(100)
    expect(s.studentPercent.get('s3')).toBe(0)
    expect(s.classPercent).toBe(38) // (100+50+0+0)/4 = 37.5
    expect(cellOf(s, 's4', 'p1').state).toBe('NOT_STARTED')
    expect(cellOf(s, 's3', 'p1').checkAttempts).toBe(2)
  })

  it('배정 밖·반 밖 진도 행은 무시한다', () => {
    const s = summarizeHeatmap({
      studentIds: ['s1'],
      pointIds: ['p1'],
      progress: [
        { studentId: 's1', grammarPointId: 'px', state: 'PASSED', bestCheckScore: 90, checkAttempts: 1 },
        { studentId: 'sx', grammarPointId: 'p1', state: 'PASSED', bestCheckScore: 90, checkAttempts: 1 },
      ],
    })
    expect(s.pointPassRate.get('p1')).toBe(0)
    expect(s.cells.size).toBe(0)
  })

  it('학생이나 배정이 없으면 null', () => {
    const s = summarizeHeatmap({ studentIds: [], pointIds: ['p1'], progress: [] })
    expect(s.pointPassRate.get('p1')).toBeNull()
    expect(s.stuckPointIds.size).toBe(0)
    expect(s.classPercent).toBeNull()
    const t = summarizeHeatmap({ studentIds: ['s1'], pointIds: [], progress: [] })
    expect(t.studentPercent.get('s1')).toBeNull()
  })
})

describe('groupStudentPoints', () => {
  const row = (over: Partial<StudentPointRowInput>): StudentPointRowInput => ({
    pointId: 'p',
    code: 'G01-01-01',
    title: 't',
    groupId: 'g1',
    groupName: '문장',
    groupOrder: 1,
    subOrder: 1,
    pointOrder: 1,
    state: 'NOT_STARTED',
    bestCheckScore: null,
    checkAttempts: 0,
    assigned: null,
    ...over,
  })

  it('대분류 순서로 묶고 안에서는 중분류·포인트 순', () => {
    const groups = groupStudentPoints([
      row({ pointId: 'b', groupId: 'g2', groupName: '시제', groupOrder: 2 }),
      row({ pointId: 'a2', subOrder: 2, state: 'PASSED' }),
      row({ pointId: 'a1', subOrder: 1, pointOrder: 3, state: 'MASTERED' }),
    ])
    expect(groups.map((g) => g.id)).toEqual(['g1', 'g2'])
    expect(groups[0].rows.map((r) => r.pointId)).toEqual(['a1', 'a2'])
    expect(groups[0].passedCount).toBe(2)
    expect(groups[1].passedCount).toBe(0)
  })
})

describe('countPassedStates', () => {
  it('통과·숙달만 센다', () => {
    expect(
      countPassedStates([
        { state: 'PASSED', count: 3 },
        { state: 'MASTERED', count: 2 },
        { state: 'WEAK', count: 9 },
      ]),
    ).toEqual({ passed: 3, mastered: 2 })
  })
})
