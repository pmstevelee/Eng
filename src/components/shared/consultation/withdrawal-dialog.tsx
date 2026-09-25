'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { UserMinus } from 'lucide-react'
import { todayKst } from '@/lib/consultation/constants'
import { withdrawStudent } from '@/lib/consultation/risk-actions'
import { WITHDRAWAL_REASON_KEYS, WITHDRAWAL_REASON_LABEL, type WithdrawalReasonValue } from '@/lib/consultation/risk-constants'
import { cn } from '@/lib/utils'
import { Field, FormActions, FormError, ModalShell, inputClass, textareaClass } from './modal-shell'

/**
 * 퇴원 처리 (학원장) — 퇴원일·사유·메모를 퇴원 상담 기록으로 저장하고 학생 상태를 '퇴원'으로 바꾼다.
 */
export function WithdrawalDialog({
  studentId,
  studentName,
  onClose,
  onDone,
}: {
  studentId: string
  studentName: string
  onClose: () => void
  onDone?: () => void
}) {
  const router = useRouter()
  const [withdrawnOn, setWithdrawnOn] = useState(todayKst())
  const [reason, setReason] = useState<WithdrawalReasonValue | ''>('')
  const [memo, setMemo] = useState('')
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  const submit = () => {
    setError('')
    if (!withdrawnOn) return setError('퇴원일을 선택해주세요.')
    if (!reason) return setError('퇴원 사유를 선택해주세요.')
    startTransition(async () => {
      const res = await withdrawStudent(studentId, { withdrawnOn, reason, memo })
      if (res.error) {
        setError(res.error)
        return
      }
      onDone?.()
      onClose()
      router.refresh()
    })
  }

  return (
    <ModalShell title="퇴원 처리" icon={UserMinus} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
        className="px-5 sm:px-6 py-5 space-y-4"
      >
        <p className="text-sm text-gray-700">
          <span className="font-semibold text-gray-900">{studentName}</span> 학생을 퇴원 처리합니다. 학생 상태가
          &lsquo;퇴원&rsquo;으로 바뀌고, 입력한 내용은 상담 기록(퇴원 상담)으로 남습니다.
        </p>

        <Field label="퇴원일" required>
          <input
            type="date"
            className={inputClass}
            value={withdrawnOn}
            onChange={(e) => setWithdrawnOn(e.target.value)}
            aria-label="퇴원일"
          />
        </Field>

        <fieldset>
          <legend className="block text-sm font-medium text-gray-700 mb-1.5">
            퇴원 사유 <span className="text-accent-red">*</span>
          </legend>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {WITHDRAWAL_REASON_KEYS.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setReason(key)}
                aria-pressed={reason === key}
                className={cn(
                  'h-11 rounded-xl border text-sm font-medium transition-colors',
                  reason === key
                    ? 'border-primary-700 bg-primary-100 text-primary-700'
                    : 'border-gray-200 text-gray-700 hover:bg-gray-50',
                )}
              >
                {WITHDRAWAL_REASON_LABEL[key]}
              </button>
            ))}
          </div>
        </fieldset>

        <Field label="상세 메모" hint="교사·학원장만 볼 수 있는 내부 메모입니다.">
          <textarea
            className={textareaClass}
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            maxLength={5000}
            placeholder="퇴원 경위, 재등록 가능성 등"
            aria-label="상세 메모"
          />
        </Field>

        <FormError message={error} />
        <FormActions onCancel={onClose} pending={isPending} submitLabel="퇴원 처리" pendingLabel="처리 중..." danger />
      </form>
    </ModalShell>
  )
}
