'use client'

import { useState, useTransition } from 'react'
import { updateWordLearningSettings } from '../../actions'

interface Props {
  initialDailyNewWords: number
}

export function WordLearningClient({ initialDailyNewWords }: Props) {
  const [dailyNewWords, setDailyNewWords] = useState(initialDailyNewWords)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSave() {
    startTransition(async () => {
      const result = await updateWordLearningSettings({ dailyNewWords })
      if (result.error) {
        setMessage({ type: 'error', text: result.error })
      } else {
        setMessage({ type: 'success', text: '저장되었습니다.' })
      }
    })
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-200 p-5 space-y-4">
        <div>
          <label htmlFor="dailyNewWords" className="block text-sm font-medium text-gray-700 mb-1">
            하루 신규 단어 수
          </label>
          <p className="text-sm text-gray-500 mb-3">
            학원 전체 학생에게 적용되는 하루 신규 단어 수입니다.
          </p>
          <input
            id="dailyNewWords"
            type="number"
            min={1}
            max={100}
            value={dailyNewWords}
            onChange={(e) => {
              setMessage(null)
              setDailyNewWords(Number(e.target.value))
            }}
            className="w-32 min-h-[44px] rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#1865F2] focus:border-transparent"
          />
          <span className="ml-2 text-sm text-gray-500">개 (1~100)</span>
        </div>
      </div>

      {message && (
        <p className={`text-sm ${message.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
          {message.text}
        </p>
      )}

      <button
        onClick={handleSave}
        disabled={isPending}
        className="min-h-[44px] px-5 py-2.5 rounded-lg bg-[#1865F2] text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        {isPending ? '저장 중...' : '저장'}
      </button>
    </div>
  )
}
