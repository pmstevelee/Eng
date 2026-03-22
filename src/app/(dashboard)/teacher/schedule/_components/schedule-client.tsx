'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { CalendarDays, Calendar, Clock, Plus, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { WeeklyView } from './weekly-view'
import { MonthlyView } from './monthly-view'
import { AddEventDialog } from './add-event-dialog'
import { ClassData, TestEvent, PersonalEvent, getWeekStart, formatDateStr } from './types'

// ─── 타입 ─────────────────────────────────────────────────────────────────────
type ViewMode = 'weekly' | 'monthly'

type Props = {
  userId: string
  classes: ClassData[]
  tests: TestEvent[]
  pendingCount: number
}

const STORAGE_KEY_PREFIX = 'teacher_events_'

// ─── 컴포넌트 ─────────────────────────────────────────────────────────────────
export function ScheduleClient({ userId, classes, tests, pendingCount }: Props) {
  const [view, setView] = useState<ViewMode>('weekly')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [personalEvents, setPersonalEvents] = useState<PersonalEvent[]>([])
  const [showDialog, setShowDialog] = useState(false)
  const [defaultDate, setDefaultDate] = useState<string | undefined>()

  // localStorage에서 개인 일정 불러오기
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_PREFIX + userId)
      if (raw) setPersonalEvents(JSON.parse(raw) as PersonalEvent[])
    } catch {
      // 무시
    }
  }, [userId])

  const saveEvents = (events: PersonalEvent[]) => {
    setPersonalEvents(events)
    try {
      localStorage.setItem(STORAGE_KEY_PREFIX + userId, JSON.stringify(events))
    } catch {
      // 무시
    }
  }

  const handleAddEvent = (event: PersonalEvent) => {
    saveEvents([...personalEvents, event])
  }

  const handleDeleteEvent = (eventId: string) => {
    saveEvents(personalEvents.filter((e) => e.id !== eventId))
  }

  const handleDayClick = (date: string) => {
    setDefaultDate(date)
    setShowDialog(true)
  }

  // ── 주간 네비게이션 ──────────────────────────────────────────────────────────
  const prevPeriod = () => {
    const d = new Date(currentDate)
    if (view === 'weekly') d.setDate(d.getDate() - 7)
    else d.setMonth(d.getMonth() - 1)
    setCurrentDate(d)
  }
  const nextPeriod = () => {
    const d = new Date(currentDate)
    if (view === 'weekly') d.setDate(d.getDate() + 7)
    else d.setMonth(d.getMonth() + 1)
    setCurrentDate(d)
  }
  const goToToday = () => setCurrentDate(new Date())

  // ── 기간 레이블 ──────────────────────────────────────────────────────────────
  const getPeriodLabel = () => {
    if (view === 'weekly') {
      const monday = getWeekStart(currentDate)
      const saturday = new Date(monday)
      saturday.setDate(monday.getDate() + 5)
      const isSameMonth = monday.getMonth() === saturday.getMonth()
      if (isSameMonth) {
        return `${monday.getFullYear()}년 ${monday.getMonth() + 1}월 ${monday.getDate()}–${saturday.getDate()}일`
      }
      return (
        `${monday.getMonth() + 1}월 ${monday.getDate()}일 – ` +
        `${saturday.getMonth() + 1}월 ${saturday.getDate()}일`
      )
    }
    return `${currentDate.getFullYear()}년 ${currentDate.getMonth() + 1}월`
  }

  const isCurrentPeriod = (() => {
    const now = new Date()
    if (view === 'weekly') {
      return formatDateStr(getWeekStart(currentDate)) === formatDateStr(getWeekStart(now))
    }
    return currentDate.getFullYear() === now.getFullYear() && currentDate.getMonth() === now.getMonth()
  })()

  return (
    <div className="space-y-4">
      {/* ── 페이지 헤더 ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">일정 관리</h1>
          <p className="mt-1 text-sm text-gray-500">수업 일정과 개인 일정을 한 눈에 확인하세요</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {pendingCount > 0 && (
            <Link href="/teacher/tests">
              <Button
                variant="outline"
                size="sm"
                className="h-9 gap-1.5 border-accent-gold text-[#B37D00] hover:bg-accent-gold-light"
              >
                채점 대기 {pendingCount}건
              </Button>
            </Link>
          )}
          <Link href="/teacher/schedule/today">
            <Button variant="outline" size="sm" className="h-9 gap-1.5">
              <Clock size={14} />
              오늘 할 일
            </Button>
          </Link>
          <Button
            size="sm"
            className="h-9 gap-1.5 bg-primary-700 text-white hover:bg-primary-800"
            onClick={() => {
              setDefaultDate(undefined)
              setShowDialog(true)
            }}
          >
            <Plus size={14} />
            일정 추가
          </Button>
        </div>
      </div>

      {/* ── 뷰 전환 + 네비게이션 ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* 주간 / 월간 탭 */}
        <div className="flex w-fit rounded-lg border border-gray-200 bg-gray-50 p-1">
          <button
            onClick={() => setView('weekly')}
            className={`flex items-center gap-1.5 rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              view === 'weekly'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <CalendarDays size={14} />
            주간
          </button>
          <button
            onClick={() => setView('monthly')}
            className={`flex items-center gap-1.5 rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              view === 'monthly'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Calendar size={14} />
            월간
          </button>
        </div>

        {/* 이전/다음 + 기간 레이블 */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={prevPeriod}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors"
          >
            <ChevronLeft size={15} />
          </button>
          <span className="min-w-[220px] text-center text-sm font-medium text-gray-900">
            {getPeriodLabel()}
          </span>
          <button
            onClick={nextPeriod}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors"
          >
            <ChevronRight size={15} />
          </button>
          {!isCurrentPeriod && (
            <button
              onClick={goToToday}
              className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              오늘
            </button>
          )}
        </div>
      </div>

      {/* ── 빈 반 안내 ── */}
      {classes.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white py-12 text-center">
          <CalendarDays size={32} className="mx-auto mb-3 text-gray-300" />
          <p className="text-sm font-medium text-gray-500">담당 반이 없습니다</p>
          <p className="mt-1 text-xs text-gray-400">
            학원장에게 반 배정을 요청해 주세요
          </p>
        </div>
      )}

      {/* ── 뷰 컴포넌트 ── */}
      {classes.length > 0 || personalEvents.length > 0 || tests.length > 0 ? (
        view === 'weekly' ? (
          <WeeklyView
            currentDate={currentDate}
            classes={classes}
            tests={tests}
            personalEvents={personalEvents}
            onDeleteEvent={handleDeleteEvent}
            onDayClick={handleDayClick}
          />
        ) : (
          <MonthlyView
            currentDate={currentDate}
            classes={classes}
            tests={tests}
            personalEvents={personalEvents}
            onDayClick={handleDayClick}
          />
        )
      ) : null}

      {/* ── 일정 추가 다이얼로그 ── */}
      <AddEventDialog
        open={showDialog}
        onClose={() => setShowDialog(false)}
        onAdd={handleAddEvent}
        defaultDate={defaultDate}
      />
    </div>
  )
}
