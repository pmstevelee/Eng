'use client'

import { useState } from 'react'
import { loadTossPayments } from '@tosspayments/tosspayments-sdk'
import { Zap, CheckCircle, Star } from 'lucide-react'
import { CREDIT_PACKAGES } from '@/lib/pricing'
import type { CreditPackageKey } from '@/lib/pricing'

const TOSS_CLIENT_KEY = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY!

interface PackageCardProps {
  id: CreditPackageKey
  price: number
  writingCredits: number
  questionCredits: number
  discountLabel?: string
  isRecommended?: boolean
  onSelect: (id: CreditPackageKey) => void
  loading: boolean
  selected: boolean
}

function PackageCard({
  id,
  price,
  writingCredits,
  questionCredits,
  discountLabel,
  isRecommended,
  onSelect,
  loading,
  selected,
}: PackageCardProps) {
  const perWriting = Math.round(price / writingCredits)

  return (
    <div
      className={`relative rounded-xl border-2 bg-white p-6 transition-all ${
        isRecommended
          ? 'border-[#7854F7] shadow-md'
          : 'border-gray-200 hover:border-[#7854F7]/50'
      }`}
    >
      {isRecommended && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="flex items-center gap-1 rounded-full bg-[#7854F7] px-3 py-1 text-xs font-semibold text-white">
            <Star className="h-3 w-3" />
            인기
          </span>
        </div>
      )}

      {discountLabel && (
        <div className="mb-3 inline-flex items-center rounded-full bg-green-50 px-2.5 py-1 text-xs font-semibold text-[#1FAF54]">
          {discountLabel}
        </div>
      )}

      <div className="mb-4">
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold text-gray-900">
            {price.toLocaleString('ko-KR')}원
          </span>
        </div>
        <p className="mt-0.5 text-xs text-gray-400">1회당 약 {perWriting}원</p>
      </div>

      <div className="mb-6 space-y-2">
        <div className="flex items-center gap-2">
          <CheckCircle className="h-4 w-4 text-[#1FAF54] shrink-0" />
          <span className="text-sm text-gray-700">
            AI 쓰기 평가 <strong>{writingCredits.toLocaleString()}</strong>회
          </span>
        </div>
        <div className="flex items-center gap-2">
          <CheckCircle className="h-4 w-4 text-[#1FAF54] shrink-0" />
          <span className="text-sm text-gray-700">
            AI 문제 생성 <strong>{questionCredits.toLocaleString()}</strong>회
          </span>
        </div>
        <div className="flex items-center gap-2">
          <CheckCircle className="h-4 w-4 text-gray-300 shrink-0" />
          <span className="text-sm text-gray-500">유효기간: 구매일로부터 12개월</span>
        </div>
      </div>

      <button
        onClick={() => onSelect(id)}
        disabled={loading}
        className={`w-full rounded-lg py-3 text-sm font-semibold transition-colors disabled:opacity-50 ${
          isRecommended
            ? 'bg-[#7854F7] text-white hover:bg-[#6644e6]'
            : 'bg-gray-900 text-white hover:bg-gray-700'
        }`}
      >
        {loading && selected ? '결제 중...' : '구매하기'}
      </button>
    </div>
  )
}

interface CreditsClientProps {
  writingCredits: number
  questionCredits: number
  earliestExpiry: string | null
  customerInfo: {
    customerId: string
    fullName: string
    email: string
  }
  initialSuccessMessage?: string
  initialError?: string
}

