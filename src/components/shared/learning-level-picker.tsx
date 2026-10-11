'use client'

import { Check } from 'lucide-react'
import { LEVELS } from '@/lib/constants/levels'
import { cn } from '@/lib/utils'

// 학생이 스스로 고를 수 있도록 레벨별 수준을 쉬운 말로 설명
const LEVEL_DESCRIPTIONS: Record<number, string> = {
  1: '알파벳과 기초 단어부터 시작해요',
  2: '쉬운 단어와 짧은 문장을 읽을 수 있어요',
  3: '기본 문장을 이해하고 간단히 말할 수 있어요',
  4: '짧은 글을 읽고 기초 문법을 알아요',
  5: '일상적인 글을 읽고 문장을 만들 수 있어요',
  6: '중학교 수준의 글과 문법을 이해해요',
  7: '긴 글을 읽고 내 생각을 쓸 수 있어요',
  8: '고등학교 수준의 글을 이해해요',
  9: '수능·고급 독해를 무리 없이 할 수 있어요',
  10: '원서와 고급 영어를 자유롭게 다뤄요',
}

type LearningLevelPickerProps = {
  value: number | null
  onChange: (level: number) => void
  recommendedLevel?: number | null
  disabled?: boolean
}

export function LearningLevelPicker({
  value,
  onChange,
  recommendedLevel,
  disabled,
}: LearningLevelPickerProps) {
  return (
    <div role="radiogroup" aria-label="학습레벨" className="grid gap-2">
      {LEVELS.map((lv) => {
        const selected = value === lv.level
        return (
          <button
            key={lv.level}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(lv.level)}
            className={cn(
              'flex min-h-[44px] w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors',
              'disabled:cursor-not-allowed disabled:opacity-50',
              selected
                ? 'border-primary-700 bg-primary-100'
                : 'border-gray-200 bg-white hover:border-gray-300',
            )}
          >
            <span
              className={cn(
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold',
                selected ? 'bg-primary-700 text-white' : 'bg-gray-100 text-gray-700',
              )}
            >
              {selected ? <Check className="h-4 w-4" /> : lv.level}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-1.5">
                <span className="text-sm font-semibold text-gray-900">
                  Level {lv.level} · {lv.nameKo}
                </span>
                <span className="text-xs text-gray-500">{lv.cefr}</span>
                {recommendedLevel === lv.level && (
                  <span className="rounded-full bg-accent-gold-light px-2 py-0.5 text-[11px] font-medium text-[#9A6B00]">
                    학년 추천
                  </span>
                )}
              </span>
              <span className="mt-0.5 block text-xs text-gray-500">
                {LEVEL_DESCRIPTIONS[lv.level]}
              </span>
            </span>
          </button>
        )
      })}
    </div>
  )
}
