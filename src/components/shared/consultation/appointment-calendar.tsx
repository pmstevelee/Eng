'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CalendarDays, ChevronLeft, ChevronRight, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  APPOINTMENT_STATUS_BADGE,
  APPOINTMENT_STATUS_LABEL,
  LEAD_STATUS_LABEL,
  addDaysToDateKey,
  formatDateKeyShort,
  formatKstTime,
  kstMinutesOfDay,
  toKstDateKey,
  type AppointmentStatusValue,
} from '@/lib/consultation/constants'
import type { AppointmentCalendarItem } from '@/lib/consultation/queries'
import { StatusBadge } from './modal-shell'

type Option = { id: string; name: string }
type View = 'week' | 'day'

type Props = {
  basePath: string
  today: string
  /** 선택 날짜 (YYYY-MM-DD, KST) */
  date: string
  /** 선택 날짜가 속한 주의 월요일 */
  weekStart: string
  /** URL로 지정된 보기 (없으면 화면 폭 기준: 모바일=일간, 그 외=주간) */
  view: View | null
  counselorId: string
  counselorOptions: Option[]
  showCounselor: boolean
  appointments: AppointmentCalendarItem[]
}

const START_HOUR = 8
const END_HOUR = 22
const HOUR_PX = 56

/** 캘린더 블록 색상 (좌측 강조선 + 옅은 배경) */
const BLOCK_STYLE: Record<AppointmentStatusValue, string> = {
  SCHEDULED: 'border-primary-700 bg-primary-100 text-gray-900',
  COMPLETED: 'border-accent-green bg-accent-green-light text-gray-900',
  NO_SHOW: 'border-accent-red bg-accent-red-light text-gray-900',
  CANCELED: 'border-gray-300 bg-gray-100 text-gray-500',
}

