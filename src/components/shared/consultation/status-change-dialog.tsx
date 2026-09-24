'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRightLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { changeLeadStatus } from '@/lib/consultation/actions'
import {
  LEAD_STATUS_LABEL,
  LOST_REASON_LABEL,
  MANUAL_LEAD_STATUSES,
  type LeadStatusValue,
  type LostReasonValue,
} from '@/lib/consultation/constants'
import { Field, FormActions, FormError, ModalShell, textareaClass } from './modal-shell'

type Props = {
  leadId: string
  currentStatus: LeadStatusValue
  currentLostReason: LostReasonValue | null
  currentLostReasonNote: string | null
  /** 칸반 드롭 등으로 목표 상태가 정해진 경우 (lockStatus면 선택 버튼 숨김) */
  initialStatus?: LeadStatusValue
  lockStatus?: boolean
  onClose: () => void
}

export function StatusChangeDialog(props: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [status, setStatus] = useState<LeadStatusValue>(props.initialStatus ?? props.currentStatus)
  const [lostReason, setLostReason] = useState<LostReasonValue | ''>(props.currentLostReason ?? '')
  const [lostReasonNote, setLostReasonNote] = useState(props.currentLostReasonNote ?? '')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    startTransition(async () => {
      const result = await changeLeadStatus(props.leadId, {
        status,
        lostReason: status === 'LOST' ? lostReason || undefined : undefined,
        lostReasonNote: status === 'LOST' ? lostReasonNote : undefined,
      })
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
      title={props.lockStatus ? `'${LEAD_STATUS_LABEL[status]}'(으)로 변경` : '상태 변경'}
      icon={ArrowRightLeft}
      onClose={props.onClose}
    >
      <form onSubmit={handleSubmit} className="px-5 sm:px-6 py-5 space-y-4">
        {!props.lockStatus && (
          <>
            <div className="grid grid-cols-2 gap-2">
              {MANUAL_LEAD_STATUSES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatus(s)}
                  className={cn(
                    'h-11 rounded-xl border text-sm font-medium transition-colors',
                    status === s
                      ? 'border-primary-700 bg-primary-100 text-primary-700'
                      : 'border-gray-200 text-gray-700 hover:bg-gray-50',
                  )}
                >
                  {LEAD_STATUS_LABEL[s]}
                  {s === props.currentStatus && <span className="ml-1 text-xs text-gray-500">(현재)</span>}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500">&lsquo;등록&rsquo; 상태는 [학생으로 등록]으로 계정을 만들면 자동 변경됩니다.</p>
          </>
        )}

        {status === 'LOST' && (
          <div className="space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
            <Field label="이탈 사유" required>
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(LOST_REASON_LABEL) as LostReasonValue[]).map((r) => (
                  <label
                    key={r}
                    className={cn(
                      'h-11 px-3 rounded-xl border bg-white text-sm flex items-center gap-2 cursor-pointer',
                      lostReason === r ? 'border-primary-700 text-primary-700' : 'border-gray-200 text-gray-700',
                    )}
                  >
                    <input
                      type="radio"
                      name="lostReason"
                      value={r}
                      checked={lostReason === r}
                      onChange={() => setLostReason(r)}
                      className="accent-primary-700"
                    />
                    {LOST_REASON_LABEL[r]}
                  </label>
                ))}
              </div>
            </Field>
            <Field label="상세 사유" required={lostReason === 'OTHER'}>
              <textarea
                className={textareaClass}
                value={lostReasonNote}
                onChange={(e) => setLostReasonNote(e.target.value)}
                placeholder="예: 집에서 가까운 OO학원으로 결정"
                maxLength={500}
              />
            </Field>
          </div>
        )}

        <FormError message={error} />
        <FormActions onCancel={props.onClose} pending={isPending} submitLabel="변경" pendingLabel="변경 중..." />
      </form>
    </ModalShell>
  )
}
