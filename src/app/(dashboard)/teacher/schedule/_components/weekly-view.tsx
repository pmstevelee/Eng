'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { X } from 'lucide-react'
import {
  ClassData,
  TestEvent,
  PersonalEvent,
  ScheduleItem,
  CLASS_COLORS,
  EVENT_TYPE_COLORS,
  TEST_TYPE_LABELS,
  parseScheduleJson,
  formatDateStr,
  getWeekStart,
  timeToMinutes,
  personalEventMatchesDate,
} from './types'

// ─── 상수 ─────────────────────────────────────────────────────────────────────
const HOUR_START = 8   // 08:00
const HOUR_END = 21    // 21:00
const TOTAL_HOURS = HOUR_END - HOUR_START
const HOUR_HEIGHT = 64 // px per hour

const DAYS_KO = ['월', '화', '수', '목', '금', '토']

// ─── 타입 ─────────────────────────────────────────────────────────────────────
type Props = {
  currentDate: Date
  classes: ClassData[]
  tests: TestEvent[]
  personalEvents: PersonalEvent[]
  onDeleteEvent: (id: string) => void
  onDayClick: (date: string) => void
}

// ─── 유틸 ─────────────────────────────────────────────────────────────────────
function getBlockStyle(startTime: string, endTime: string): React.CSSProperties {
  const startMin = timeToMinutes(startTime) - HOUR_START * 60
  const endMin = timeToMinutes(endTime) - HOUR_START * 60
  const clampedStart = Math.max(0, startMin)
  const clampedEnd = Math.min(TOTAL_HOURS * 60, endMin)
  const top = (clampedStart / 60) * HOUR_HEIGHT
  const height = Math.max(22, ((clampedEnd - clampedStart) / 60) * HOUR_HEIGHT)
  return { top: `${top}px`, height: `${height}px`, position: 'absolute' }
}

