// 문법학습 관리 화면 날짜 표시 — 'YYYY-MM-DD' → '10월 27일(화)'

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

export function formatDateKey(key: string | null): string {
  if (!key) return ''
  const [y, m, d] = key.split('-').map(Number)
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  return `${m}월 ${d}일(${WEEKDAYS[day]})`
}
