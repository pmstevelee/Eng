'use client'

import { History, RotateCcw } from 'lucide-react'

/** 이전에 중단한 학습을 이어서 진행 중임을 알리는 안내 + 처음부터 다시 버튼 */
export function ResumeBanner({
  done,
  total,
  onRestart,
}: {
  done: number
  total: number
  onRestart: () => void
}) {
  return (
    <div className="mb-4 flex items-center gap-3 rounded-xl border border-[#1865F2]/20 bg-[#1865F2]/5 px-4 py-3">
      <History className="h-4 w-4 shrink-0 text-[#1865F2]" />
      <p className="flex-1 text-sm text-gray-700">
        이전에 학습하던 곳부터 이어서 진행해요{' '}
        <span className="font-semibold text-[#1865F2]">
          ({done}/{total})
        </span>
      </p>
      <button
        type="button"
        onClick={onRestart}
        className="flex min-h-[44px] shrink-0 items-center gap-1 px-1 text-xs font-medium text-gray-500 hover:text-gray-800"
      >
        <RotateCcw className="h-3.5 w-3.5" />
        처음부터
      </button>
    </div>
  )
}
