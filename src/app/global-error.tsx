'use client'

import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[Global Error]', error)
  }, [error])

  return (
    <html lang="ko">
      <body>
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
          <div className="w-full max-w-md text-center space-y-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900">오류가 발생했습니다</h2>
              <p className="mt-2 text-sm text-gray-500">
                일시적인 오류입니다. 아래 버튼을 눌러 다시 시도해 주세요.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <button
                onClick={reset}
                style={{ height: 44, width: '100%', borderRadius: 12, backgroundColor: '#1865F2', color: '#fff', fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer' }}
              >
                다시 시도
              </button>
              <button
                onClick={() => window.location.href = '/'}
                style={{ height: 44, width: '100%', borderRadius: 12, border: '1px solid #E3E5EA', backgroundColor: '#fff', color: '#3B3E48', fontSize: 14, cursor: 'pointer' }}
              >
                처음으로
              </button>
            </div>
          </div>
        </div>
      </body>
    </html>
  )
}
