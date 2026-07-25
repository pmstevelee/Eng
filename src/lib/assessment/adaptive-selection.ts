/**
 * 적응형 레벨 테스트 문제 선정 (순수 로직, DB 의존성 없음)
 */

export type AdaptivePickCandidate = {
  id: string
  difficulty: number
  qualityScore: number | null
}

export type AdaptiveExclusions = {
  /** 이번 세션에서 이미 출제된 문제 (절대 제외) */
  sessionUsedIds: Set<string>
  /** 학생이 과거에 이미 푼 문제 (우선 제외, 풀 소진 시 완화) */
  studentSeenIds: Set<string>
  /** 학원에서 최근 1년 내 레벨테스트에 사용된 문제 (선호도 하향) */
  academyUsedIds: Set<string>
}

/**
 * 메모리 풀에서 다음 문제 선정 (순수 함수, DB 호출 없음)
 * - 목표 난이도 정확히 일치 → ±1 → ±2 순으로 후보 탐색
 * - 학생 미풀이 + 학원 미사용 문제 우선, 소진 시 단계적으로 완화
 * - 후보 중 품질 상위 그룹에서 무작위 추첨 (같은 문제 반복 배치 방지)
 */
export function pickAdaptiveQuestion(
  pool: AdaptivePickCandidate[],
  targetDifficulty: number,
  exclusions: AdaptiveExclusions,
  random: () => number = Math.random,
): AdaptivePickCandidate | null {
  const target = Math.max(1, Math.min(10, targetDifficulty))
  const { sessionUsedIds, studentSeenIds, academyUsedIds } = exclusions

  for (const range of [0, 1, 2]) {
    const candidates = pool.filter(
      (q) =>
        Math.abs(q.difficulty - target) <= range && !sessionUsedIds.has(q.id),
    )
    if (candidates.length === 0) continue

    // 선호도: ① 학생 미풀이 + 학원 미사용 → ② 학생 미풀이 → ③ 전체
    const fresh = candidates.filter(
      (q) => !studentSeenIds.has(q.id) && !academyUsedIds.has(q.id),
    )
    const unseen = candidates.filter((q) => !studentSeenIds.has(q.id))
    const tier = fresh.length > 0 ? fresh : unseen.length > 0 ? unseen : candidates

    // 난이도 근접 우선, 그다음 품질 내림차순 정렬 후 상위 그룹에서 무작위 추첨
    const sorted = [...tier].sort((a, b) => {
      const distDiff = Math.abs(a.difficulty - target) - Math.abs(b.difficulty - target)
      if (distDiff !== 0) return distDiff
      return (b.qualityScore ?? 0) - (a.qualityScore ?? 0)
    })
    const topK = Math.min(sorted.length, Math.max(3, Math.ceil(sorted.length * 0.3)))
    return sorted[Math.floor(random() * topK)]
  }

  return null
}
