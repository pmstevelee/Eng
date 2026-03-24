import { redirect } from 'next/navigation'
import { unstable_cache } from 'next/cache'
import { Users, FileText, ClipboardCheck, Bell, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TeacherTodo } from '@/components/dashboard/teacher-todo'

// ─── Data Fetching ────────────────────────────────────────────────────────────

async function fetchTeacherDashboardData(userId: string, academyId: string) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  const [
    myClasses,
    pendingGradingCount,
    publishedTestCount,
    recentSessions,
    urgentNotifications,
    lowScoreStudentCount,
  ] = await Promise.all([
    // 1. Classes taught by this teacher
    prisma.class.findMany({
      where: { teacherId: userId, isActive: true, academyId },
      select: {
        id: true,
        name: true,
        levelRange: true,
        _count: { select: { students: { where: { status: 'ACTIVE' } } } },
      },
    }),

    // 2. Pending grading (COMPLETED = submitted by student, not yet scored)
    prisma.testSession.count({
      where: {
        test: { createdBy: userId },
        status: 'COMPLETED',
      },
    }),

    // 3. Published tests by this teacher
    prisma.test.count({
      where: {
        createdBy: userId,
        status: 'PUBLISHED',
        isActive: true,
      },
    }),

    // 4. Recent test sessions from teacher's students
    prisma.testSession.findMany({
      where: {
        test: { createdBy: userId },
        status: { in: ['COMPLETED', 'GRADED'] },
      },
      select: {
        id: true,
        score: true,
        status: true,
        completedAt: true,
        student: {
          select: {
            user: { select: { name: true } },
            class: { select: { name: true } },
            currentLevel: true,
          },
        },
        test: { select: { title: true, type: true } },
      },
      orderBy: { completedAt: 'desc' },
      take: 8,
    }),

    // 5. Urgent unread notifications for this teacher
    prisma.notification.findMany({
      where: {
        userId,
        isRead: false,
        type: { in: ['WARNING', 'ERROR'] },
      },
      select: {
        id: true,
        type: true,
        title: true,
        message: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),

    // 6. Count of students with recent low scores (< 60) in teacher's tests
    prisma.testSession.groupBy({
      by: ['studentId'],
      where: {
        test: { createdBy: userId },
        status: 'GRADED',
        score: { lt: 60, not: null },
        completedAt: { gte: thirtyDaysAgo },
      },
      _count: { id: true },
    }).then((r) => r.length),
  ])

  const studentCount = myClasses.reduce((sum, cls) => sum + cls._count.students, 0)
  const classIds = myClasses.map((c) => c.id)

  return {
    myClasses,
    stats: { studentCount, pendingGradingCount, publishedTestCount },
    // Date → string 변환 (unstable_cache JSON 직렬화 대응)
    recentSessions: recentSessions.map((s) => ({
      ...s,
      completedAt: s.completedAt?.toISOString() ?? null,
    })),
    urgentNotifications: urgentNotifications.map((n) => ({
      ...n,
      createdAt: n.createdAt.toISOString(),
    })),
    lowScoreStudentCount,
    classIds,
  }
}

const getCachedTeacherDashboard = (userId: string, academyId: string) =>
  unstable_cache(
    () => fetchTeacherDashboardData(userId, academyId),
    ['teacher-dashboard', userId],
    { revalidate: 60, tags: [`teacher-${userId}-dashboard`] },
  )()

// ─── Helper Components ────────────────────────────────────────────────────────

const SESSION_STATUS_LABEL: Record<string, { label: string; className: string }> = {
  GRADED: { label: '채점완료', className: 'bg-accent-green-light text-accent-green' },
  COMPLETED: { label: '채점대기', className: 'bg-accent-gold-light text-[#B37D00]' },
}

const TEST_TYPE_LABEL: Record<string, string> = {
  LEVEL_TEST: '레벨테스트',
  UNIT_TEST: '단원평가',
  PRACTICE: '연습테스트',
}

const NOTIFICATION_ICON: Record<string, React.ReactNode> = {
  WARNING: <AlertTriangle size={15} className="text-[#B37D00]" />,
  ERROR: <AlertTriangle size={15} className="text-accent-red" />,
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function TeacherDashboard() {
  // layout에서 이미 호출됨 → cache()로 즉시 반환 (네트워크 없음)
  const user = await getCurrentUser()
  if (!user || user.role !== 'TEACHER' || !user.academyId) redirect('/login')

  const { stats, myClasses, recentSessions, urgentNotifications, lowScoreStudentCount } =
    await getCachedTeacherDashboard(user.id, user.academyId)

  const now = new Date()
  const dateLabel = `${now.getFullYear()}년 ${now.getMonth() + 1}월 ${now.getDate()}일`

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">대시보드</h1>
        <p className="mt-1 text-sm text-gray-500">{dateLabel} · 안녕하세요, {user.name} 선생님</p>
      </div>

      {/* ── Stat Cards (3) ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* 담당 학생 */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-100">
                <Users size={18} className="text-primary-700" />
              </div>
              {myClasses.length > 0 && (
                <span className="rounded-full bg-primary-100 px-2 py-0.5 text-xs font-medium text-primary-700">
                  {myClasses.length}개 반
                </span>
              )}
            </div>
            <p className="mt-3 text-3xl font-bold text-gray-900">
              {stats.studentCount}
              <span className="ml-1 text-base font-normal text-gray-500">명</span>
            </p>
            <p className="mt-1 text-sm text-gray-500">담당 학생</p>
          </CardContent>
        </Card>

        {/* 출제한 테스트 */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-gold-light">
                <FileText size={18} className="text-[#B37D00]" />
              </div>
              <span className="rounded-full bg-accent-gold-light px-2 py-0.5 text-xs font-medium text-[#B37D00]">
                활성
              </span>
            </div>
            <p className="mt-3 text-3xl font-bold text-gray-900">
              {stats.publishedTestCount}
              <span className="ml-1 text-base font-normal text-gray-500">개</span>
            </p>
            <p className="mt-1 text-sm text-gray-500">배포된 테스트</p>
          </CardContent>
        </Card>

        {/* 채점 대기 */}
        <Card className={stats.pendingGradingCount > 0 ? 'border-accent-gold' : ''}>
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                  stats.pendingGradingCount > 0 ? 'bg-accent-red-light' : 'bg-gray-100'
                }`}
              >
                <ClipboardCheck
                  size={18}
                  className={stats.pendingGradingCount > 0 ? 'text-accent-red' : 'text-gray-500'}
                />
              </div>
              {stats.pendingGradingCount > 0 && (
                <span className="rounded-full bg-accent-red-light px-2 py-0.5 text-xs font-semibold text-accent-red">
                  필요
                </span>
              )}
            </div>
            <p className="mt-3 text-3xl font-bold text-gray-900">
              {stats.pendingGradingCount}
              <span className="ml-1 text-base font-normal text-gray-500">건</span>
            </p>
            <p className="mt-1 text-sm text-gray-500">채점 대기</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Urgent Notifications ── */}
      {urgentNotifications.length > 0 && (
        <Card className="border-accent-gold bg-accent-gold-light">
          <CardHeader className="pb-3 pt-4">
            <CardTitle className="flex items-center gap-2 text-base text-gray-900">
              <Bell size={16} className="text-[#B37D00]" />
              긴급 알림
              <span className="ml-auto rounded-full bg-[#FFB100] px-2 py-0.5 text-xs font-bold text-white">
                {urgentNotifications.length}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <div className="space-y-2">
              {urgentNotifications.map((n) => (
                <div key={n.id} className="flex items-start gap-2.5 rounded-lg bg-white p-3 shadow-sm">
                  <span className="mt-0.5 shrink-0">
                    {NOTIFICATION_ICON[n.type] ?? <Bell size={15} className="text-gray-500" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900">{n.title}</p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-gray-600">{n.message}</p>
                  </div>
                  <span className="shrink-0 text-xs text-gray-400">
                    {new Date(n.createdAt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Recent Results + Todo ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* 최근 테스트 결과 */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardCheck size={16} className="text-primary-700" />
              최근 테스트 결과
            </CardTitle>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            {recentSessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <CheckCircle2 size={32} className="mb-3 text-gray-300" />
                <p className="text-sm text-gray-500">아직 제출된 테스트가 없습니다</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px]">
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
                            <div className="flex items-center gap-2.5">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-700">
                                {session.student.user.name.charAt(0)}
                              </div>
                              <div>
                                <p className="text-sm font-medium text-gray-900">
                                  {session.student.user.name}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {session.student.class?.name ?? '반 미배정'}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <p className="line-clamp-1 text-sm text-gray-900">{session.test.title}</p>
                            <p className="text-xs text-gray-500">
                              {TEST_TYPE_LABEL[session.test.type] ?? session.test.type}
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-sm font-bold ${scoreColor}`}>
                              {session.score !== null ? `${session.score}점` : '채점 전'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusMeta.className}`}
                            >
                              {statusMeta.label}
                            </span>
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

        {/* 할일 체크리스트 */}
        <TeacherTodo
          pendingGradingCount={stats.pendingGradingCount}
          publishedTestCount={stats.publishedTestCount}
          lowScoreStudentCount={lowScoreStudentCount}
        />
      </div>

      {/* ── My Classes ── */}
      {myClasses.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users size={16} className="text-primary-700" />
              담당 반 현황
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {myClasses.map((cls) => (
                <div
                  key={cls.id}
                  className="rounded-xl border border-gray-200 p-4 transition-colors hover:border-primary-700 hover:bg-primary-100"
                >
                  <p className="font-semibold text-gray-900">{cls.name}</p>
                  {cls.levelRange && (
                    <p className="mt-0.5 text-xs text-gray-500">레벨 {cls.levelRange}</p>
                  )}
                  <p className="mt-2 text-2xl font-bold text-primary-700">
                    {cls._count.students}
                    <span className="ml-0.5 text-sm font-normal text-gray-500">명</span>
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