export function CreditsClient({
  writingCredits,
  questionCredits,
  earliestExpiry,
  customerInfo,
  initialSuccessMessage,
  initialError,
}: CreditsClientProps) {
  const [loading, setLoading] = useState(false)
  const [selectedPkg, setSelectedPkg] = useState<CreditPackageKey | null>(null)
  const [error, setError] = useState(initialError ?? '')
  const [successMsg, setSuccessMsg] = useState(initialSuccessMessage ?? '')

  async function handlePurchase(packageId: CreditPackageKey) {
    setLoading(true)
    setSelectedPkg(packageId)
    setError('')
    setSuccessMsg('')

    try {
      // 1단계: 결제 레코드 생성
      const checkoutRes = await fetch('/api/billing/credits/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageId }),
      })

      if (!checkoutRes.ok) {
        const data = await checkoutRes.json()
        setError(data.error ?? '결제 초기화에 실패했습니다.')
        setLoading(false)
        setSelectedPkg(null)
        return
      }

      const { paymentId, amount, orderName } = await checkoutRes.json()

      // 2단계: 토스페이먼츠 결제창 (리다이렉트 방식)
      const tossPayments = await loadTossPayments(TOSS_CLIENT_KEY)
      const payment = tossPayments.payment({ customerKey: customerInfo.customerId })

      await payment.requestPayment({
        method: 'CARD',
        amount: { currency: 'KRW', value: amount },
        orderId: paymentId,
        orderName,
        successUrl: `${window.location.origin}/owner/billing/credits/toss-success`,
        failUrl: `${window.location.origin}/owner/billing/credits/toss-fail`,
        customerEmail: customerInfo.email,
        customerName: customerInfo.fullName,
      })

      // requestPayment는 리다이렉트이므로 이 이후 코드는 실행되지 않음
    } catch (err) {
      const message = err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다'
      if (!message.includes('PAY_PROCESS_CANCELED')) {
        setError(`결제 중 오류가 발생했습니다: ${message}`)
      }
      setLoading(false)
      setSelectedPkg(null)
    }
  }

  const packageItems: {
    id: CreditPackageKey
    discountLabel?: string
    isRecommended?: boolean
  }[] = [
    { id: 'SMALL' },
    { id: 'MEDIUM', discountLabel: '14% 절약', isRecommended: true },
    { id: 'LARGE', discountLabel: '20% 절약' },
  ]

  return (
    <div className="space-y-6">
      {/* 현재 보유 크레딧 */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="flex items-center gap-2 mb-4">
          <Zap className="h-5 w-5 text-[#7854F7]" />
          <h2 className="text-base font-bold text-gray-900">현재 보유 크레딧</h2>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-gray-500 mb-1">AI 쓰기 평가</p>
            <p className="text-xl font-bold text-gray-900">
              {writingCredits.toLocaleString()}
              <span className="ml-1 text-sm font-normal text-gray-500">회</span>
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">AI 문제 생성</p>
            <p className="text-xl font-bold text-gray-900">
              {questionCredits.toLocaleString()}
              <span className="ml-1 text-sm font-normal text-gray-500">회</span>
            </p>
          </div>
        </div>
        {earliestExpiry && (
          <p className="mt-3 text-xs text-gray-400">
            가장 빠른 만료일: {new Date(earliestExpiry).toLocaleDateString('ko-KR')}
          </p>
        )}
      </div>

      {/* 패키지 카드 */}
      {successMsg && (
        <div className="flex items-start gap-2 rounded-xl bg-green-50 border border-green-200 p-4 text-sm text-[#1FAF54]">
          <CheckCircle className="h-5 w-5 shrink-0 mt-0.5" />
          {successMsg}
        </div>
      )}

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-[#D92916]">
          {error}
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-3">
        {packageItems.map(({ id, discountLabel, isRecommended }) => {
          const pkg = CREDIT_PACKAGES[id]
          return (
            <PackageCard
              key={id}
              id={id}
              price={pkg.price}
              writingCredits={pkg.writingCredits}
              questionCredits={pkg.questionCredits}
              discountLabel={discountLabel}
              isRecommended={isRecommended}
              onSelect={handlePurchase}
              loading={loading}
              selected={selectedPkg === id}
            />
          )
        })}
      </div>

      <p className="text-center text-xs text-gray-400">
        크레딧은 구매 후 12개월간 유효합니다. 만료 전 사용하지 않은 크레딧은 소멸됩니다.
        <br />
        결제는 KG이니시스를 통해 안전하게 처리됩니다.
      </p>
    </div>
  )
}