export function AppointmentCalendar(props: Props) {
  const router = useRouter()
  const [view, setView] = useState<View | null>(props.view)
  const [selectedDate, setSelectedDate] = useState(props.date)

  // 보기가 지정되지 않았으면 화면 폭으로 결정 (그 전까지는 CSS로 반응형 표시)
  useEffect(() => {
    if (props.view) {
      setView(props.view)
      return
    }
    setView(window.matchMedia('(max-width: 767px)').matches ? 'day' : 'week')
  }, [props.view])

  useEffect(() => setSelectedDate(props.date), [props.date])

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDaysToDateKey(props.weekStart, i)),
    [props.weekStart],
  )
  const byDate = useMemo(() => {
    const map = new Map<string, AppointmentCalendarItem[]>()
    for (const a of props.appointments) {
      const key = toKstDateKey(a.scheduledAt)
      const list = map.get(key) ?? []
      list.push(a)
      map.set(key, list)
    }
    return map
  }, [props.appointments])

  const navigate = (params: { date?: string; view?: View; counselor?: string }) => {
    const sp = new URLSearchParams()
    const nextView = params.view ?? view
    if (nextView) sp.set('view', nextView)
    sp.set('date', params.date ?? selectedDate)
    const counselor = params.counselor ?? props.counselorId
    if (counselor) sp.set('counselor', counselor)
    router.push(`${props.basePath}/schedule?${sp.toString()}`)
  }

  /** 같은 주 안에서의 날짜 이동은 다시 조회하지 않고 화면만 전환 */
  const goToDate = (date: string) => {
    if (weekDays.includes(date)) {
      setSelectedDate(date)
      window.history.replaceState(null, '', buildUrl(props.basePath, { view, date, counselor: props.counselorId }))
      return
    }
    navigate({ date })
  }

  const changeView = (next: View, date = selectedDate) => {
    setView(next)
    setSelectedDate(date)
    window.history.replaceState(null, '', buildUrl(props.basePath, { view: next, date, counselor: props.counselorId }))
  }

  const step = (dir: -1 | 1) => {
    if (view === 'day') goToDate(addDaysToDateKey(selectedDate, dir))
    else navigate({ date: addDaysToDateKey(props.weekStart, dir * 7) })
  }

  const rangeLabel =
    view === 'day'
      ? formatDateKeyShort(selectedDate)
      : `${formatDateKeyShort(weekDays[0])} ~ ${formatDateKeyShort(weekDays[6])}`

  return (
    <section className="space-y-4">
      {/* 툴바 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2">
          <IconButton label="이전" onClick={() => step(-1)}>
            <ChevronLeft size={18} />
          </IconButton>
          <IconButton label="다음" onClick={() => step(1)}>
            <ChevronRight size={18} />
          </IconButton>
          <button
            type="button"
            onClick={() => goToDate(props.today)}
            className="h-11 px-3.5 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            오늘
          </button>
          <p className="ml-1 text-base font-semibold text-gray-900 tabular-nums">{rangeLabel}</p>
        </div>

        <div className="flex items-center gap-2">
          {props.showCounselor && (
            <select
              aria-label="담당자 필터"
              value={props.counselorId}
              onChange={(e) => navigate({ counselor: e.target.value })}
              className="h-11 flex-1 sm:flex-none sm:w-44 px-3 rounded-xl border border-gray-200 bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-700"
            >
              <option value="">전체 담당자</option>
              {props.counselorOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          )}
          <div className="inline-flex rounded-xl border border-gray-200 bg-white p-1" role="group" aria-label="보기 전환">
            {(['week', 'day'] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => changeView(v)}
                aria-pressed={view === v}
                className={cn(
                  'h-9 px-3 rounded-lg text-sm font-medium transition-colors',
                  view === v ? 'bg-primary-700 text-white' : 'text-gray-700 hover:bg-gray-50',
                )}
              >
                {v === 'week' ? '주간' : '일간'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 보기 미지정 + 첫 렌더: CSS로 모바일=일간, 데스크톱=주간 */}
      {(view === 'week' || view === null) && (
        <div className={cn(view === null && 'hidden md:block')}>
          <WeekGrid
            today={props.today}
            weekDays={weekDays}
            byDate={byDate}
            showCounselor={props.showCounselor}
            onSelectDay={(d) => changeView('day', d)}
          />
        </div>
      )}
      {(view === 'day' || view === null) && (
        <div className={cn(view === null && 'md:hidden')}>
          <DayList
            basePath={props.basePath}
            today={props.today}
            weekDays={weekDays}
            selectedDate={selectedDate}
            items={byDate.get(selectedDate) ?? []}
            counts={weekDays.map((d) => (byDate.get(d) ?? []).filter((a) => a.status === 'SCHEDULED').length)}
            showCounselor={props.showCounselor}
            onSelectDate={(d) => goToDate(d)}
          />
        </div>
      )}
    </section>
  )
}

function buildUrl(basePath: string, p: { view: View | null; date: string; counselor: string }) {
  const sp = new URLSearchParams()
  if (p.view) sp.set('view', p.view)
  sp.set('date', p.date)
  if (p.counselor) sp.set('counselor', p.counselor)
  return `${basePath}/schedule?${sp.toString()}`
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="w-11 h-11 rounded-xl border border-gray-200 bg-white flex items-center justify-center text-gray-700 hover:bg-gray-50"
    >
      {children}
    </button>
  )
}

// ─── 주간 캘린더 ───────────────────────────────────────────────────────────────

type Positioned = { item: AppointmentCalendarItem; top: number; height: number; lane: number; lanes: number }

