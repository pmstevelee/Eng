// 문법학습 화면 공용 표시 헬퍼

/** 'YYYY-MM-DD' → '10월 30일' */
export function formatDueKey(dueKey: string): string {
  const [, m, d] = dueKey.split('-').map(Number)
  return `${m}월 ${d}일`
}

/** 남은 일수 → 'D-3' / '오늘 마감' / '마감 2일 지남' */
export function formatDaysLeft(daysLeft: number): string {
  if (daysLeft === 0) return '오늘 마감'
  if (daysLeft < 0) return `마감 ${-daysLeft}일 지남`
  return `D-${daysLeft}`
}
