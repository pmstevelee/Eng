'use client'

import { useState, useTransition } from 'react'
import { ShieldAlert } from 'lucide-react'
import { purgeLeadImmediately } from '@/lib/consultation/purge-actions'
import { FormActions, FormError, ModalShell } from './modal-shell'

/** 문의 개인정보 즉시 파기 확인 (학원장 전용) */
export function PurgeLeadDialog({
  leadId,
  studentName,
  onClose,
  onDone,
}: {
  leadId: string
  studentName: string
  onClose: () => void
  onDone: () => void
}) {
  const [confirmed, setConfirmed] = useState(false)
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!confirmed) return setError('되돌릴 수 없다는 안내를 확인해주세요.')
    setError('')
    startTransition(async () => {
      const res = await purgeLeadImmediately(leadId)
      if (res.error) setError(res.error)
      else onDone()
    })
  }

  return (
    <ModalShell title="개인정보 즉시 파기" icon={ShieldAlert} onClose={pending ? () => {} : onClose}>
      <form onSubmit={submit} className="px-5 sm:px-6 py-5 space-y-4">
        <p className="text-sm text-gray-900">
          <strong>{studentName}</strong> 문의의 개인정보를 지금 파기합니다.
        </p>
        <ul className="rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-700 space-y-1.5 list-disc list-inside">
          <li>삭제: 학생·보호자 이름, 연락처, 학교, 상담 기록 내용·메모, 웹 신청 내용, 알림 발송 연락처</li>
          <li>유지(통계용): 채널, 유입경로, 상태, 이탈 사유, 날짜, 담당자</li>
          <li>파기 후에는 상세 내용을 열람할 수 없고 복구할 수 없습니다.</li>
        </ul>
        <label className="flex items-start gap-2.5 min-h-11 cursor-pointer text-sm text-gray-900">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 rounded border-gray-300 accent-accent-red"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
          />
          되돌릴 수 없다는 것을 확인했습니다.
        </label>
        <FormError message={error} />
        <FormActions onCancel={onClose} pending={pending} submitLabel="파기" pendingLabel="파기 중…" danger />
      </form>
    </ModalShell>
  )
}
