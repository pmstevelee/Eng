'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, Info } from 'lucide-react'

type ScheduleTest = {
  id: string
  title: string
  type: string
  status: string
  classId: string | null
  className: string | null
  date: string // YYYY-MM-DD
}

type ClassItem = { id: string; name: string }

// Colors cycling for classes
const CLASS_COLORS = [
  { chip: 'bg-blue-100 text-blue-700 border-blue-200', dot: '#1865F2' },
  { chip: 'bg-purple-100 text-purple-700 border-purple-200', dot: '#7854F7' },
  { chip: 'bg-teal-100 text-teal-700 border-teal-200', dot: '#0FBFAD' },
  { chip: 'bg-orange-100 text-orange-700 border-orange-200', dot: '#E35C20' },
  { chip: 'bg-green-100 text-green-700 border-green-200', dot: '#1FAF54' },
  { chip: 'bg-yellow-100 text-yellow-700 border-yellow-200', dot: '#FFB100' },
  { chip: 'bg-red-100 text-red-700 border-red-200', dot: '#D92916' },
]

const TYPE_LABEL: Record<string, string> = {
  LEVEL_TEST: '레벨',
  UNIT_TEST: '단원',
  PRACTICE: '연습',
}
const STATUS_LABEL: Record<string, string> = {
  DRAFT: '초안',
  PUBLISHED: '배포됨',
  GRADED: '채점완료',
}
const STATUS_COLOR: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-500',
  PUBLISHED: 'bg-blue-100 text-blue-700',
  GRADED: 'bg-green-100 text-green-700',
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

function buildClassColorMap(classList: ClassItem[]) {
  const map = new Map<string, number>()
  classList.forEach((c, i) => map.set(c.id, i))
  return map
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay() // 0=Sun
}

