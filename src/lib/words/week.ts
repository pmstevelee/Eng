// 주간 단어학습 날짜 헬퍼 — 한 주는 월요일~일요일(KST), 날짜 키는 'YYYY-MM-DD'

import { addDays, dayOfWeekOf } from '../attendance/time'

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'] as const

/** 날짜가 속한 주의 월요일 */
export function weekStartOf(dateKey: string): string {
  const dow = dayOfWeekOf(dateKey)
  return addDays(dateKey, dow === 0 ? -6 : 1 - dow)
}

/** 월요일부터 일요일까지 7일 */
export function weekDaysOf(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
}

export function weekdayLabel(dateKey: string): string {
  return WEEKDAY_LABELS[dayOfWeekOf(dateKey)]
}

function monthDay(dateKey: string): string {
  const [, m, d] = dateKey.split('-').map(Number)
  return `${m}월 ${d}일`
}

/** '10월 19일 ~ 10월 25일' */
export function formatWeekRange(weekStart: string): string {
  return `${monthDay(weekStart)} ~ ${monthDay(addDays(weekStart, 6))}`
}

/** 주간 테스트용 세트 제목 — 학생별·주별로 하나씩 만들고 이 제목으로 찾는다 */
export function weeklySetTitle(weekStart: string): string {
  return `주간 단어 · ${formatWeekRange(weekStart)}`
}
