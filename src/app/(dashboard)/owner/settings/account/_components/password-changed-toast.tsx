'use client'

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'

export function PasswordChangedToast() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (searchParams.get('passwordChanged') === '1') {
      setShow(true)
      // URL에서 쿼리 파라미터 제거
      router.replace(pathname)
      const timer = setTimeout(() => setShow(false), 4000)
      return () => clearTimeout(timer)
    }
  }, [searchParams, router, pathname])

  if (!show) return null

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-4">
      <div className="flex items-center gap-3 bg-gray-900 text-white text-sm px-4 py-3 rounded-xl shadow-lg">
        <span className="text-green-400 text-base">✓</span>
        비밀번호가 성공적으로 변경되었습니다
      </div>
    </div>
  )
}
