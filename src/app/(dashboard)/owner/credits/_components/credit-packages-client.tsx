'use client'

import { useState } from 'react'
import { loadTossPayments } from '@tosspayments/tosspayments-sdk'
import { Loader2 } from 'lucide-react'
import { startCreditCheckout } from '@/lib/credits/actions'
import { estimateSendable, formatCredits } from '@/lib/credits/constants'

const TOSS_CLIENT_KEY = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY ?? ''

type Pkg = { id: string; name: string; credits: number; priceKrw: number }

type Props = {
  packages: Pkg[]
  alimtalkPrice: number
  customerName: string
  customerEmail: string
}

export function CreditPackagesClient({ packages, alimtalkPrice, customerName, customerEmail }: Props) {
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const purchase = async (pkg: Pkg) => {
    setPendingId(pkg.id)
    setError('')
    try {
      // 1) 서버에서 결제 건 생성 (금액·크레딧은 서버의 상품 정보로 확정)
      const checkout = await startCreditCheckout(pkg.id)
      if (!checkout.ok) {
        setError(checkout.error)
        setPendingId(null)
        return
      }
      // 2) 토스페이먼츠 결제창 (리다이렉트) → 승인·충전은 /owner/credits/toss-success 에서 서버가 처리
      const toss = await loadTossPayments(TOSS_CLIENT_KEY)
      const payment = toss.payment({ customerKey: checkout.customerKey })
      await payment.requestPayment({
        method: 'CARD',
        amount: { currency: 'KRW', value: checkout.amount },
        orderId: checkout.paymentId,
        orderName: checkout.orderName,
        successUrl: `${window.location.origin}/owner/credits/toss-success`,
        failUrl: `${window.location.origin}/owner/credits/toss-fail`,
        customerEmail,
        customerName,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.'
      if (!message.includes('PAY_PROCESS_CANCELED') && !message.includes('USER_CANCEL')) {
        setError(`결제 중 오류가 발생했습니다: ${message}`)
      }
      setPendingId(null)
    }
  }

  if (packages.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
        현재 판매 중인 충전 상품이 없습니다. 고객센터로 문의해주세요.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {error && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-accent-red">
          {error}
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {packages.map((pkg) => (
          <div key={pkg.id} className="flex flex-col rounded-xl border border-gray-200 bg-white p-5">
            <p className="text-sm font-semibold text-gray-500">{pkg.name}</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">
              {formatCredits(pkg.credits)}
              <span className="ml-1 text-sm font-medium text-gray-500">크레딧</span>
            </p>
            <p className="mt-1 text-xs text-gray-500">
              알림톡 약 {formatCredits(estimateSendable(pkg.credits, alimtalkPrice))}건
            </p>
            <p className="mt-4 text-lg font-bold text-gray-900">{pkg.priceKrw.toLocaleString('ko-KR')}원</p>
            <button
              type="button"
              onClick={() => purchase(pkg)}
              disabled={pendingId !== null}
              className="mt-4 h-11 rounded-xl bg-primary-700 text-sm font-semibold text-white inline-flex items-center justify-center gap-2 hover:bg-primary-800 disabled:opacity-60"
            >
              {pendingId === pkg.id && <Loader2 size={16} className="animate-spin" />}
              충전하기
            </button>
          </div>
        ))}
      </div>
      <p className="text-xs text-gray-500">
        결제는 토스페이먼츠로 처리되며, 결제가 확인되면 크레딧이 바로 충전됩니다.
      </p>
    </div>
  )
}
