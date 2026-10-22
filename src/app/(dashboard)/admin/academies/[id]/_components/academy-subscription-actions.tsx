'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { PlanType } from '@/generated/prisma'
import { PLAN_TYPE_LABEL, SELECTABLE_PLAN_TYPES, isSelectablePlanType } from '@/lib/plan-types'
import {
  changePlan,
  extendSubscription,
  suspendAcademy,
  type AcademyActionResult,
} from '../actions'

interface AcademySubscriptionActionsProps {
  academyId: string
  currentPlan: PlanType
}

type Feedback = { type: 'success' | 'error'; text: string } | null

function FeedbackText({ feedback }: { feedback: Feedback }) {
  if (!feedback) return null
  return (
    <p
      role="status"
      className={`text-xs ${feedback.type === 'success' ? 'text-accent-green' : 'text-accent-red'}`}
    >
      {feedback.text}
    </p>
  )
}

/** 구독 연장 · 플랜 변경 · 정지 — 처리 중 표시와 결과 메시지를 보여준다. */
export function AcademySubscriptionActions({ academyId, currentPlan }: AcademySubscriptionActionsProps) {
  const router = useRouter()
  const [months, setMonths] = useState('1')
  const [plan, setPlan] = useState<string>(isSelectablePlanType(currentPlan) ? currentPlan : 'FREE')
  const [pendingKey, setPendingKey] = useState<'extend' | 'plan' | 'suspend' | null>(null)
  const [feedback, setFeedback] = useState<Record<string, Feedback>>({})
  const [, startTransition] = useTransition()

  function run(
    key: 'extend' | 'plan' | 'suspend',
    action: (fd: FormData) => Promise<AcademyActionResult>,
    fields: Record<string, string>,
  ) {
    const fd = new FormData()
    fd.append('academyId', academyId)
    Object.entries(fields).forEach(([k, v]) => fd.append(k, v))

    setPendingKey(key)
    setFeedback((prev) => ({ ...prev, [key]: null }))
    startTransition(async () => {
      try {
        const result = await action(fd)
        setFeedback((prev) => ({
          ...prev,
          [key]: result.ok
            ? { type: 'success', text: result.message }
            : { type: 'error', text: result.error },
        }))
        if (result.ok) router.refresh()
      } catch {
        setFeedback((prev) => ({
          ...prev,
          [key]: { type: 'error', text: '요청을 처리하지 못했습니다. 페이지를 새로고침한 뒤 다시 시도해주세요.' },
        }))
      } finally {
        setPendingKey(null)
      }
    })
  }

  const busy = pendingKey !== null
  const selectClass =
    'w-full h-11 px-3 rounded-lg border border-gray-200 text-sm text-gray-900 bg-white focus:outline-none focus:border-primary-700 disabled:opacity-60'
  const primaryButtonClass =
    'w-full h-11 rounded-lg bg-primary-700 text-white text-sm font-medium hover:bg-primary-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed'

  return (
    <>
      {/* 구독 연장 */}
      <div className="space-y-2">
        <label htmlFor="extend-months" className="block text-xs font-medium text-gray-600">
          구독 연장
        </label>
        <select
          id="extend-months"
          value={months}
          onChange={(e) => setMonths(e.target.value)}
          disabled={busy}
          className={selectClass}
        >
          <option value="1">1개월</option>
          <option value="3">3개월</option>
          <option value="6">6개월</option>
          <option value="12">12개월</option>
        </select>
        <button
          type="button"
          disabled={busy}
          onClick={() => run('extend', extendSubscription, { months })}
          className={primaryButtonClass}
        >
          {pendingKey === 'extend' ? '연장 중...' : '연장'}
        </button>
        <FeedbackText feedback={feedback.extend ?? null} />
      </div>

      {/* 플랜 변경 */}
      <div className="space-y-2">
        <label htmlFor="change-plan" className="block text-xs font-medium text-gray-600">
          플랜 변경
        </label>
        <select
          id="change-plan"
          value={plan}
          onChange={(e) => setPlan(e.target.value)}
          disabled={busy}
          className={selectClass}
        >
          {SELECTABLE_PLAN_TYPES.map((p) => (
            <option key={p} value={p}>
              {PLAN_TYPE_LABEL[p]}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={busy}
          onClick={() => run('plan', changePlan, { plan })}
          className={primaryButtonClass}
        >
          {pendingKey === 'plan' ? '변경 중...' : '변경'}
        </button>
        <FeedbackText feedback={feedback.plan ?? null} />
      </div>

      {/* 정지 */}
      <div className="space-y-2">
        <label className="block text-xs font-medium text-gray-600">학원 정지</label>
        <p className="text-xs text-gray-400">구독을 정지하고 접근을 제한합니다</p>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            if (!window.confirm('이 학원을 정지하시겠습니까? 학원 이용이 제한됩니다.')) return
            run('suspend', suspendAcademy, {})
          }}
          className="w-full h-11 rounded-lg border border-accent-gold text-accent-gold text-sm font-medium hover:bg-accent-gold-light transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {pendingKey === 'suspend' ? '정지 중...' : '정지'}
        </button>
        <FeedbackText feedback={feedback.suspend ?? null} />
      </div>
    </>
  )
}
