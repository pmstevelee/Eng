import { describe, expect, it } from 'vitest'
import { collectWrongAnswers, parseWeakComment, rankWeakPoints, sumAttempts, weekStartKey } from './weekly-report-logic'

describe('sumAttempts', () => {
  it('문항 수와 정답률', () => {
    expect(sumAttempts([{ correctCount: 7, totalCount: 10 }, { correctCount: 1, totalCount: 2 }])).toEqual({ solved: 12, correct: 8, accuracy: 67 })
    expect(sumAttempts([])).toEqual({ solved: 0, correct: 0, accuracy: null })
  })
})

describe('rankWeakPoints', () => {
  it('이번 주 틀린 수 → 최근 학습 순', () => {
    const ranked = rankWeakPoints(
      [
        { pointId: 'a', lastActivityAt: '2026-10-20T00:00:00Z' },
        { pointId: 'b', lastActivityAt: '2026-10-25T00:00:00Z' },
        { pointId: 'c', lastActivityAt: '2026-10-24T00:00:00Z' },
        { pointId: 'd', lastActivityAt: '2026-10-26T00:00:00Z' },
      ],
      [
        { grammarPointId: 'a', correctCount: 2, totalCount: 10, answers: [] },
        { grammarPointId: 'c', correctCount: 8, totalCount: 10, answers: [] },
        { grammarPointId: null, correctCount: 0, totalCount: 20, answers: [] },
      ],
    )
    expect(ranked).toEqual([
      { pointId: 'a', weekWrong: 8 },
      { pointId: 'c', weekWrong: 2 },
      { pointId: 'd', weekWrong: 0 },
    ])
  })
})

describe('collectWrongAnswers', () => {
  it('최신 시도부터 포인트별로, 같은 문항·빈 답·정답은 뺀다', () => {
    const out = collectWrongAnswers(
      [
        {
          grammarPointId: 'p',
          answers: [
            { questionId: 'q1', answer: 'B', isCorrect: false },
            { questionId: 'q2', answer: 'A', isCorrect: true },
            { questionId: 'q3', answer: ' ', isCorrect: false },
          ],
        },
        { grammarPointId: 'p', answers: [{ questionId: 'q1', answer: 'C', isCorrect: false }, { questionId: 'q4', answer: 'D', isCorrect: false }] },
        { grammarPointId: 'x', answers: [{ questionId: 'q9', answer: 'A', isCorrect: false }] },
      ],
      ['p'],
    )
    expect(out.get('p')).toEqual([
      { questionId: 'q1', answer: 'B' },
      { questionId: 'q4', answer: 'D' },
    ])
    expect(out.has('x')).toBe(false)
  })

  it('최대 개수에서 멈춘다', () => {
    const answers = Array.from({ length: 8 }, (_, i) => ({ questionId: `q${i}`, answer: 'A', isCorrect: false }))
    expect(collectWrongAnswers([{ grammarPointId: 'p', answers }], ['p'], 5).get('p')).toHaveLength(5)
  })
})

describe('weekStartKey', () => {
  it('월요일 시작', () => {
    expect(weekStartKey('2026-10-26')).toBe('2026-10-26') // 월
    expect(weekStartKey('2026-11-01')).toBe('2026-10-26') // 일
    expect(weekStartKey('2026-10-28')).toBe('2026-10-26') // 수
  })
})

describe('parseWeakComment', () => {
  it('문자열만 받고 공백 정리', () => {
    expect(parseWeakComment({ comment: '  be동사 뒤에   과거분사를 빠뜨리는 실수가 많아요. ' })).toBe('be동사 뒤에 과거분사를 빠뜨리는 실수가 많아요.')
    expect(parseWeakComment({ comment: 3 })).toBeNull()
    expect(parseWeakComment({ comment: '짧음' })).toBeNull()
    expect(parseWeakComment([])).toBeNull()
  })
})
