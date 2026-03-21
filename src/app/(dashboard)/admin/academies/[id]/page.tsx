import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma/client'
import { ChevronRight } from 'lucide-react'
import type { SubscriptionStatus, PlanType, PaymentStatus, SubscriptionPeriod } from '@/generated/prisma'
import { extendSubscription, changePlan, suspendAcademy } from './actions'
import { DeleteAcademyModal } from './_components/delete-academy-modal'

const STATUS_LABEL: Record<SubscriptionStatus, string> = {
  TRIAL: '체험',
  ACTIVE: '활성',
  EXPIRED: '만료',
  CANCELLED: '정지',
}
const STATUS_CLASS: Record<SubscriptionStatus, string> = {
  TRIAL: 'bg-accent-gold-light text-accent-gold',
  ACTIVE: 'bg-accent-green-light text-accent-green',
  EXPIRED: 'bg-accent-red-light text-accent-red',
  CANCELLED: 'bg-gray-100 text-gray-500',
}
const PLAN_LABEL: Record<PlanType, string> = {
  BASIC: '기본',
  STANDARD: '표준',
  PREMIUM: '프리미엄',
  ENTERPRISE: '엔터프라이즈',
}
const PLAN_CLASS: Record<PlanType, string> = {
  BASIC: 'bg-gray-100 text-gray-600',
  STANDARD: 'bg-primary-100 text-primary-700',
  PREMIUM: 'bg-accent-purple-light text-accent-purple',
  ENTERPRISE: 'bg-accent-gold-light text-accent-gold',
}
const PAYMENT_LABEL: Record<PaymentStatus, string> = {
  PENDING: '입금 대기',
  PAID: '결제 완료',
  EXPIRED: '만료',
  REFUNDED: '환불',
  CANCELLED: '취소',
}
const PAYMENT_CLASS: Record<PaymentStatus, string> = {
  PENDING: 'bg-accent-gold-light text-accent-gold',
  PAID: 'bg-accent-green-light text-accent-green',
  EXPIRED: 'bg-gray-100 text-gray-500',
  REFUNDED: 'bg-accent-purple-light text-accent-purple',
  CANCELLED: 'bg-gray-100 text-gray-500',
}
const PERIOD_LABEL: Record<SubscriptionPeriod, string> = {
  MONTHLY: '월간',
  YEARLY: '연간',
}

interface PageProps {
  params: { id: string }
}

