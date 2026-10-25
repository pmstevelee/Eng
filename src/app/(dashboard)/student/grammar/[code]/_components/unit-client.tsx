'use client'

// 문법 단원 학습 — 개념 → (강의) → 연습 → 확인 테스트 → 결과
// 단계는 Progress.currentStep으로 복원하고, 단계를 옮길 때마다 서버에 기록한다.

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Check } from 'lucide-react'
import { GrammarConceptView } from '@/components/grammar/grammar-concept-view'
import { GRAMMAR_STEP_LABEL, type GrammarStep } from '@/lib/grammar/constants'
import type { GrammarCheckResult, GrammarUnitData } from '@/lib/grammar/unit-queries'
import { cn } from '@/lib/utils'
import { completeConcept, startGrammarUnit } from '../actions'
import { CheckStep } from './check-step'
import { LectureStep } from './lecture-step'
import { PracticeStep } from './practice-step'
import { ResultStep } from './result-step'

interface Props {
  data: GrammarUnitData
  studentId: string
}

function initialStep(data: GrammarUnitData): GrammarStep {
  const step = data.progress.currentStep
  if (step === 'LECTURE' && !data.lecture) return 'PRACTICE'
  if (step === 'RESULT' && !data.lastResult) return 'CHECK'
  return step
}

export function GrammarUnitClient({ data, studentId }: Props) {
  const router = useRouter()
  const code = data.point.code
  const [step, setStep] = useState<GrammarStep>(() => initialStep(data))
  const [result, setResult] = useState<GrammarCheckResult | null>(data.lastResult)
  const [error, setError] = useState('')
  const [isSaving, startSaving] = useTransition()
  // 연습·확인 제출 뒤 다음 문항 세트를 서버에서 다시 받는 중
  const [isRefreshing, startRefresh] = useTransition()

  const steps: GrammarStep[] = ['CONCEPT', ...(data.lecture ? (['LECTURE'] as const) : []), 'PRACTICE', 'CHECK', 'RESULT']
  const currentIdx = steps.indexOf(step)

  function refreshData() {
    startRefresh(() => router.refresh())
  }

  /** 단계 이동 + 서버 기록 (기록 실패는 학습을 막지 않음) */
  function moveTo(next: GrammarStep) {
    setError('')
    setStep(next)
    window.scrollTo({ top: 0, behavior: 'smooth' })
    startGrammarUnit(code, next).catch(() => undefined)
  }

  function handleConceptDone() {
    setError('')
    startSaving(async () => {
      const res = await completeConcept(code).catch(() => null)
      if (!res || !res.ok) {
        setError(res && !res.ok ? res.error : '저장하지 못했어요. 다시 눌러 주세요.')
        return
      }
      setStep(res.nextStep === 'LECTURE' && !data.lecture ? 'PRACTICE' : res.nextStep)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    })
  }

  function handlePracticeDone() {
    setStep('CHECK')
    window.scrollTo({ top: 0, behavior: 'smooth' })
    // 확인 테스트는 방금 푼 연습 문항을 피해서 새로 고른다
    refreshData()
  }

  function handleResult(r: GrammarCheckResult) {
    setResult(r)
    setStep('RESULT')
    window.scrollTo({ top: 0, behavior: 'smooth' })
    refreshData()
  }

  return (
    <div className="space-y-5">
      {/* 단계 표시줄 */}
      <nav aria-label="학습 단계" className="-mx-4 overflow-x-auto px-4">
        <ol className="flex min-w-max items-center gap-1">
          {steps.map((s, i) => {
            const done = i < currentIdx
            const active = s === step
            const disabled = s === 'RESULT' && !result
            return (
              <li key={s} className="flex items-center gap-1">
                {i > 0 && <span className={cn('h-px w-4 sm:w-8', done || active ? 'bg-[#1865F2]' : 'bg-gray-200')} aria-hidden />}
                <button
                  type="button"
                  onClick={() => !active && !disabled && moveTo(s)}
                  disabled={disabled}
                  aria-current={active ? 'step' : undefined}
                  className={cn(
                    'flex min-h-[44px] items-center gap-1.5 rounded-full px-3 text-sm font-semibold transition-colors',
                    active
                      ? 'bg-[#1865F2] text-white'
                      : done
                        ? 'bg-[#EEF4FF] text-[#1865F2] hover:bg-[#E0EAFF]'
                        : 'text-gray-500 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent',
                  )}
                >
                  <span
                    className={cn(
                      'flex h-5 w-5 items-center justify-center rounded-full text-xs',
                      active ? 'bg-white text-[#1865F2]' : done ? 'bg-[#1865F2] text-white' : 'bg-gray-200 text-gray-600',
                    )}
                  >
                    {done ? <Check className="h-3 w-3" /> : i + 1}
                  </span>
                  {GRAMMAR_STEP_LABEL[s]}
                </button>
              </li>
            )
          })}
        </ol>
      </nav>

      {error && <p className="rounded-lg bg-[#FDECEA] px-4 py-3 text-sm text-[#B42318]">{error}</p>}

      {step === 'CONCEPT' && (
        <div className="space-y-4">
          {data.unmetPrerequisites.length > 0 && (
            <div className="rounded-xl border border-[#FFB100]/40 bg-[#FFF8E6] px-4 py-3 text-sm text-gray-700">
              먼저 학습하면 좋아요:{' '}
              {data.unmetPrerequisites.map((p, i) => (
                <span key={p.code}>
                  {i > 0 && ', '}
                  <Link href={`/student/grammar/${encodeURIComponent(p.code)}`} className="font-semibold text-[#1865F2] underline-offset-2 hover:underline">
                    {p.title}
                  </Link>
                </span>
              ))}
            </div>
          )}
          <div className="rounded-xl border border-gray-200 bg-white p-5 sm:p-6">
            <GrammarConceptView
              title={data.point.title}
              summary={data.point.summary}
              rules={data.point.rules}
              examples={data.point.examples}
              commonErrors={data.point.commonErrors}
              foldTranslations
              hideTitle
            />
          </div>
          <button
            type="button"
            onClick={handleConceptDone}
            disabled={isSaving}
            className="h-12 w-full rounded-lg bg-[#1865F2] text-base font-semibold text-white hover:bg-[#1558d6] disabled:opacity-60"
          >
            {isSaving ? '저장 중...' : '다 읽었어요'}
          </button>
        </div>
      )}

      {step === 'LECTURE' && data.lecture && (
        <LectureStep code={code} studentId={studentId} lecture={data.lecture} onNext={() => moveTo('PRACTICE')} />
      )}

      {(step === 'PRACTICE' || step === 'CHECK') && isRefreshing && (
        <div className="rounded-xl border border-gray-200 bg-white px-6 py-12 text-center text-sm text-gray-500">문제를 준비하고 있어요...</div>
      )}

      {step === 'PRACTICE' && !isRefreshing && (
        <PracticeStep
          key={data.practice.map((q) => q.id).join(',')}
          code={code}
          studentId={studentId}
          questions={data.practice}
          onDone={handlePracticeDone}
        />
      )}

      {step === 'CHECK' &&
        !isRefreshing && (
          <CheckStep
            key={data.check.map((q) => q.id).join(',')}
            code={code}
            studentId={studentId}
            questions={data.check}
            passScore={data.settings.passScore}
            onResult={handleResult}
          />
        )}

      {step === 'RESULT' && result && (
        <ResultStep
          result={result}
          onRetryPractice={() => moveTo('PRACTICE')}
          onReviewConcept={() => moveTo('CONCEPT')}
          onRetryCheck={() => moveTo('CHECK')}
        />
      )}
    </div>
  )
}
