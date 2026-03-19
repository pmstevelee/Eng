import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma/client'
import { SubscriptionClient } from './_components/subscription-client'

const SUBSCRIPTION_STATUS_LABEL: Record<string, string> = {
  TRIAL: '무료 체험',
  ACTIVE: '이용 중',
  EXPIRED: '만료됨',
  CANCELLED: '해지됨',
}

const SUBSCRIPTION_STATUS_CLASS: Record<string, string> = {
  TRIAL: 'bg-accent-gold-light text-amber-700 border-accent-gold',
  ACTIVE: 'bg-accent-green-light text-green-700 border-accent-green',
  EXPIRED: 'bg-gray-100 text-gray-500 border-gray-200',
  CANCELLED: 'bg-accent-red-light text-red-700 border-accent-red',
}

const PAYMENT_STATUS_LABEL: Record<string, string> = {
  PENDING: '확인 대기중',
  PAID: '결제 완료',
  EXPIRED: '기간 만료',
  REFUNDED: '환불',
  CANCELLED: '취소됨',
}

const PAYMENT_STATUS_CLASS: Record<string, string> = {
  PENDING: 'bg-accent-gold-light text-amber-700',
  PAID: 'bg-accent-green-light text-green-700',
  EXPIRED: 'bg-gray-100 text-gray-500',
  REFUNDED: 'bg-accent-purple-light text-purple-700',
  CANCELLED: 'bg-accent-red-light text-red-700',
}

const PLAN_LABEL: Record<string, string> = {
  BASIC: '베이직',
  STANDARD: '스탠다드',
  PREMIUM: '프리미엄',
  ENTERPRISE: '엔터프라이즈',
}

const PERIOD_LABEL: Record<string, string> = {
  MONTHLY: '월간',
  YEARLY: '연간',
}

export default async function SubscriptionPage() {
  const supabase = await createClient()
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const user = await prisma.user.findUnique({
    where: { id: authUser.id, isDeleted: false },
    select: {
      role: true,
      academyId: true,
      academy: {
        select: {
          subscriptionStatus: true,
          subscriptionPlan: true,
          subscriptionExpiresAt: true,
          trialEndsAt: true,
          maxStudents: true,
          maxTeachers: true,
        },
      },
    },
  })
  if (!user || user.role !== 'ACADEMY_OWNER' || !user.academyId) redirect('/login')

  const academy = user.academy!
  const academyId = user.academyId

  const [teacherCount, studentCount, subscriptions] = await Promise.all([
    prisma.user.count({ where: { academyId, role: 'TEACHER', isDeleted: false } }),
    prisma.student.count({ where: { user: { academyId }, status: 'ACTIVE' } }),
    prisma.subscription.findMany({
      where: { academyId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
  ])

  const isTrialing = academy.subscriptionStatus === 'TRIAL'
  const trialDaysLeft = isTrialing
    ? Math.ceil(
        (new Date(academy.trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
      )
    : 0

  const teacherPct = Math.min(
    Math.round((teacherCount / academy.maxTeachers) * 100),
    100,
  )
  const studentPct = Math.min(
    Math.round((studentCount / academy.maxStudents) * 100),
    100,
  )

  const currentPlan = academy.subscriptionPlan as 'BASIC' | 'STANDARD' | 'PREMIUM'

  return (
    <div className="space-y-8 max-w-5xl">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">구독 관리</h1>
        <p className="text-sm text-gray-500 mt-1">요금제 및 구독 내역을 확인하고 관리합니다</p>
      </div>

      {/* Trial Banner */}
      {isTrialing && (
        <div
          className={`rounded-xl border px-5 py-4 ${
            trialDaysLeft > 0
              ? 'bg-accent-gold-light border-accent-gold'
              : 'bg-accent-red-light border-accent-red'
          }`}
        >
          {trialDaysLeft > 0 ? (
            <>
              <p className="font-semibold text-amber-800">무료 체험 D-{trialDaysLeft}</p>
              <p className="text-sm text-amber-700 mt-0.5">
                {new Date(academy.trialEndsAt).toLocaleDateString('ko-KR', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
                에 체험이 종료됩니다. 지금 구독하여 서비스를 계속 이용하세요.
              </p>
            </>
          ) : (
            <>
              <p className="font-semibold text-red-800">무료 체험 기간이 종료되었습니다</p>
              <p className="text-sm text-red-700 mt-0.5">
                요금제를 선택하여 서비스를 계속 이용하세요.
              </p>
            </>
          )}
        </div>
      )}

      {/* Current Status Card */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-5">현재 구독 상태</h2>
        <div className="grid sm:grid-cols-2 gap-8">
          {/* Left: Plan & Status */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-3 py-1 rounded-full text-sm font-medium bg-primary-100 text-primary-700 border border-primary-700">
                {PLAN_LABEL[academy.subscriptionPlan] ?? academy.subscriptionPlan}
              </span>
              <span
                className={`px-3 py-1 rounded-full text-xs font-medium border ${
                  SUBSCRIPTION_STATUS_CLASS[academy.subscriptionStatus] ?? ''
                }`}
              >
                {SUBSCRIPTION_STATUS_LABEL[academy.subscriptionStatus] ??
                  academy.subscriptionStatus}
              </span>
            </div>

            {academy.subscriptionExpiresAt && (
              <p className="text-sm text-gray-500">
                만료일{' '}
                <span className="font-medium text-gray-900">
                  {new Date(academy.subscriptionExpiresAt).toLocaleDateString('ko-KR', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </span>
              </p>
            )}
            {isTrialing && (
              <p className="text-sm text-gray-500">
                체험 종료{' '}
                <span className="font-medium text-gray-900">
                  {new Date(academy.trialEndsAt).toLocaleDateString('ko-KR', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </span>
              </p>
            )}
          </div>

          {/* Right: Usage Progress Bars */}
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1.5">
                <span className="text-gray-500">교사</span>
                <span className="font-medium text-gray-900">
                  {teacherCount} / {academy.maxTeachers}명
                </span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent-green rounded-full transition-all duration-500"
                  style={{ width: `${teacherPct}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-sm mb-1.5">
                <span className="text-gray-500">학생</span>
                <span className="font-medium text-gray-900">
                  {studentCount} / {academy.maxStudents}명
                </span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent-green rounded-full transition-all duration-500"
                  style={{ width: `${studentPct}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Plan Comparison + Payment (Client Component) */}
      <SubscriptionClient currentPlan={currentPlan} />

      {/* Subscription History */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">구독 이력</h2>
        </div>

        {subscriptions.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm text-gray-500">아직 구독 이력이 없습니다.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    날짜
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    플랜
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    기간
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    금액
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    상태
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {subscriptions.map((sub) => (
                  <tr key={sub.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-700 whitespace-nowrap">
                      {sub.createdAt.toLocaleDateString('ko-KR')}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      {PLAN_LABEL[sub.plan] ?? sub.plan}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      {PERIOD_LABEL[sub.period] ?? sub.period}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900 whitespace-nowrap">
                      {sub.amount.toLocaleString('ko-KR')}원
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${
                          PAYMENT_STATUS_CLASS[sub.status] ?? 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {PAYMENT_STATUS_LABEL[sub.status] ?? sub.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
