// 문법 포인트 문항 추출 — 연습 12 · 확인 10 · 복습 5
//
// 같은 학생·포인트·시도 차수면 항상 같은 문항이 나오도록 시드 난수로 섞는다.
// (새로고침·중간 이탈 후 돌아와도 같은 문항이어야 localStorage에 백업한 풀이를 이어 쓸 수 있다)
// 문항이 모자라면 있는 만큼만 준다.
//
// vitest로 테스트하므로 @/ 경로를 쓰지 않는다. DB 조회는 unit-queries.ts.

import { CHECK_SIZE, PRACTICE_SIZE, REVIEW_SIZE } from './constants'

export type GrammarQuestionSetKind = 'PRACTICE' | 'CHECK' | 'REVIEW'

const SET_SIZE: Record<GrammarQuestionSetKind, number> = {
  PRACTICE: PRACTICE_SIZE,
  CHECK: CHECK_SIZE,
  REVIEW: REVIEW_SIZE,
}

/** 문자열 → 32비트 시드 (FNV-1a) */
export function hashSeed(text: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** 시드 난수 (mulberry32) — 0 이상 1 미만 */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** 섞은 새 배열 (Fisher-Yates) */
export function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const out = items.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    const tmp = out[i]
    out[i] = out[j]
    out[j] = tmp
  }
  return out
}

/** 시드 문자열 — 학생·포인트·종류·차수가 같으면 같은 문항 세트 */
export function questionSetSeed(studentId: string, pointId: string, kind: GrammarQuestionSetKind, round: number): string {
  return `${studentId}:${pointId}:${kind}:${round}`
}

export interface PickOptions {
  seed: string
  /** 기본값: 종류별 문항 수 */
  size?: number
  /** 우선 제외 그룹 — 앞 그룹일수록 나중에 쓴다 (부족할 때만 완화) */
  avoid?: ReadonlyArray<ReadonlySet<string>>
}

/**
 * 문항 id 목록에서 세트를 뽑는다.
 * avoid 그룹에 걸리지 않는 문항을 먼저 쓰고, 모자라면 avoid의 뒤 그룹에 걸린 것부터 채운다.
 * 예) 확인 테스트: avoid = [직전 확인 문항, 이번 연습 문항]
 *     → 둘 다 아닌 것 → 연습에만 나온 것 → 직전 확인에 나온 것 순서로 채움
 */
export function pickQuestionIds(
  ids: readonly string[],
  kind: GrammarQuestionSetKind,
  { seed, size = SET_SIZE[kind], avoid = [] }: PickOptions,
): string[] {
  const unique = Array.from(new Set(ids)).sort()
  const shuffled = shuffle(unique, seededRandom(hashSeed(seed)))
  if (avoid.length === 0) return shuffled.slice(0, size)

  // 각 문항이 걸린 avoid 그룹 중 가장 앞 그룹 번호(우선 제외일수록 작음) — 안 걸리면 avoid.length
  const rank = (id: string): number => {
    for (let i = 0; i < avoid.length; i++) if (avoid[i].has(id)) return i
    return avoid.length
  }
  // 정렬 안정성을 이용: 같은 그룹 안에서는 섞인 순서 유지, 걸리지 않은 것 → 뒤 그룹 → 앞 그룹
  return shuffled
    .map((id, i) => ({ id, i, r: rank(id) }))
    .sort((a, b) => b.r - a.r || a.i - b.i)
    .slice(0, size)
    .map((x) => x.id)
}
