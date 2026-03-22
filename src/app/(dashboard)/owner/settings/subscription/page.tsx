import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma/client'
import { SubscriptionClient } from './_components/subscription-client'

const SUBSCRIPTION_STATUS_LABEL: Record<string, string> = {
  TRIAL: '무료 체험',
  ACTIVE: '이용 중',
  EXPIRED: '만료됨',
  CANCELLED: '해지됨',
}

const SUBSCRIPTION_STATUS_CLASS: Record<string, string> = {
  TRIAL: 'bg-yellow-50 text-amber-700 border-yellow-300',
  ACTIVE: 'bg-green-50 text-green-700 border-green-300',
  EXPIRED: 'bg-gray-100 text-gray-500 border-gray-200',
  CANCELLED: 'bg-red-50 text-red-700 border-red-200',
}

const PAYMENT_STATUS_LABEL: Record<string, string> = {
  PENDING: '확인 대기중',
  PAID: '결제 완료',
  EXPIRED: '기간 만료',
  REFUNDED: '환불',
  CANCELLED: '취소됨',
}

const PAYMENT_STATUS_CLASS: Record<string, string> = {
  PENDING: 'bg-yellow-50 text-amber-700',
  PAID: 'bg-green-50 text-green-700',
  EXPIRED: 'bg-gray-100 text-gray-500',
  REFUNDED: 'bg-purple-50 text-purple-700',
  CANCELLED: 'bg-red-50 text-red-700',
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
  const user = await getCurrentUser()
  if (!user || user.role !== 'ACADEMY_OWNER' || !user.academyId) redirect('/login')

  const academyId = user.academyId

  const academy = await prisma.academy.findUnique({
    where: { id: academyId },
    select: {
      name: true,
      businessName: true,
      subscriptionStatus: true,
      subscriptionPlan: true,
      subscriptionExpiresAt: true,
      trialEndsAt: true,
      maxStudents: true,
      maxTeachers: true,
    },
  })
  if (!academy) redirect('/login')

  const [teacherCount, studentCount, subscriptions, pendingSubscription] = await Promise.all([
    prisma.user.count({ where: { academyId, role: 'TEACHER', isDeleted: false } }),
    prisma.student.count({ where: { user: { academyId }, status: 'ACTIVE' } }),
    prisma.subscription.findMany({
      where: { academyId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
    prisma.subscription.findFirst({
      where: { academyId, status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
      select: { plan: true, period: true, amount: true, createdAt: true },
    }),
  ])

  const isTrialing = academy.subscriptionStatus === 'TRIAL'
  const isExpired = academy.subscriptionStatus === 'EXPIRED'
  const trialDaysLeft = isTrialing && academy.trialEndsAt
    ? Math.ceil((new Date(academy.trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : 0

  const teacherPct = Math.min(Math.round((teacherCount / academy.maxTeachers) * 100), 100)
  const studentPct = Math.min(Math.round((studentCount / academy.maxStudents) * 100), 100)

  const currentPlan = academy.subscriptionPlan as 'BASIC' | 'STANDARD' | 'PREMIUM'
  const academyName = academy.businessName ?? academy.name

  const pendingSubForClient = pendingSubscription
    ? {
        plan: pendingSubscription.plan,
        period: pendingSubscription.period,
        amount: pendingSubscription.amount,
        createdAt: pendingSubscription.createdAt.toISOString(),
      }
    : undefined

  return (
    <div className="space-y-8 max-w-5xl">
      {/* 만료 배너 */}
      {isExpired && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 flex items-start gap-3">
          <span className="text-lg mt-0.5">⚠️</span>
          <div>
            <p className="font-semibold text-red-800">구독이 만료되었습니다</p>
            <p className="text-sm text-red-700 mt-0.5">
              현재 데이터 조회만 가능합니다. 테스트 생성·배포 등 기능을 이용하려면 구독을 갱신해주세요.
            </p>
          </div>
          <a
            href="#plan-comparison"
            className="ml-auto shrink-0 px-4 py-2 bg-red-700 text-white text-sm font-medium rounded-lg hover:bg-red-800 transition-colors min-h-[44px] flex items-center"
          >
            지금 구독하기
          </a>
        </div>
      )}

      {/* 체험 배너 */}
      {isTrialing && (
        <div
          className={`rounded-xl border px-5 py-4 flex items-start gap-3 ${
            trialDaysLeft > 0
              ? 'bg-yellow-50 border-yellow-300'
              : 'bg-red-50 border-red-200'
          }`}
        >
          <span className="text-lg mt-0.5">{trialDaysLeft > 0 ? '🎁' : '⏰'}</span>
          <div className="flex-1">
            {trialDaysLeft > 0 ? (
              <>
                <p className="font-semibold text-amber-800">무료 체험 D-{trialDaysLeft}</p>
                <p className="text-sm text-amber-700 mt-0.5">
                  체험 기간이 끝나면 기능이 제한됩니다. 지금 구독하여 서비스를 계속 이용하세요.
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
          <a
            href="#plan-comparison"
            className="shrink-0 px-4 py-2 bg-[#1865F2] text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors min-h-[44px] flex items-center"
          >
            지금 구독하기
          </a>
        </div>
      )}

      {/* 입금 대기중 배너 */}
      {pendingSubForClient && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-5 py-4 flex items-start gap-3">
          <span className="text-lg mt-0.5">🕐</span>
          <div>
            <p className="font-semibold text-blue-800">입금 확인 대기중</p>
            <p className="text-sm text-blue-700 mt-0.5">
              {PLAN_LABEL[pendingSubForClient.plan]} {PERIOD_LABEL[pendingSubForClient.period]} 구독 신청이 접수되었습니다.
              관리자 확인 후 1~2 영업일 내에 활성화됩니다.
            </p>
          </div>
        </div>
      )}

      {/* 현재 구독 상태 카드 */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-5">현재 구독 상태</h2>
        <div className="grid sm:grid-cols-2 gap-8">
          {/* 왼쪽: 플랜 & 상태 */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-3 py-1 rounded-full text-sm font-semibold bg-blue-50 text-[#1865F2] border border-[#1865F2]">
                {PLAN_LABEL[academy.subscriptionPlan] ?? academy.subscriptionPlan}
              </span>
              <span
                className={`px-3 py-1 rounded-full text-xs font-medium border ${
                  SUBSCRIPTION_STATUS_CLASS[academy.subscriptionStatus] ?? ''
                }`}
              >
                {academy.subscriptionStatus === 'TRIAL' && trialDaysLeft > 0
                  ? `체험 중 (D-${trialDaysLeft})`
                  : SUBSCRIPTION_STATUS_LABEL[academy.subscriptionStatus] ?? academy.subscriptionStatus}
              </span>
            </div>

            {academy.subscriptionExpiresAt && !isTrialing && (
              <div className="text-sm text-gray-500">
                만료일{' '}
                <span className="font-medium text-gray-900">
                  {new Date(academy.subscriptionExpiresAt).toLocaleDateString('ko-KR', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </span>
              </div>
            )}
            {isTrialing && academy.trialEndsAt && (
              <div className="text-sm text-gray-500">
                체험 종료{' '}
                <span className="font-medium text-gray-900">
                  {new Date(academy.trialEndsAt).toLocaleDateString('ko-KR', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </span>
              </div>
            )}
          </div>

          {/* 오른쪽: 사용량 프로그레스 바 */}
          <div className="space-y-5">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-500">교사</span>
                <span className="font-medium text-gray-900">
                  {teacherCount} / {academy.maxTeachers}명
                </span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    teacherPct >= 90 ? 'bg-[#D92916]' : 'bg-[#1FAF54]'
                  }`}
                  style={{ width: `${teacherPct}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-500">학생</span>
                <span className="font-medium text-gray-900">
                  {studentCount} / {academy.maxStudents}명
                </span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    studentPct >= 90 ? 'bg-[#D92916]' : 'bg-[#1FAF54]'
                  }`}
                  style={{ width: `${studentPct}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 요금제 비교 + 결제 (클라이언트 컴포넌트) */}
      <SubscriptionClient
        currentPlan={currentPlan}
        academyName={academyName}
        pendingSubscription={pendingSubForClient}
      />

      {/* 구독 이력 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">구독 이력</h2>
        </div>

        {subscriptions.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-2xl mb-2">📋</p>
            <p className="text-sm text-gray-500">아직 구독 이력이 없습니다.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    신청일
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
