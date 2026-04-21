import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  Clock,
  Users,
  ClipboardCheck,
  FileText,
  ChevronLeft,
  CalendarDays,
  AlertCircle,
} from 'lucide-react'
import { unstable_cache } from 'next/cache'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { TodayTodoList } from './_components/today-client'
import { parseScheduleJson, CLASS_COLORS, TEST_TYPE_LABELS } from '../_components/types'

// ─── 데이터 패칭 ──────────────────────────────────────────────────────────────
async function getTodayData(userId: string, academyId: string) {
  const todayJs = new Date() // JS getDay() 기준 (0=일, 1=월 ...)
  const todayDow = todayJs.getDay()

  const todayStart = new Date(todayJs)
  todayStart.setHours(0, 0, 0, 0)
  const todayEnd = new Date(todayJs)
  todayEnd.setHours(23, 59, 59, 999)

  const [myClasses, publishedTests, pendingGrading] = await Promise.all([
    // 담당 반 + 학생 수
    prisma.class.findMany({
      where: { teacherId: userId, isActive: true, academyId },
      select: {
        id: true,
        name: true,
        levelRange: true,
        scheduleJson: true,
        _count: { select: { students: { where: { status: 'ACTIVE' } } } },
      },
      orderBy: { name: 'asc' },
    }),

    // 배포 중 테스트
    prisma.test.findMany({
      where: { createdBy: userId, status: 'PUBLISHED', isActive: true },
      select: {
        id: true,
        title: true,
        type: true,
        classId: true,
        createdAt: true,
        class: { select: { name: true } },
        testSessions: {
          where: { status: { in: ['COMPLETED', 'GRADED'] } },
          select: { id: true, status: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),

    // 채점 대기 목록 (상위 5건)
    prisma.testSession.findMany({
      where: { test: { createdBy: userId }, status: 'COMPLETED' },
      select: {
        id: true,
        student: { select: { user: { select: { name: true } } } },
        test: { select: { id: true, title: true, type: true } },
        completedAt: true,
      },
      orderBy: { completedAt: 'desc' },
      take: 5,
    }),
  ])

  // 오늘 수업이 있는 반 (schedule_json에서 today DOW 기준 필터)
  const todayClasses = myClasses
    .map((cls) => {
      const slots = parseScheduleJson(cls.scheduleJson)
      const todaySlots = slots.filter((s) => s.day === todayDow)
      return { cls, slots: todaySlots }
    })
    .filter((item) => item.slots.length > 0)
    .flatMap(({ cls, slots }) =>
      slots.map((slot) => ({
        classId: cls.id,
        className: cls.name,
        levelRange: cls.levelRange,
        studentCount: cls._count.students,
        startTime: slot.startTime,
        endTime: slot.endTime,
        room: slot.room,
      })),
    )
    .sort((a, b) => a.startTime.localeCompare(b.startTime))

  const pendingCount = await prisma.testSession.count({
    where: { test: { createdBy: userId }, status: 'COMPLETED' },
  })

  return {
    todayClasses,
    publishedTests: publishedTests.map((t) => ({
      id: t.id,
      title: t.title,
      type: t.type as string,
      className: t.class?.name ?? null,
      createdAt: t.createdAt.toISOString(),
      submittedCount: t.testSessions.length,
      gradedCount: t.testSessions.filter((s) => s.status === 'GRADED').length,
    })),
    pendingGrading: pendingGrading.map((s) => ({
      id: s.id,
      studentName: s.student.user.name,
      testId: s.test.id,
      testTitle: s.test.title,
      testType: s.test.type as string,
      completedAt: s.completedAt?.toISOString() ?? null,
    })),
    pendingCount,
  }
}

// ─── 도우미 ───────────────────────────────────────────────────────────────────
function formatToday() {
  const d = new Date()
  const days = ['일', '월', '화', '수', '목', '금', '토']
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${days[d.getDay()]})`
}

const getCachedTodayData = (userId: string, academyId: string) =>
  unstable_cache(
    () => getTodayData(userId, academyId),
    [`teacher-today-${userId}`],
    { revalidate: 60, tags: [`teacher-${userId}-schedule`] },
  )()

// ─── 페이지 ───────────────────────────────────────────────────────────────────
export default async function TodayPage() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'TEACHER' || !user.academyId) redirect('/login')

  const { todayClasses, publishedTests, pendingGrading, pendingCount } =
    await getCachedTodayData(user.id, user.academyId)

  return (
    <div className="space-y-5">
      {/* ── 헤더 ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Link href="/teacher/schedule">
              <button className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
                <ChevronLeft size={14} />
                일정
              </button>
            </Link>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-900">오늘 할 일</h1>
          <p className="mt-0.5 text-sm text-gray-500">{formatToday()}</p>
        </div>
        <Link href="/teacher/schedule">
          <Button variant="outline" size="sm" className="gap-1.5">
            <CalendarDays size={14} />
            전체 일정
          </Button>
        </Link>
      </div>

      {/* ── 요약 카드 3개 ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-100">
                <Clock size={17} className="text-primary-700" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{todayClasses.length}</p>
                <p className="text-xs text-gray-500">오늘 수업</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-gold-light">
                <FileText size={17} className="text-[#B37D00]" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{publishedTests.length}</p>
                <p className="text-xs text-gray-500">배포 중 테스트</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={pendingCount > 0 ? 'border-accent-red' : ''}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                  pendingCount > 0 ? 'bg-accent-red-light' : 'bg-gray-100'
                }`}
              >
                <ClipboardCheck
                  size={17}
                  className={pendingCount > 0 ? 'text-accent-red' : 'text-gray-500'}
                />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{pendingCount}</p>
                <p className="text-xs text-gray-500">채점 대기</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* ── 오늘 수업 목록 ── */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock size={16} className="text-primary-700" />
                오늘의 수업
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {todayClasses.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <CalendarDays size={28} className="mb-2 text-gray-300" />
                  <p className="text-sm text-gray-500">오늘 예정된 수업이 없습니다</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {todayClasses.map((cls, idx) => {
                    const color = CLASS_COLORS[idx % CLASS_COLORS.length]
                    return (
                      <div
                        key={`${cls.classId}-${cls.startTime}`}
                        className="flex items-center gap-3 rounded-xl border border-gray-200 p-3 hover:border-gray-300 transition-colors"
                      >
                        {/* 색상 바 */}
                        <div
                          className="h-10 w-1 shrink-0 rounded-full"
                          style={{ backgroundColor: color.bg }}
                        />
                        {/* 시간 */}
                        <div className="w-16 shrink-0">
                          <p className="text-sm font-bold text-gray-900">{cls.startTime}</p>
                          <p className="text-xs text-gray-400">{cls.endTime}</p>
                        </div>
                        {/* 반 정보 */}
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-gray-900 truncate">{cls.className}</p>
                          {cls.levelRange && (
                            <p className="text-xs text-gray-500">레벨 {cls.levelRange}</p>
                          )}
                        </div>
                        {/* 학생 수 + 교실 */}
                        <div className="shrink-0 text-right">
                          <div className="flex items-center gap-1 justify-end">
                            <Users size={12} className="text-gray-400" />
                            <span className="text-sm font-medium text-gray-700">
                              {cls.studentCount}명
                            </span>
                          </div>
                          {cls.room && (
                            <p className="text-xs text-gray-400">{cls.room}</p>
                          )}
                        </div>
                        {/* 바로가기 */}
                        <Link href={`/teacher/students?classId=${cls.classId}`}>
                          <button className="shrink-0 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                            보기
                          </button>
                        </Link>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── 배포 중 테스트 ── */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText size={16} className="text-[#B37D00]" />
                배포 중 테스트
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {publishedTests.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <FileText size={28} className="mb-2 text-gray-300" />
                  <p className="text-sm text-gray-500">배포 중인 테스트가 없습니다</p>
                  <Link href="/teacher/tests/new">
                    <button className="mt-3 rounded-lg bg-primary-700 px-4 py-2 text-sm font-medium text-white hover:bg-primary-800 transition-colors">
                      테스트 출제
                    </button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-2">
                  {publishedTests.map((test) => (
                    <div
                      key={test.id}
                      className="flex items-center gap-3 rounded-xl border border-gray-200 p-3"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-gold-light text-base">
                        📝
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-gray-900 truncate">{test.title}</p>
                        <p className="text-xs text-gray-500">
                          {TEST_TYPE_LABELS[test.type] ?? test.type}
                          {test.className ? ` · ${test.className}` : ''}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-semibold text-gray-900">
                          {test.submittedCount}명
                        </p>
                        <p className="text-xs text-gray-400">제출</p>
                      </div>
                      <Link href={`/teacher/tests/${test.id}/grade`}>
                        <button className="shrink-0 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                          채점
                        </button>
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── 채점 대기 ── */}
          {pendingCount > 0 && (
            <Card className="border-accent-red">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between text-base">
                  <div className="flex items-center gap-2">
                    <AlertCircle size={16} className="text-accent-red" />
                    채점 대기
                  </div>
                  <span className="rounded-full bg-accent-red-light px-2.5 py-0.5 text-xs font-bold text-accent-red">
                    {pendingCount}건
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="space-y-2">
                  {pendingGrading.map((session) => (
                    <div
                      key={session.id}
                      className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 p-3"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-red-light text-sm font-bold text-accent-red">
                        {session.studentName.charAt(0)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-gray-900">{session.studentName}</p>
                        <p className="text-xs text-gray-500 truncate">{session.testTitle}</p>
                      </div>
                      {session.completedAt && (
                        <span className="shrink-0 text-xs text-gray-400">
                          {new Date(session.completedAt).toLocaleDateString('ko-KR', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      )}
                      <Link href={`/teacher/tests/${session.testId}/grade`}>
                        <button className="shrink-0 rounded-lg bg-accent-red px-2.5 py-1.5 text-xs font-medium text-white hover:opacity-90 transition-opacity">
                          채점
                        </button>
                      </Link>
                    </div>
                  ))}
                  {pendingCount > 5 && (
                    <Link href="/teacher/tests">
                      <button className="w-full rounded-xl border border-dashed border-gray-200 py-2.5 text-sm font-medium text-gray-500 hover:bg-gray-50 transition-colors">
                        나머지 {pendingCount - 5}건 더 보기
                      </button>
                    </Link>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* ── 오늘의 Todo ── */}
        <div>
          <Card className="h-fit">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <ClipboardCheck size={16} className="text-accent-green" />
                오늘의 할 일
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <TodayTodoList userId={user.id} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
