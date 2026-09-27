'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertTriangle, ArrowLeft, CheckCheck, Loader2, Square, Users } from 'lucide-react'
import { endSession, markAllPresent, setSessionAttendance } from '@/lib/attendance/record-actions'
import type { SessionDetail } from '@/lib/attendance/queries'
import type { AttendanceRecordView } from '@/lib/attendance/records'
import {
  ATTENDANCE_STATUS_META,
  emptyCounts,
  isPastLateLine,
  nextCycleStatus,
  SPECIAL_STATUSES,
  type AttendanceStatusValue,
} from '@/lib/attendance/constants'
import { formatDateLabel, formatKstTime } from '@/lib/attendance/time'
import { cn } from '@/lib/utils'
import { AttendanceStatusBadge, AutoTag, KeypadTag } from './status-badge'
import { AttendanceStatusSheet } from './status-sheet'
import { useToastMessage } from './use-toast-message'

type StudentState = SessionDetail['students'][number]

const LONG_PRESS_MS = 550
const COUNT_ORDER: AttendanceStatusValue[] = ['PRESENT', 'LATE', 'ABSENT', 'EXCUSED', 'EARLY_LEAVE', 'MAKEUP', 'UNCHECKED']

export function SessionCheck({ detail, basePath, today }: { detail: SessionDetail; basePath: string; today: string }) {
  const router = useRouter()
  const toast = useToastMessage()
  const [students, setStudents] = useState(detail.students)
  const [sheetFor, setSheetFor] = useState<StudentState | null>(null)
  const [confirmEnd, setConfirmEnd] = useState(false)
  const [pending, startTransition] = useTransition()

  // 학생별 요청을 순서대로 보내고, 마지막 요청 결과만 반영
  const queues = useRef(new Map<string, Promise<void>>())
  const latestReq = useRef(new Map<string, number>())
  const confirmed = useRef(new Map<string, AttendanceRecordView | null>())

  useEffect(() => {
    setStudents(detail.students)
    confirmed.current = new Map(detail.students.map((s) => [s.id, s.record]))
  }, [detail.students])

  const isToday = detail.dateKey === today
  const editable = detail.canEdit && !detail.cancelled

  const counts = useMemo(() => {
    const c = emptyCounts()
    for (const s of students) c[s.record?.status ?? 'UNCHECKED']++
    return c
  }, [students])

  const setRecord = (studentId: string, record: AttendanceRecordView | null) =>
    setStudents((prev) => prev.map((s) => (s.id === studentId ? { ...s, record } : s)))

  const optimistic = (s: StudentState, status: AttendanceStatusValue, reason: string | null): AttendanceRecordView => {
    const nowIso = new Date().toISOString()
    const clears = status === 'UNCHECKED' || status === 'ABSENT' || status === 'EXCUSED'
    return {
      id: s.record?.id ?? 'pending',
      studentId: s.id,
      status,
      checkInAt: clears ? null : (s.record?.checkInAt ?? nowIso),
      checkOutAt: clears ? null : (s.record?.checkOutAt ?? (status === 'EARLY_LEAVE' ? nowIso : null)),
      source: 'MANUAL',
      reason: SPECIAL_STATUSES.includes(status) ? reason : null,
    }
  }

  const send = (s: StudentState, status: AttendanceStatusValue, reason: string | null, autoLate: boolean) => {
    const reqId = (latestReq.current.get(s.id) ?? 0) + 1
    latestReq.current.set(s.id, reqId)
    const prev = queues.current.get(s.id) ?? Promise.resolve()
    const next = prev.then(async () => {
      const res = await setSessionAttendance({ sessionId: detail.id, studentId: s.id, status, reason, autoLate })
      if (res.error) {
        toast.show(res.error)
        if (latestReq.current.get(s.id) === reqId) setRecord(s.id, confirmed.current.get(s.id) ?? null)
        return
      }
      if (res.record) {
        confirmed.current.set(s.id, res.record)
        if (latestReq.current.get(s.id) === reqId) setRecord(s.id, res.record)
      }
    })
    queues.current.set(s.id, next.catch(() => undefined))
  }

  const tap = (s: StudentState) => {
    if (!editable) return
    let status = nextCycleStatus(s.record?.status ?? 'UNCHECKED')
    const autoLate = status === 'PRESENT'
    // 서버와 같은 기준으로 지각을 미리 반영 (깜빡임 방지)
    if (autoLate && isToday && isPastLateLine(detail.startAt, detail.lateGraceMinutes, Date.now())) status = 'LATE'
    setRecord(s.id, optimistic(s, status, null))
    send(s, autoLate ? 'PRESENT' : status, null, autoLate)
  }

  const submitSheet = (status: AttendanceStatusValue, reason: string | null) => {
    const s = sheetFor
    setSheetFor(null)
    if (!s) return
    setRecord(s.id, optimistic(s, status, reason))
    send(s, status, reason, false)
  }

  const onAllPresent = () => {
    const late = isToday && isPastLateLine(detail.startAt, detail.lateGraceMinutes, Date.now())
    const before = students
    setStudents((prev) =>
      prev.map((s) => ((s.record?.status ?? 'UNCHECKED') === 'UNCHECKED' ? { ...s, record: optimistic(s, late ? 'LATE' : 'PRESENT', null) } : s)),
    )
    startTransition(async () => {
      const res = await markAllPresent(detail.id)
      if (res.error) {
        setStudents(before)
        toast.show(res.error)
        return
      }
      toast.show(`${res.count ?? 0}명을 ${late ? '지각' : '출석'} 처리했습니다.`, true)
      router.refresh()
    })
  }

  const onEnd = () => {
    setConfirmEnd(false)
    startTransition(async () => {
      const res = await endSession(detail.id)
      if (res.error) {
        toast.show(res.error)
        return
      }
      toast.show(
        res.absentCount ? `수업을 종료했습니다. 미체크 ${res.absentCount}명은 결석 처리했습니다.` : '수업을 종료했습니다.',
        true,
      )
      router.refresh()
    })
  }

  return (
    <div className="space-y-5">
      <div>
        <Link
          href={`${basePath}/today${isToday ? '' : `?date=${detail.dateKey}`}`}
          className="inline-flex items-center gap-1 h-11 -ml-2 px-2 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-100"
        >
          <ArrowLeft size={16} /> 오늘 출결
        </Link>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{detail.className}</h1>
            <p className="text-sm text-gray-500 mt-1">
              {formatDateLabel(detail.dateKey)} · {formatKstTime(detail.startAt)}~{formatKstTime(detail.endAt)}
              {detail.teacherName && ` · ${detail.teacherName}`}
            </p>
          </div>
          {editable && (
            <div className="flex gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={onAllPresent}
                disabled={pending || counts.UNCHECKED === 0}
                className="flex-1 sm:flex-none h-11 px-4 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-900 inline-flex items-center justify-center gap-2 hover:bg-gray-50 disabled:opacity-50"
              >
                <CheckCheck size={18} className="text-accent-green" /> 전체 출석
              </button>
              {detail.endedAt ? (
                <span className="flex-1 sm:flex-none h-11 px-4 rounded-xl bg-gray-100 text-sm font-semibold text-gray-700 inline-flex items-center justify-center">
                  {formatKstTime(detail.endedAt)} 종료됨
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmEnd(true)}
                  disabled={pending}
                  className="flex-1 sm:flex-none h-11 px-4 rounded-xl bg-primary-700 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 hover:bg-primary-800 disabled:opacity-60"
                >
                  {pending ? <Loader2 size={16} className="animate-spin" /> : <Square size={16} />} 수업 종료
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 상태별 개수 */}
      <div className="flex flex-wrap gap-2">
        {COUNT_ORDER.filter((k) => counts[k] > 0 || k === 'PRESENT' || k === 'UNCHECKED').map((k) => (
          <span key={k} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-white border border-gray-200 text-sm">
            <span
              className={cn('w-2 h-2 rounded-full', k === 'UNCHECKED' && 'border border-gray-400')}
              style={k === 'UNCHECKED' ? undefined : { backgroundColor: ATTENDANCE_STATUS_META[k].color }}
              aria-hidden
            />
            <span className="text-gray-700">{ATTENDANCE_STATUS_META[k].label}</span>
            <span className="font-bold text-gray-900 tabular-nums">{counts[k]}</span>
          </span>
        ))}
      </div>

      {detail.cancelled ? (
        <p className="rounded-xl bg-gray-100 px-4 py-3 text-sm text-gray-700">휴강한 수업입니다.</p>
      ) : !detail.canEdit ? (
        <p className="rounded-xl bg-gray-100 px-4 py-3 text-sm text-gray-700">
          지난 수업의 출결은 조회만 할 수 있습니다. 수정은 학원장에게 요청해주세요.
        </p>
      ) : (
        <p className="text-sm text-gray-500">
          카드를 누르면 미체크 → 출석 → 지각 → 결석 순으로 바뀝니다. 길게 누르거나 우클릭하면 인정결석·조퇴·보강을 선택할 수 있습니다.
        </p>
      )}

      {students.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white py-14 px-6 flex flex-col items-center text-center">
          <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center">
            <Users size={24} className="text-primary-700" />
          </div>
          <p className="mt-4 text-base font-semibold text-gray-900">이 반에 배정된 학생이 없습니다</p>
          <p className="mt-1 text-sm text-gray-500">학생 관리에서 학생의 반을 지정하면 출석 명단에 표시됩니다.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {students.map((s) => (
            <StudentCard
              key={s.id}
              student={s}
              editable={editable}
              onTap={() => tap(s)}
              onLongPress={() => editable && setSheetFor(s)}
            />
          ))}
        </div>
      )}

      {sheetFor && (
        <AttendanceStatusSheet
          title={`${sheetFor.name} 출결`}
          statuses={SPECIAL_STATUSES}
          initialStatus={sheetFor.record?.status}
          initialReason={sheetFor.record?.reason}
          onClose={() => setSheetFor(null)}
          onSubmit={submitSheet}
        />
      )}

      {confirmEnd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setConfirmEnd(false)} />
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="end-session-title"
            className="relative z-10 w-full max-w-sm rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
          >
            <div className="w-10 h-10 rounded-full bg-accent-gold/15 flex items-center justify-center">
              <AlertTriangle size={20} className="text-accent-gold" />
            </div>
            <h3 id="end-session-title" className="mt-4 text-base font-bold text-gray-900">
              수업을 종료할까요?
            </h3>
            <p className="mt-2 text-sm text-gray-700">
              {detail.autoAbsentOnEnd && counts.UNCHECKED > 0
                ? `아직 체크하지 않은 ${counts.UNCHECKED}명은 결석으로 처리됩니다.`
                : '종료 후에도 출결 상태는 수정할 수 있습니다.'}
            </p>
            <div className="mt-6 flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmEnd(false)}
                className="flex-1 h-11 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={onEnd}
                className="flex-1 h-11 rounded-xl bg-primary-700 text-white text-sm font-semibold hover:bg-primary-800"
              >
                종료
              </button>
            </div>
          </div>
        </div>
      )}
      {toast.node}
    </div>
  )
}

