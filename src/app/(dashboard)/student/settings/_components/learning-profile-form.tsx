'use client'

import { useState, useTransition } from 'react'
import { Lock } from 'lucide-react'
import { LearningLevelPicker } from '@/components/shared/learning-level-picker'
import { getLevelInfo } from '@/lib/constants/levels'
import { STUDENT_GRADE_OPTIONS, getRecommendedLevel } from '@/lib/constants/student-profile'
import { updateLearningProfile } from '../actions'

type LearningProfileFormProps = {
  initialGrade: string | null
  initialLevel: number
  levelLocked: boolean
}

export function LearningProfileForm({
  initialGrade,
  initialLevel,
  levelLocked,
}: LearningProfileFormProps) {
  const [grade, setGrade] = useState(initialGrade ?? '')
  const [level, setLevel] = useState(initialLevel)
  const [savedGrade, setSavedGrade] = useState(initialGrade ?? '')
  const [savedLevel, setSavedLevel] = useState(initialLevel)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [isPending, startTransition] = useTransition()

  const dirty = grade !== savedGrade || level !== savedLevel
  const levelInfo = getLevelInfo(level)

  function handleSave() {
    setError('')
    setMessage('')
    if (!grade) return setError('학년을 선택해 주세요.')

    startTransition(async () => {
      const result = await updateLearningProfile({ grade, learningLevel: level })
      if (result.error) {
        setError(result.error)
        return
      }
      setSavedGrade(grade)
      setSavedLevel(level)
      setMessage('저장되었습니다.')
    })
  }

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <label htmlFor="settings-grade" className="text-sm font-medium text-gray-900">
          학년
        </label>
        <select
          id="settings-grade"
          value={grade}
          onChange={(e) => {
            setGrade(e.target.value)
            setMessage('')
          }}
          disabled={isPending}
          className="flex h-11 w-full rounded-md border border-gray-200 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="">학년을 선택하세요</option>
          {STUDENT_GRADE_OPTIONS.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium text-gray-900">학습레벨</p>
        {levelLocked ? (
          <div className="flex items-start gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
            <Lock className="mt-0.5 h-4 w-4 shrink-0 text-gray-500" />
            <div>
              <p className="text-sm font-semibold text-gray-900">
                Level {level} · {levelInfo.nameKo}{' '}
                <span className="text-xs font-normal text-gray-500">{levelInfo.cefr}</span>
              </p>
              <p className="mt-1 text-xs text-gray-500">
                레벨 테스트 결과로 정해진 레벨이에요. 이후 레벨은 승급 조건을 채우거나 선생님이
                조정해 주실 때 바뀝니다.
              </p>
            </div>
          </div>
        ) : (
          <>
            <p className="text-xs text-gray-500">
              단어·학습 문제가 이 레벨에 맞춰 준비됩니다. 레벨 테스트를 보기 전까지만 직접 바꿀 수
              있어요.
            </p>
            <LearningLevelPicker
              value={level}
              onChange={(lv) => {
                setLevel(lv)
                setMessage('')
              }}
              recommendedLevel={grade ? getRecommendedLevel(grade) : null}
              disabled={isPending}
            />
          </>
        )}
      </div>

      {error && (
        <p className="rounded-md bg-accent-red-light px-3 py-2 text-sm text-accent-red">{error}</p>
      )}
      {message && (
        <p className="rounded-md bg-accent-green-light px-3 py-2 text-sm text-[#16803D]">
          {message}
        </p>
      )}

      <button
        type="button"
        onClick={handleSave}
        disabled={!dirty || isPending}
        className="h-11 rounded-xl bg-primary-700 px-5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? '저장 중...' : '저장'}
      </button>
    </div>
  )
}