/** 하루 일정의 세로 위치와 겹침 레인 계산 */
function layoutDay(items: AppointmentCalendarItem[]): Positioned[] {
  const minStart = START_HOUR * 60
  const maxEnd = END_HOUR * 60
  const sorted = [...items]
    .map((item) => {
      const start = Math.min(Math.max(kstMinutesOfDay(item.scheduledAt), minStart), maxEnd - 15)
      const end = Math.min(start + item.durationMinutes, maxEnd)
      return { item, start, end }
    })
    .sort((a, b) => a.start - b.start)

  const result: Positioned[] = []
  let cluster: { item: AppointmentCalendarItem; start: number; end: number; lane: number }[] = []
  let clusterEnd = -1
  const flush = () => {
    const lanes = Math.max(1, ...cluster.map((c) => c.lane + 1))
    for (const c of cluster) {
      result.push({
        item: c.item,
        top: ((c.start - minStart) / 60) * HOUR_PX,
        height: Math.max(((c.end - c.start) / 60) * HOUR_PX, 24),
        lane: c.lane,
        lanes,
      })
    }
    cluster = []
  }

  for (const ev of sorted) {
    if (ev.start >= clusterEnd && cluster.length > 0) flush()
    const laneEnds: number[] = []
    for (const c of cluster) laneEnds[c.lane] = Math.max(laneEnds[c.lane] ?? 0, c.end)
    let lane = laneEnds.findIndex((end) => end <= ev.start)
    if (lane === -1) lane = laneEnds.length
    cluster.push({ ...ev, lane })
    clusterEnd = Math.max(clusterEnd, ev.end)
  }
  if (cluster.length > 0) flush()
  return result
}

