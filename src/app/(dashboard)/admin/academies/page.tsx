import Link from 'next/link'
import { prisma } from '@/lib/prisma/client'
import { Search, Building2 } from 'lucide-react'
import type { SubscriptionStatus, PlanType } from '@/generated/prisma'

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

const ALL_STATUSES: SubscriptionStatus[] = ['TRIAL', 'ACTIVE', 'EXPIRED', 'CANCELLED']
const ALL_PLANS: PlanType[] = ['BASIC', 'STANDARD', 'PREMIUM', 'ENTERPRISE']

interface PageProps {
  searchParams: {
    q?: string
    status?: string
    plan?: string
  }
}

export default async function AcademiesPage({ searchParams }: PageProps) {
  const q = searchParams.q?.trim() ?? ''
  const statusFilter = ALL_STATUSES.includes(searchParams.status as SubscriptionStatus)
    ? (searchParams.status as SubscriptionStatus)
    : null
  const planFilter = ALL_PLANS.includes(searchParams.plan as PlanType)
    ? (searchParams.plan as PlanType)
    : null

  const academies = await prisma.academy.findMany({
    where: {
      isDeleted: false,
      ...(statusFilter ? { subscriptionStatus: statusFilter } : {}),
      ...(planFilter ? { subscriptionPlan: planFilter } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { businessName: { contains: q, mode: 'insensitive' } },
              { owner: { email: { contains: q, mode: 'insensitive' } } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      name: true,
      businessName: true,
      subscriptionPlan: true,
      subscriptionStatus: true,
      subscriptionExpiresAt: true,
      createdAt: true,
      owner: { select: { name: true, email: true } },
      users: {
        select: { role: true },
        where: { isDeleted: false, role: { in: ['TEACHER', 'STUDENT'] } },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  // Build filter URL helper
  function filterUrl(overrides: Record<string, string | null>) {
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    if (statusFilter) params.set('status', statusFilter)
    if (planFilter) params.set('plan', planFilter)
    Object.entries(overrides).forEach(([key, val]) => {
      if (val === null) params.delete(key)
      else params.set(key, val)
    })
    const str = params.toString()
    return `/admin/academies${str ? `?${str}` : ''}`
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">학원 관리</h1>
        <p className="text-sm text-gray-500 mt-1">전체 {academies.length}개 학원</p>
      </div>

      {/* Search + Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
        {/* Search */}
        <form method="GET" action="/admin/academies" className="relative">
          {statusFilter && <input type="hidden" name="status" value={statusFilter} />}
          {planFilter && <input type="hidden" name="plan" value={planFilter} />}
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
          />
          <input
            name="q"
            defaultValue={q}
            placeholder="상호명, 학원명, 이메일 검색"
            className="w-full h-11 pl-9 pr-4 rounded-lg border border-gray-200 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-700/20 focus:border-primary-700"
          />
        </form>

        {/* Status filter */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-gray-500">상태:</span>
          <Link
            href={filterUrl({ status: null })}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              !statusFilter
                ? 'bg-primary-700 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            전체
          </Link>
          {ALL_STATUSES.map((s) => (
            <Link
              key={s}
              href={filterUrl({ status: s })}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                statusFilter === s
                  ? 'bg-primary-700 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {STATUS_LABEL[s]}
            </Link>
          ))}
        </div>

        {/* Plan filter */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-gray-500">플랜:</span>
          <Link
            href={filterUrl({ plan: null })}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              !planFilter
                ? 'bg-primary-700 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            전체
          </Link>
          {ALL_PLANS.map((p) => (
            <Link
              key={p}
              href={filterUrl({ plan: p })}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                planFilter === p
                  ? 'bg-primary-700 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {PLAN_LABEL[p]}
            </Link>
          ))}
        </div>
      </div>

      {/* Table */}
      {academies.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 py-20 flex flex-col items-center gap-3">
          <Building2 size={40} className="text-gray-300" />
          <p className="text-sm text-gray-500">조건에 맞는 학원이 없습니다</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">
                    상호명 / 학원명
                  </th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">
                    학원장
                  </th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">
                    플랜
                  </th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">
                    상태
                  </th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">
                    교사 / 학생
                  </th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">
                    만료일
                  </th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">
                    가입일
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {academies.map((academy) => {
                  const teacherCount = academy.users.filter((u) => u.role === 'TEACHER').length
                  const studentCount = academy.users.filter((u) => u.role === 'STUDENT').length
                  return (
                    <tr
                      key={academy.id}
                      className="hover:bg-gray-50 transition-colors cursor-pointer"
                    >
                      <td className="px-4 py-3">
                        <Link href={`/admin/academies/${academy.id}`} className="block">
                          <span className="text-sm font-medium text-gray-900">
                            {academy.businessName ?? academy.name}
                          </span>
                          {academy.businessName && (
                            <span className="block text-xs text-gray-400">{academy.name}</span>
                          )}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/admin/academies/${academy.id}`} className="block">
                          <span className="text-sm text-gray-700">
                            {academy.owner?.name ?? '-'}
                          </span>
                          <span className="block text-xs text-gray-400">
                            {academy.owner?.email ?? ''}
                          </span>
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/admin/academies/${academy.id}`} className="block">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${PLAN_CLASS[academy.subscriptionPlan]}`}
                          >
                            {PLAN_LABEL[academy.subscriptionPlan]}
                          </span>
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/admin/academies/${academy.id}`} className="block">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_CLASS[academy.subscriptionStatus]}`}
                          >
                            {STATUS_LABEL[academy.subscriptionStatus]}
                          </span>
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/admin/academies/${academy.id}`} className="block">
                          <span className="text-sm text-gray-700">
                            {teacherCount} / {studentCount}
                          </span>
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/admin/academies/${academy.id}`} className="block">
                          <span className="text-sm text-gray-700">
                            {academy.subscriptionExpiresAt
                              ? academy.subscriptionExpiresAt.toLocaleDateString('ko-KR')
                              : '-'}
                          </span>
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/admin/academies/${academy.id}`} className="block">
                          <span className="text-sm text-gray-500">
                            {academy.createdAt.toLocaleDateString('ko-KR')}
                          </span>
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
