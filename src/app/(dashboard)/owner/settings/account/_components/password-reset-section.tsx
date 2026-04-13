'use client'

import { useState, useTransition } from 'react'
import { sendPasswordResetEmail } from '../../actions'

export function PasswordResetSection({ email }: { email: string }) {
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleSend = () => {
    setError(null)
    startTransition(async () => {
      const res = await sendPasswordResetEmail()
      if (res?.error) {
        setError(res.error)
      } else {
        setSent(true)
      }
    })
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-gray-900">비밀번호 변경</h3>
        <p className="text-xs text-gray-500 mt-0.5">
          이메일 인증을 통해 비밀번호를 변경합니다
        </p>
      </div>

      {sent ? (
        <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 space-y-1">
          <p className="text-sm font-medium text-green-800">인증 이메일이 발송되었습니다</p>
          <p className="text-xs text-green-700">
            <span className="font-medium">{email}</span>로 발송된 이메일의 링크를 클릭하여
            비밀번호를 변경해주세요.
          </p>
          <p className="text-xs text-green-600 mt-1">이메일이 오지 않으면 스팸 폴더를 확인해주세요.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-3 rounded-lg bg-gray-50 border border-gray-200 px-4 py-3">
            <div className="text-xl">✉️</div>
            <div>
              <p className="text-xs text-gray-500">인증 이메일 발송 주소</p>
              <p className="text-sm font-medium text-gray-900">{email}</p>
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
          )}

          <button
            type="button"
            onClick={handleSend}
            disabled={isPending}
            className="h-11 px-5 rounded-xl text-sm font-medium text-white transition-colors disabled:opacity-50"
            style={{ backgroundColor: '#1865F2' }}
          >
            {isPending ? '발송 중…' : '비밀번호 변경 이메일 발송'}
          </button>
        </div>
      )}
    </div>
  )
}