export default function ScheduleClient({
  tests,
  classList,
}: {
  tests: ScheduleTest[]
  classList: ClassItem[]
}) {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth()) // 0-indexed
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [showRegularModal, setShowRegularModal] = useState(false)

  const classColorMap = useMemo(() => buildClassColorMap(classList), [classList])

  function getClassColor(classId: string | null) {
    if (!classId) return CLASS_COLORS[CLASS_COLORS.length - 1]
    const idx = classColorMap.get(classId) ?? 0
    return CLASS_COLORS[idx % CLASS_COLORS.length]
  }

  // Tests grouped by date
  const testsByDate = useMemo(() => {
    const map = new Map<string, ScheduleTest[]>()
    for (const t of tests) {
      const list = map.get(t.date) ?? []
      list.push(t)
      map.set(t.date, list)
    }
    return map
  }, [tests])

  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfMonth(year, month)

  // Build calendar grid
  const calendarDays: Array<{ day: number | null; dateStr: string | null }> = []
  for (let i = 0; i < firstDay; i++) {
    calendarDays.push({ day: null, dateStr: null })
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    calendarDays.push({ day: d, dateStr })
  }
  // Pad to full weeks
  while (calendarDays.length % 7 !== 0) {
    calendarDays.push({ day: null, dateStr: null })
  }

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(y => y - 1) }
    else setMonth(m => m - 1)
    setSelectedDate(null)
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(y => y + 1) }
    else setMonth(m => m + 1)
    setSelectedDate(null)
  }

  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  const selectedTests = selectedDate ? (testsByDate.get(selectedDate) ?? []) : []

  // Month stats
  const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`
  const monthTests = tests.filter((t) => t.date.startsWith(monthPrefix))

  return (
    <div className="space-y-4">
      {/* 이번달 요약 */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-gray-200 bg-white p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{monthTests.length}</p>
          <p className="text-xs text-gray-500 mt-0.5">이번 달 출제</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 text-center">
          <p className="text-2xl font-bold text-[#1865F2]">
            {monthTests.filter((t) => t.status === 'PUBLISHED').length}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">배포됨</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 text-center">
          <p className="text-2xl font-bold text-[#1FAF54]">
            {monthTests.filter((t) => t.status === 'GRADED').length}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">채점완료</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* 달력 */}
        <div className="lg:col-span-2 rounded-xl border border-gray-200 bg-white overflow-hidden">
          {/* 달력 헤더 */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <button
              onClick={prevMonth}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
            >
              <ChevronLeft size={18} />
            </button>
            <h2 className="text-base font-bold text-gray-900">
              {year}년 {month + 1}월
            </h2>
            <button
              onClick={nextMonth}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          {/* 요일 헤더 */}
          <div className="grid grid-cols-7 border-b border-gray-100">
            {WEEKDAYS.map((d, i) => (
              <div
                key={d}
                className={`py-2 text-center text-xs font-semibold ${
                  i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-500'
                }`}
              >
                {d}
              </div>
            ))}
          </div>

          {/* 날짜 그리드 */}
          <div className="grid grid-cols-7">
            {calendarDays.map((cell, idx) => {
              const dayOfWeek = idx % 7
              const isToday = cell.dateStr === todayStr
              const isSelected = cell.dateStr === selectedDate
              const dayTests = cell.dateStr ? (testsByDate.get(cell.dateStr) ?? []) : []
              const hasTests = dayTests.length > 0

              return (
                <div
                  key={idx}
                  onClick={() => cell.dateStr && setSelectedDate(isSelected ? null : cell.dateStr)}
                  className={`min-h-[72px] p-1.5 border-b border-r border-gray-50 transition-colors ${
                    cell.day === null ? 'bg-gray-50/50' : 'cursor-pointer'
                  } ${isSelected ? 'bg-primary-50' : hasTests && !isSelected ? 'hover:bg-gray-50' : 'hover:bg-gray-50'}`}
                >
                  {cell.day !== null && (
                    <>
                      <div className="flex items-center justify-between mb-1">
                        <span
                          className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full ${
                            isToday
                              ? 'bg-primary-700 text-white'
                              : dayOfWeek === 0
                                ? 'text-red-400'
                                : dayOfWeek === 6
                                  ? 'text-blue-400'
                                  : 'text-gray-700'
                          }`}
                        >
                          {cell.day}
                        </span>
                      </div>
                      {/* Test chips (show max 2) */}
                      <div className="space-y-0.5">
                        {dayTests.slice(0, 2).map((t) => {
                          const color = getClassColor(t.classId)
                          return (
                            <div
                              key={t.id}
                              className={`text-xs px-1.5 py-0.5 rounded truncate border ${color.chip} text-[10px] leading-snug`}
                            >
                              {t.title}
                            </div>
                          )
                        })}
                        {dayTests.length > 2 && (
                          <div className="text-[10px] text-gray-400 px-1">
                            +{dayTests.length - 2}개
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* 사이드: 선택된 날 또는 범례 */}
        <div className="space-y-4">
          {/* 날짜 클릭 시 해당일 테스트 목록 */}
          {selectedDate ? (
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-700">
                  {new Date(selectedDate + 'T00:00:00').toLocaleDateString('ko-KR', {
                    month: 'long',
                    day: 'numeric',
                  })}
                </h3>
                <button
                  onClick={() => setSelectedDate(null)}
                  className="text-xs text-gray-400 hover:text-gray-600"
                >
                  닫기
                </button>
              </div>
              {selectedTests.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">이 날 테스트 없음</p>
              ) : (
                <div className="space-y-2">
                  {selectedTests.map((t) => {
                    const color = getClassColor(t.classId)
                    return (
                      <Link
                        key={t.id}
                        href={`/owner/tests/${t.id}`}
                        className="block rounded-lg border border-gray-100 p-3 hover:border-primary-200 hover:bg-primary-50 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium text-gray-900 line-clamp-2 flex-1">
                            {t.title}
                          </p>
                          <span
                            className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${STATUS_COLOR[t.status] ?? 'bg-gray-100 text-gray-500'}`}
                          >
                            {STATUS_LABEL[t.status] ?? t.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="text-[10px] font-semibold text-gray-500">
                            {TYPE_LABEL[t.type] ?? t.type}
                          </span>
                          {t.className && (
                            <>
                              <span className="text-gray-300">·</span>
                              <div className="flex items-center gap-1">
                                <span
                                  className="w-2 h-2 rounded-full"
                                  style={{ backgroundColor: color.dot }}
                                />
                                <span className="text-[10px] text-gray-500">{t.className}</span>
                              </div>
                            </>
                          )}
                        </div>
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <p className="text-xs text-gray-400 text-center py-2">날짜를 클릭하면 해당 일의 테스트 목록을 볼 수 있습니다.</p>
            </div>
          )}

          {/* 반별 색상 범례 */}
          {classList.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                반별 색상
              </h3>
              <div className="space-y-2">
                {classList.map((c) => {
                  const color = getClassColor(c.id)
                  return (
                    <div key={c.id} className="flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-sm shrink-0"
                        style={{ backgroundColor: color.dot }}
                      />
                      <span className="text-sm text-gray-700">{c.name}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* 정기 테스트 설정 */}
          <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4">
            <div className="flex items-start gap-2">
              <Info size={14} className="text-gray-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-gray-600 mb-0.5">정기 테스트 설정</p>
                <p className="text-xs text-gray-400 leading-relaxed">
                  매월 첫째 주 토요일 레벨 테스트 등 반복 일정 설정 기능은 준비 중입니다.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
