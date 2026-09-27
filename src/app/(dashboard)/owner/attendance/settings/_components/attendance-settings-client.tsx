'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { updateAttendanceSetting } from '@/lib/attendance/actions'
import {
  ATTENDANCE_MODE_LABEL,
  LATE_GRACE_MAX,
  LATE_GRACE_MIN,
  type AttendanceModeValue,
  type AttendanceSettingValues,
} from '@/lib/attendance/constants'
import { cn } from '@/lib/utils'

type Props = {
  academyId: string
  academies: { id: string; label: string }[]
  initial: AttendanceSettingValues
  /** 알림 크레딧 — 건당 차감(알림톡·문자 대체) · 현재 잔액 (지점은 본원 지갑) */
  credit: { perMessage: number; smsPerMessage: number; balance: number }
}

const MODES: AttendanceModeValue[] = ['ACADEMY', 'CLASS']

function SectionCard({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 md:p-6">
      <h2 className="text-base font-bold text-gray-900">{title}</h2>
      {description && <p className="text-sm text-gray-500 mt-1">{description}</p>}
      <div className="mt-5">{children}</div>
    </section>
  )
}

function ToggleRow({
  id,
  title,
  help,
  checked,
  disabled,
  cost,
  onChange,
}: {
  id: string
  title: string
  help: string
  checked: boolean
  disabled?: boolean
  /** 알림 토글 옆 "건당 N크레딧" */
  cost?: number
  onChange: (on: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
      <label htmlFor={id} className={cn('cursor-pointer', disabled && 'opacity-50')}>
        <p className="text-sm font-semibold text-gray-900">{title}</p>
        <p className="text-xs text-gray-500 mt-0.5">{help}</p>
      </label>
      <div className="flex shrink-0 items-center gap-3">
        {cost !== undefined && <span className="text-xs font-medium text-gray-500">건당 {cost}크레딧</span>}
        <Switch id={id} checked={checked} disabled={disabled} onCheckedChange={onChange} />
      </div>
    </div>
  )
}

export function AttendanceSettingsClient({ academyId, academies, initial, credit }: Props) {
  const router = useRouter()
  const [form, setForm] = useState<AttendanceSettingValues>(initial)
  const [graceText, setGraceText] = useState(String(initial.lateGraceMinutes))
  const [savedMode, setSavedMode] = useState<AttendanceModeValue>(initial.mode)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [pending, startTransition] = useTransition()

  const set = <K extends keyof AttendanceSettingValues>(key: K, value: AttendanceSettingValues[K]) => {
    setForm((f) => ({ ...f, [key]: value }))
    setMessage(null)
  }

  const graceValue = Number(graceText)
  const graceInvalid =
    graceText.trim() === '' || !Number.isInteger(graceValue) || graceValue < LATE_GRACE_MIN || graceValue > LATE_GRACE_MAX

  const save = () => {
    setConfirmOpen(false)
    startTransition(async () => {
      const result = await updateAttendanceSetting(academyId, { ...form, lateGraceMinutes: graceValue })
      if (result.error) {
        setMessage({ ok: false, text: result.error })
        return
      }
      setSavedMode(form.mode)
      setMessage({ ok: true, text: '저장되었습니다.' })
      router.refresh()
    })
  }

  const handleSave = () => {
    if (graceInvalid) {
      setMessage({ ok: false, text: `지각 허용시간은 ${LATE_GRACE_MIN}~${LATE_GRACE_MAX}분 사이로 입력해주세요.` })
      return
    }
    // 출결 방식이 바뀌면 확인 후 저장
    if (form.mode !== savedMode) setConfirmOpen(true)
    else save()
  }

  return (
    <div className="space-y-6">
      {academies.length > 1 && (
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="학원 선택">
          {academies.map((a) => (
            <button
              key={a.id}
              type="button"
              role="tab"
              aria-selected={a.id === academyId}
              onClick={() => router.push(`/owner/attendance/settings?academy=${a.id}`)}
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

      <SectionCard title="출결 방식" description="학원 운영 방식에 맞는 출결 방식을 선택하세요.">
        <div role="radiogroup" aria-label="출결 방식" className="grid gap-3 sm:grid-cols-2">
          {MODES.map((mode) => {
            const selected = form.mode === mode
            return (
              <button
                key={mode}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => set('mode', mode)}
                className={cn(
                  'flex items-start gap-3 rounded-xl border p-4 text-left transition-colors min-h-[44px]',
                  selected ? 'border-primary-700 bg-primary-100' : 'border-gray-200 bg-white hover:bg-gray-50',
                )}
              >
                <span
                  className={cn(
                    'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2',
                    selected ? 'border-primary-700' : 'border-gray-300',
                  )}
                >
                  {selected && <span className="h-2.5 w-2.5 rounded-full bg-primary-700" />}
                </span>
                <span>
                  <span className="block text-sm font-semibold text-gray-900">
                    {ATTENDANCE_MODE_LABEL[mode].title}
                    {mode === 'ACADEMY' && <span className="ml-1.5 text-xs font-medium text-gray-500">기본</span>}
                  </span>
                  <span className="block text-xs text-gray-500 mt-1">{ATTENDANCE_MODE_LABEL[mode].description}</span>
                </span>
              </button>
            )
          })}
        </div>
      </SectionCard>

      <SectionCard title="지각 · 결석 기준">
        <div className="divide-y divide-gray-100">
          <div className="flex items-center justify-between gap-4 pb-3">
            <label htmlFor="late-grace">
              <p className="text-sm font-semibold text-gray-900">지각 허용시간</p>
              <p className="text-xs text-gray-500 mt-0.5">
                수업 시작 후 이 시간까지는 출석으로 처리합니다. ({LATE_GRACE_MIN}~{LATE_GRACE_MAX}분)
              </p>
            </label>
            <div className="flex items-center gap-2 shrink-0">
              <input
                id="late-grace"
                type="number"
                inputMode="numeric"
                min={LATE_GRACE_MIN}
                max={LATE_GRACE_MAX}
                value={graceText}
                onChange={(e) => {
                  setGraceText(e.target.value)
                  setMessage(null)
                }}
                aria-invalid={graceInvalid}
                className={cn(
                  'w-20 h-11 px-3 rounded-xl border text-sm text-gray-900 text-right bg-white focus:outline-none focus:ring-2 focus:ring-primary-700',
                  graceInvalid ? 'border-accent-red' : 'border-gray-200',
                )}
              />
              <span className="text-sm text-gray-700">분</span>
            </div>
          </div>
          <div className="pt-3">
            <ToggleRow
              id="auto-absent"
              title="수업 종료 시 미체크 자동 결석"
              help="수업 종료 처리 시 출석 체크가 안 된 학생을 결석으로 기록합니다."
              checked={form.autoAbsentOnEnd}
              onChange={(on) => set('autoAbsentOnEnd', on)}
            />
          </div>
        </div>
      </SectionCard>

      <SectionCard title="학부모 알림" description="출결 시 학부모에게 보낼 안내를 선택하세요.">
        <div className="divide-y divide-gray-100">
          <ToggleRow
            id="notify-check-in"
            cost={credit.perMessage}
            title="등원 알림"
            help="학생이 등원(출석)하면 학부모에게 알립니다."
            checked={form.notifyCheckIn}
            onChange={(on) => set('notifyCheckIn', on)}
          />
          <ToggleRow
            id="notify-check-out"
            cost={credit.perMessage}
            title="하원 알림"
            help="학생이 하원하면 학부모에게 알립니다."
            checked={form.notifyCheckOut}
            onChange={(on) => set('notifyCheckOut', on)}
          />
          <ToggleRow
            id="include-study-summary"
            title="하원 알림에 학습 요약 포함"
            help="오늘 학습한 내용을 하원 알림에 함께 보냅니다."
            checked={form.includeStudySummary}
            disabled={!form.notifyCheckOut}
            onChange={(on) => set('includeStudySummary', on)}
          />
          <ToggleRow
            id="notify-absent"
            cost={credit.perMessage}
            title="미등원 안내"
            help="수업 시간이 지나도 등원하지 않으면 학부모에게 안내합니다."
            checked={form.notifyAbsent}
            onChange={(on) => set('notifyAbsent', on)}
          />
        </div>
        {credit.balance < credit.perMessage ? (
          <div className="mt-4 flex flex-col gap-3 rounded-xl bg-accent-gold/10 p-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-start gap-2 text-sm text-gray-900">
              <AlertTriangle size={18} className="mt-0.5 shrink-0 text-accent-gold" />
              알림 크레딧 잔액이 없어 알림을 켜도 학부모에게 발송되지 않습니다.
            </p>
            <Link
              href="/owner/credits#charge"
              className="inline-flex h-11 shrink-0 items-center justify-center rounded-xl bg-primary-700 px-4 text-sm font-semibold text-white hover:bg-primary-800"
            >
              충전하기
            </Link>
          </div>
        ) : (
          <p className="mt-4 text-xs text-gray-500">
            알림톡으로 발송하며, 알림톡이 실패해 문자로 대체발송되면 건당 {credit.smsPerMessage}크레딧이 차감됩니다. 현재 잔액{' '}
            {credit.balance.toLocaleString('ko-KR')}크레딧 ·{' '}
            <Link href="/owner/credits" className="font-medium text-primary-700 hover:underline">
              크레딧 관리
            </Link>
          </p>
        )}
      </SectionCard>

      <div className="flex items-center justify-end gap-3">
        {message && (
          <p role="status" className={cn('text-sm', message.ok ? 'text-accent-green' : 'text-accent-red')}>
            {message.text}
          </p>
        )}
        <button
          type="button"
          onClick={handleSave}
          disabled={pending}
          className="h-11 px-5 rounded-xl bg-primary-700 text-white text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-60"
        >
          {pending && <Loader2 size={16} className="animate-spin" />}
          저장
        </button>
      </div>

      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setConfirmOpen(false)} />
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="mode-confirm-title"
            className="relative z-10 w-full max-w-sm rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
          >
            <div className="w-10 h-10 rounded-full bg-accent-gold/15 flex items-center justify-center">
              <AlertTriangle size={20} className="text-accent-gold" />
            </div>
            <h3 id="mode-confirm-title" className="mt-4 text-base font-bold text-gray-900">
              출결 방식을 &lsquo;{ATTENDANCE_MODE_LABEL[form.mode].title}&rsquo;(으)로 변경할까요?
            </h3>
            <p className="mt-2 text-sm text-gray-700">
              오늘부터 새 방식으로 기록됩니다. 과거 기록은 그대로 유지됩니다.
            </p>
            <div className="mt-6 flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="flex-1 h-11 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={save}
                className="flex-1 h-11 rounded-xl bg-primary-700 text-white text-sm font-semibold hover:bg-primary-800"
              >
                변경
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
