import { describe, expect, it } from 'vitest'
import { formatWeekRange, weekDaysOf, weekStartOf, weekdayLabel, weeklySetTitle } from './week'

describe('weekStartOf', () => {
  it('월요일은 그대로', () => {
    expect(weekStartOf('2026-10-19')).toBe('2026-10-19')
  })
  it('주 중간은 그 주 월요일', () => {
    expect(weekStartOf('2026-10-23')).toBe('2026-10-19')
  })
  it('일요일은 앞 주 월요일 (월~일 한 주)', () => {
    expect(weekStartOf('2026-10-25')).toBe('2026-10-19')
  })
  it('월이 바뀌는 주', () => {
    expect(weekStartOf('2026-11-01')).toBe('2026-10-26')
  })
})

describe('weekDaysOf', () => {
  it('월요일부터 7일', () => {
    const days = weekDaysOf('2026-10-26')
    expect(days).toHaveLength(7)
    expect(days[0]).toBe('2026-10-26')
    expect(days[6]).toBe('2026-11-01')
    expect(weekdayLabel(days[0])).toBe('월')
    expect(weekdayLabel(days[6])).toBe('일')
  })
})

describe('weeklySetTitle', () => {
  it('주 범위가 제목에 들어간다', () => {
    expect(formatWeekRange('2026-10-26')).toBe('10월 26일 ~ 11월 1일')
    expect(weeklySetTitle('2026-10-19')).toBe('주간 단어 · 10월 19일 ~ 10월 25일')
  })
})
