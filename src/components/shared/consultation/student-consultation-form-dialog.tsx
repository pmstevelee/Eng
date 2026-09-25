'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, NotebookPen } from 'lucide-react'
import {
  STUDENT_CONSULTATION_TYPE_LABEL,
  addDaysToDateKey,
  kstLocalInputToIso,
  nowKstLocalInput,
  toKstLocalInput,
  todayKst,
  type StudentConsultationTypeValue,
} from '@/lib/consultation/constants'
import type { LearningSummary } from '@/lib/consultation/learning-summary-types'
import {
  createStudentConsultation,
  getLearningSummary,
  updateStudentConsultation,
} from '@/lib/consultation/student-consultation-actions'
import { cn } from '@/lib/utils'
import { LearningSummaryView } from './learning-summary-view'
import { Field, FormActions, FormError, ModalShell, inputClass, textareaClass } from './modal-shell'

export type StudentConsultationFormInitial = {
  id: string
  consultedAt: string
  type: StudentConsultationTypeValue
  goal: string | null
  parentNeeds: string | null
  memo: string | null
  parentComment: string | null
  snapshot: LearningSummary | null
}

type Props = {
  studentId: string
  studentName: string
  initial?: StudentConsultationFormInitial
  /** 예약 "상담 완료" 처리: 저장 시 예약을 완료하고 기록과 연결 */
  appointment?: { id: string; scheduledAt: string }
  /** 새 기록의 기본 유형 (정기상담 대상 목록에서 열면 REGULAR) */
  defaultType?: StudentConsultationTypeValue
  onClose: () => void
}

const PERIOD_PRESETS = [30, 60, 90] as const

