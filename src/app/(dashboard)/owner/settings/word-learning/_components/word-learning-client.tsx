'use client'

import { useState, useTransition } from 'react'
import { updateWordLearningSettings } from '../../actions'
import { GRAMMAR_QUESTIONS_RANGE, type WordLearningSettings } from '@/lib/words/settings'

interface Props {
  initial: WordLearningSettings
}

const inputClass =
  'w-32 min-h-[44px] rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#1865F2] focus:border-transparent'

export function WordLearningClient({ initial }: Props) {
  const [dailyNewWords, setDailyNewWords] = useState(initial.dailyNewWords)
  const [dailyGrammarQuestions, setDailyGrammarQuestions] = useState(initial.dailyGrammarQuestions)
  const [globalRanking, setGlobalRanking] = useState(initial.globalRanking)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSave() {
    startTransition(async () => {
      const result = await updateWordLearningSettings({ dailyNewWords, dailyGrammarQuestions, globalRanking })
      if (result.error) {
        setMessage({ type: 'error', text: result.error })
      } else {
        setMessage({ type: 'success', text: '저장되었습니다. 내일 생성되는 오늘의 단어학습부터 적용돼요.' })
      }
    })
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-200 p-5 space-y-6">
        <div>
          <label htmlFor="dailyNewWords" className="block text-sm font-medium text-gray-700 mb-1">
            하루 신규 단어 수
          </label>
          <p className="text-sm text-gray-500 mb-3">
            오늘의 단어학습에서 학생 레벨에 맞춰 매일 자동으로 준비되는 새 단어 수입니다. 복습량은 이 값의 약 3배(최대 50개)로 정해져요.
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
            className={inputClass}
          />
          <span className="ml-2 text-sm text-gray-500">개 (1~100)</span>
        </div>

        <div>
          <label htmlFor="dailyGrammarQuestions" className="block text-sm font-medium text-gray-700 mb-1">
            하루 문법 문제 수
          </label>
          <p className="text-sm text-gray-500 mb-3">
            오늘의 학습 문법 미션 문제 수입니다. 틀린 문제 복습 → 약점 보강 → 실력 다지기 → 도전 순으로 자동 배분돼요.
          </p>
          <input
            id="dailyGrammarQuestions"
            type="number"
            min={GRAMMAR_QUESTIONS_RANGE.min}
            max={GRAMMAR_QUESTIONS_RANGE.max}
            value={dailyGrammarQuestions}
            onChange={(e) => {
              setMessage(null)
              setDailyGrammarQuestions(Number(e.target.value))
            }}
            className={inputClass}
          />
          <span className="ml-2 text-sm text-gray-500">
            문제 ({GRAMMAR_QUESTIONS_RANGE.min}~{GRAMMAR_QUESTIONS_RANGE.max})
          </span>
        </div>

        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-gray-700">전체 랭킹 참여</p>
            <p className="text-sm text-gray-500 mt-1">
              켜면 우리 학원 학생이 다른 학원 학생과 함께 전체 랭킹에 표시되고, 학생들도 전체 랭킹을 볼 수 있어요.
              전체 랭킹의 이름은 일부를 가려서(김*수) 보여주며 학원명은 공개되지 않아요.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={globalRanking}
            aria-label="전체 랭킹 참여"
            onClick={() => {
              setMessage(null)
              setGlobalRanking((v) => !v)
            }}
            className={`relative mt-1 inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${
              globalRanking ? 'bg-[#1865F2]' : 'bg-gray-300'
            }`}
          >
            <span
              className={`inline-block h-5 w-5 rounded-full bg-white transition-transform ${
                globalRanking ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
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