function StudentCard({
  student,
  editable,
  onTap,
  onLongPress,
}: {
  student: StudentState
  editable: boolean
  onTap: () => void
  onLongPress: () => void
}) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPressed = useRef(false)
  const r = student.record
  const status = r?.status ?? 'UNCHECKED'
  const color = ATTENDANCE_STATUS_META[status].color

  const clear = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
  }

  return (
    <button
      type="button"
      disabled={!editable}
      onPointerDown={(e) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return
        longPressed.current = false
        clear()
        timer.current = setTimeout(() => {
          longPressed.current = true
          onLongPress()
        }, LONG_PRESS_MS)
      }}
      onPointerUp={clear}
      onPointerLeave={clear}
      onPointerCancel={clear}
      onClick={() => {
        // 길게 누른 뒤 손을 뗄 때 발생하는 click은 무시
        if (longPressed.current) {
          longPressed.current = false
          return
        }
        onTap()
      }}
      onContextMenu={(e) => {
        e.preventDefault()
        clear()
        longPressed.current = true
        onLongPress()
      }}
      aria-label={`${student.name} ${ATTENDANCE_STATUS_META[status].label}`}
      className={cn(
        'relative min-h-[112px] rounded-xl border bg-white p-3 text-left select-none [-webkit-touch-callout:none] [touch-action:manipulation] transition-colors',
        status === 'UNCHECKED' ? 'border-gray-300 border-dashed' : 'border-2',
        editable ? 'active:scale-[0.98] hover:bg-gray-50' : 'cursor-default',
      )}
      style={status === 'UNCHECKED' ? undefined : { borderColor: color, backgroundColor: `${color}0F` }}
    >
      <p className="text-base font-bold text-gray-900 truncate">{student.name}</p>
      <div className="mt-2 flex flex-wrap items-center gap-1">
        <AttendanceStatusBadge status={status} />
        {r?.source === 'KEYPAD' && <KeypadTag />}
        {r?.source === 'AUTO' && <AutoTag />}
      </div>
      <p className="mt-2 text-xs text-gray-500 tabular-nums h-4">
        {r?.checkInAt ? `${formatKstTime(r.checkInAt)} 체크` : ''}
      </p>
      {r?.reason && <p className="text-xs text-gray-500 truncate">{r.reason}</p>}
    </button>
  )
}
