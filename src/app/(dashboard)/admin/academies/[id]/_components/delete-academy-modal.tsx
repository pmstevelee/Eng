'use client'

import { useState, useTransition } from 'react'
import { AlertTriangle } from 'lucide-react'
import { deleteAcademy } from '../actions'

interface DeleteAcademyModalProps {
  academyId: string
  academyName: string
}

export function DeleteAcademyModal({ academyId, academyName }: DeleteAcademyModalProps) {
  const [open, setOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  const canSubmit = confirmText === '삭제합니다'

  function handleClose() {
    setOpen(false)
    setConfirmText('')
    setError('')
  }

  function handleSubmit() {
    if (!canSubmit) return
    setError('')
    const formData = new FormData()
    formData.append('academyId', academyId)

    startTransition(async () => {
      const result = await deleteAcademy(formData)
      if (result?.error) setError(result.error)
    })
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full h-9 rounded-lg border border-accent-red text-accent-red text-sm font-medium hover:bg-accent-red-light transition-colors"
      >
        삭제
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl border border-gray-200 p-6 w-full max-w-md shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-accent-red-light flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={20} className="text-accent-red" />
              </div>
              <h2 className="text-base font-bold text-gray-900">학원 영구 삭제</h2>
            </div>

            <div className="mb-5">
              <p className="text-sm text-gray-700 mb-3">
                <strong>{academyName}</strong> 학원을 삭제하면 다음 데이터가 모두 영구 삭제됩니다:
              </p>
              <ul className="text-sm text-gray-600 space-y-1 pl-4 list-disc">
                <li>학원 정보 및 모든 설정</li>
                <li>모든 교사/학생 계정</li>
                <li>모든 테스트/문제/성적 데이터</li>
                <li>구독 이력</li>
              </ul>
              <p className="text-sm font-semibold text-accent-red mt-3">
                이 작업은 절대 되돌릴 수 없습니다.
              </p>
            </div>

            <div className="mb-5">
              <label className="block text-xs font-medium text-gray-700 mb-1.5">
                확인을 위해 <strong>삭제합니다</strong>를 입력하세요
              </label>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="삭제합니다"
                autoComplete="off"
                className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:border-accent-red"
              />
            </div>

            {error && <p className="text-sm text-accent-red mb-4">{error}</p>}

            <div className="flex gap-3">
              <button
                onClick={handleClose}
                disabled={isPending}
                className="flex-1 h-11 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                취소
              </button>
              <button
                onClick={handleSubmit}
                disabled={!canSubmit || isPending}
                className="flex-1 h-11 rounded-xl bg-accent-red text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {isPending ? '삭제 중...' : '영구 삭제'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
