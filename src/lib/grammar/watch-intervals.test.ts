import { describe, expect, it } from 'vitest'
import {
  addInterval,
  applySample,
  compactIntervals,
  coveredSeconds,
  mergeIntervals,
  parseIntervals,
  watchedPercent,
  type WatchInterval,
} from './watch-intervals'

describe('mergeIntervals', () => {
  it('겹치거나 맞닿은 구간을 합친다', () => {
    expect(mergeIntervals([[10, 20], [0, 5], [5, 8], [15, 30]])).toEqual([[0, 8], [10, 30]])
  })
  it('잘못된 구간은 버린다', () => {
    expect(mergeIntervals([[5, 5], [8, 3], [NaN, 4], [-3, 2]])).toEqual([[0, 2]])
  })
})

describe('coveredSeconds · watchedPercent', () => {
  it('같은 부분을 여러 번 봐도 한 번만 센다', () => {
    let iv: WatchInterval[] = []
    iv = addInterval(iv, 0, 30)
    iv = addInterval(iv, 10, 40)
    iv = addInterval(iv, 0, 20)
    expect(coveredSeconds(iv)).toBe(40)
    expect(watchedPercent(iv, 100)).toBe(40)
  })
  it('길이를 넘는 부분은 자른다', () => {
    expect(coveredSeconds([[90, 120]], 100)).toBe(10)
    expect(watchedPercent([[0, 200]], 100)).toBe(100)
  })
  it('길이를 모르면 0%', () => {
    expect(watchedPercent([[0, 50]], null)).toBe(0)
    expect(watchedPercent([[0, 50]], 0)).toBe(0)
  })
  it('내림으로 계산한다 (79.9% → 79)', () => {
    expect(watchedPercent([[0, 79.9]], 100)).toBe(79)
  })
})

describe('applySample — 1초 샘플링', () => {
  function play(samples: number[]): WatchInterval[] {
    let state: { intervals: WatchInterval[]; lastSample: number | null } = { intervals: [], lastSample: null }
    for (const t of samples) state = applySample(state.intervals, state.lastSample, t)
    return state.intervals
  }

  it('정상 재생은 구간으로 쌓인다', () => {
    expect(play([0, 1, 2, 3, 4, 5])).toEqual([[0, 5]])
  })
  it('끝으로 건너뛰면 안 본 부분은 들어가지 않는다', () => {
    const iv = play([0, 1, 2, 3, 95, 96, 97, 98, 99, 100])
    expect(iv).toEqual([[0, 3], [95, 100]])
    expect(watchedPercent(iv, 100)).toBe(8)
  })
  it('뒤로 감아 다시 보면 겹친 부분은 한 번만', () => {
    const iv = play([0, 1, 2, 3, 4, 5, 2, 3, 4, 5, 6])
    expect(iv).toEqual([[0, 6]])
  })
  it('2배속은 본 것으로 센다', () => {
    expect(play([0, 2, 4, 6])).toEqual([[0, 6]])
  })
  it('멈춘 동안(같은 위치)은 늘지 않는다', () => {
    expect(play([0, 1, 1, 1, 2])).toEqual([[0, 2]])
  })
  it('처음부터 끝까지 보면 100%', () => {
    const samples = Array.from({ length: 121 }, (_, i) => i)
    expect(watchedPercent(play(samples), 120)).toBe(100)
  })
})

describe('parseIntervals · compactIntervals', () => {
  it('저장값 복원', () => {
    expect(parseIntervals([[0, 5], [3, 9], 'x', [1], [2, 'a']])).toEqual([[0, 9]])
    expect(parseIntervals('oops')).toEqual([])
    expect(parseIntervals(null)).toEqual([])
  })
  it('소수 첫째 자리까지', () => {
    expect(compactIntervals([[0.123, 5.678]])).toEqual([[0.1, 5.7]])
  })
})
