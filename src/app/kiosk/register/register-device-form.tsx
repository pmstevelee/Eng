'use client'

import { useState, useTransition } from 'react'
import { Loader2 } from 'lucide-react'
import { registerKeypadDevice } from '@/lib/attendance/keypad-actions'

export function RegisterDeviceForm({ code }: { code: string }) {
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const register = () => {
    setError(null)
    startTransition(async () => {
      // 성공하면 서버에서 /kiosk로 이동
      const result = await registerKeypadDevice(code)
      if (result?.error) setError(result.error)
    })
  }

  return (
    <div className="mt-6">
      <button
        type="button"
        onClick={register}
        disabled={pending}
        className="w-full h-14 rounded-xl bg-primary-700 text-white text-base font-semibold inline-flex items-center justify-center gap-2 hover:bg-primary-800 disabled:opacity-60"
      >
        {pending && <Loader2 size={18} className="animate-spin" />}
        이 기기 등록하기
      </button>
      {error && (
        <p role="alert" className="mt-3 text-sm text-accent-red">
          {error}
        </p>
      )}
    </div>
  )
}
