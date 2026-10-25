import { describe, expect, it } from 'vitest'
import {
  OTHER_GROUP_KEY,
  clampPage,
  filterByGroupKey,
  groupByPoint,
  isPointReviewDue,
  latestWrongAnswers,
  reviewRound,
  type PointInfo,
} from './review-logic'

const dueBy = new Date('2026-10-26T15:00:00Z') // KST 10/27 00:00

describe('isPointReviewDue', () => {
  it('통과 포인트의 예정일이 오늘 안이면 복습 대상', () => {
    expect(isPointReviewDue({ state: 'PASSED', nextReviewAt: new Date('2026-10-26T14:59:59Z') }, dueBy)).toBe(true)
    expect(isPointReviewDue({ state: 'PASSED', nextReviewAt: new Date('2026-10-20T00:00:00Z') }, dueBy)).toBe(true)
  })
  it('예정일이 내일이면 아님', () => {
    expect(isPointReviewDue({ state: 'PASSED', nextReviewAt: dueBy }, dueBy)).toBe(false)
  })
  it('통과·숙달이 아니거나 예정일이 없으면 아님', () => {
    const past = new Date('2026-10-01T00:00:00Z')
    expect(isPointReviewDue({ state: 'WEAK', nextReviewAt: past }, dueBy)).toBe(false)
    expect(isPointReviewDue({ state: 'IN_PROGRESS', nextReviewAt: past }, dueBy)).toBe(false)
    expect(isPointReviewDue({ state: 'MASTERED', nextReviewAt: null }, dueBy)).toBe(false)
    expect(isPointReviewDue({ state: 'MASTERED', nextReviewAt: past }, dueBy)).toBe(true)
  })
})

describe('reviewRound', () => {
  it('예정일이 같으면 같은 차수, 다르면 다른 차수', () => {
    const a = new Date('2026-10-20T01:02:03.456Z')
    expect(reviewRound(a)).toBe(reviewRound(new Date(a.getTime())))
    expect(reviewRound(a)).not.toBe(reviewRound(new Date('2026-10-27T01:02:03Z')))
    expect(reviewRound(null)).toBe(0)
  })
})

const points = new Map<string, PointInfo>([
  ['p1', { code: 'G01-01-01', title: 'be동사', categoryName: '문장의 기초' }],
  ['p2', { code: 'G02-01-01', title: '현재시제', categoryName: '시제' }],
])

describe('groupByPoint', () => {
  it('포인트별로 묶고 기타는 맨 뒤', () => {
    const items = [
      { id: 'a', grammarPointId: null },
      { id: 'b', grammarPointId: 'p2' },
      { id: 'c', grammarPointId: 'p1' },
      { id: 'd', grammarPointId: 'p2' },
      { id: 'e', grammarPointId: 'hidden' },
    ]
    const groups = groupByPoint(items, points)
    expect(groups.map((g) => g.key)).toEqual(['G02-01-01', 'G01-01-01', OTHER_GROUP_KEY])
    expect(groups[0].items.map((i) => i.id)).toEqual(['b', 'd'])
    expect(groups[2].items.map((i) => i.id)).toEqual(['a', 'e'])
    expect(groups[2].title).toBe('기타')
  })
  it('기타가 없으면 기타 묶음도 없음', () => {
    expect(groupByPoint([{ grammarPointId: 'p1' }], points).map((g) => g.key)).toEqual(['G01-01-01'])
  })
})

describe('filterByGroupKey', () => {
  const items = [
    { id: 'a', grammarPointId: null },
    { id: 'b', grammarPointId: 'p1' },
    { id: 'c', grammarPointId: 'hidden' },
  ]
  it('포인트 code로 거름', () => {
    expect(filterByGroupKey(items, 'G01-01-01', points).map((i) => i.id)).toEqual(['b'])
  })
  it('기타 키는 포인트 없는 문항과 볼 수 없는 포인트 문항', () => {
    expect(filterByGroupKey(items, OTHER_GROUP_KEY, points).map((i) => i.id)).toEqual(['a', 'c'])
  })
  it('없는 키는 빈 목록', () => {
    expect(filterByGroupKey(items, 'G99-99-99', points)).toEqual([])
  })
})

describe('latestWrongAnswers', () => {
  it('최신 시도의 오답을 우선, 빈 답·정답은 건너뜀', () => {
    const map = latestWrongAnswers([
      [
        { questionId: 'q1', answer: 'C', isCorrect: true },
        { questionId: 'q2', answer: '', isCorrect: false },
      ],
      [
        { questionId: 'q1', answer: 'B', isCorrect: false },
        { questionId: 'q2', answer: 'A', isCorrect: false },
      ],
      [{ questionId: 'q1', answer: 'D', isCorrect: false }],
    ])
    expect(map.get('q1')).toBe('B')
    expect(map.get('q2')).toBe('A')
    expect(map.has('q3')).toBe(false)
  })
})

describe('clampPage', () => {
  it('범위 밖·잘못된 값은 1 또는 마지막 쪽', () => {
    expect(clampPage(undefined, 45, 20)).toBe(1)
    expect(clampPage('2', 45, 20)).toBe(2)
    expect(clampPage('9', 45, 20)).toBe(3)
    expect(clampPage('-1', 45, 20)).toBe(1)
    expect(clampPage('abc', 45, 20)).toBe(1)
    expect(clampPage('3', 0, 20)).toBe(1)
  })
})
