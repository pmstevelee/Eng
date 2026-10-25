import { describe, expect, it } from 'vitest'
import { hashSeed, pickQuestionIds, questionSetSeed, seededRandom, shuffle } from './question-picker'

const ids = (n: number, prefix = 'q') => Array.from({ length: n }, (_, i) => `${prefix}${String(i).padStart(2, '0')}`)

describe('seededRandom / shuffle', () => {
  it('같은 시드면 같은 순서, 다른 시드면 대체로 다른 순서', () => {
    const list = ids(30)
    const a = shuffle(list, seededRandom(hashSeed('s1')))
    const b = shuffle(list, seededRandom(hashSeed('s1')))
    const c = shuffle(list, seededRandom(hashSeed('s2')))
    expect(a).toEqual(b)
    expect(a).not.toEqual(c)
    expect([...a].sort()).toEqual(list)
  })

  it('난수는 0 이상 1 미만', () => {
    const r = seededRandom(123)
    for (let i = 0; i < 1000; i++) {
      const v = r()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })
})

describe('pickQuestionIds', () => {
  it('종류별 기본 문항 수: 연습 12 · 확인 10 · 복습 5', () => {
    const pool = ids(40)
    expect(pickQuestionIds(pool, 'PRACTICE', { seed: 'a' })).toHaveLength(12)
    expect(pickQuestionIds(pool, 'CHECK', { seed: 'a' })).toHaveLength(10)
    expect(pickQuestionIds(pool, 'REVIEW', { seed: 'a' })).toHaveLength(5)
  })

  it('문항이 모자라면 있는 만큼만, 중복 없이', () => {
    const picked = pickQuestionIds(['a', 'b', 'a', 'c'], 'PRACTICE', { seed: 'x' })
    expect(picked).toHaveLength(3)
    expect(new Set(picked).size).toBe(3)
    expect(pickQuestionIds([], 'CHECK', { seed: 'x' })).toEqual([])
  })

  it('입력 순서가 달라도 같은 시드면 같은 결과 (DB 정렬에 흔들리지 않음)', () => {
    const pool = ids(25)
    const reversed = [...pool].reverse()
    expect(pickQuestionIds(pool, 'PRACTICE', { seed: 'k' })).toEqual(pickQuestionIds(reversed, 'PRACTICE', { seed: 'k' }))
  })

  it('시드(시도 차수)가 바뀌면 다른 세트', () => {
    const pool = ids(40)
    const r0 = pickQuestionIds(pool, 'PRACTICE', { seed: questionSetSeed('s', 'p', 'PRACTICE', 0) })
    const r1 = pickQuestionIds(pool, 'PRACTICE', { seed: questionSetSeed('s', 'p', 'PRACTICE', 1) })
    expect(r0).not.toEqual(r1)
  })

  it('확인 테스트는 직전 확인 문항과 이번 연습 문항을 피한다 (충분할 때)', () => {
    const pool = ids(40)
    const lastCheck = new Set(pool.slice(0, 10))
    const practice = new Set(pool.slice(10, 22))
    const picked = pickQuestionIds(pool, 'CHECK', { seed: 'c', avoid: [lastCheck, practice] })
    expect(picked).toHaveLength(10)
    for (const id of picked) {
      expect(lastCheck.has(id)).toBe(false)
      expect(practice.has(id)).toBe(false)
    }
  })

  it('부족하면 연습 문항부터, 그래도 부족하면 직전 확인 문항으로 완화', () => {
    const pool = ids(25)
    const lastCheck = new Set(pool.slice(0, 10))
    const practice = new Set(pool.slice(10, 22)) // 남는 새 문항 3개
    const picked = pickQuestionIds(pool, 'CHECK', { seed: 'c', avoid: [lastCheck, practice] })
    expect(picked).toHaveLength(10)
    expect(picked.filter((id) => !lastCheck.has(id) && !practice.has(id))).toHaveLength(3)
    expect(picked.filter((id) => practice.has(id))).toHaveLength(7)
    expect(picked.filter((id) => lastCheck.has(id))).toHaveLength(0)

    const tiny = ids(15)
    const picked2 = pickQuestionIds(tiny, 'CHECK', {
      seed: 'c',
      avoid: [new Set(tiny.slice(0, 10)), new Set(tiny.slice(5, 15))],
    })
    // 둘 다 아닌 문항 없음 → 연습에만(10~14) 5개 → 나머지 5개는 직전 확인에서
    expect(picked2).toHaveLength(10)
    expect(picked2.filter((id) => tiny.indexOf(id) >= 10)).toHaveLength(5)
  })
})