// ─── 컴포넌트 ─────────────────────────────────────────────────────────────────
export function WeeklyView({
  currentDate,
  classes,
  tests,
  personalEvents,
  onDeleteEvent,
  onDayClick,
}: Props) {
  const weekStart = getWeekStart(currentDate)

  // 이번 주 날짜 배열 (월~토, 6일)
  const weekDates = useMemo(
    () =>
      Array.from({ length: 6 }, (_, i) => {
        const d = new Date(weekStart)
        d.setDate(weekStart.getDate() + i)
        return d
      }),
    [weekStart],
  )

  const todayStr = formatDateStr(new Date())

  // 이번 주 반 수업 블록 계산
  const classBlocks = useMemo(() => {
    type Block = {
      dateStr: string
      classIdx: number
      cls: ClassData
      slot: ScheduleItem
    }
    const blocks: Block[] = []
    classes.forEach((cls, classIdx) => {
      const slots = parseScheduleJson(cls.scheduleJson)
      slots.forEach((slot) => {
        weekDates.forEach((date) => {
          if (date.getDay() === slot.day) {
            blocks.push({ dateStr: formatDateStr(date), classIdx, cls, slot })
          }
        })
      })
    })
    return blocks
  }, [classes, weekDates])

  // 이번 주 테스트 이벤트 (createdAt 날짜 기준)
  const testBlocks = useMemo(() => {
    type TestBlock = { dateStr: string; test: TestEvent }
    const blocks: TestBlock[] = []
    tests.forEach((test) => {
      const d = new Date(test.createdAt)
      weekDates.forEach((date) => {
        if (
          d.getFullYear() === date.getFullYear() &&
          d.getMonth() === date.getMonth() &&
          d.getDate() === date.getDate()
        ) {
          blocks.push({ dateStr: formatDateStr(date), test })
        }
      })
    })
    return blocks
  }, [tests, weekDates])

  const hours = Array.from({ length: TOTAL_HOURS }, (_, i) => HOUR_START + i)

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      {/* ── 요일 헤더 ── */}
      <div className="flex border-b border-gray-200 bg-gray-50">
        {/* 시간 열 공백 */}
        <div className="w-14 shrink-0 border-r border-gray-200" />
        {weekDates.map((date, i) => {
          const dateStr = formatDateStr(date)
          const isToday = dateStr === todayStr
          const dayTests = testBlocks.filter((b) => b.dateStr === dateStr)
          return (
            <button
              key={i}
              type="button"
              onClick={() => onDayClick(dateStr)}
              className={`flex-1 border-r border-gray-200 last:border-r-0 px-1 py-2.5 text-center hover:bg-gray-100 transition-colors ${
                isToday ? 'bg-primary-100' : ''
              }`}
            >
              <div
                className={`text-[11px] font-semibold uppercase tracking-wider ${
                  isToday ? 'text-primary-700' : 'text-gray-500'
                }`}
              >
                {DAYS_KO[i]}
              </div>
              <div
                className={`mt-0.5 text-sm font-bold ${
                  isToday ? 'text-primary-700' : 'text-gray-900'
                }`}
              >
                {isToday ? (
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary-700 text-white text-xs">
                    {date.getDate()}
                  </span>
                ) : (
                  date.getDate()
                )}
              </div>
              {/* 테스트 배지 */}
              {dayTests.map((b) => (
                <div
                  key={b.test.id}
                  className="mt-1 mx-0.5 truncate rounded-full bg-accent-gold-light px-1.5 py-0.5 text-[9px] font-medium text-[#B37D00]"
                  title={`📝 ${b.test.title} (${TEST_TYPE_LABELS[b.test.type] ?? b.test.type})`}
                >
                  📝 {b.test.title.length > 5 ? b.test.title.slice(0, 5) + '…' : b.test.title}
                </div>
              ))}
            </button>
          )
        })}
      </div>

      {/* ── 시간 그리드 ── */}
      <div className="overflow-y-auto" style={{ maxHeight: '580px' }}>
        <div className="flex" style={{ height: `${TOTAL_HOURS * HOUR_HEIGHT}px` }}>
          {/* 시간 레이블 열 */}
          <div className="w-14 shrink-0 border-r border-gray-200 relative">
            {hours.map((h) => (
              <div
                key={h}
                className="absolute right-0 flex w-full items-start justify-end pr-2 text-[11px] text-gray-400"
                style={{ top: `${(h - HOUR_START) * HOUR_HEIGHT - 7}px` }}
              >
                {String(h).padStart(2, '0')}:00
              </div>
            ))}
          </div>

          {/* 요일 열 */}
          {weekDates.map((date, colIdx) => {
            const dateStr = formatDateStr(date)
            const isToday = dateStr === todayStr
            const colClassBlocks = classBlocks.filter((b) => b.dateStr === dateStr)
            const colPersonalEvents = personalEvents.filter((e) =>
              personalEventMatchesDate(e, date),
            )

            return (
              <div
                key={colIdx}
                className={`flex-1 relative border-r border-gray-200 last:border-r-0 ${
                  isToday ? 'bg-primary-50/40' : ''
                }`}
              >
                {/* 시간 구분선 */}
                {hours.map((h) => (
                  <div
                    key={h}
                    className="absolute w-full border-t border-gray-100"
                    style={{ top: `${(h - HOUR_START) * HOUR_HEIGHT}px` }}
                  />
                ))}

                {/* 30분 구분선 (연한) */}
                {hours.map((h) => (
                  <div
                    key={`half-${h}`}
                    className="absolute w-full border-t border-dashed border-gray-50"
                    style={{ top: `${(h - HOUR_START) * HOUR_HEIGHT + HOUR_HEIGHT / 2}px` }}
                  />
                ))}

                {/* 반 수업 블록 */}
                {colClassBlocks.map((block, idx) => {
                  const color = CLASS_COLORS[block.classIdx % CLASS_COLORS.length]
                  const style = getBlockStyle(block.slot.startTime, block.slot.endTime)
                  return (
                    <Link
                      key={`${block.cls.id}-${idx}`}
                      href={`/teacher/students?classId=${block.cls.id}`}
                      className="absolute left-1 right-1 rounded-lg overflow-hidden hover:opacity-90 transition-opacity z-10 cursor-pointer"
                      style={{
                        ...style,
                        backgroundColor: color.light,
                        borderLeft: `3px solid ${color.bg}`,
                      }}
                      title={`${block.cls.name} (${block.slot.startTime}–${block.slot.endTime})`}
                    >
                      <div className="px-1.5 py-1 h-full">
                        <p
                          className="text-[11px] font-semibold leading-tight truncate"
                          style={{ color: color.text }}
                        >
                          {block.cls.name}
                        </p>
                        <p className="text-[10px] text-gray-500 leading-tight">
                          {block.slot.startTime}–{block.slot.endTime}
                        </p>
                        {block.slot.room && (
                          <p className="text-[10px] text-gray-400 leading-tight truncate">
                            {block.slot.room}
                          </p>
                        )}
                      </div>
                    </Link>
                  )
                })}

                {/* 개인 일정 블록 */}
                {colPersonalEvents.map((event) => {
                  if (!event.startTime) return null
                  const endTime = event.endTime || event.startTime
                  const style = getBlockStyle(event.startTime, endTime)
                  const color = EVENT_TYPE_COLORS[event.type]
                  return (
                    <div
                      key={event.id}
                      className="absolute left-1 right-1 rounded-lg overflow-hidden z-10"
                      style={{
                        ...style,
                        backgroundColor: color.light,
                        borderLeft: `3px solid ${color.bg}`,
                      }}
                    >
                      <div className="flex h-full items-start justify-between px-1.5 py-1">
                        <div className="min-w-0 flex-1">
                          <p
                            className="text-[11px] font-semibold leading-tight truncate"
                            style={{ color: color.text }}
                          >
                            {event.title}
                          </p>
                          <p className="text-[10px] text-gray-500 leading-tight">
                            {event.startTime}
                            {event.endTime ? `–${event.endTime}` : ''}
                          </p>
                        </div>
                        <button
                          onClick={(e) => {
                            e.preventDefault()
                            onDeleteEvent(event.id)
                          }}
                          className="shrink-0 rounded p-0.5 hover:bg-black/10"
                          title="삭제"
                        >
                          <X size={9} className="text-gray-400" />
                        </button>
                      </div>
                    </div>
                  )
                })}

                {/* 종일 개인 일정 (시간 없는 경우) */}
                {colPersonalEvents
                  .filter((e) => !e.startTime)
                  .map((event, idx) => {
                    const color = EVENT_TYPE_COLORS[event.type]
                    return (
                      <div
                        key={event.id}
                        className="absolute left-1 right-1 z-10 rounded px-1.5 py-0.5"
                        style={{
                          top: `${idx * 20}px`,
                          backgroundColor: color.light,
                          borderLeft: `3px solid ${color.bg}`,
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <p
                            className="text-[10px] font-medium truncate"
                            style={{ color: color.text }}
                          >
                            {event.title}
                          </p>
                          <button
                            onClick={() => onDeleteEvent(event.id)}
                            className="shrink-0 ml-0.5"
                          >
                            <X size={9} className="text-gray-400" />
                          </button>
                        </div>
                      </div>
                    )
                  })}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── 범례 ── */}
      {classes.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 border-t border-gray-100 bg-gray-50 px-4 py-2.5">
          <span className="text-xs text-gray-400">담당 반</span>
          {classes.map((cls, idx) => {
            const color = CLASS_COLORS[idx % CLASS_COLORS.length]
            return (
              <div key={cls.id} className="flex items-center gap-1.5">
                <div
                  className="h-2.5 w-2.5 rounded-sm flex-shrink-0"
                  style={{ backgroundColor: color.bg }}
                />
                <span className="text-xs text-gray-600">{cls.name}</span>
                <span className="text-xs text-gray-400">({cls.studentCount}명)</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
