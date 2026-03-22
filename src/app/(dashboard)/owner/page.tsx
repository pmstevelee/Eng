import { redirect } from 'next/navigation'
import { Users, TrendingUp, FileCheck, BarChart2, ArrowUpRight, ArrowDownRight, Minus, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { OwnerCharts } from '@/components/dashboard/owner-charts'
import type { ClassChartItem, MonthlyChartItem, LevelChartItem, DomainChartItem } from '@/components/dashboard/owner-charts'

// ─── Data Fetching ────────────────────────────────────────────────────────────

async function getOwnerDashboardData(academyId: string) {
  const now = new Date()
  const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1)
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  // ── 그룹1: 핵심 지표 (5개) ──────────────────────────────────────────────────
  const [
    studentCount,
    attendanceThisMonth,
    testSessionsThisMonth,
    avgScoreThisMonth,
    avgScoreLastMonth,
  ] = await Promise.all([
    // 1. 활성 학생 수
    prisma.student.count({
      where: { user: { academyId, isActive: true, isDeleted: false }, status: 'ACTIVE' },
    }),

    // 2. 이번 달 출석 현황
    prisma.attendance.groupBy({
      by: ['status'],
      where: { student: { user: { academyId } }, date: { gte: startOfThisMonth } },
      _count: { id: true },
    }),

    // 3. 이번 달 완료 테스트 수
    prisma.testSession.count({
      where: {
        student: { user: { academyId } },
        status: { in: ['COMPLETED', 'GRADED'] },
        completedAt: { gte: startOfThisMonth },
      },
    }),

    // 4. 이번 달 평균 점수
    prisma.testSession.aggregate({
      where: {
        student: { user: { academyId } },
        status: 'GRADED',
        completedAt: { gte: startOfThisMonth },
        score: { not: null },
      },
      _avg: { score: true },
    }),

    // 5. 지난 달 평균 점수
    prisma.testSession.aggregate({
      where: {
        student: { user: { academyId } },
        status: 'GRADED',
        completedAt: { gte: startOfLastMonth, lt: startOfThisMonth },
        score: { not: null },
      },
      _avg: { score: true },
    }),
  ])

  // ── 그룹2: 차트 데이터 (5개) ──────────────────────────────────────────────
  const [
    classesWithStudents,
    recentSessions,
    levelDistribution,
    allStudents,
    domainAvgRaw,
  ] = await Promise.all([
    // 6. 반별 평균 점수
    prisma.class.findMany({
      where: { academyId, isActive: true },
      select: {
        name: true,
        students: {
          where: { status: 'ACTIVE' },
          select: {
            testSessions: {
              where: { status: 'GRADED', score: { not: null } },
              select: { score: true },
              orderBy: { completedAt: 'desc' },
              take: 3,
            },
          },
        },
      },
    }),

    // 8. 최근 테스트 세션 10개
    prisma.testSession.findMany({
      where: {
        student: { user: { academyId } },
        status: { in: ['COMPLETED', 'GRADED'] },
      },
      select: {
        id: true,
        score: true,
        status: true,
        completedAt: true,
        student: { select: { user: { select: { name: true } }, class: { select: { name: true } } } },
        test: { select: { title: true, type: true } },
      },
      orderBy: { completedAt: 'desc' },
      take: 10,
    }),

    // 9. 레벨 분포
    prisma.student.groupBy({
      by: ['currentLevel'],
      where: { user: { academyId, isActive: true }, status: 'ACTIVE' },
      _count: { id: true },
      orderBy: { currentLevel: 'asc' },
    }),

    // 10. 월별 신규 학생 (최근 6개월)
    prisma.user.findMany({
      where: {
        academyId,
        role: 'STUDENT',
        isActive: true,
        isDeleted: false,
        createdAt: { gte: sixMonthsAgo },
      },
      select: { createdAt: true },
    }),

    // 11. 영역별 평균 (최근 30일)
    prisma.testSession.aggregate({
      where: {
        student: { user: { academyId } },
        status: 'GRADED',
        completedAt: { gte: thirtyDaysAgo },
      },
      _avg: {
        grammarScore: true,
        vocabularyScore: true,
        readingScore: true,
        writingScore: true,
      },
    }),
  ])

  // ── Process stats ──
  const totalAttendance = attendanceThisMonth.reduce((sum, s) => sum + s._count.id, 0)
  const presentCount = attendanceThisMonth.find((s) => s.status === 'PRESENT')?._count.id ?? 0
  const attendanceRate = totalAttendance > 0 ? Math.round((presentCount / totalAttendance) * 100) : null

  const avgThisMonth = avgScoreThisMonth._avg.score
  const avgLastMonth = avgScoreLastMonth._avg.score
  const avgDelta =
    avgThisMonth !== null && avgLastMonth !== null
      ? Math.round(avgThisMonth - avgLastMonth)
      : null

  // ── Class chart ──
  const classChartData: ClassChartItem[] = classesWithStudents
    .map((cls) => {
      const scores = cls.students.flatMap((s) =>
        s.testSessions.map((ts) => ts.score ?? 0).filter((sc) => sc > 0)
      )
      const avg = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0
      return { name: cls.name, 평균점수: avg, 학생수: cls.students.length }
    })
    .filter((d) => d.name)

  // ── Monthly chart (last 6 months) ──
  const monthlyMap: Record<string, number> = {}
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    monthlyMap[key] = 0
  }
  allStudents.forEach((u) => {
    const key = `${u.createdAt.getFullYear()}-${String(u.createdAt.getMonth() + 1).padStart(2, '0')}`
    if (key in monthlyMap) monthlyMap[key]++
  })
  const monthlyChartData: MonthlyChartItem[] = Object.entries(monthlyMap).map(([key, count]) => {
    const [, month] = key.split('-')
    return { month: `${parseInt(month)}월`, 신규학생: count }
  })

  // ── Level distribution ──
  const levelChartData: LevelChartItem[] = levelDistribution.map((l) => ({
    name: `레벨 ${l.currentLevel}`,
    value: l._count.id,
  }))

  // ── Domain averages ──
  const domainData: DomainChartItem[] = [
    { domain: 'Grammar', 평균: Math.round(domainAvgRaw._avg.grammarScore ?? 0) },
    { domain: 'Vocabulary', 평균: Math.round(domainAvgRaw._avg.vocabularyScore ?? 0) },
    { domain: 'Reading', 평균: Math.round(domainAvgRaw._avg.readingScore ?? 0) },
    { domain: 'Writing', 평균: Math.round(domainAvgRaw._avg.writingScore ?? 0) },
  ]

  // ── At-risk students (last graded score < 60) ──
  const studentsWithLatestScore = await prisma.student.findMany({
    where: {
      user: { academyId, isActive: true },
      status: 'ACTIVE',
      testSessions: { some: { status: 'GRADED' } },
    },
    select: {
      id: true,
      currentLevel: true,
      user: { select: { name: true } },
      class: { select: { name: true } },
      testSessions: {
        where: { status: 'GRADED', score: { not: null } },
        select: { score: true, completedAt: true },
        orderBy: { completedAt: 'desc' },
        take: 1,
      },
    },
  })
  const atRiskStudents = studentsWithLatestScore
    .filter((s) => (s.testSessions[0]?.score ?? 100) < 60)
    .slice(0, 6)

  return {
    stats: {
      studentCount,
      attendanceRate,
      testSessionsThisMonth,
      avgScoreThisMonth: avgThisMonth !== null ? Math.round(avgThisMonth) : null,
      avgDelta,
    },
    classChartData,
    monthlyChartData,
    levelChartData,
    domainData,
    recentSessions,
    atRiskStudents,
  }
}

