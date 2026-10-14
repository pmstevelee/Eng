import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { addDays, addMonths, dayOfWeekOf, monthRange, todayKst } from '@/lib/attendance/time'
import type { CalendarDayActivity } from '@/lib/learning/home-calendar'

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

const KINDS = [
  { key: 'word', label: '단어', color: '#7854F7' },
  { key: 'grammar', label: '문법', color: '#1865F2' },
  { key: 'writing', label: '쓰기', color: '#E35C20' },
] as const

export function LearningCalendar({
  monthKey,
  activity,
}: {
  monthKey: string
  activity: Record<string, CalendarDayActivity>
}) {
  const today = todayKst()
  const { first, last } = monthRange(monthKey)
  const lastDay = Number(last.slice(8, 10))
  const leading = dayOfWeekOf(first)
  const [year, month] = monthKey.split('-').map(Number)

  const cells: (string | null)[] = [
    ...Array.from({ length: leading }, () => null),
    ...Array.from({ length: lastDay }, (_, i) => addDays(first, i)),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  const days = Object.entries(activity)
  const totals = KINDS.map((k) => ({
    ...k,
    count: days.filter(([, a]) => a[k.key]).length,
  }))

  const navClass =
    'flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50'

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-bold text-gray-900">학습 캘린더</h2>
        <div className="flex items-center gap-2">
          <Link href={`/student?month=${addMonths(monthKey, -1)}`} className={navClass} aria-label="이전 달">
            <ChevronLeft size={16} />
          </Link>
          <span className="min-w-[88px] text-center text-sm font-medium text-gray-900">
            {year}년 {month}월
          </span>
          <Link href={`/student?month=${addMonths(monthKey, 1)}`} className={navClass} aria-label="다음 달">
            <ChevronRight size={16} />
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS.map((w, i) => (
          <div
            key={w}
            className={`pb-1 text-xs font-medium ${i === 0 ? 'text-[#D92916]' : i === 6 ? 'text-[#1865F2]' : 'text-gray-500'}`}
          >
            {w}
          </div>
        ))}
        {cells.map((key, idx) => {
          if (!key) return <div key={`e-${idx}`} className="min-h-[52px]" />
          const a = activity[key]
          const isToday = key === today
          return (
            <div
              key={key}
              className={`flex min-h-[52px] flex-col items-center justify-start rounded-lg py-1.5 ${
                isToday ? 'border border-[#1865F2] bg-[#1865F2]/5' : 'border border-transparent'
              }`}
            >
              <span className={`text-xs ${isToday ? 'font-bold text-[#1865F2]' : 'text-gray-700'}`}>
                {Number(key.slice(8, 10))}
              </span>
              <div className="mt-1.5 flex h-2 items-center gap-0.5">
                {KINDS.map((k) =>
                  a?.[k.key] ? (
                    <span
                      key={k.key}
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: k.color }}
                      title={`${k.label}학습 완료`}
                    />
                  ) : null,
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-gray-100 pt-3">
        {totals.map((t) => (
          <span key={t.key} className="flex items-center gap-1.5 text-xs text-gray-500">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: t.color }} />
            {t.label}학습 <b className="text-gray-900">{t.count}일</b>
          </span>
        ))}
      </div>
    </div>
  )
}