export default async function AcademyDetailPage({ params }: PageProps) {
  const academy = await prisma.academy.findUnique({
    where: { id: params.id, isDeleted: false },
    select: {
      id: true,
      name: true,
      businessName: true,
      address: true,
      phone: true,
      inviteCode: true,
      planType: true,
      subscriptionPlan: true,
      subscriptionStatus: true,
      subscriptionStartedAt: true,
      subscriptionExpiresAt: true,
      trialEndsAt: true,
      maxStudents: true,
      maxTeachers: true,
      createdAt: true,
      owner: { select: { name: true, email: true, phone: true } },
      users: {
        select: { role: true },
        where: { isDeleted: false, role: { in: ['TEACHER', 'STUDENT'] } },
      },
      subscriptions: {
        select: {
          id: true,
          plan: true,
          amount: true,
          period: true,
          startedAt: true,
          expiresAt: true,
          paymentMethod: true,
          status: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      },
    },
  })

  if (!academy) notFound()

  const teacherCount = academy.users.filter((u) => u.role === 'TEACHER').length
  const studentCount = academy.users.filter((u) => u.role === 'STUDENT').length
  const teacherPct = Math.min(100, Math.round((teacherCount / academy.maxTeachers) * 100))
  const studentPct = Math.min(100, Math.round((studentCount / academy.maxStudents) * 100))
  const displayName = academy.businessName ?? academy.name

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1 text-sm text-gray-500">
        <Link href="/admin/academies" className="hover:text-primary-700 transition-colors">
          학원 관리
        </Link>
        <ChevronRight size={14} />
        <span className="text-gray-900 font-medium">{displayName}</span>
      </div>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{displayName}</h1>
          <p className="text-sm text-gray-500 mt-1">
            가입일: {academy.createdAt.toLocaleDateString('ko-KR')}
          </p>
        </div>
        <span
          className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${STATUS_CLASS[academy.subscriptionStatus]}`}
        >
          {STATUS_LABEL[academy.subscriptionStatus]}
        </span>
      </div>

      {/* Info grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* 기본 정보 */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">기본 정보</h2>
          <dl className="space-y-3">
            <div>
              <dt className="text-xs text-gray-400">상호명</dt>
              <dd className="text-sm font-medium text-gray-900 mt-0.5">
                {academy.businessName ?? '-'}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-gray-400">학원명</dt>
              <dd className="text-sm text-gray-700 mt-0.5">{academy.name}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-400">주소</dt>
              <dd className="text-sm text-gray-700 mt-0.5">{academy.address ?? '-'}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-400">연락처</dt>
              <dd className="text-sm text-gray-700 mt-0.5">{academy.phone ?? '-'}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-400">초대코드</dt>
              <dd className="text-sm font-mono text-gray-700 mt-0.5 bg-gray-50 px-2 py-1 rounded">
                {academy.inviteCode}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-gray-400">학원장</dt>
              <dd className="text-sm text-gray-700 mt-0.5">
                {academy.owner?.name ?? '-'}
                {academy.owner?.email && (
                  <span className="block text-xs text-gray-400">{academy.owner.email}</span>
                )}
              </dd>
            </div>
          </dl>
        </div>

        {/* 구독 정보 */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">구독 정보</h2>
          <dl className="space-y-3">
            <div>
              <dt className="text-xs text-gray-400">현재 플랜</dt>
              <dd className="mt-0.5">
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${PLAN_CLASS[academy.subscriptionPlan]}`}
                >
                  {PLAN_LABEL[academy.subscriptionPlan]}
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-gray-400">구독 상태</dt>
              <dd className="mt-0.5">
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_CLASS[academy.subscriptionStatus]}`}
                >
                  {STATUS_LABEL[academy.subscriptionStatus]}
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-gray-400">체험 만료일</dt>
              <dd className="text-sm text-gray-700 mt-0.5">
                {academy.trialEndsAt.toLocaleDateString('ko-KR')}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-gray-400">구독 시작일</dt>
              <dd className="text-sm text-gray-700 mt-0.5">
                {academy.subscriptionStartedAt
                  ? academy.subscriptionStartedAt.toLocaleDateString('ko-KR')
                  : '-'}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-gray-400">구독 만료일</dt>
              <dd className="text-sm text-gray-700 mt-0.5">
                {academy.subscriptionExpiresAt
                  ? academy.subscriptionExpiresAt.toLocaleDateString('ko-KR')
                  : '-'}
              </dd>
            </div>
          </dl>
        </div>

        {/* 사용 현황 */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">사용 현황</h2>
          <div className="space-y-5">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm text-gray-600">교사</span>
                <span className="text-sm font-medium text-gray-900">
                  {teacherCount} / {academy.maxTeachers}명
                </span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${teacherPct >= 100 ? 'bg-accent-red' : 'bg-primary-700'}`}
                  style={{ width: `${teacherPct}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm text-gray-600">학생</span>
                <span className="text-sm font-medium text-gray-900">
                  {studentCount} / {academy.maxStudents}명
                </span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${studentPct >= 100 ? 'bg-accent-red' : 'bg-accent-green'}`}
                  style={{ width: `${studentPct}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 관리 액션 */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">관리 액션</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* 구독 연장 */}
          <form action={extendSubscription} className="space-y-2">
            <input type="hidden" name="academyId" value={academy.id} />
            <label className="block text-xs font-medium text-gray-600">구독 연장</label>
            <select
              name="months"
              className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm text-gray-900 bg-white focus:outline-none focus:border-primary-700"
            >
              <option value="1">1개월</option>
              <option value="3">3개월</option>
              <option value="6">6개월</option>
              <option value="12">12개월</option>
            </select>
            <button
              type="submit"
              className="w-full h-9 rounded-lg bg-primary-700 text-white text-sm font-medium hover:bg-primary-600 transition-colors"
            >
              연장
            </button>
          </form>

          {/* 플랜 변경 */}
          <form action={changePlan} className="space-y-2">
            <input type="hidden" name="academyId" value={academy.id} />
            <label className="block text-xs font-medium text-gray-600">플랜 변경</label>
            <select
              name="plan"
              defaultValue={academy.subscriptionPlan}
              className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm text-gray-900 bg-white focus:outline-none focus:border-primary-700"
            >
              <option value="BASIC">기본</option>
              <option value="STANDARD">표준</option>
              <option value="PREMIUM">프리미엄</option>
              <option value="ENTERPRISE">엔터프라이즈</option>
            </select>
            <button
              type="submit"
              className="w-full h-9 rounded-lg bg-primary-700 text-white text-sm font-medium hover:bg-primary-600 transition-colors"
            >
              변경
            </button>
          </form>

          {/* 정지 */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-gray-600">학원 정지</label>
            <p className="text-xs text-gray-400">구독을 정지하고 접근을 제한합니다</p>
            <form action={suspendAcademy}>
              <input type="hidden" name="academyId" value={academy.id} />
              <button
                type="submit"
                className="w-full h-9 rounded-lg border border-accent-gold text-accent-gold text-sm font-medium hover:bg-accent-gold-light transition-colors"
              >
                정지
              </button>
            </form>
          </div>

          {/* 삭제 */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-gray-600">학원 삭제</label>
            <p className="text-xs text-gray-400">모든 데이터가 영구 삭제됩니다</p>
            <DeleteAcademyModal academyId={academy.id} academyName={displayName} />
          </div>
        </div>
      </div>

      {/* 구독 이력 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">구독 이력</h2>
        </div>
        {academy.subscriptions.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-400">구독 이력이 없습니다</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">
                    플랜
                  </th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">
                    기간
                  </th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">
                    금액
                  </th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">
                    결제 상태
                  </th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">
                    구독 기간
                  </th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">
                    생성일
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {academy.subscriptions.map((sub) => (
                  <tr key={sub.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${PLAN_CLASS[sub.plan]}`}
                      >
                        {PLAN_LABEL[sub.plan]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {PERIOD_LABEL[sub.period]}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      ₩{sub.amount.toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${PAYMENT_CLASS[sub.status]}`}
                      >
                        {PAYMENT_LABEL[sub.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {sub.startedAt.toLocaleDateString('ko-KR')} ~{' '}
                      {sub.expiresAt.toLocaleDateString('ko-KR')}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400">
                      {sub.createdAt.toLocaleDateString('ko-KR')}
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