// ─── Helper Components ────────────────────────────────────────────────────────

const SESSION_STATUS_LABEL: Record<string, { label: string; className: string }> = {
  GRADED: { label: '채점완료', className: 'bg-accent-green-light text-accent-green' },
  COMPLETED: { label: '채점대기', className: 'bg-accent-gold-light text-[#B37D00]' },
  IN_PROGRESS: { label: '진행중', className: 'bg-primary-100 text-primary-700' },
}

const TEST_TYPE_LABEL: Record<string, string> = {
  LEVEL_TEST: '레벨테스트',
  UNIT_TEST: '단원평가',
  PRACTICE: '연습테스트',
}

function TrendIcon({ delta }: { delta: number | null }) {
  if (delta === null) return <Minus size={14} className="text-gray-400" />
  if (delta > 0) return <ArrowUpRight size={14} className="text-accent-green" />
  if (delta < 0) return <ArrowDownRight size={14} className="text-accent-red" />
  return <Minus size={14} className="text-gray-400" />
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function OwnerDashboard() {
  const supabase = await createClient()
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()

  if (!authUser) redirect('/login')

  const user = await prisma.user.findUnique({
    where: { id: authUser.id },
    select: { academyId: true, name: true },
  })

  if (!user?.academyId) redirect('/login')

  const {
    stats,
    classChartData,
    monthlyChartData,
    levelChartData,
    domainData,
    recentSessions,
    atRiskStudents,
  } = await getOwnerDashboardData(user.academyId)

  const now = new Date()
  const dateLabel = `${now.getFullYear()}년 ${now.getMonth() + 1}월 ${now.getDate()}일`

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">대시보드</h1>
          <p className="mt-1 text-sm text-gray-500">{dateLabel} 기준 학원 현황</p>
        </div>
      </div>

      {/* ── Stat Cards (4) ── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {/* 전체 학생 */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-100">
                <Users size={18} className="text-primary-700" />
              </div>
              <span className="rounded-full bg-primary-100 px-2 py-0.5 text-xs font-medium text-primary-700">
                활성
              </span>
            </div>
            <p className="mt-3 text-3xl font-bold text-gray-900">
              {stats.studentCount.toLocaleString()}
              <span className="ml-1 text-base font-normal text-gray-500">명</span>
            </p>
            <p className="mt-1 text-sm text-gray-500">전체 학생</p>
          </CardContent>
        </Card>

        {/* 출석률 */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-green-light">
                <BarChart2 size={18} className="text-accent-green" />
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  (stats.attendanceRate ?? 0) >= 80
                    ? 'bg-accent-green-light text-accent-green'
                    : 'bg-accent-red-light text-accent-red'
                }`}
              >
                이번 달
              </span>
            </div>
            <p className="mt-3 text-3xl font-bold text-gray-900">
              {stats.attendanceRate !== null ? stats.attendanceRate : '–'}
              <span className="ml-1 text-base font-normal text-gray-500">%</span>
            </p>
            <p className="mt-1 text-sm text-gray-500">출석률</p>
          </CardContent>
        </Card>

        {/* 테스트 수 */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-gold-light">
                <FileCheck size={18} className="text-[#B37D00]" />
              </div>
              <span className="rounded-full bg-accent-gold-light px-2 py-0.5 text-xs font-medium text-[#B37D00]">
                이번 달
              </span>
            </div>
            <p className="mt-3 text-3xl font-bold text-gray-900">
              {stats.testSessionsThisMonth.toLocaleString()}
              <span className="ml-1 text-base font-normal text-gray-500">회</span>
            </p>
            <p className="mt-1 text-sm text-gray-500">완료된 테스트</p>
          </CardContent>
        </Card>

        {/* 평균 점수 & 변화 */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-purple-light">
                <TrendingUp size={18} className="text-accent-purple" />
              </div>
              {stats.avgDelta !== null && (
                <div
                  className={`flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold ${
                    stats.avgDelta > 0
                      ? 'bg-accent-green-light text-accent-green'
                      : stats.avgDelta < 0
                        ? 'bg-accent-red-light text-accent-red'
                        : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  <TrendIcon delta={stats.avgDelta} />
                  {stats.avgDelta > 0 ? `+${stats.avgDelta}` : stats.avgDelta}점
                </div>
              )}
            </div>
            <p className="mt-3 text-3xl font-bold text-gray-900">
              {stats.avgScoreThisMonth !== null ? stats.avgScoreThisMonth : '–'}
              {stats.avgScoreThisMonth !== null && (
                <span className="ml-1 text-base font-normal text-gray-500">점</span>
              )}
            </p>
            <p className="mt-1 text-sm text-gray-500">이번 달 평균 점수</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Charts (2×2) ── */}
      <OwnerCharts
        classChartData={classChartData}
        monthlyChartData={monthlyChartData}
        levelChartData={levelChartData}
        domainData={domainData}
      />

      {/* ── Recent Test Results & At-Risk Students ── */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {/* 최근 테스트 결과 */}
        <Card className="xl:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileCheck size={16} className="text-primary-700" />
              최근 테스트 결과
            </CardTitle>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            {recentSessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <FileCheck size={32} className="mb-3 text-gray-300" />
                <p className="text-sm text-gray-500">아직 완료된 테스트가 없습니다</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[540px]">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                        학생
                      </th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                        테스트
                      </th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                        점수
                      </th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                        상태
                      </th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                        날짜
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {recentSessions.map((session) => {
                      const statusMeta = SESSION_STATUS_LABEL[session.status] ?? {
                        label: session.status,
                        className: 'bg-gray-100 text-gray-600',
                      }
                      const scoreColor =
                        session.score === null
                          ? 'text-gray-400'
                          : session.score >= 80
                            ? 'text-accent-green'
                            : session.score >= 60
                              ? 'text-[#B37D00]'
                              : 'text-accent-red'
                      return (
                        <tr key={session.id} className="transition-colors hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <div>
                              <p className="text-sm font-medium text-gray-900">
                                {session.student.user.name}
                              </p>
                              {session.student.class?.name && (
                                <p className="text-xs text-gray-500">{session.student.class.name}</p>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div>
                              <p className="line-clamp-1 text-sm text-gray-900">{session.test.title}</p>
                              <p className="text-xs text-gray-500">
                                {TEST_TYPE_LABEL[session.test.type] ?? session.test.type}
                              </p>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-sm font-bold ${scoreColor}`}>
                              {session.score !== null ? `${session.score}점` : '–'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusMeta.className}`}
                            >
                              {statusMeta.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-500">
                            {session.completedAt
                              ? new Date(session.completedAt).toLocaleDateString('ko-KR', {
                                  month: 'short',
                                  day: 'numeric',
                                })
                              : '–'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 주의 학생 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertCircle size={16} className="text-accent-red" />
              주의 학생
              {atRiskStudents.length > 0 && (
                <span className="ml-auto rounded-full bg-accent-red-light px-2 py-0.5 text-xs font-semibold text-accent-red">
                  {atRiskStudents.length}명
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {atRiskStudents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-accent-green-light">
                  <Users size={22} className="text-accent-green" />
                </div>
                <p className="text-sm font-medium text-gray-700">주의 학생 없음</p>
                <p className="mt-1 text-xs text-gray-500">모든 학생이 양호한 성취를 보입니다</p>
              </div>
            ) : (
              <div className="space-y-3">
                {atRiskStudents.map((student) => {
                  const lastScore = student.testSessions[0]?.score ?? 0
                  return (
                    <div
                      key={student.id}
                      className="flex items-center gap-3 rounded-lg border border-gray-100 p-3"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-red-light text-sm font-bold text-accent-red">
                        {student.user.name.charAt(0)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-gray-900">
                          {student.user.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {student.class?.name ?? '반 미배정'} · 레벨 {student.currentLevel}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-accent-red-light px-2 py-0.5 text-xs font-bold text-accent-red">
                        {lastScore}점
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
