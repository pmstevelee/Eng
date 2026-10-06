import { describe, it, expect } from 'vitest'
import { resolveMastery, isDifficultWord, MASTERY_REPETITIONS } from './mastery'

const base = {
  repetitionsAfter: 1,
  learnedBeforeToday: false,
  hasLearnedAt: false,
}

describe('resolveMastery', () => {
  it('학습 흐름: 플래시카드 정답 → RECALL, 리콜 정답 → SPELL', () => {
    expect(resolveMastery({ ...base, current: 'FLASHCARD', activity: 'FLASHCARD', isCorrect: true }).stage).toBe('RECALL')
    expect(resolveMastery({ ...base, current: 'RECALL', activity: 'RECALL', isCorrect: true }).stage).toBe('SPELL')
  })

  it('첫날 스펠 정답은 학습 완료일 뿐 마스터가 아니다', () => {
    const r = resolveMastery({ ...base, current: 'SPELL', activity: 'SPELL', isCorrect: true })
    expect(r.stage).toBe('SPELL')
    expect(r.becameLearned).toBe(true)
    expect(r.becameMastered).toBe(false)
  })

  it('학습 완료 후 서로 다른 날 연속 정답으로 repetitions가 기준 이상이면 마스터', () => {
    const r = resolveMastery({
      ...base,
      current: 'SPELL',
      activity: 'RECALL',
      isCorrect: true,
      hasLearnedAt: true,
      learnedBeforeToday: true,
      repetitionsAfter: MASTERY_REPETITIONS,
    })
    expect(r.stage).toBe('MASTERED')
    expect(r.becameMastered).toBe(true)
  })

  it('학습 완료 전에는 repetitions가 높아도 마스터되지 않는다', () => {
    const r = resolveMastery({ ...base, current: 'RECALL', activity: 'RECALL', isCorrect: true, repetitionsAfter: 5 })
    expect(r.stage).toBe('SPELL')
    expect(r.becameMastered).toBe(false)
  })

  it('복습 리콜 정답은 마스터 단어를 강등시키지 않는다', () => {
    const r = resolveMastery({
      ...base,
      current: 'MASTERED',
      activity: 'RECALL',
      isCorrect: true,
      hasLearnedAt: true,
      learnedBeforeToday: true,
    })
    expect(r.stage).toBe('MASTERED')
    expect(r.becameMastered).toBe(false)
  })

  it('세트 재학습 플래시카드 정답도 마스터 단어를 강등시키지 않는다', () => {
    const r = resolveMastery({ ...base, current: 'MASTERED', activity: 'FLASHCARD', isCorrect: true, hasLearnedAt: true })
    expect(r.stage).toBe('MASTERED')
  })

  it('마스터 단어를 틀리면 망각: RECALL로 강등, 마스터 해제', () => {
    const r = resolveMastery({ ...base, current: 'MASTERED', activity: 'SPELL', isCorrect: false, hasLearnedAt: true })
    expect(r.stage).toBe('RECALL')
    expect(r.isLapse).toBe(true)
    expect(r.lostMastery).toBe(true)
  })

  it('전날 학습 완료한 단어를 틀리면 망각', () => {
    const r = resolveMastery({
      ...base,
      current: 'SPELL',
      activity: 'RECALL',
      isCorrect: false,
      hasLearnedAt: true,
      learnedBeforeToday: true,
    })
    expect(r.isLapse).toBe(true)
    expect(r.stage).toBe('RECALL')
  })

  it('오늘 처음 배우는 단어의 오답은 망각이 아니며 단계 유지', () => {
    const r = resolveMastery({ ...base, current: 'SPELL', activity: 'SPELL', isCorrect: false })
    expect(r.isLapse).toBe(false)
    expect(r.stage).toBe('SPELL')
  })
})

describe('isDifficultWord', () => {
  it('망각 2회 이상이면 어려운 단어', () => {
    expect(isDifficultWord({ lapses: 2, wrongCount: 0, correctCount: 10 })).toBe(true)
  })
  it('오답이 2회 이상이고 정답 이상이면 어려운 단어', () => {
    expect(isDifficultWord({ lapses: 0, wrongCount: 3, correctCount: 3 })).toBe(true)
    expect(isDifficultWord({ lapses: 0, wrongCount: 2, correctCount: 5 })).toBe(false)
  })
})
