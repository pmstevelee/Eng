import { redirect } from 'next/navigation'
import { unstable_cache } from 'next/cache'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma/client'
import { AnalyticsClient } from './_components/analytics-client'
import type { AnalyticsData } from './_components/analytics-client'
import type { ClassTrendItem } from './_components/analytics-charts'

// ─── Date Helpers ─────────────────────────────────────────────────────────────

function getPeriodDates(period: string): { from: Date; to: Date } {
  const now = new Date()
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)

  switch (period) {
    case 'this-month':
      return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: todayEnd }
    case 'last-month':
      return {
        from: new Date(now.getFullYear(), now.getMonth() - 1, 1),
        to: new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59),
      }
    case '6-months':
      return { from: new Date(now.getFullYear(), now.getMonth() - 5, 1), to: todayEnd }
    case '3-months':
    default:
      return { from: new Date(now.getFullYear(), now.getMonth() - 2, 1), to: todayEnd }
  }
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function avg(nums: number[]): number | null {
  if (nums.length === 0) return null
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length)
}

function median(nums: number[]): number | null {
  if (nums.length === 0) return null
  const sorted = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : Math.round((sorted[mid - 1] + sorted[mid]) / 2)
}

// ─── Data Fetching ────────────────────────────────────────────────────────────

async function getAnalyticsData(academyId: string, fromDate: Date, toDate: Date): Promise<AnalyticsData> {
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1)

  // ── Parallel fetch (3개 배치로 분리 — connection_limit=3 대응) ──────────────
  // Batch 1: 핵심 성적/레벨 데이터
  const [gradedSessions, levelDistRaw, levelUpBadges] = await Promise.all([
    // 1. All graded sessions in period (for score analysis)
    prisma.testSession.findMany({
      where: {
        student: { user: { academyId } },
        status: 'GRADED',
        score: { not: null },
        completedAt: { gte: fromDate, lte: toDate },
      },
      select: {
        score: true,
        grammarScore: true,
        vocabularyScore: true,
        readingScore: true,
        writingScore: true,
        completedAt: true,
        student: {
          select: {
            currentLevel: true,
            class: { select: { name: true } },
          },
        },
      },
    }),

    // 2. Level distribution (active students)
    prisma.student.groupBy({
      by: ['currentLevel'],
      where: { user: { academyId, isActive: true }, status: 'ACTIVE' },
      _count: { id: true },
      orderBy: { currentLevel: 'asc' },
    }),

    // 3. Level-up badge earners this month
    prisma.badgeEarning.findMany({
      where: {
        student: { user: { academyId } },
        badge: { code: 'LEVEL_UP' },
        earnedAt: { gte: startOfMonth },
      },
      select: {
        student: {
          select: {
            currentLevel: true,
            user: { select: { name: true } },
            class: { select: { name: true } },
          },
        },
      },
      take: 20,
    }),
  ])

  // Batch 2: 트렌드/반/교사 데이터
  const [monthlySessionsRaw, classesWithData, teachersRaw] = await Promise.all([
    // 4. Monthly sessions (last 6 months, for trend charts)
    prisma.testSession.findMany({
      where: {
        student: { user: { academyId } },
        status: 'GRADED',
        score: { not: null },
        completedAt: { gte: sixMonthsAgo },
      },
      select: {
        score: true,
        completedAt: true,
        student: { select: { class: { select: { name: true } } } },
      },
    }),

    // 5. Classes with students, test sessions & attendance
    prisma.class.findMany({
      where: { academyId, isActive: true },
      select: {
        id: true,
        name: true,
        students: {
          where: { status: 'ACTIVE' },
          select: {
            testSessions: {
              where: {
                status: 'GRADED',
                score: { not: null },
                completedAt: { gte: fromDate, lte: toDate },
              },
              select: {
                score: true,
                grammarScore: true,
                vocabularyScore: true,
                readingScore: true,
                writingScore: true,
                completedAt: true,
              },
              orderBy: { completedAt: 'asc' },
            },
            attendance: {
              where: { date: { gte: fromDate, lte: toDate } },
              select: { status: true },
            },
          },
        },
      },
    }),

    // 6. Teachers with their classes & activity
    prisma.user.findMany({
      where: { academyId, role: 'TEACHER', isActive: true, isDeleted: false },
      select: {
        id: true,
        name: true,
        taughtClasses: {
          where: { isActive: true },
          select: {
            students: {
              where: { status: 'ACTIVE' },
              select: {
                testSessions: {
                  where: {
                    status: 'GRADED',
                    score: { not: null },
                    completedAt: { gte: fromDate, lte: toDate },
                  },
                  select: { score: true, completedAt: true },
                  orderBy: { completedAt: 'asc' },
                },
              },
            },
          },
        },
        createdTests: {
          where: { createdAt: { gte: fromDate, lte: toDate } },
          select: { id: true },
        },
        writtenComments: {
          where: { createdAt: { gte: fromDate, lte: toDate } },
          select: { id: true },
        },
      },
    }),
  ])

  // Batch 3: 출석/학생 현황 데이터 + 카운트
  const [attendanceRaw, newStudentsRaw, withdrawnRaw, totalActiveStudents] = await Promise.all([
    // 7. Attendance raw (for heatmap + weekday)
    prisma.attendance.findMany({
      where: {
        student: { user: { academyId } },
        date: { gte: fromDate, lte: toDate },
      },
      select: {
        date: true,
        status: true,
        studentId: true,
        student: {
          select: {
            user: { select: { name: true } },
            class: { select: { name: true } },
          },
        },
      },
    }),

    // 8. New students (last 6 months)
    prisma.user.findMany({
      where: {
        academyId,
        role: 'STUDENT',
        isDeleted: false,
        createdAt: { gte: sixMonthsAgo },
      },
      select: { createdAt: true },
    }),

    // 9. Withdrawn students (last 6 months)
    prisma.student.findMany({
      where: {
        user: { academyId },
        status: 'WITHDRAWN',
        updatedAt: { gte: sixMonthsAgo },
      },
      select: { updatedAt: true },
    }),

    // 10. Active student count
    prisma.student.count({
      where: { user: { academyId, isActive: true }, status: 'ACTIVE' },
    }),
  ])

  // ── TAB 1: Score Analysis ──────────────────────────────────────────────────

  const allScores = gradedSessions.map((s) => s.score as number)
  const scoreHistogram = [
    { range: '0~20', count: allScores.filter((s) => s <= 20).length },
    { range: '21~40', count: allScores.filter((s) => s >= 21 && s <= 40).length },
    { range: '41~60', count: allScores.filter((s) => s >= 41 && s <= 60).length },
    { range: '61~80', count: allScores.filter((s) => s >= 61 && s <= 80).length },
    { range: '81~100', count: allScores.filter((s) => s >= 81).length },
  ]
  const scoreStats = {
    avg: avg(allScores),
    median: median(allScores),
    max: allScores.length > 0 ? Math.max(...allScores) : null,
    min: allScores.length > 0 ? Math.min(...allScores) : null,
    total: allScores.length,
  }

  // Level distribution
  const levelDistribution = levelDistRaw.map((l) => ({
    level: `레벨 ${l.currentLevel}`,
    count: l._count.id,
  }))

  // Level avg scores (from graded sessions)
  const levelScoreMap: Record<number, number[]> = {}
  gradedSessions.forEach((s) => {
    const lvl = s.student.currentLevel
    if (!levelScoreMap[lvl]) levelScoreMap[lvl] = []
    levelScoreMap[lvl].push(s.score as number)
  })
  const levelAvgScores = Object.entries(levelScoreMap)
    .map(([lvl, scores]) => ({
      level: `레벨 ${lvl}`,
      avgScore: avg(scores) ?? 0,
    }))
    .sort((a, b) => parseInt(a.level.split(' ')[1]) - parseInt(b.level.split(' ')[1]))

  // Level-up students
  const levelUpStudents = levelUpBadges.map((b) => ({
    name: b.student.user.name,
    className: b.student.class?.name ?? '반 미배정',
    level: b.student.currentLevel,
  }))

  // Domain averages
  const domainScores = {
    Grammar: gradedSessions.map((s) => s.grammarScore).filter((v): v is number => v !== null),
    Vocabulary: gradedSessions.map((s) => s.vocabularyScore).filter((v): v is number => v !== null),
    Reading: gradedSessions.map((s) => s.readingScore).filter((v): v is number => v !== null),
    Writing: gradedSessions.map((s) => s.writingScore).filter((v): v is number => v !== null),
  }
  const domainAvgs = Object.entries(domainScores).map(([domain, scores]) => ({
    domain,
    avg: avg(scores) ?? 0,
  }))
  const weakestDomain =
    domainAvgs.some((d) => d.avg > 0)
      ? domainAvgs.reduce((a, b) => (a.avg <= b.avg ? a : b)).domain
      : null

  // Monthly trend (last 6 months)
  const monthKeys: string[] = []
  for (let i = 5; i >= 0; i--) {
    monthKeys.push(monthKey(new Date(now.getFullYear(), now.getMonth() - i, 1)))
  }
  const monthScoreMap: Record<string, number[]> = {}
  monthKeys.forEach((k) => (monthScoreMap[k] = []))
  monthlySessionsRaw.forEach((s) => {
    if (!s.completedAt) return
    const k = monthKey(s.completedAt)
    if (k in monthScoreMap) monthScoreMap[k].push(s.score as number)
  })
  const monthlyTrend = monthKeys.map((k) => ({
    month: `${parseInt(k.split('-')[1])}월`,
    avg: avg(monthScoreMap[k]),
  }))

  // Class monthly trend (last 6 months)
  const classNames = classesWithData.map((c) => c.name)
  const classByMonth: Record<string, Record<string, number[]>> = {}
  monthKeys.forEach((k) => {
    classByMonth[k] = {}
    classNames.forEach((cn) => (classByMonth[k][cn] = []))
  })
  monthlySessionsRaw.forEach((s) => {
    if (!s.completedAt || !s.student.class) return
    const k = monthKey(s.completedAt)
    if (k in classByMonth && s.student.class.name in classByMonth[k]) {
      classByMonth[k][s.student.class.name].push(s.score as number)
    }
  })
  const classTrendData: ClassTrendItem[] = monthKeys.map((k) => {
    const row: ClassTrendItem = { month: `${parseInt(k.split('-')[1])}월` }
    classNames.forEach((cn) => {
      const scores = classByMonth[k][cn]
      row[cn] = scores.length > 0 ? (avg(scores) ?? null) : null
    })
    return row
  })

  // ── TAB 2: Class Comparison ───────────────────────────────────────────────

  const classComparison = classesWithData.map((cls) => {
    const allSessions = cls.students.flatMap((s) => s.testSessions)
    const scores = allSessions.map((s) => s.score as number)
    const avgScore = avg(scores)

    // Growth rate: compare first half vs second half
    const sorted = [...allSessions].sort((a, b) =>
      (a.completedAt?.getTime() ?? 0) - (b.completedAt?.getTime() ?? 0),
    )
    const half = Math.floor(sorted.length / 2)
    const firstHalfScores = sorted.slice(0, half).map((s) => s.score as number)
    const secondHalfScores = sorted.slice(half).map((s) => s.score as number)
    const firstAvg = avg(firstHalfScores)
    const secondAvg = avg(secondHalfScores)
    const growthRate =
      firstAvg !== null && secondAvg !== null && firstHalfScores.length > 0 && secondHalfScores.length > 0
        ? secondAvg - firstAvg
        : null

    // Attendance rate
    const allAttendance = cls.students.flatMap((s) => s.attendance)
    const presentCount = allAttendance.filter((a) => a.status === 'PRESENT').length
    const attendanceRate = allAttendance.length > 0
      ? Math.round((presentCount / allAttendance.length) * 100)
      : null

    return {
      id: cls.id,
      name: cls.name,
      studentCount: cls.students.length,
      avgScore,
      growthRate,
      attendanceRate,
    }
  })

  const classDomainData = classesWithData.map((cls) => {
    const sessions = cls.students.flatMap((s) => s.testSessions)
    const g = sessions.map((s) => s.grammarScore).filter((v): v is number => v !== null)
    const v = sessions.map((s) => s.vocabularyScore).filter((v2): v2 is number => v2 !== null)
    const r = sessions.map((s) => s.readingScore).filter((v3): v3 is number => v3 !== null)
    const w = sessions.map((s) => s.writingScore).filter((v4): v4 is number => v4 !== null)
    return {
      name: cls.name,
      Grammar: avg(g) ?? 0,
      Vocabulary: avg(v) ?? 0,
      Reading: avg(r) ?? 0,
      Writing: avg(w) ?? 0,
    }
  })

  // ── TAB 3: Teacher Performance ────────────────────────────────────────────

  const teacherPerformance = teachersRaw.map((teacher) => {
    const allStudentSessions = teacher.taughtClasses.flatMap((cls) =>
      cls.students.flatMap((s) => s.testSessions),
    )
    const scores = allStudentSessions.map((s) => s.score as number)
    const avgScore = avg(scores)
    const studentCount = teacher.taughtClasses.flatMap((cls) => cls.students).length

    // Improvement rate: first vs last score per student (across all students)
    const improvements: number[] = []
    teacher.taughtClasses.forEach((cls) => {
      cls.students.forEach((student) => {
        const sorted = [...student.testSessions].sort(
          (a, b) => (a.completedAt?.getTime() ?? 0) - (b.completedAt?.getTime() ?? 0),
        )
        if (sorted.length >= 2) {
          const first = sorted[0].score as number
          const last = sorted[sorted.length - 1].score as number
          improvements.push(last - first)
        }
      })
    })
    const improvementRate = avg(improvements)

    return {
      id: teacher.id,
      name: teacher.name,
      studentCount,
      avgScore,
      testCount: teacher.createdTests.length,
      commentCount: teacher.writtenComments.length,
      improvementRate,
    }
  })

  const teacherActivityData = teachersRaw.map((t) => ({
    name: t.name,
    tests: t.createdTests.length,
    comments: t.writtenComments.length,
  }))

  // ── TAB 4: Attendance Analysis ────────────────────────────────────────────

  // Daily attendance rates
  const dailyMap: Record<string, { present: number; total: number }> = {}
  attendanceRaw.forEach((a) => {
    const dateStr = a.date.toISOString().split('T')[0]
    if (!dailyMap[dateStr]) dailyMap[dateStr] = { present: 0, total: 0 }
    dailyMap[dateStr].total++
    if (a.status === 'PRESENT') dailyMap[dateStr].present++
  })
  const dailyAttendance = Object.entries(dailyMap)
    .map(([date, { present, total }]) => ({
      date,
      rate: total > 0 ? present / total : 0,
      present,
      total,
    }))
    .sort((a, b) => a.date.localeCompare(b.date))

  // Weekday averages (0=Sun ... 6=Sat)
  const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']
  const weekdayMap: Record<number, number[]> = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] }
  attendanceRaw.forEach((a) => {
    const dow = a.date.getDay()
    const isPresent = a.status === 'PRESENT' ? 1 : 0
    weekdayMap[dow].push(isPresent)
  })
  const weekdayAvgs = WEEKDAY_LABELS.map((day, i) => {
    const vals = weekdayMap[i]
    const rate = vals.length > 0 ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) : 0
    return { day, avg: rate }
  }).filter((d) => d.avg > 0 || weekdayMap[WEEKDAY_LABELS.indexOf(d.day)].length > 0)

  // Absent top 10
  type StudentAttendanceSummary = { name: string; className: string; absentCount: number; total: number }
  const studentAttMap: Record<string, StudentAttendanceSummary> = {}
  attendanceRaw.forEach((a) => {
    const id = a.studentId
    if (!studentAttMap[id]) {
      studentAttMap[id] = {
        name: a.student.user.name,
        className: a.student.class?.name ?? '반 미배정',
        absentCount: 0,
        total: 0,
      }
    }
    studentAttMap[id].total++
    if (a.status === 'ABSENT') studentAttMap[id].absentCount++
  })
  const absentTop10 = Object.values(studentAttMap)
    .filter((s) => s.absentCount > 0)
    .sort((a, b) => b.absentCount - a.absentCount)
    .slice(0, 10)
    .map((s) => ({
      name: s.name,
      className: s.className,
      absentCount: s.absentCount,
      rate: s.total > 0 ? (s.total - s.absentCount) / s.total : 0,
    }))

  // ── TAB 5: Revenue Analysis ───────────────────────────────────────────────

  const monthlyEnrollmentMap: Record<string, { newStudents: number; withdrawn: number }> = {}
  monthKeys.forEach((k) => (monthlyEnrollmentMap[k] = { newStudents: 0, withdrawn: 0 }))

  newStudentsRaw.forEach((u) => {
    const k = monthKey(u.createdAt)
    if (k in monthlyEnrollmentMap) monthlyEnrollmentMap[k].newStudents++
  })
  withdrawnRaw.forEach((s) => {
    const k = monthKey(s.updatedAt)
    if (k in monthlyEnrollmentMap) monthlyEnrollmentMap[k].withdrawn++
  })
  const monthlyEnrollments = monthKeys.map((k) => ({
    month: `${parseInt(k.split('-')[1])}월`,
    newStudents: monthlyEnrollmentMap[k].newStudents,
    withdrawn: monthlyEnrollmentMap[k].withdrawn,
  }))

  return {
    scoreHistogram,
    scoreStats,
    levelDistribution,
    levelAvgScores,
    levelUpStudents,
    domainAvgs,
    weakestDomain,
    monthlyTrend,
    classTrendNames: classNames,
    classTrendData,
    classComparison,
    classDomainData,
    teacherPerformance,
    teacherActivityData,
    dailyAttendance,
    weekdayAvgs,
    absentTop10,
    monthlyEnrollments,
    totalActiveStudents,
  }
}

// ─── Cached Wrapper (period별 독립 캐시, 60초 TTL) ────────────────────────────

function getCachedAnalyticsData(academyId: string, period: string) {
  const { from, to } = getPeriodDates(period)
  return unstable_cache(
    () => getAnalyticsData(academyId, from, to),
    ['owner-analytics', academyId, period],
    { revalidate: 60 },
  )()
}

// ─── Page ─────────────────────────────────────────────────────────────────────

interface PageProps {
  searchParams: {
    period?: string
    tab?: string
  }
}

export default async function AnalyticsPage({ searchParams }: PageProps) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ACADEMY_OWNER' || !user.academyId) redirect('/login')

  const period = searchParams.period ?? '3-months'
  const activeTab = searchParams.tab ?? 'scores'

  const data = await getCachedAnalyticsData(user.academyId, period)

  return (
    <AnalyticsClient
      data={data}
      period={period}
      activeTab={activeTab}
    />
  )
}
