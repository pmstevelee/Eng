'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, ClipboardCheck, MoreHorizontal, Users } from 'lucide-react'
import { academyCheck, setAcademyAttendance } from '@/lib/attendance/record-actions'
import type { TodayAttendanceData, TodayStudentRow } from '@/lib/attendance/queries'
import type { AttendanceRecordView } from '@/lib/attendance/records'
import {
  ATTENDANCE_MODE_LABEL,
  ATTENDANCE_STATUS_META,
  attendanceRate,
  emptyCounts,
  isPastLateLine,
  SELECTABLE_STATUSES,
  SESSION_PHASE_LABEL,
  sessionPhase,
  type AttendanceStatusValue,
  type SessionPhase,
} from '@/lib/attendance/constants'
import { addDays, formatDateLabel, formatKstTime } from '@/lib/attendance/time'
import { cn } from '@/lib/utils'
import { AttendanceStatusBadge, AutoTag, KeypadTag } from './status-badge'
import { AttendanceStatusSheet } from './status-sheet'
import { useNow } from './use-now'
import { useToastMessage } from './use-toast-message'

type Props = {
  data: TodayAttendanceData
  /** '/owner/attendance' | '/teacher/attendance' */
  basePath: string
  today: string
  nowMs: number
  /** 학원장 지점 선택 (지점이 있을 때만 2개 이상) */
  academies?: { id: string; label: string }[]
  academyId?: string
}

type ChipKey = 'PRESENT' | 'LATE' | 'ABSENT' | 'UNCHECKED'
const CHIPS: ChipKey[] = ['PRESENT', 'LATE', 'ABSENT', 'UNCHECKED']

const PHASE_STYLE: Record<SessionPhase, string> = {
  WAITING: 'bg-gray-100 text-gray-700',
  IN_PROGRESS: 'bg-primary-100 text-primary-700',
  DONE: 'bg-accent-green-light text-[#16803D]',
  CANCELLED: 'bg-gray-100 text-gray-500',
}

function statusOf(row: TodayStudentRow): AttendanceStatusValue {
  return row.record?.status ?? 'UNCHECKED'
}

