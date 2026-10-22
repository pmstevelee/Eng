import { describe, it, expect } from 'vitest'
import { resolveStudySession, toStudySessionState, parseStudySessionState } from './study-session'

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const card = (n: number) => ({ word: { id: id(n) } })
const cards = [1, 2, 3, 4, 5].map(card)

describe('resolveStudySession', () => {
  it('저장된 진행이 없거나 시작 전이면 null', () => {
    expect(resolveStudySession(null, cards)).toBeNull()
    const state = toStudySessionState({ deck: cards, index: 0, wrong: [], correct: 0, answered: 0, retry: 0 })
    expect(resolveStudySession(state, cards)).toBeNull()
  })

  it('저장된 위치·틀린 단어·통계를 복원한다', () => {
    const state = toStudySessionState({
      deck: cards,
      index: 3,
      wrong: [card(2)],
      correct: 2,
      answered: 3,
      retry: 0,
      mode: 'KO_TO_EN',
    })
    const r = resolveStudySession(state, cards)
    expect(r?.index).toBe(3)
    expect(r?.deck.map((c) => c.word.id)).toEqual(cards.map((c) => c.word.id))
    expect(r?.wrong.map((c) => c.word.id)).toEqual([id(2)])
    expect(r?.correct).toBe(2)
    expect(r?.mode).toBe('KO_TO_EN')
  })

  it('배치에서 빠진 단어는 제외하고 위치를 보정, 새 단어는 첫 라운드에 덧붙인다', () => {
    const state = toStudySessionState({ deck: cards, index: 3, wrong: [card(1)], correct: 2, answered: 3, retry: 0 })
    const now = [card(2), card(3), card(4), card(5), card(6)] // 1 제외, 6 추가
    const r = resolveStudySession(state, now)
    expect(r?.index).toBe(2)
    expect(r?.deck.map((c) => c.word.id)).toEqual([id(2), id(3), id(4), id(5), id(6)])
    expect(r?.wrong).toEqual([])
    expect(r?.answered).toBe(2)
  })

  it('재출제 라운드에는 새 단어를 덧붙이지 않는다', () => {
    const state = toStudySessionState({ deck: [card(2), card(4)], index: 1, wrong: [], correct: 1, answered: 1, retry: 1 })
    const r = resolveStudySession(state, cards)
    expect(r?.deck.map((c) => c.word.id)).toEqual([id(2), id(4)])
    expect(r?.retry).toBe(1)
  })

  it('마지막 문제까지 답한 상태도 복원한다 (라운드 완료 처리용)', () => {
    const state = toStudySessionState({ deck: cards, index: 5, wrong: [], correct: 5, answered: 5, retry: 0 })
    const r = resolveStudySession(state, cards)
    expect(r && r.index >= r.deck.length).toBe(true)
  })

  it('형식이 다른 값은 무시한다', () => {
    expect(parseStudySessionState({ foo: 1 })).toBeNull()
    expect(parseStudySessionState(null)).toBeNull()
  })
})
