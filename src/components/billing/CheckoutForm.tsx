'use client'

import { useState } from 'react'
import { loadTossPayments } from '@tosspayments/tosspayments-sdk'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import { AlertCircle, CreditCard, Loader2, ShieldCheck } from 'lucide-react'
import { PLANS, PLAN_DISPLAY_NAMES, BILLING_CYCLE_DISPLAY_NAMES } from '@/lib/pricing'
import type { Plan, BillingCycle } from '@/generated/prisma'

const TOSS_CLIENT_KEY = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY!

interface CheckoutFormProps {
  plan: Plan
  billingCycle: BillingCycle
  customerName: string
  customerEmail: string
  academyName: string
  academyId: string
}

export function CheckoutForm({
  plan,
  billingCycle,
  customerName,
  customerEmail,
  academyName,
  academyId,
}: CheckoutFormProps) {
  const [businessNumber, setBusinessNumber] = useState('')
  const [agreeTerms, setAgreeTerms] = useState(false)
  const [agreePrivacy, setAgreePrivacy] = useState(false)
  const [agreeAuto, setAgreeAuto] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const planConfig = PLANS[plan]
  const price = billingCycle === 'YEARLY' ? planConfig.yearlyPrice : planConfig.monthlyPrice
  const monthlyEquiv = billingCycle === 'YEARLY' ? Math.floor(planConfig.yearlyPrice / 12) : price

  const canSubmit = agreeTerms && agreePrivacy && agreeAuto && !loading

  async function handlePayment() {
    if (!canSubmit) return
    setError(null)
    setLoading(true)

    try {
      // 1. 서버에서 구독 레코드 생성 (TRIAL)
      const checkoutRes = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, billingCycle }),
      })

      const checkoutData = await checkoutRes.json()

      if (!checkoutRes.ok) {
        setError(checkoutData.error ?? '결제 준비 중 오류가 발생했습니다')
        setLoading(false)
        return
      }

      // FREE 플랜: 바로 완료
      if (checkoutData.free) {
        window.location.href = '/owner/billing/success?free=1'
        return
      }

      // 2. 토스페이먼츠 SDK 초기화
      const tossPayments = await loadTossPayments(TOSS_CLIENT_KEY)

      // customerKey = academyId (구매자 고유 키)
      const payment = tossPayments.payment({ customerKey: academyId })

      // 3. 카드 등록창 열기 (리다이렉트 방식)
      await payment.requestBillingAuth({
        method: 'CARD',
        successUrl: `${window.location.origin}/owner/billing/toss-success`,
        failUrl: `${window.location.origin}/owner/billing/toss-fail`,
        customerEmail,
        customerName,
      })

      // requestBillingAuth는 리다이렉트이므로 이 이후 코드는 실행되지 않음
    } catch (err) {
      const message = err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다'

      // 사용자가 직접 취소한 경우
      if (message.includes('PAY_PROCESS_CANCELED')) {
        setError(null)
      } else {
        setError(`카드 등록 중 오류가 발생했습니다: ${message}`)
      }
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* 주문 요약 */}
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-5">
        <h3 className="mb-4 text-sm font-semibold text-gray-500 uppercase tracking-wide">
          주문 요약
        </h3>
        <div className="flex flex-col gap-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">학원명</span>
            <span className="font-medium text-gray-900">{academyName}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">플랜</span>
            <span className="font-medium text-gray-900">
              {PLAN_DISPLAY_NAMES[plan]} · {BILLING_CYCLE_DISPLAY_NAMES[billingCycle]}
            </span>
          </div>
          {billingCycle === 'YEARLY' && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">월 환산</span>
              <span className="font-medium text-accent-green">
                {monthlyEquiv.toLocaleString('ko-KR')}원/월 (20% 할인)
              </span>
            </div>
          )}
          <Separator className="my-2" />
          <div className="flex justify-between text-base font-bold">
            <span className="text-gray-900">
              {billingCycle === 'YEARLY' ? '연간 결제 금액' : '월 결제 금액'}
            </span>
            <span className="text-primary-700">{price.toLocaleString('ko-KR')}원</span>
          </div>
        </div>
      </div>

      {/* 세금계산서 (선택) */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="businessNumber" className="text-sm font-medium text-gray-700">
          사업자등록번호{' '}
          <span className="font-normal text-gray-400">(세금계산서 발행 시 입력)</span>
        </Label>
        <Input
          id="businessNumber"
          type="text"
          placeholder="000-00-00000"
          value={businessNumber}
          onChange={(e) => setBusinessNumber(e.target.value)}
          className="h-11"
          maxLength={12}
        />
      </div>

      {/* 결제자 정보 */}
      <div className="rounded-xl border border-gray-200 p-4">
        <p className="mb-3 text-sm font-medium text-gray-700">결제자 정보</p>
        <div className="flex flex-col gap-1.5 text-sm text-gray-600">
          <div className="flex justify-between">
            <span>이름</span>
            <span className="font-medium text-gray-900">{customerName}</span>
          </div>
          <div className="flex justify-between">
            <span>이메일</span>
            <span className="font-medium text-gray-900">{customerEmail}</span>
          </div>
        </div>
      </div>

      {/* 동의 체크박스 */}
      <div className="flex flex-col gap-3">
        <CheckboxItem
          id="agreeTerms"
          checked={agreeTerms}
          onCheckedChange={(v) => setAgreeTerms(!!v)}
          label="이용약관에 동의합니다"
          required
        />
        <CheckboxItem
          id="agreePrivacy"
          checked={agreePrivacy}
          onCheckedChange={(v) => setAgreePrivacy(!!v)}
          label="개인정보 처리방침에 동의합니다"
          required
        />
        <CheckboxItem
          id="agreeAuto"
          checked={agreeAuto}
          onCheckedChange={(v) => setAgreeAuto(!!v)}
          label={`정기결제 자동 청구에 동의합니다 (${BILLING_CYCLE_DISPLAY_NAMES[billingCycle]} 자동 갱신)`}
          required
        />
      </div>

      {/* 에러 메시지 */}
      {error && (
        <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 결제 버튼 */}
      <Button
        onClick={handlePayment}
        disabled={!canSubmit}
        className="h-12 w-full bg-primary-700 hover:bg-primary-800 text-white font-semibold text-base"
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            카드 등록 준비 중...
          </>
        ) : (
          <>
            <CreditCard className="mr-2 h-5 w-5" />
            카드 등록하고 {price.toLocaleString('ko-KR')}원 결제하기
          </>
        )}
      </Button>

      <div className="flex items-center justify-center gap-1.5 text-xs text-gray-400">
        <ShieldCheck className="h-3.5 w-3.5" />
        <span>토스페이먼츠 · SSL 암호화 결제</span>
      </div>
    </div>
  )
}

function CheckboxItem({
  id,
  checked,
  onCheckedChange,
  label,
  required,
}: {
  id: string
  checked: boolean
  onCheckedChange: (v: boolean | 'indeterminate') => void
  label: string
  required?: boolean
}) {
  return (
    <div className="flex items-center gap-2">
      <Checkbox id={id} checked={checked} onCheckedChange={onCheckedChange} />
      <label htmlFor={id} className="cursor-pointer text-sm text-gray-700">
        {label}
        {required && <span className="ml-0.5 text-accent-red">*</span>}
      </label>
    </div>
  )
}
