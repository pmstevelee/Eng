'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowUpCircle, XCircle, FileText, Zap } from 'lucide-react'
import type { Plan, BillingCycle, SubscriptionStatus } from '@/generated/prisma'
import { PLAN_DISPLAY_NAMES, PLANS } from '@/lib/pricing'

const CANCEL_REASONS = [
  '가격이 부담됩니다',
  '기능이 기대에 못 미칩니다',
  '더 이상 사용하지 않습니다',
  '다른 서비스로 이동합니다',
  '일시적으로 필요 없습니다',
  '기타',
]

interface BillingActionsProps {
  currentPlan: Plan
  currentCycle: BillingCycle
  status: SubscriptionStatus
  cancelAtPeriodEnd: boolean
}

export function BillingActions({
  currentPlan,
  currentCycle,
  status,
  cancelAtPeriodEnd,
}: BillingActionsProps) {
  const router = useRouter()
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [showPlanModal, setShowPlanModal] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [customReason, setCustomReason] = useState('')
  const [immediate, setImmediate] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const isActive = status === 'ACTIVE' || status === 'TRIAL'
  const isCanceled = status === 'CANCELLED' || status === 'CANCELED' || status === 'EXPIRED'

  const planConfig = PLANS[currentPlan]
  const otherPlans = (['STARTER', 'STANDARD', 'PREMIUM'] as Plan[]).filter(
    (p) => p !== currentPlan,
  )

  async function handleCancel() {
    const reason = cancelReason === '기타' ? customReason : cancelReason
    if (!reason.trim()) {
      setError('해지 사유를 선택하거나 입력해 주세요.')
      return
    }

    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/billing/subscription/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason, immediate }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? '해지 처리에 실패했습니다.')
        return
      }

      setShowCancelModal(false)
      router.refresh()
    } catch {
      setError('서버 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  async function handlePlanChange(newPlan: Plan) {
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/billing/subscription/change-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPlan, newBillingCycle: currentCycle }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? '플랜 변경에 실패했습니다.')
        return
      }

      setShowPlanModal(false)
      router.refresh()
    } catch {
      setError('서버 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* 액션 버튼 그리드 */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {isActive && !cancelAtPeriodEnd && (
          <button
            onClick={() => setShowPlanModal(true)}
            className="flex flex-col items-center gap-2 rounded-xl border border-gray-200 bg-white p-4 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <ArrowUpCircle className="h-6 w-6 text-[#1865F2]" />
            플랜 변경
          </button>
        )}

        <Link
          href="/owner/billing/credits"
          className="flex flex-col items-center gap-2 rounded-xl border border-gray-200 bg-white p-4 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <Zap className="h-6 w-6 text-[#7854F7]" />
          크레딧 충전
        </Link>

        <Link
          href="/owner/billing/history"
          className="flex flex-col items-center gap-2 rounded-xl border border-gray-200 bg-white p-4 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <FileText className="h-6 w-6 text-gray-500" />
          결제 내역
        </Link>

        {isActive && !cancelAtPeriodEnd && !isCanceled && currentPlan !== 'FREE' && (
          <button
            onClick={() => setShowCancelModal(true)}
            className="flex flex-col items-center gap-2 rounded-xl border border-red-100 bg-white p-4 text-sm font-medium text-[#D92916] hover:bg-red-50 transition-colors"
          >
            <XCircle className="h-6 w-6" />
            구독 해지
          </button>
        )}
      </div>

      {/* 플랜 변경 모달 */}
      {showPlanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="mb-1 text-lg font-bold text-gray-900">플랜 변경</h2>
            <p className="mb-6 text-sm text-gray-500">
              현재 플랜: {PLAN_DISPLAY_NAMES[currentPlan]}
            </p>

            <div className="space-y-3 mb-4">
              {otherPlans.map((plan) => {
                const config = PLANS[plan]
                const price = currentCycle === 'YEARLY' ? config.yearlyPrice : config.monthlyPrice
                const isUpgrade = config.monthlyPrice > planConfig.monthlyPrice

                return (
                  <button
                    key={plan}
                    onClick={() => handlePlanChange(plan)}
                    disabled={loading}
                    className="w-full flex items-center justify-between rounded-xl border border-gray-200 p-4 text-left hover:border-[#1865F2] hover:bg-blue-50 transition-colors disabled:opacity-50"
                  >
                    <div>
                      <p className="font-semibold text-gray-900">
                        {PLAN_DISPLAY_NAMES[plan]}
                        <span
                          className={`ml-2 text-xs font-medium ${isUpgrade ? 'text-[#1FAF54]' : 'text-[#FFB100]'}`}
                        >
                          {isUpgrade ? '업그레이드' : '다운그레이드'}
                        </span>
                      </p>
                      <p className="text-sm text-gray-500">
                        {price.toLocaleString('ko-KR')}원/{currentCycle === 'YEARLY' ? '년' : '월'}
                      </p>
                    </div>
                    {isUpgrade && (
                      <span className="text-xs text-gray-400">즉시 적용 + 차액 결제</span>
                    )}
                    {!isUpgrade && (
                      <span className="text-xs text-gray-400">다음 주기부터 적용</span>
                    )}
                  </button>
                )
              })}
            </div>

            {error && <p className="mb-3 text-sm text-[#D92916]">{error}</p>}

            <button
              onClick={() => { setShowPlanModal(false); setError('') }}
              className="w-full rounded-lg border border-gray-200 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              취소
            </button>
          </div>
        </div>
      )}

      {/* 구독 해지 모달 */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="mb-1 text-lg font-bold text-gray-900">구독 해지</h2>
            <p className="mb-4 text-sm text-gray-500">
              해지 시 다음 기능을 잃게 됩니다:
            </p>

            <ul className="mb-6 space-y-1.5 rounded-lg bg-red-50 p-4 text-sm text-[#D92916]">
              <li>• AI 쓰기 평가 월 {planConfig.aiWritingLimit}회</li>
              <li>• AI 문제 생성 월 {planConfig.aiQuestionLimit}회</li>
              <li>• 학생 {planConfig.studentLimit === -1 ? '무제한' : `최대 ${planConfig.studentLimit}명`}</li>
            </ul>

            <p className="mb-2 text-sm font-medium text-gray-700">
              혹시 가격이 부담되시나요?{' '}
              <button
                onClick={() => { setShowCancelModal(false); setShowPlanModal(true) }}
                className="text-[#1865F2] underline"
              >
                다운그레이드는 어떠세요?
              </button>
            </p>

            <div className="mb-4 space-y-2">
              <p className="text-sm font-medium text-gray-700">해지 사유 (필수)</p>
              {CANCEL_REASONS.map((r) => (
                <label key={r} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="reason"
                    value={r}
                    checked={cancelReason === r}
                    onChange={(e) => setCancelReason(e.target.value)}
                    className="accent-[#1865F2]"
                  />
                  <span className="text-sm text-gray-700">{r}</span>
                </label>
              ))}
              {cancelReason === '기타' && (
                <textarea
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  placeholder="해지 사유를 입력해 주세요"
                  rows={2}
                  className="w-full rounded-lg border border-gray-200 p-2.5 text-sm focus:border-[#1865F2] focus:outline-none resize-none"
                />
              )}
            </div>

            <div className="mb-6 space-y-2">
              <p className="text-sm font-medium text-gray-700">해지 방식</p>
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="immediate"
                  checked={!immediate}
                  onChange={() => setImmediate(false)}
                  className="mt-0.5 accent-[#1865F2]"
                />
                <div>
                  <p className="text-sm font-medium text-gray-900">현재 주기 종료 후 해지</p>
                  <p className="text-xs text-gray-500">갱신일까지 계속 이용 가능. 환불 없음.</p>
                </div>
              </label>
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="immediate"
                  checked={immediate}
                  onChange={() => setImmediate(true)}
                  className="mt-0.5 accent-[#1865F2]"
                />
                <div>
                  <p className="text-sm font-medium text-gray-900">즉시 해지</p>
                  <p className="text-xs text-gray-500">
                    즉시 해지 + 남은 기간 일할 환불.
                  </p>
                </div>
              </label>
            </div>

            {error && <p className="mb-3 text-sm text-[#D92916]">{error}</p>}

            <div className="flex gap-3">
              <button
                onClick={() => { setShowCancelModal(false); setError(''); setCancelReason('') }}
                className="flex-1 rounded-lg border border-gray-200 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleCancel}
                disabled={loading}
                className="flex-1 rounded-lg bg-[#D92916] py-2.5 text-sm font-semibold text-white hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {loading ? '처리 중...' : '해지 확인'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
