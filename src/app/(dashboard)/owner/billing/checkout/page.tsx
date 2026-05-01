import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma/client'
import { PLANS, PLAN_DISPLAY_NAMES, BILLING_CYCLE_DISPLAY_NAMES } from '@/lib/pricing'
import { CheckoutForm } from '@/components/billing/CheckoutForm'
import { ArrowLeft, Check } from 'lucide-react'
import Link from 'next/link'
import type { Plan, BillingCycle } from '@/generated/prisma'

interface PageProps {
  searchParams: Promise<{ plan?: string; cycle?: string }>
}

export default async function CheckoutPage({ searchParams }: PageProps) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ACADEMY_OWNER') redirect('/login')

  const params = await searchParams
  const plan = params.plan as Plan | undefined
  const billingCycle = (params.cycle as BillingCycle | undefined) ?? 'MONTHLY'

  const validPlans: Plan[] = ['FREE', 'STARTER', 'STANDARD', 'PREMIUM']
  const validCycles: BillingCycle[] = ['MONTHLY', 'YEARLY']

  if (!plan || !validPlans.includes(plan) || !validCycles.includes(billingCycle)) {
    redirect('/owner/billing/plans')
  }

  if (plan === 'FREE') redirect('/owner/billing/plans')

  const planConfig = PLANS[plan]
  const price = billingCycle === 'YEARLY' ? planConfig.yearlyPrice : planConfig.monthlyPrice

  // 이미 활성 구독 여부 확인
  if (user.academyId) {
    const existing = await prisma.subscription.findUnique({
      where: { academyId: user.academyId },
      select: { status: true, plan: true },
    })
    if (existing?.status === 'ACTIVE' && existing.plan !== 'FREE') {
      redirect('/owner/settings')
    }
  }

  const features = getKeyFeatures(plan, billingCycle)

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* 뒤로가기 */}
      <Link
        href="/owner/billing/plans"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        요금제 선택으로
      </Link>

      <h1 className="mb-8 text-2xl font-bold text-gray-900">결제 진행</h1>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* 좌: 플랜 요약 */}
        <div className="flex flex-col gap-6">
          <div className="rounded-xl border border-gray-200 p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">
                {PLAN_DISPLAY_NAMES[plan]} 플랜
              </h2>
              <span className="text-sm font-medium text-gray-500">
                {BILLING_CYCLE_DISPLAY_NAMES[billingCycle]}
              </span>
            </div>

            <div className="mb-6">
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold text-primary-700">
                  {price.toLocaleString('ko-KR')}원
                </span>
                <span className="text-sm text-gray-500">
                  /{billingCycle === 'YEARLY' ? '년' : '월'}
                </span>
              </div>
              {billingCycle === 'YEARLY' && (
                <p className="mt-1 text-sm text-accent-green">
                  월 {Math.floor(price / 12).toLocaleString('ko-KR')}원 (20% 절약)
                </p>
              )}
            </div>

            <ul className="flex flex-col gap-2.5">
              {features.map((f, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent-green" />
                  {f}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl bg-blue-50 border border-blue-100 p-4 text-sm text-blue-700">
            <p className="font-medium mb-1">14일 무료 체험 적용</p>
            <p className="text-blue-600">
              카드 등록 후 14일간 무료로 이용하실 수 있습니다.
              체험 종료 후 자동으로 결제됩니다.
            </p>
          </div>
        </div>

        {/* 우: 결제 폼 */}
        <div>
          <CheckoutForm
            plan={plan}
            billingCycle={billingCycle}
            customerName={user.name}
            customerEmail={user.email}
            academyName={user.academy?.name ?? user.academy?.businessName ?? ''}
          />
        </div>
      </div>
    </div>
  )
}

function getKeyFeatures(plan: Plan, billingCycle: BillingCycle): string[] {
  const config = PLANS[plan]
  const studentLimit = config.studentLimit === -1 ? '무제한' : `최대 ${config.studentLimit}명`
  const teacherLimit = config.teacherLimit === -1 ? '무제한' : `${config.teacherLimit}개`
  const aiWriting = config.aiWritingLimit === -1 ? '무제한' : `월 ${config.aiWritingLimit}회`
  const aiQuestion = config.aiQuestionLimit === -1 ? '무제한' : `월 ${config.aiQuestionLimit}회`
  const storage = config.storageLimitMb >= 1024 ? `${config.storageLimitMb / 1024}GB` : `${config.storageLimitMb}MB`
  const retention =
    config.dataRetentionDays === -1
      ? '무기한'
      : config.dataRetentionDays >= 365
        ? `${config.dataRetentionDays / 365}년`
        : `${config.dataRetentionDays}일`

  return [
    `학생 ${studentLimit}`,
    `교사 계정 ${teacherLimit}`,
    `AI 쓰기 평가 ${aiWriting}`,
    `AI 문제 생성 ${aiQuestion}`,
    `파일 저장 ${storage}`,
    `데이터 ${retention} 보관`,
    billingCycle === 'YEARLY' ? '연간 결제 (20% 절약)' : '언제든지 해지 가능',
  ]
}