export function TodayAttendance({ data, basePath, today, nowMs, academies = [], academyId }: Props) {
  const now = useNow(nowMs)
  const router = useRouter()
  const toast = useToastMessage()
  const [rows, setRows] = useState(data.students)
  const [filter, setFilter] = useState<ChipKey | null>(null)
  const [sheetFor, setSheetFor] = useState<TodayStudentRow | null>(null)
  const [busy, setBusy] = useState<Set<string>>(new Set())
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => setRows(data.students), [data.students])

  const isAcademyMode = data.mode === 'ACADEMY'
  const isToday = data.dateKey === today
  const query = (params: { date?: string; academy?: string }) => {
    const sp = new URLSearchParams()
    const date = params.date ?? data.dateKey
    if (date !== today) sp.set('date', date)
    const academy = params.academy ?? academyId
    if (academy && academies.length > 1) sp.set('academy', academy)
    const s = sp.toString()
    return `${basePath}/today${s ? `?${s}` : ''}`
  }

  const counts = useMemo(() => {
    const c = emptyCounts()
    for (const r of rows) c[statusOf(r)]++
    return c
  }, [rows])
  const rate = attendanceRate(counts, rows.length)

  const filteredRows = filter ? rows.filter((r) => statusOf(r) === filter) : rows

  const onChip = (key: ChipKey) => {
    setFilter((f) => (f === key ? null : key))
    requestAnimationFrame(() => listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  const applyRecord = (studentId: string, record: AttendanceRecordView | null) => {
    setRows((prev) => prev.map((r) => (r.studentId === studentId && r.sessionId === null ? { ...r, record } : r)))
  }

  const setBusyFor = (id: string, on: boolean) =>
    setBusy((prev) => {
      const next = new Set(prev)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })

  const runAcademy = async (row: TodayStudentRow, action: () => Promise<{ error?: string; record?: AttendanceRecordView }>) => {
    const before = row.record
    setBusyFor(row.studentId, true)
    const res = await action()
    setBusyFor(row.studentId, false)
    if (res.error) {
      applyRecord(row.studentId, before)
      toast.show(res.error)
      return
    }
    if (res.record) applyRecord(row.studentId, res.record)
  }

  const checkIn = (row: TodayStudentRow) => {
    const iso = new Date().toISOString()
    applyRecord(row.studentId, {
      id: row.record?.id ?? 'pending',
      studentId: row.studentId,
      status: 'PRESENT',
      checkInAt: iso,
      checkOutAt: null,
      source: 'MANUAL',
      reason: null,
    })
    void runAcademy(row, () => academyCheck(row.studentId, 'IN'))
  }

  const checkOut = (row: TodayStudentRow) => {
    if (row.record) applyRecord(row.studentId, { ...row.record, checkOutAt: new Date().toISOString() })
    void runAcademy(row, () => academyCheck(row.studentId, 'OUT'))
  }

  const submitSheet = (status: AttendanceStatusValue, reason: string | null) => {
    const row = sheetFor
    setSheetFor(null)
    if (!row) return
    applyRecord(row.studentId, {
      id: row.record?.id ?? 'pending',
      studentId: row.studentId,
      status,
      checkInAt: status === 'UNCHECKED' || status === 'ABSENT' || status === 'EXCUSED' ? null : (row.record?.checkInAt ?? null),
      checkOutAt: status === 'UNCHECKED' || status === 'ABSENT' || status === 'EXCUSED' ? null : (row.record?.checkOutAt ?? null),
      source: 'MANUAL',
      reason,
    })
    void runAcademy(row, () =>
      setAcademyAttendance({ studentId: row.studentId, dateKey: data.dateKey, status, reason }),
    )
  }

  return (
    <div className="space-y-5">
      {/* 헤더: 날짜 이동 */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">오늘 출결</h1>
          <p className="text-sm text-gray-500 mt-1">
            {ATTENDANCE_MODE_LABEL[data.mode].title} · {ATTENDANCE_MODE_LABEL[data.mode].description}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Link
            href={query({ date: addDays(data.dateKey, -1) })}
            aria-label="이전 날"
            className="w-11 h-11 inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
          >
            <ChevronLeft size={20} />
          </Link>
          <div className="min-w-[9.5rem] h-11 px-3 inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-900">
            {formatDateLabel(data.dateKey)}
          </div>
          <Link
            href={query({ date: addDays(data.dateKey, 1) })}
            aria-label="다음 날"
            className="w-11 h-11 inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
          >
            <ChevronRight size={20} />
          </Link>
          {!isToday && (
            <Link
              href={query({ date: today })}
              className="h-11 px-3 ml-1 inline-flex items-center rounded-xl text-sm font-semibold text-primary-700 hover:bg-primary-100"
            >
              오늘
            </Link>
          )}
        </div>
      </div>

      {academies.length > 1 && (
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="학원 선택">
          {academies.map((a) => (
            <button
              key={a.id}
              type="button"
              role="tab"
              aria-selected={a.id === academyId}
              onClick={() => router.push(query({ academy: a.id }))}
              className={cn(
                'h-11 px-4 rounded-xl border text-sm font-medium transition-colors',
                a.id === academyId
                  ? 'border-primary-700 bg-primary-100 text-primary-700'
                  : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50',
              )}
            >
              {a.label}
            </button>
          ))}
        </div>
      )}

      {!data.canEdit && (
        <p className="rounded-xl bg-gray-100 px-4 py-3 text-sm text-gray-700">
          지난 날짜의 출결은 조회만 할 수 있습니다. 수정은 학원장에게 요청해주세요.
        </p>
      )}

      {/* 요약 칩 */}
      <div className="flex flex-wrap gap-2">
        {CHIPS.map((key) => {
          const meta = ATTENDANCE_STATUS_META[key]
          const active = filter === key
          return (
            <button
              key={key}
              type="button"
              onClick={() => onChip(key)}
              aria-pressed={active}
              className={cn(
                'h-11 px-4 rounded-full border text-sm font-medium inline-flex items-center gap-2 transition-colors',
                active ? 'border-2 bg-white' : 'border-gray-200 bg-white hover:bg-gray-50',
              )}
              style={active ? { borderColor: key === 'UNCHECKED' ? '#6B6F7A' : meta.color } : undefined}
            >
              <span
                className={cn('w-2.5 h-2.5 rounded-full', key === 'UNCHECKED' && 'border border-gray-400')}
                style={key === 'UNCHECKED' ? undefined : { backgroundColor: meta.color }}
                aria-hidden
              />
              <span className="text-gray-700">{meta.label}</span>
              <span className="font-bold text-gray-900 tabular-nums">{counts[key]}</span>
            </button>
          )
        })}
        <div className="h-11 px-4 rounded-full bg-gray-100 text-sm inline-flex items-center gap-2">
          <span className="text-gray-700">출석률</span>
          <span className="font-bold text-gray-900 tabular-nums">{rate === null ? '-' : `${rate}%`}</span>
        </div>
      </div>

      {/* 반 출결: 오늘 수업 목록 */}
      {!isAcademyMode && (
        <SessionTable data={data} basePath={basePath} now={now} />
      )}

      {/* 학생 목록 — 원 출결은 항상, 반 출결은 칩 선택 시 */}
      {(isAcademyMode || filter) && (
        <div ref={listRef} className="scroll-mt-4">
          <section className="rounded-xl border border-gray-200 bg-white">
            <div className="flex items-center justify-between px-4 md:px-5 py-3 border-b border-gray-200">
              <h2 className="text-base font-bold text-gray-900">
                {filter ? `${ATTENDANCE_STATUS_META[filter].label} 학생` : '학생 출결'}
                <span className="ml-2 text-sm font-medium text-gray-500">{filteredRows.length}명</span>
              </h2>
              {filter && (
                <button
                  type="button"
                  onClick={() => setFilter(null)}
                  className="h-11 px-3 rounded-xl text-sm font-medium text-primary-700 hover:bg-primary-100"
                >
                  필터 해제
                </button>
              )}
            </div>
            {filteredRows.length === 0 ? (
              <EmptyState
                icon={<Users size={24} className="text-primary-700" />}
                title={filter ? '해당하는 학생이 없습니다' : '출결 대상 학생이 없습니다'}
                description={filter ? '다른 상태를 선택해보세요.' : '재원 중인 학생이 등록되면 이곳에 표시됩니다.'}
              />
            ) : (
              <ul className="divide-y divide-gray-100">
                {filteredRows.map((row) =>
                  isAcademyMode ? (
                    <AcademyRow
                      key={row.key}
                      row={row}
                      editable={data.canEdit}
                      canCheck={isToday && data.canEdit}
                      busy={busy.has(row.studentId)}
                      onCheckIn={() => checkIn(row)}
                      onCheckOut={() => checkOut(row)}
                      onMore={() => setSheetFor(row)}
                    />
                  ) : (
                    <SessionStudentRow key={row.key} row={row} href={`${basePath}/session/${row.sessionId}`} />
                  ),
                )}
              </ul>
            )}
          </section>
        </div>
      )}

      {sheetFor && (
        <AttendanceStatusSheet
          title={`${sheetFor.name} 출결 변경`}
          statuses={SELECTABLE_STATUSES}
          initialStatus={statusOf(sheetFor)}
          initialReason={sheetFor.record?.reason}
          onClose={() => setSheetFor(null)}
          onSubmit={submitSheet}
        />
      )}
      {toast.node}
    </div>
  )
}

function EmptyState({ icon, title, description, action }: { icon: React.ReactNode; title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="py-14 px-6 flex flex-col items-center text-center">
      <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center">{icon}</div>
      <p className="mt-4 text-base font-semibold text-gray-900">{title}</p>
      <p className="mt-1 text-sm text-gray-500">{description}</p>
      {action}
    </div>
  )
}

function SessionTable({ data, basePath, now }: { data: TodayAttendanceData; basePath: string; now: number }) {
  if (data.sessions.length === 0) {
    return (
      <section className="rounded-xl border border-gray-200 bg-white">
        <EmptyState
          icon={<ClipboardCheck size={24} className="text-primary-700" />}
          title="이 날은 수업이 없습니다"
          description="반 상세 화면의 시간표 탭에서 요일별 수업 시간을 등록하면 자동으로 표시됩니다."
        />
      </section>
    )
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      {/* 태블릿·PC: 표 */}
      <table className="hidden md:table w-full text-sm">
        <thead className="bg-gray-50 text-gray-500 text-sm">
          <tr>
            <th className="px-5 py-3 text-left font-medium">시작</th>
            <th className="px-3 py-3 text-left font-medium">반</th>
            <th className="px-3 py-3 text-left font-medium">담당 교사</th>
            <th className="px-3 py-3 text-left font-medium w-[28%]">진행</th>
            <th className="px-3 py-3 text-left font-medium">상태</th>
            <th className="px-5 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {data.sessions.map((s) => {
            const phase = sessionPhase(s, now)
            const unchecked = s.total - s.checked
            const overdue = phase === 'IN_PROGRESS' && unchecked > 0 && isPastLateLine(s.startAt, data.lateGraceMinutes, now)
            return (
              <tr key={s.id}>
                <td className="px-5 py-3 font-semibold text-gray-900 tabular-nums">{formatKstTime(s.startAt)}</td>
                <td className="px-3 py-3 font-medium text-gray-900">{s.className}</td>
                <td className="px-3 py-3 text-gray-700">{s.teacherName ?? '-'}</td>
                <td className="px-3 py-3">
                  <ProgressBar checked={s.checked} total={s.total} />
                </td>
                <td className="px-3 py-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={cn('inline-flex h-6 px-2.5 items-center rounded-full text-xs font-semibold', PHASE_STYLE[phase])}>
                      {SESSION_PHASE_LABEL[phase]}
                    </span>
                    {overdue && <OverdueBadge count={unchecked} />}
                  </div>
                </td>
                <td className="px-5 py-3 text-right">
                  <Link
                    href={`${basePath}/session/${s.id}`}
                    className="h-11 px-4 inline-flex items-center rounded-xl border border-gray-200 text-sm font-semibold text-primary-700 hover:bg-primary-100"
                  >
                    열기
                  </Link>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {/* 모바일: 카드 목록 */}
      <ul className="md:hidden divide-y divide-gray-100">
        {data.sessions.map((s) => {
          const phase = sessionPhase(s, now)
          const unchecked = s.total - s.checked
          const overdue = phase === 'IN_PROGRESS' && unchecked > 0 && isPastLateLine(s.startAt, data.lateGraceMinutes, now)
          return (
            <li key={s.id}>
              <Link href={`${basePath}/session/${s.id}`} className="block px-4 py-4 hover:bg-gray-50">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-gray-900">
                    <span className="tabular-nums">{formatKstTime(s.startAt)}</span> · {s.className}
                  </p>
                  <span className={cn('inline-flex h-6 px-2.5 items-center rounded-full text-xs font-semibold', PHASE_STYLE[phase])}>
                    {SESSION_PHASE_LABEL[phase]}
                  </span>
                </div>
                <p className="mt-0.5 text-sm text-gray-500">{s.teacherName ?? '담당 교사 없음'}</p>
                <div className="mt-3 flex items-center gap-2">
                  <div className="flex-1">
                    <ProgressBar checked={s.checked} total={s.total} />
                  </div>
                  {overdue && <OverdueBadge count={unchecked} />}
                </div>
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function ProgressBar({ checked, total }: { checked: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((checked / total) * 100)
  return (
    <div className="flex items-center gap-2">
      <div
        className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden"
        role="progressbar"
        aria-valuenow={checked}
        aria-valuemin={0}
        aria-valuemax={total}
      >
        <div className="h-full rounded-full bg-primary-700" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-medium text-gray-700 tabular-nums whitespace-nowrap">
        {checked}/{total}
      </span>
    </div>
  )
}

/** 지각 허용시간이 지났는데 미체크 학생이 남은 반 */
function OverdueBadge({ count }: { count: number }) {
  return (
    <span className="inline-flex h-6 px-2.5 items-center rounded-full text-xs font-semibold bg-[#FEF3C7] text-[#B45309]">
      미체크 {count}
    </span>
  )
}

function AcademyRow({
  row,
  editable,
  canCheck,
  busy,
  onCheckIn,
  onCheckOut,
  onMore,
}: {
  row: TodayStudentRow
  editable: boolean
  canCheck: boolean
  busy: boolean
  onCheckIn: () => void
  onCheckOut: () => void
  onMore: () => void
}) {
  const r = row.record
  const status = r?.status ?? 'UNCHECKED'
  return (
    <li className="px-4 md:px-5 py-3 flex flex-wrap items-center gap-x-4 gap-y-2">
      <div className="min-w-0 flex-1 basis-40">
        <p className="font-semibold text-gray-900 truncate">{row.name}</p>
        <p className="text-sm text-gray-500 truncate">{row.className ?? '반 미배정'}</p>
      </div>
      <dl className="flex gap-4 text-sm">
        <div>
          <dt className="text-xs text-gray-500">등원</dt>
          <dd className="font-medium text-gray-900 tabular-nums">{formatKstTime(r?.checkInAt) || '-'}</dd>
        </div>
        <div>
          <dt className="text-xs text-gray-500">하원</dt>
          <dd className="font-medium text-gray-900 tabular-nums">{formatKstTime(r?.checkOutAt) || '-'}</dd>
        </div>
      </dl>
      <div className="flex items-center gap-1.5 w-28">
        <AttendanceStatusBadge status={status} />
        {r?.source === 'KEYPAD' && <KeypadTag />}
        {r?.source === 'AUTO' && <AutoTag />}
      </div>
      {editable && (
        <div className="flex items-center gap-2 ml-auto">
          {canCheck && (
            <>
              <button
                type="button"
                onClick={onCheckIn}
                disabled={busy || !!r?.checkInAt}
                className="h-11 px-4 rounded-xl bg-primary-700 text-white text-sm font-semibold hover:bg-primary-800 disabled:bg-gray-100 disabled:text-gray-500"
              >
                등원
              </button>
              <button
                type="button"
                onClick={onCheckOut}
                disabled={busy || !r?.checkInAt || !!r?.checkOutAt}
                className="h-11 px-4 rounded-xl border border-gray-200 text-sm font-semibold text-gray-900 hover:bg-gray-50 disabled:text-gray-300 disabled:hover:bg-white"
              >
                하원
              </button>
            </>
          )}
          <button
            type="button"
            onClick={onMore}
            disabled={busy}
            aria-label={`${row.name} 출결 상태 변경`}
            className="w-11 h-11 inline-flex items-center justify-center rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50"
          >
            <MoreHorizontal size={18} />
          </button>
        </div>
      )}
    </li>
  )
}

function SessionStudentRow({ row, href }: { row: TodayStudentRow; href: string }) {
  const r = row.record
  return (
    <li>
      <Link href={href} className="px-4 md:px-5 py-3 flex items-center gap-4 hover:bg-gray-50">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-gray-900 truncate">{row.name}</p>
          <p className="text-sm text-gray-500 truncate">{row.className}</p>
        </div>
        <span className="text-sm text-gray-700 tabular-nums">{formatKstTime(r?.checkInAt)}</span>
        <AttendanceStatusBadge status={r?.status ?? 'UNCHECKED'} />
      </Link>
    </li>
  )
}
