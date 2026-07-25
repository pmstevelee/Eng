import { describe, it, expect } from 'vitest'
import { pickAdaptiveQuestion, type AdaptivePickCandidate } from './adaptive-selection'

function makePool(): AdaptivePickCandidate[] {
  // 난이도 1~10, 난이도당 10문제 (q-{난이도}-{번호})
  const pool: AdaptivePickCandidate[] = []
  for (let d = 1; d <= 10; d++) {
    for (let i = 0; i < 10; i++) {
      pool.push({ id: `q-${d}-${i}`, difficulty: d, qualityScore: 0.9 - i * 0.05 })
    }
  }
  return pool
}

const noExclusions = () => ({
  sessionUsedIds: new Set<string>(),
  studentSeenIds: new Set<string>(),
  academyUsedIds: new Set<string>(),
})

describe('pickAdaptiveQuestion', () => {
  it('목표 난이도의 문제를 우선 선택한다', () => {
    const q = pickAdaptiveQuestion(makePool(), 5, noExclusions())
    expect(q).not.toBeNull()
    expect(q!.difficulty).toBe(5)
  })

  it('같은 조건으로 반복 호출해도 항상 같은 문제가 나오지 않는다 (랜덤화)', () => {
    const pool = makePool()
    const picked = new Set<string>()
    for (let i = 0; i < 50; i++) {
      const q = pickAdaptiveQuestion(pool, 5, noExclusions())
      picked.add(q!.id)
    }
    // 상위 품질 그룹(최소 3개) 내에서 추첨되므로 2개 이상의 서로 다른 문제가 나와야 함
    expect(picked.size).toBeGreaterThan(1)
  })

  it('세션에서 이미 출제된 문제는 절대 다시 선택하지 않는다', () => {
    const pool = makePool()
    const sessionUsedIds = new Set<string>()
    for (let i = 0; i < 10; i++) {
      const q = pickAdaptiveQuestion(pool, 5, { ...noExclusions(), sessionUsedIds })
      expect(q).not.toBeNull()
      expect(sessionUsedIds.has(q!.id)).toBe(false)
      sessionUsedIds.add(q!.id)
    }
    expect(sessionUsedIds.size).toBe(10)
  })

  it('학생이 이미 푼 문제는 미풀이 문제가 남아있는 한 선택하지 않는다', () => {
    const pool = makePool()
    // 난이도 5의 절반을 학생이 이미 풀었다고 가정
    const studentSeenIds = new Set(['q-5-0', 'q-5-1', 'q-5-2', 'q-5-3', 'q-5-4'])
    for (let i = 0; i < 30; i++) {
      const q = pickAdaptiveQuestion(pool, 5, { ...noExclusions(), studentSeenIds })
      expect(studentSeenIds.has(q!.id)).toBe(false)
    }
  })

  it('학원 사용 이력이 있는 문제보다 미사용 문제를 우선한다', () => {
    const pool = makePool()
    const academyUsedIds = new Set(
      Array.from({ length: 9 }, (_, i) => `q-5-${i}`), // q-5-9만 미사용
    )
    for (let i = 0; i < 20; i++) {
      const q = pickAdaptiveQuestion(pool, 5, { ...noExclusions(), academyUsedIds })
      expect(q!.id).toBe('q-5-9')
    }
  })

  it('미풀이 문제가 소진되면 이미 푼 문제라도 출제한다 (풀 소진 완화)', () => {
    const pool = makePool()
    // 난이도 4~6 전체를 이미 풀었다고 가정
    const studentSeenIds = new Set(
      pool.filter((q) => q.difficulty >= 4 && q.difficulty <= 6).map((q) => q.id),
    )
    const q = pickAdaptiveQuestion(pool, 5, { ...noExclusions(), studentSeenIds })
    expect(q).not.toBeNull()
    expect(q!.difficulty).toBe(5) // 난이도는 유지하되 기풀이 문제 허용
  })

  it('목표 난이도에 문제가 없으면 ±1 → ±2 범위로 폴백한다', () => {
    const pool = makePool().filter((q) => q.difficulty !== 5 && q.difficulty !== 4 && q.difficulty !== 6)
    const q = pickAdaptiveQuestion(pool, 5, noExclusions())
    expect(q).not.toBeNull()
    expect([3, 7]).toContain(q!.difficulty)
  })

  it('±2 범위에도 문제가 없으면 null을 반환한다', () => {
    const pool = makePool().filter((q) => q.difficulty >= 9)
    const q = pickAdaptiveQuestion(pool, 5, noExclusions())
    expect(q).toBeNull()
  })

  it('난이도 범위를 1~10으로 클램프한다', () => {
    const q = pickAdaptiveQuestion(makePool(), 12, noExclusions())
    expect(q!.difficulty).toBe(10)
    const q2 = pickAdaptiveQuestion(makePool(), -3, noExclusions())
    expect(q2!.difficulty).toBe(1)
  })

  it('품질 상위 그룹에서만 추첨한다 (random 주입)', () => {
    const pool = makePool()
    // random=0 → 정렬 1위 (품질 최고), random=0.999 → topK 마지막
    const first = pickAdaptiveQuestion(pool, 5, noExclusions(), () => 0)
    expect(first!.id).toBe('q-5-0')
    const last = pickAdaptiveQuestion(pool, 5, noExclusions(), () => 0.999)
    // 난이도 5 후보 10개의 topK = max(3, ceil(10*0.3)) = 3 → 3번째 문제
    expect(last!.id).toBe('q-5-2')
  })
})
