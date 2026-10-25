// 강의 시청 구간 계산 — 순수 함수 (DB·@/ 의존 없음, vitest 대상)
//
// 재생 중 1초마다 재생 위치를 샘플링해, 직전 샘플과 가까우면(정상 재생) 그 사이를 "본 구간"으로 더한다.
// 끝으로 건너뛰면 두 샘플 차이가 커서 구간이 생기지 않는다 → 안 본 부분은 시청률에 들어가지 않는다.

/** [시작초, 끝초] — 항상 시작 ≤ 끝 */
export type WatchInterval = [number, number]

/** 샘플 사이가 이 값(초)보다 크면 건너뛴 것으로 본다 (1초 샘플 × 2배속 + 여유) */
export const MAX_SAMPLE_GAP_SEC = 2.5

function isFiniteNumber(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n)
}

/** 겹치거나 맞닿은 구간을 합쳐 정렬된 목록으로 */
export function mergeIntervals(intervals: WatchInterval[]): WatchInterval[] {
  const sorted = intervals
    .filter(([a, b]) => isFiniteNumber(a) && isFiniteNumber(b) && b > a)
    .map(([a, b]): WatchInterval => [Math.max(0, a), b])
    .sort((x, y) => x[0] - y[0])
  const out: WatchInterval[] = []
  for (const [a, b] of sorted) {
    const last = out[out.length - 1]
    if (last && a <= last[1]) last[1] = Math.max(last[1], b)
    else out.push([a, b])
  }
  return out
}

/** 구간 하나를 더하고 합친다 */
export function addInterval(intervals: WatchInterval[], start: number, end: number): WatchInterval[] {
  if (!isFiniteNumber(start) || !isFiniteNumber(end) || end <= start) return mergeIntervals(intervals)
  return mergeIntervals([...intervals, [start, end]])
}

/** 본 시간 합계(초) — duration이 있으면 그 안으로 자른다 */
export function coveredSeconds(intervals: WatchInterval[], durationSec?: number | null): number {
  const limit = isFiniteNumber(durationSec) && durationSec > 0 ? durationSec : Infinity
  return mergeIntervals(intervals).reduce((sum, [a, b]) => {
    const end = Math.min(b, limit)
    return end > a ? sum + (end - a) : sum
  }, 0)
}

/** 시청률(0~100 정수, 내림) */
export function watchedPercent(intervals: WatchInterval[], durationSec: number | null | undefined): number {
  if (!isFiniteNumber(durationSec) || durationSec <= 0) return 0
  const pct = Math.floor((coveredSeconds(intervals, durationSec) / durationSec) * 100)
  return Math.max(0, Math.min(100, pct))
}

/**
 * 새 샘플 반영 — 직전 샘플과의 차이가 0 초과 maxGap 이하면 그 사이를 본 구간으로 더한다.
 * 뒤로 감기·건너뛰기·멈춤은 구간을 만들지 않고 기준점만 옮긴다.
 */
export function applySample(
  intervals: WatchInterval[],
  lastSample: number | null,
  currentTime: number,
  maxGap: number = MAX_SAMPLE_GAP_SEC,
): { intervals: WatchInterval[]; lastSample: number | null } {
  if (!isFiniteNumber(currentTime) || currentTime < 0) return { intervals, lastSample }
  if (lastSample !== null) {
    const diff = currentTime - lastSample
    if (diff > 0 && diff <= maxGap) return { intervals: addInterval(intervals, lastSample, currentTime), lastSample: currentTime }
  }
  return { intervals, lastSample: currentTime }
}

/** localStorage 등에서 읽은 값을 구간 목록으로 (형식이 틀리면 빈 목록) */
export function parseIntervals(value: unknown): WatchInterval[] {
  if (!Array.isArray(value)) return []
  const out: WatchInterval[] = []
  for (const item of value.slice(0, 500)) {
    if (Array.isArray(item) && item.length === 2 && isFiniteNumber(item[0]) && isFiniteNumber(item[1])) {
      out.push([item[0], item[1]])
    }
  }
  return mergeIntervals(out)
}

/** 저장용으로 소수 첫째 자리까지 줄인다 */
export function compactIntervals(intervals: WatchInterval[]): WatchInterval[] {
  return mergeIntervals(intervals).map(([a, b]): WatchInterval => [Math.round(a * 10) / 10, Math.round(b * 10) / 10])
}