function WeekGrid({
  today,
  weekDays,
  byDate,
  showCounselor,
  onSelectDay,
}: {
  today: string
  weekDays: string[]
  byDate: Map<string, AppointmentCalendarItem[]>
  showCounselor: boolean
  onSelectDay: (date: string) => void
}) {
  const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i)
  const bodyHeight = hours.length * HOUR_PX

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-x-auto">
      <div className="min-w-[760px]">
        {/* 요일 헤더 */}
        <div className="grid grid-cols-[52px_repeat(7,minmax(0,1fr))] border-b border-gray-200 bg-gray-50">
          <div />
          {weekDays.map((d) => {
            const count = (byDate.get(d) ?? []).length
            return (
              <button
                key={d}
                type="button"
                onClick={() => onSelectDay(d)}
                className={cn(
                  'h-12 flex flex-col items-center justify-center text-sm border-l border-gray-200 hover:bg-gray-100',
                  d === today ? 'text-primary-700 font-semibold' : 'text-gray-700',
                )}
              >
                <span>{formatDateKeyShort(d)}</span>
                {count > 0 && <span className="text-[11px] text-gray-500 font-normal">{count}건</span>}
              </button>
            )
          })}
        </div>

        {/* 시간 격자 */}
        <div className="grid grid-cols-[52px_repeat(7,minmax(0,1fr))]">
          <div className="relative" style={{ height: bodyHeight }}>
            {hours.map((h, i) => (
              <span
                key={h}
                className="absolute right-2 -translate-y-1/2 text-[11px] text-gray-500 tabular-nums"
                style={{ top: i * HOUR_PX }}
              >
                {i === 0 ? '' : `${h}:00`}
              </span>
            ))}
          </div>
          {weekDays.map((d) => (
            <div
              key={d}
              className={cn('relative border-l border-gray-200', d === today && 'bg-primary-100/30')}
              style={{ height: bodyHeight }}
            >
              {hours.map((h, i) => (
                <div key={h} className="absolute inset-x-0 border-t border-gray-100" style={{ top: i * HOUR_PX }} />
              ))}
              {layoutDay(byDate.get(d) ?? []).map(({ item, top, height, lane, lanes }) => (
                <AppointmentBlock
                  key={item.id}
                  item={item}
                  showCounselor={showCounselor}
                  style={{
                    top,
                    height,
                    left: `calc(${(lane / lanes) * 100}% + 2px)`,
                    width: `calc(${100 / lanes}% - 4px)`,
                  }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function AppointmentBlock({
  item,
  showCounselor,
  style,
}: {
  item: AppointmentCalendarItem
  showCounselor: boolean
  style: React.CSSProperties
}) {
  const className = cn(
    'absolute rounded-md border-l-4 px-1.5 py-1 text-xs overflow-hidden leading-tight',
    BLOCK_STYLE[item.status],
    item.openHref && 'hover:ring-2 hover:ring-primary-700',
  )
  const title = `${formatKstTime(item.scheduledAt)} ${item.studentName} (${APPOINTMENT_STATUS_LABEL[item.status]})`
  const content = (
    <>
      <p className="font-semibold truncate">{item.studentName}</p>
      <p className="tabular-nums truncate">
        {formatKstTime(item.scheduledAt)}
        {showCounselor && item.counselorName ? ` · ${item.counselorName}` : ''}
      </p>
    </>
  )
  return item.openHref ? (
    <Link href={item.openHref} className={className} style={style} title={title}>
      {content}
    </Link>
  ) : (
    <div className={className} style={style} title={title}>
      {content}
    </div>
  )
}

// ─── 일간 목록 ─────────────────────────────────────────────────────────────────

function DayList({
  basePath,
  today,
  weekDays,
  selectedDate,
  items,
  counts,
  showCounselor,
  onSelectDate,
}: {
  basePath: string
  today: string
  weekDays: string[]
  selectedDate: string
  items: AppointmentCalendarItem[]
  counts: number[]
  showCounselor: boolean
  onSelectDate: (date: string) => void
}) {
  return (
    <div className="space-y-3">
      {/* 주간 날짜 선택 */}
      <div className="grid grid-cols-7 gap-1">
        {weekDays.map((d, i) => {
          const [md, dow] = formatDateKeyShort(d).split('(')
          return (
            <button
              key={d}
              type="button"
              onClick={() => onSelectDate(d)}
              aria-pressed={d === selectedDate}
              className={cn(
                'min-h-14 rounded-xl border flex flex-col items-center justify-center text-xs transition-colors',
                d === selectedDate
                  ? 'border-primary-700 bg-primary-700 text-white'
                  : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50',
                d === today && d !== selectedDate && 'border-primary-700 text-primary-700',
              )}
            >
              <span>{dow.replace(')', '')}</span>
              <span className="font-semibold tabular-nums">{md.split('/')[1]}</span>
              <span className={cn('mt-0.5 w-1.5 h-1.5 rounded-full', counts[i] > 0 ? (d === selectedDate ? 'bg-white' : 'bg-primary-700') : 'bg-transparent')} />
            </button>
          )
        })}
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white py-12 flex flex-col items-center text-center px-4">
          <div className="w-11 h-11 rounded-full bg-primary-100 flex items-center justify-center mb-2">
            <CalendarDays size={20} className="text-primary-700" />
          </div>
          <p className="text-sm font-medium text-gray-900">{formatDateKeyShort(selectedDate)} 상담 일정이 없습니다</p>
          <p className="text-xs text-gray-500 mt-1">문의 상세 화면에서 상담을 예약할 수 있습니다.</p>
          <Link
            href={basePath}
            className="mt-4 h-11 px-4 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 inline-flex items-center"
          >
            문의 목록으로
          </Link>
        </div>
      ) : (
        <ul className="rounded-xl border border-gray-200 bg-white divide-y divide-gray-200">
          {items.map((a) => {
            const body = (
              <div className="flex items-center gap-3 px-4 py-3 min-h-16">
                <div className="w-14 shrink-0 text-center">
                  <p className="text-sm font-semibold text-gray-900 tabular-nums">{formatKstTime(a.scheduledAt)}</p>
                  <p className="text-[11px] text-gray-500 flex items-center justify-center gap-0.5">
                    <Clock size={10} />
                    {a.durationMinutes}분
                  </p>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {a.studentName}
                    {a.grade && <span className="ml-1.5 text-xs text-gray-500 font-normal">{a.grade}</span>}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {a.leadStatus ? LEAD_STATUS_LABEL[a.leadStatus] : '재원생'}
                    {showCounselor && ` · ${a.counselorName ?? '(삭제된 사용자)'}`}
                  </p>
                </div>
                <StatusBadge className={APPOINTMENT_STATUS_BADGE[a.status]} label={APPOINTMENT_STATUS_LABEL[a.status]} />
              </div>
            )
            return (
              <li key={a.id}>
                {a.openHref ? (
                  <Link href={a.openHref} className="block hover:bg-gray-50">
                    {body}
                  </Link>
                ) : (
                  body
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
