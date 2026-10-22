'use client'

import { useState } from 'react'
import { loadTossPayments } from '@tosspayments/tosspayments-sdk'
import { Loader2 } from 'lucide-react'
import { startStudentCreditCheckout } from '@/lib/student-credits/actions'
import { STUDENT_CREDIT_PACKAGES } from '@/lib/student-credits/constants'

const TOSS_CLIENT_KEY = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY ?? ''

interface Props {
  creditPerWord: number
  customerName: string
  customerEmail: string
}

export function StudentCreditPackages({ creditPerWord, customerName, customerEmail }: Props) {
  const [pendingKey, setPendingKey] = useState<string | null>(null)
  const [error, setError] = useState('')

  const purchase = async (key: string) => {
    setPendingKey(key)
    setError('')
    try {
      // 1) 서버에서 결제 건 생성 (금액·크레딧은 서버 상품 정보로 확정)
      const checkout = await startStudentCreditCheckout(key)
      if (!checkout.ok) {
        setError(checkout.error)
        setPendingKey(null)
        return
      }
      // 2) 토스페이먼츠 결제창 → 승인·충전은 /student/credits/toss-success 에서 서버가 처리
      const toss = await loadTossPayments(TOSS_CLIENT_KEY)
      const payment = toss.payment({ customerKey: checkout.customerKey })
      await payment.requestPayment({
        method: 'CARD',
        amount: { currency: 'KRW', value: checkout.amount },
        orderId: checkout.orderId,
        orderName: checkout.orderName,
        successUrl: `${window.location.origin}/student/credits/toss-success`,
        failUrl: `${window.location.origin}/student/credits/toss-fail`,
        customerEmail: customerEmail || undefined,
        customerName,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.'
      if (!message.includes('PAY_PROCESS_CANCELED') && !message.includes('USER_CANCEL')) {
        setError(`결제 중 오류가 발생했습니다: ${message}`)
      }
      setPendingKey(null)
    }
  }

  return (
    <div className="space-y-3">
      {error && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-accent-red">
          {error}
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        {STUDENT_CREDIT_PACKAGES.map((pkg) => {
          const bonus = pkg.credits - pkg.priceKrw
          return (
            <div key={pkg.key} className="flex flex-col rounded-xl border border-gray-200 bg-white p-5">
              <p className="text-sm font-semibold text-gray-500">{pkg.name}</p>
              <p className="mt-2 text-2xl font-bold text-gray-900">
                {pkg.credits.toLocaleString('ko-KR')}
                <span className="ml-1 text-sm font-medium text-gray-500">크레딧</span>
              </p>
              {bonus > 0 && (
                <span className="mt-1 w-fit rounded-full bg-accent-gold/15 px-2 py-0.5 text-xs font-semibold text-gray-900">
                  보너스 {bonus.toLocaleString('ko-KR')}
                </span>
              )}
              <p className="mt-2 text-xs text-gray-500">
                AI 플래시카드 약 {creditPerWord > 0 ? Math.floor(pkg.credits / creditPerWord).toLocaleString('ko-KR') : 0}단어
              </p>
              <p className="mt-4 text-lg font-bold text-gray-900">{pkg.priceKrw.toLocaleString('ko-KR')}원</p>
              <button
                type="button"
                onClick={() => purchase(pkg.key)}
                disabled={pendingKey !== null}
                className="mt-4 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary-700 text-sm font-semibold text-white hover:bg-primary-800 disabled:opacity-60"
              >
                {pendingKey === pkg.key && <Loader2 className="h-4 w-4 animate-spin" />}
                충전하기
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