/** 재원생 상담 기록 작성/수정 + 옆 "학습 요약" 패널 */
export function StudentConsultationFormDialog(props: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const init = props.initial
  const [form, setForm] = useState({
    consultedAt: init
      ? toKstLocalInput(init.consultedAt)
      : props.appointment
        ? toKstLocalInput(props.appointment.scheduledAt)
        : nowKstLocalInput(),
    type: init?.type ?? props.defaultType ?? ('REGULAR' as StudentConsultationTypeValue),
    goal: init?.goal ?? '',
    parentNeeds: init?.parentNeeds ?? '',
    parentComment: init?.parentComment ?? '',
    memo: init?.memo ?? '',
  })
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((f) => ({ ...f, [key]: value }))

  // ── 학습 요약 기간 ──
  const today = todayKst()
  const [period, setPeriod] = useState({ from: addDaysToDateKey(today, -29), to: today })
  const [summary, setSummary] = useState<LearningSummary | null>(null)
  const [summaryError, setSummaryError] = useState('')
  const [summaryLoading, setSummaryLoading] = useState(true)
  // 새 기록은 기본 저장, 수정은 기존 스냅샷 유지가 기본
  const [saveSnapshot, setSaveSnapshot] = useState(!init)

  useEffect(() => {
    let canceled = false
    setSummaryLoading(true)
    setSummaryError('')
    getLearningSummary(props.studentId, period.from, period.to)
      .then((res) => {
        if (canceled) return
        if (res.error || !res.summary) {
          setSummary(null)
          setSummaryError(res.error ?? '학습 요약을 불러오지 못했습니다.')
        } else {
          setSummary(res.summary)
        }
      })
      .catch(() => !canceled && setSummaryError('학습 요약을 불러오지 못했습니다.'))
      .finally(() => !canceled && setSummaryLoading(false))
    return () => {
      canceled = true
    }
  }, [props.studentId, period.from, period.to])

  const presetDays = PERIOD_PRESETS.find((d) => period.to === today && period.from === addDaysToDateKey(today, -(d - 1)))

  const submit = () => {
    setError('')
    if (!form.consultedAt) {
      setError('상담 일시를 입력해주세요.')
      return
    }
    startTransition(async () => {
      const input = { ...form, consultedAt: kstLocalInputToIso(form.consultedAt) }
      const snapshotPeriod = saveSnapshot ? period : null
      const result = init
        ? await updateStudentConsultation(init.id, input, snapshotPeriod)
        : await createStudentConsultation(props.studentId, input, snapshotPeriod, props.appointment?.id)
      if (result.error) {
        setError(result.error)
        return
      }
      props.onClose()
      router.refresh()
    })
  }

  return (
    <ModalShell
      title={init ? '상담 기록 수정' : props.appointment ? '상담 완료 · 기록 작성' : '상담 기록 작성'}
      icon={NotebookPen}
      onClose={props.onClose}
      size="xl"
    >
      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:divide-x divide-gray-200">
        {/* 상담 기록 */}
        <form
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
          className="px-5 sm:px-6 py-5 space-y-4"
        >
          <p className="text-sm text-gray-700">
            <span className="font-semibold text-gray-900">{props.studentName}</span> 학생 상담
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="상담 일시" required>
              <input
                type="datetime-local"
                className={inputClass}
                value={form.consultedAt}
                onChange={(e) => set('consultedAt', e.target.value)}
                required
              />
            </Field>
            <Field label="상담 유형" required>
              <select
                className={inputClass}
                value={form.type}
                onChange={(e) => set('type', e.target.value as StudentConsultationTypeValue)}
              >
                {(Object.keys(STUDENT_CONSULTATION_TYPE_LABEL) as StudentConsultationTypeValue[]).map((t) => (
                  <option key={t} value={t}>
                    {STUDENT_CONSULTATION_TYPE_LABEL[t]}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          {form.type === 'WITHDRAWAL' && (
            <p className="text-xs text-gray-700 bg-accent-gold-light rounded-lg px-3 py-2">
              퇴원 상담을 기록해도 학생 상태는 바뀌지 않습니다. 퇴원 처리는 학원장이 학생 관리에서 따로 진행해주세요.
            </p>
          )}

          <Field label="학부모 요청사항">
            <textarea
              className={textareaClass}
              value={form.parentNeeds}
              onChange={(e) => set('parentNeeds', e.target.value)}
              placeholder="학부모가 요청하거나 걱정하는 부분"
              maxLength={2000}
            />
          </Field>
          <Field label="다음 목표">
            <textarea
              className={textareaClass}
              value={form.goal}
              onChange={(e) => set('goal', e.target.value)}
              placeholder="다음 상담까지의 학습 목표"
              maxLength={2000}
            />
          </Field>

          <div className="rounded-xl border border-primary-700/30 bg-primary-100/40 p-3 space-y-1.5">
            <label htmlFor="parent-comment" className="block text-sm font-semibold text-gray-900">
              학부모 공유용 코멘트
            </label>
            <p className="text-xs text-gray-500">학부모 리포트에 그대로 표시됩니다.</p>
            <textarea
              id="parent-comment"
              className={textareaClass}
              value={form.parentComment}
              onChange={(e) => set('parentComment', e.target.value)}
              placeholder="예) 이번 달 단어 복습을 꾸준히 해서 어휘 정답률이 많이 올랐습니다."
              maxLength={2000}
            />
          </div>

          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 space-y-1.5">
            <label htmlFor="internal-memo" className="block text-sm font-semibold text-gray-900">
              교사 내부 메모
            </label>
            <p className="text-xs text-gray-500">학원 내부에서만 보이며 학부모에게 공개되지 않습니다.</p>
            <textarea
              id="internal-memo"
              className={textareaClass}
              value={form.memo}
              onChange={(e) => set('memo', e.target.value)}
              maxLength={5000}
            />
          </div>

          <label className="flex items-start gap-3 min-h-11 rounded-xl border border-gray-200 px-3 py-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={saveSnapshot}
              onChange={(e) => setSaveSnapshot(e.target.checked)}
              className="mt-0.5 w-5 h-5 rounded accent-primary-700"
            />
            <span className="text-sm text-gray-900">
              {init ? '선택한 기간의 학습 요약으로 다시 저장' : '선택한 기간의 학습 요약을 함께 저장'}
              <span className="block text-xs text-gray-500">
                {init && init.snapshot && !saveSnapshot
                  ? '체크하지 않으면 작성 당시 저장된 요약이 그대로 유지됩니다.'
                  : '저장 시점의 수치가 기록되어 나중에 봐도 그대로 보입니다.'}
              </span>
            </span>
          </label>

          <FormError message={error} />
          <FormActions onCancel={props.onClose} pending={isPending} submitLabel="저장" pendingLabel="저장 중..." />
        </form>

        {/* 학습 요약 패널 */}
        <aside className="px-5 sm:px-6 py-5 space-y-4 border-t lg:border-t-0 border-gray-200 bg-gray-50/60">
          <div className="space-y-2">
            <h3 className="text-base font-bold text-gray-900">학습 요약</h3>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="요약 기간">
              {PERIOD_PRESETS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setPeriod({ from: addDaysToDateKey(today, -(d - 1)), to: today })}
                  aria-pressed={presetDays === d}
                  className={cn(
                    'h-11 px-3 rounded-xl border text-sm font-medium transition-colors',
                    presetDays === d
                      ? 'border-primary-700 bg-primary-700 text-white'
                      : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50',
                  )}
                >
                  최근 {d}일
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs text-gray-500">
                시작일
                <input
                  type="date"
                  className={cn(inputClass, 'mt-1')}
                  value={period.from}
                  max={period.to}
                  onChange={(e) => e.target.value && setPeriod((p) => ({ ...p, from: e.target.value }))}
                />
              </label>
              <label className="text-xs text-gray-500">
                종료일
                <input
                  type="date"
                  className={cn(inputClass, 'mt-1')}
                  value={period.to}
                  min={period.from}
                  max={today}
                  onChange={(e) => e.target.value && setPeriod((p) => ({ ...p, to: e.target.value }))}
                />
              </label>
            </div>
          </div>

          {summaryLoading ? (
            <div className="py-16 flex flex-col items-center text-sm text-gray-500">
              <Loader2 size={20} className="animate-spin text-primary-700 mb-2" />
              학습 기록을 불러오는 중...
            </div>
          ) : summaryError ? (
            <FormError message={summaryError} />
          ) : summary ? (
            <LearningSummaryView summary={summary} compact />
          ) : null}

          {init?.snapshot && (
            <details className="rounded-xl border border-gray-200 bg-white">
              <summary className="min-h-11 px-3 flex items-center text-sm font-medium text-gray-700 cursor-pointer">
                작성 당시 저장된 요약 보기
              </summary>
              <div className="px-3 pb-3">
                <LearningSummaryView summary={init.snapshot} compact />
              </div>
            </details>
          )}
        </aside>
      </div>
    </ModalShell>
  )
}
