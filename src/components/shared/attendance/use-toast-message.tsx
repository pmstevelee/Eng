'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

/** 화면 하단 짧은 안내 메시지 */
export function useToastMessage() {
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const show = useCallback((text: string, ok = false) => {
    if (timer.current) clearTimeout(timer.current)
    setToast({ ok, text })
    timer.current = setTimeout(() => setToast(null), 3000)
  }, [])

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])

  const node = toast ? (
    <div className="fixed inset-x-0 bottom-6 z-[60] flex justify-center px-4 pointer-events-none">
      <p
        role="status"
        className={cn(
          'max-w-sm rounded-xl px-4 py-3 text-sm font-medium text-white shadow-sm',
          toast.ok ? 'bg-gray-900' : 'bg-accent-red',
        )}
      >
        {toast.text}
      </p>
    </div>
  ) : null

  return { show, node }
}
