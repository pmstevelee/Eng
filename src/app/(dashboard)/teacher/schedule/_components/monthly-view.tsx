'use client'

import { useMemo } from 'react'
import {
  ClassData,
  TestEvent,
  PersonalEvent,
  CLASS_COLORS,
  EVENT_TYPE_COLORS,
  parseScheduleJson,
  formatDateStr,
  personalEventMatchesDate,
} from './types'

const DAY_LABELS = ['월', '화', '수', '목', '금', '토', '일']

type DayEvent = {
  kind: 'class' | 'test' | 'personal'
  label: string
  color: string
  light: string
}

type Props = {
  currentDate: Date
  classes: ClassData[]
  tests: TestEvent[]
  personalEvents: PersonalEvent[]
  onDayClick: (date: string) => void
}

export function MonthlyView({ currentDate, classes, tests, personalEvents, onDayClick }: Props) {
  const year = currentDate.getFullYear()
  const month = currentDate.getMonth() // 0-indexed

  // 이번 달 첫날의 요일 (월=0 기준)
  const firstDayOfMonth = new Date(year, month, 1)
  const rawDow = firstDayOfMonth.getDay() // 0=일, 1=월, ..., 6=토
  const startOffset = rawDow === 0 ? 6 : rawDow - 1 // 월요일 기준 offset

  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const todayStr = formatDateStr(new Date())

  // 총 셀 수 (6주 × 7일 = 42, 또는 5주 × 7일 = 35)
  const totalCells = startOffset + daysInMonth > 35 ? 42 : 35

  // 각 날짜별 이벤트 미리 계산
  const eventsByDate = useMemo(() => {
    const map = new Map<string, DayEvent[]>()

    const addEvent = (dateStr: string, event: DayEvent) => {
      const list = map.get(dateStr) ?? []
      list.push(event)
      map.set(dateStr, list)
    }

    // 반 수업 (schedule_json 기반, 이번 달의 해당 요일 모두)
    classes.forEach((cls, classIdx) => {
      const color = CLASS_COLORS[classIdx % CLASS_COLORS.length]
      const slots = parseScheduleJson(cls.scheduleJson)
      slots.forEach((slot) => {
        // 이번 달 날짜 중 day가 맞는 날 찾기
        for (let d = 1; d <= daysInMonth; d++) {
          const date = new Date(year, month, d)
          if (date.getDay() === slot.day) {
            addEvent(formatDateStr(date), {
              kind: 'class',
              label: cls.name,
              color: color.bg,
              light: color.light,
            })
          }
        }
      })
    })

    // 테스트 이벤트 (createdAt 날짜)
    tests.forEach((test) => {
      const d = new Date(test.createdAt)
      if (d.getFullYear() === year && d.getMonth() === month) {
        const dateStr = formatDateStr(d)
        addEvent(dateStr, {
          kind: 'test',
          label: test.title,
          color: '#B37D00',
          light: '#FFF8E6',
        })
      }
    })

    // 개인 일정
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d)
      personalEvents.forEach((event) => {
        if (personalEventMatchesDate(event, date)) {
          const c = EVENT_TYPE_COLORS[event.type]
          addEvent(formatDateStr(date), {
            kind: 'personal',
            label: event.title,
            color: c.bg,
            light: c.light,
          })
        }
      })
    }

    return map
  }, [classes, tests, personalEvents, year, month, daysInMonth])

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      {/* 요일 헤더 */}
      <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">
        {DAY_LABELS.map((d, i) => (
          <div
            key={d}
            className={`py-2.5 text-center text-xs font-semibold uppercase tracking-wider ${
              i === 6 ? 'text-accent-red' : 'text-gray-500'
            }`}
          >
            {d}
          </div>
        ))}
      </div>

      {/* 달력 셀 그리드 */}
      <div className="grid grid-cols-7">
        {Array.from({ length: totalCells }, (_, cellIdx) => {
          const dayNum = cellIdx - startOffset + 1
          const isCurrentMonth = dayNum >= 1 && dayNum <= daysInMonth

          if (!isCurrentMonth) {
            return (
              <div
                key={cellIdx}
                className="min-h-[90px] border-b border-r border-gray-100 bg-gray-50/50 p-1.5"
              />
            )
          }

          const date = new Date(year, month, dayNum)
          const dateStr = formatDateStr(date)
          const isToday = dateStr === todayStr
          const isSunday = date.getDay() === 0
          const isSaturday = date.getDay() === 6
          const events = eventsByDate.get(dateStr) ?? []

          const MAX_VISIBLE = 3
          const visibleEvents = events.slice(0, MAX_VISIBLE)
          const hiddenCount = events.length - MAX_VISIBLE

          return (
            <button
              key={cellIdx}
              type="button"
              onClick={() => onDayClick(dateStr)}
              className={`min-h-[90px] border-b border-r border-gray-100 p-1.5 text-left hover:bg-gray-50 transition-colors last:border-r-0 ${
                isToday ? 'bg-primary-50' : ''
              }`}
            >
              {/* 날짜 번호 */}
              <div className="mb-1 flex justify-end">
                <span
                  className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                    isToday
                      ? 'bg-primary-700 text-white'
                      : isSunday
                        ? 'text-accent-red'
                        : isSaturday
                          ? 'text-primary-700'
                          : 'text-gray-900'
                  }`}
                >
                  {dayNum}
                </span>
              </div>

              {/* 이벤트 목록 */}
              <div className="space-y-0.5">
                {visibleEvents.map((event, eIdx) => (
                  <div
                    key={eIdx}
                    className="flex items-center gap-1 rounded px-1 py-0.5"
                    style={{ backgroundColor: event.light }}
                  >
                    <div
                      className="h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ backgroundColor: event.color }}
                    />
                    <span
                      className="min-w-0 flex-1 truncate text-[10px] font-medium leading-tight"
                      style={{ color: event.color }}
                    >
                      {event.kind === 'test' ? `📝 ${event.label}` : event.label}
                    </span>
                  </div>
                ))}
                {hiddenCount > 0 && (
                  <div className="px-1 text-[10px] font-medium text-gray-400">
                    +{hiddenCount}개
                  </div>
                )}
              </div>
            </button>
          )
        })}
      </div>

      {/* 범례 */}
      <div className="flex flex-wrap items-center gap-4 border-t border-gray-100 bg-gray-50 px-4 py-2.5">
        {classes.map((cls, idx) => {
          const color = CLASS_COLORS[idx % CLASS_COLORS.length]
          return (
            <div key={cls.id} className="flex items-center gap-1.5">
              <div
                className="h-2.5 w-2.5 shrink-0 rounded-sm"
                style={{ backgroundColor: color.bg }}
              />
              <span className="text-xs text-gray-600">{cls.name}</span>
            </div>
          )
        })}
        {tests.length > 0 && (
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 shrink-0 rounded-sm bg-accent-gold" />
            <span className="text-xs text-gray-600">출제 테스트</span>
          </div>
        )}
      </div>
    </div>
  )
}
