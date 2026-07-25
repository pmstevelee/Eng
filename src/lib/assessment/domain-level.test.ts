import { describe, it, expect } from 'vitest'
import { calculateDomainLevel, type QuestionHistoryItem } from './adaptive-scoring'

function item(difficulty: number, isCorrect: boolean): QuestionHistoryItem {
  return { questionId: `q-${difficulty}-${isCorrect}`, difficulty, isCorrect, domain: 'GRAMMAR' }
}

describe('calculateDomainLevel — 전부 오답 시 레벨 부풀림 방지', () => {
  it('저난이도 문제를 전부 틀리면 Level 1', () => {
    const history = [item(2, false), item(1, false), item(1, false)]
    const result = calculateDomainLevel(history, 5)
    expect(result.level).toBe(1)
  })

  it('중난이도를 전부 틀려도 startLevel(5) 근처로 부풀려지지 않는다', () => {
    const history = [item(5, false), item(4, false), item(3, false)]
    const result = calculateDomainLevel(history, 5)
    // 예전 버그: (boundary 1 + weightedAvg 5) / 2 ≈ Level 3
    // 수정 후: weightedAvg = min(3) - 1 = 2 → (1 + 2)/2 = 1.5 → Level 2
    expect(result.level).toBeLessThanOrEqual(2)
  })

  it('rawScore는 전체 정답률을 반영해 0이다', () => {
    const history = [item(3, false), item(2, false)]
    const result = calculateDomainLevel(history, 5)
    expect(result.rawScore).toBe(0)
  })
})

describe('calculateDomainLevel — 정상 신호가 있을 때', () => {
  it('저난이도 정답 + 고난이도 오답이면 중간 레벨', () => {
    const history = [
      item(3, true),
      item(3, true),
      item(5, false),
      item(5, false),
    ]
    const result = calculateDomainLevel(history, 5)
    expect(result.level).toBeGreaterThanOrEqual(3)
    expect(result.level).toBeLessThanOrEqual(5)
  })

  it('전부 정답이면 높은 레벨', () => {
    const history = [item(7, true), item(8, true), item(8, true)]
    const result = calculateDomainLevel(history, 5)
    expect(result.level).toBeGreaterThanOrEqual(7)
  })
})
