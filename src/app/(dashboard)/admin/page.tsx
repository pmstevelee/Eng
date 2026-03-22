import { prisma } from '@/lib/prisma/client'
import { Building2, Users, UserPlus, TrendingUp } from 'lucide-react'
import { MonthlySignupChart, PlanDistributionChart } from './_components/charts'
import type { MonthlyData, PlanData } from './_components/charts'

const PLAN_LABEL: Record<string, string> = {
  BASIC: '기본',
  STANDARD: '표준',
  PREMIUM: '프리미엄',
  ENTERPRISE: '엔터프라이즈',
}

async function getDashboardData() {
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const [totalAcademies, totalUsers, newAcademies, revenue] = await Promise.all([
    prisma.academy.count({ where: { isDeleted: false } }),
    prisma.user.count({ where: { isDeleted: false } }),
    prisma.academy.count({ where: { isDeleted: false, createdAt: { gte: startOfMonth } } }),
    prisma.subscription.aggregate({
      where: { status: 'PAID', createdAt: { gte: startOfMonth } },
      _sum: { amount: true },
    }),
  ])

  // Monthly signup trend (last 6 months) — 6개 쿼리를 병렬 실행
  const monthRanges = Array.from({ length: 6 }, (_, idx) => {
    const i = 5 - idx
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1)
    return { start, end }
  })

  const monthlyCounts = await Promise.all(
    monthRanges.map(({ start, end }) =>
      prisma.academy.count({
        where: { isDeleted: false, createdAt: { gte: start, lt: end } },
      })
    )
  )

  const monthlyData: MonthlyData[] = monthRanges.map(({ start }, idx) => ({
    month: start.toLocaleDateString('ko-KR', { month: 'short' }),
    count: monthlyCounts[idx],
  }))

  // Plan distribution
  const planGroups = await prisma.academy.groupBy({
    by: ['subscriptionPlan'],
    _count: { id: true },
    where: { isDeleted: false },
  })
  const planData: PlanData[] = planGroups.map((g) => ({
    plan: g.subscriptionPlan,
    label: PLAN_LABEL[g.subscriptionPlan] ?? g.subscriptionPlan,
    count: g._count.id,
  }))

  return {
    totalAcademies,
    totalUsers,
    newAcademies,
    revenue: revenue._sum.amount ?? 0,
    monthlyData,
    planData,
  }
}

export default async function AdminDashboard() {
  const { totalAcademies, totalUsers, newAcademies, revenue, monthlyData, planData } =
    await getDashboardData()

  const stats = [
    {
      label: '총 학원 수',
      value: totalAcademies.toLocaleString(),
      desc: '전체 등록 학원',
      icon: Building2,
      iconBg: 'bg-primary-100',
      iconColor: 'text-primary-700',
    },
    {
      label: '총 사용자 수',
      value: totalUsers.toLocaleString(),
      desc: '학원장 · 교사 · 학생',
      icon: Users,
      iconBg: 'bg-accent-teal-light',
      iconColor: 'text-accent-teal',
    },
    {
      label: '이번 달 신규 가입',
      value: newAcademies.toLocaleString(),
      desc: '이번 달 신규 학원',
      icon: UserPlus,
      iconBg: 'bg-accent-green-light',
      iconColor: 'text-accent-green',
    },
    {
      label: '이번 달 구독 수익',
      value: `₩${revenue.toLocaleString()}`,
      desc: '입금 확인 완료 기준',
      icon: TrendingUp,
      iconBg: 'bg-accent-gold-light',
      iconColor: 'text-accent-gold',
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">시스템 대시보드</h1>
        <p className="text-sm text-gray-500 mt-1">EduLevel 전체 운영 현황</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <div key={stat.label} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-gray-500">{stat.label}</span>
                <div
                  className={`w-10 h-10 rounded-lg ${stat.iconBg} flex items-center justify-center`}
                >
                  <Icon size={20} className={stat.iconColor} />
                </div>
              </div>
              <div className="text-3xl font-bold text-gray-900">{stat.value}</div>
              <p className="text-xs text-gray-500 mt-1">{stat.desc}</p>
            </div>
          )
        })}
      </div>

      {/* Charts grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-1">월별 신규 가입 추이</h3>
          <p className="text-xs text-gray-400 mb-4">최근 6개월 신규 학원 수</p>
          <MonthlySignupChart data={monthlyData} />
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-1">플랜별 분포</h3>
          <p className="text-xs text-gray-400 mb-4">현재 활성 학원 기준</p>
          {planData.length > 0 ? (
            <PlanDistributionChart data={planData} />
          ) : (
            <div className="h-60 flex items-center justify-center text-sm text-gray-400">
              데이터 없음
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
