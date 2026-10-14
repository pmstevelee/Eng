'use client'

import { useState, useTransition } from 'react'
import { Layers } from 'lucide-react'
import { updateMyDailyNewWords } from '@/app/(dashboard)/student/words/_actions/daily-limit'
import { DAILY_NEW_WORDS_RANGE } from '@/lib/words/settings'

interface Props {
  /** 현재 적용 중인 하루 신규 단어 수 */
  current: number
  /** 학원 기본값 */
  academyDefault: number
  /** 학생이 직접 정한 값이 있는지 */
  isCustom: boolean
}

export function DailyLimitSetting({ current, academyDefault, isCustom }: Props) {
  const [value, setValue] = useState(String(current))
  const [custom, setCustom] = useState(isCustom)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [isPending, startTransition] = useTransition()

  function save(next: number | null) {
    startTransition(async () => {
      const result = await updateMyDailyNewWords(next)
      if (!result.ok) {
        setMessage({ type: 'error', text: result.error })
        return
      }
      setCustom(next !== null)
      if (next === null) setValue(String(academyDefault))
      setMessage({ type: 'success', text: '저장되었습니다. 새로 시작하는 학습부터 적용돼요.' })
    })
  }

  function handleSave() {
    const n = Number(value)
    if (!Number.isInteger(n) || n < DAILY_NEW_WORDS_RANGE.min || n > DAILY_NEW_WORDS_RANGE.max) {
      setMessage({
        type: 'error',
        text: `${DAILY_NEW_WORDS_RANGE.min}~${DAILY_NEW_WORDS_RANGE.max}개 사이로 입력해 주세요.`,
      })
      return
    }
    save(n)
  }

  return (
    <div className="rounded-xl border bg-white p-4" style={{ borderColor: '#DDD6FE' }}>
      <div className="flex items-center gap-3">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
          style={{ backgroundColor: '#F3F0FF' }}
        >
          <Layers className="h-5 w-5" style={{ color: '#7854F7' }} />
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-700">하루 신규 단어 한도</p>
          <p className="text-xs text-gray-500">
            {custom ? '내가 정한 값' : `학원 기본값 ${academyDefault}개`}
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <input
          type="number"
          inputMode="numeric"
          min={DAILY_NEW_WORDS_RANGE.min}
          max={DAILY_NEW_WORDS_RANGE.max}
          value={value}
          onChange={(e) => {
            setMessage(null)
            setValue(e.target.value)
          }}
          aria-label="하루 신규 단어 수"
          className="w-20 min-h-[44px] rounded-lg border border-gray-300 px-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#7854F7] focus:border-transparent"
        />
        <span className="text-sm text-gray-500">개/일</span>
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="min-h-[44px] rounded-lg bg-[#7854F7] px-4 text-sm font-semibold text-white disabled:opacity-50"
        >
          {isPending ? '저장 중...' : '저장'}
        </button>
        {custom && (
          <button
            type="button"
            onClick={() => save(null)}
            disabled={isPending}
            className="min-h-[44px] rounded-lg border border-gray-200 px-3 text-sm text-gray-600 disabled:opacity-50"
          >
            기본값
          </button>
        )}
      </div>

      {message && (
        <p
          className={`mt-2 text-xs ${message.type === 'success' ? 'text-[#1FAF54]' : 'text-[#D92916]'}`}
        >
          {message.text}
        </p>
      )}
    </div>
  )
}
