'use client'

import { useState, useTransition } from 'react'
import { Info } from 'lucide-react'
import { updateGrammarLearningSettings } from '../../actions'
import { MASTERY_REVIEW_STREAK_RANGE, PASS_SCORE_RANGE } from '@/lib/grammar/constants'
import { PASS_SCORE_STEP } from '@/lib/grammar/assignment-plan'
import type { GrammarLearningSettings } from '@/lib/grammar/settings'

interface Props {
  initial: GrammarLearningSettings
}

const selectClass =
  'min-h-[44px] w-36 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#1865F2]'

const PASS_OPTIONS: number[] = []
for (let v = PASS_SCORE_RANGE.min; v <= PASS_SCORE_RANGE.max; v += PASS_SCORE_STEP) PASS_OPTIONS.push(v)

const STREAK_OPTIONS: number[] = []
for (let v = MASTERY_REVIEW_STREAK_RANGE.min; v <= MASTERY_REVIEW_STREAK_RANGE.max; v++) STREAK_OPTIONS.push(v)

export function GrammarLearningClient({ initial }: Props) {
  const [passScore, setPassScore] = useState(initial.passScore)
  const [streak, setStreak] = useState(initial.masteryReviewStreak)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSave() {
    startTransition(async () => {
      const result = await updateGrammarLearningSettings({ passScore, masteryReviewStreak: streak })
      setMessage(
        result.error
          ? { type: 'error', text: result.error }
          : { type: 'success', text: '저장되었습니다. 다음 확인 테스트·복습부터 적용돼요.' },
      )
    })
  }

  return (
    <div className="space-y-6">
      <div className="space-y-6 rounded-xl border border-gray-200 bg-white p-5">
        <div>
          <label htmlFor="passScore" className="mb-1 block text-sm font-medium text-gray-700">
            통과 기준
          </label>
          <p className="mb-3 text-sm text-gray-500">
            단원 확인 테스트와 복습에서 이 점수 이상이면 통과예요. 예를 들어 70%로 정하면 10문제 중 7문제를 맞히면 통과합니다.
          </p>
          <select
            id="passScore"
            value={passScore}
            onChange={(e) => {
              setMessage(null)
              setPassScore(Number(e.target.value))
            }}
            className={selectClass}
          >
            {PASS_OPTIONS.map((v) => (
              <option key={v} value={v}>
                {v}%
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="masteryReviewStreak" className="mb-1 block text-sm font-medium text-gray-700">
            숙달 복습 횟수
          </label>
          <p className="mb-3 text-sm text-gray-500">
            통과한 단원을 간격을 두고 복습해 연속으로 이 횟수만큼 통과하면 &lsquo;숙달&rsquo;이 됩니다.
          </p>
          <select
            id="masteryReviewStreak"
            value={streak}
            onChange={(e) => {
              setMessage(null)
              setStreak(Number(e.target.value))
            }}
            className={selectClass}
          >
            {STREAK_OPTIONS.map((v) => (
              <option key={v} value={v}>
                {v}회
              </option>
            ))}
          </select>
        </div>

        <p className="flex items-start gap-2 rounded-lg bg-gray-50 px-3 py-2.5 text-sm text-gray-600">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" aria-hidden />
          바꿔도 이미 통과·숙달한 기록은 다시 판정하지 않습니다.
        </p>
      </div>

      {message && (
        <p className={`text-sm ${message.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>{message.text}</p>
      )}

      <button
        onClick={handleSave}
        disabled={isPending}
        className="min-h-[44px] rounded-lg bg-[#1865F2] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
      >
        {isPending ? '저장 중...' : '저장'}
      </button>
    </div>
  )
}
