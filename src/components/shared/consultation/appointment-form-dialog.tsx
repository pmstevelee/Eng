'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, CalendarClock } from 'lucide-react'
import {
  createAppointment,
  rescheduleAppointment,
  type AppointmentConflict,
} from '@/lib/consultation/appointment-actions'
import {
  APPOINTMENT_DURATION_OPTIONS,
  formatKstDateTime,
  formatKstTime,
  toKstDateKey,
  todayKst,
} from '@/lib/consultation/constants'
import { Field, FormActions, FormError, ModalShell, inputClass } from './modal-shell'

type Option = { id: string; name: string }

type Props = {
  leadId: string
  studentName: string
  /** 일정 변경 시 기존 예약 */
  reschedule?: { id: string; scheduledAt: string; durationMinutes: number; counselorId: string | null }
  /** 학원장만: 상담 담당자 선택지 (교사는 본인 고정이라 빈 배열) */
  counselorOptions: Option[]
  defaultCounselorId: string | null
  onClose: () => void
}

/** 08:00 ~ 21:30, 30분 단위 */
const TIME_OPTIONS = Array.from({ length: 28 }, (_, i) => {
  const minutes = 8 * 60 + i * 30
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
})

export function AppointmentFormDialog(props: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [conflicts, setConflicts] = useState<AppointmentConflict[]>([])
  const init = props.reschedule
  const initTime = init ? formatKstTime(init.scheduledAt) : '15:00'
  const [form, setForm] = useState({
    date: init ? toKstDateKey(init.scheduledAt) : todayKst(),
    time: TIME_OPTIONS.includes(initTime) ? initTime : '15:00',
    durationMinutes: init?.durationMinutes ?? 30,
    counselorId: init?.counselorId ?? props.defaultCounselorId ?? '',
  })
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((f) => ({ ...f, [key]: value }))
    setConflicts([])
  }
  const showCounselor = props.counselorOptions.length > 0

  const submit = (confirmOverlap: boolean) => {
    setError('')
    if (!form.date || !form.time) {
      setError('상담 일시를 입력해주세요.')
      return
    }
    startTransition(async () => {
      const input = {
        scheduledAt: new Date(`${form.date}T${form.time}:00+09:00`).toISOString(),
        durationMinutes: form.durationMinutes,
        counselorId: showCounselor ? form.counselorId || undefined : undefined,
        confirmOverlap,
      }
      const result = init ? await rescheduleAppointment(init.id, input) : await createAppointment(props.leadId, input)
      if (result.error) {
        setError(result.error)
        return
      }
      if (result.conflicts && result.conflicts.length > 0) {
        setConflicts(result.conflicts)
        return
      }
      props.onClose()
      router.refresh()
    })
  }

  return (
    <ModalShell title={init ? '상담 일정 변경' : '상담 예약'} icon={CalendarClock} onClose={props.onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          submit(false)
        }}
        className="px-5 sm:px-6 py-5 space-y-4"
      >
        <p className="text-sm text-gray-700">
          <span className="font-semibold text-gray-900">{props.studentName}</span> 학생 상담
          {init && <span className="block text-xs text-gray-500 mt-0.5">기존 일정: {formatKstDateTime(init.scheduledAt)} (변경 시 취소 처리됩니다)</span>}
        </p>

        <div className="grid grid-cols-2 gap-3">
          <Field label="날짜" required>
            <input
              type="date"
              className={inputClass}
              value={form.date}
              onChange={(e) => set('date', e.target.value)}
              required
            />
          </Field>
          <Field label="시간" required>
            <select className={inputClass} value={form.time} onChange={(e) => set('time', e.target.value)}>
              {TIME_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="상담 시간">
            <select
              className={inputClass}
              value={form.durationMinutes}
              onChange={(e) => set('durationMinutes', parseInt(e.target.value, 10))}
            >
              {APPOINTMENT_DURATION_OPTIONS.map((m) => (
                <option key={m} value={m}>
                  {m}분
                </option>
              ))}
            </select>
          </Field>
          {showCounselor && (
            <Field label="상담 담당자">
              <select className={inputClass} value={form.counselorId} onChange={(e) => set('counselorId', e.target.value)}>
                {props.counselorOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </Field>
          )}
        </div>

        {conflicts.length > 0 && (
          <div className="rounded-xl border border-accent-gold bg-accent-gold-light px-4 py-3 text-sm space-y-2">
            <p className="font-medium text-gray-900 flex items-center gap-1.5">
              <AlertTriangle size={16} className="text-accent-gold" />
              같은 담당자의 일정과 시간이 겹칩니다
            </p>
            <ul className="text-gray-700 space-y-0.5">
              {conflicts.map((c) => (
                <li key={c.id}>
                  {formatKstDateTime(c.scheduledAt)} · {c.studentName} ({c.durationMinutes}분)
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => submit(true)}
              disabled={isPending}
              className="w-full h-11 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-900 hover:bg-gray-50 disabled:opacity-50"
            >
              겹치더라도 저장
            </button>
          </div>
        )}

        <FormError message={error} />
        <FormActions
          onCancel={props.onClose}
          pending={isPending}
          submitLabel={init ? '일정 변경' : '예약'}
          pendingLabel="저장 중..."
        />
      </form>
    </ModalShell>
  )
}
