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

  // ── Phase 1: 학원의 활성 학생/반/교사 기본 목록 (다른 쿼리들의 기반) ─────
  const [allClasses, allTeachers, activeStudents] = await Promise.all([
    prisma.class.findMany({
      where: { academyId, isActive: true },
      select: { id: true, name: true, teacherId: true },
    }),
    prisma.user.findMany({
      where: { academyId, role: 'TEACHER', isActive: true, isDeleted: false },
      select: { id: true, name: true },
    }),
    prisma.student.findMany({
      where: { user: { academyId, isActive: true }, status: 'ACTIVE' },
      select: { id: true, classId: true, currentLevel: true, userId: true },
    }),
  ])

  const classIds = allClasses.map((c) => c.id)
  const studentIds = activeStudents.map((s) => s.id)
  const teacherIds = allTeachers.map((t) => t.id)
  const classNameById: Record<string, string> = {}
  allClasses.forEach((c) => (classNameById[c.id] = c.name))
  const studentById: Record<string, { classId: string | null; currentLevel: number }> = {}
  activeStudents.forEach((s) => (studentById[s.id] = { classId: s.classId, currentLevel: s.currentLevel }))
  const userIdToStudentId: Record<string, string> = {}
  activeStudents.forEach((s) => (userIdToStudentId[s.userId] = s.id))

  // ── Phase 2: 세션·출석·배지 데이터를 병렬 로드 (전부 평탄한 쿼리) ──────
  const [
    gradedSessions,
    monthlySessions,
    levelUpBadges,
    attendanceRaw,
    newStudentsRaw,
    withdrawnRaw,
    nearPromotionStudents,
    testCountsByTeacher,
    commentCountsByTeacher,
  ] = await Promise.all([
    // 기간내 GRADED 세션 — 학생의 반/레벨은 studentId로 메모리 조인
    prisma.testSession.findMany({
      where: {
        studentId: { in: studentIds },
        status: 'GRADED',
        score: { not: null },
        completedAt: { gte: fromDate, lte: toDate },
      },
      select: {
        studentId: true,
        score: true,
        grammarScore: true,
        vocabularyScore: true,
        readingScore: true,
        listeningScore: true,
        writingScore: true,
        completedAt: true,
      },
    }),

    // 최근 6개월 월별 트렌드용 — 필드 최소화
    prisma.testSession.findMany({
      where: {
        studentId: { in: studentIds },
        status: 'GRADED',
        score: { not: null },
        completedAt: { gte: sixMonthsAgo },
      },
      select: { studentId: true, score: true, completedAt: true },
    }),

    // 이번 달 레벨업 배지 (소량)
    prisma.badgeEarning.findMany({
      where: {
        studentId: { in: studentIds },
        badge: { code: 'LEVEL_UP' },
        earnedAt: { gte: startOfMonth },
      },
      select: {
        studentId: true,
        student: {
          select: {
            currentLevel: true,
            user: { select: { name: true } },
          },
        },
      },
      take: 20,
    }),

    // 출석 원본 — nested join 제거 (studentId로 메모리 매칭)
    prisma.attendance.findMany({
      where: {
        studentId: { in: studentIds },
        date: { gte: fromDate, lte: toDate },
      },
      select: { date: true, status: true, studentId: true },
    }),

    // 신규 학생 (최근 6개월)
    prisma.user.findMany({
      where: {
        academyId,
        role: 'STUDENT',
        isDeleted: false,
        createdAt: { gte: sixMonthsAgo },
      },
      select: { createdAt: true },
    }),

    // 탈퇴 학생 (최근 6개월)
    prisma.student.findMany({
      where: {
        user: { academyId },
        status: 'WITHDRAWN',
        updatedAt: { gte: sixMonthsAgo },
      },
      select: { updatedAt: true },
    }),

    // 승급 대기
    prisma.levelPromotionStatus.findMany({
      where: {
        studentId: { in: studentIds },
        allConditionsMet: false,
        condition1Met: true,
        condition3Met: true,
      },
      select: {
        currentLevel: true,
        targetLevel: true,
        condition2Detail: true,
        studentId: true,
        student: {
          select: {
            user: { select: { name: true } },
            classId: true,
          },
        },
      },
      take: 10,
    }),

    // 교사별 작성 테스트 수 (기간내) — DB-level groupBy
    prisma.test.groupBy({
      by: ['createdBy'],
      where: { createdBy: { in: teacherIds }, createdAt: { gte: fromDate, lte: toDate } },
      _count: { id: true },
    }),

    // 교사별 코멘트 수 (기간내) — DB-level groupBy
    prisma.teacherComment.groupBy({
      by: ['teacherId'],
      where: { teacherId: { in: teacherIds }, createdAt: { gte: fromDate, lte: toDate } },
      _count: { id: true },
    }),
  ])

  // 학생별 학생정보 가져와 메모리 매칭 (nearPromotion + absentTop10 용)
  // nearPromotion과 absent 학생의 이름을 얻기 위해 studentId 모음 → 이름 한 번에 조회
  const nearPromoStudentIds = nearPromotionStudents.map((p) => p.studentId)
  const attendanceStudentIds = Array.from(new Set(attendanceRaw.map((a) => a.studentId)))
  const nameFetchIds = Array.from(new Set([...nearPromoStudentIds, ...attendanceStudentIds]))

  const studentsWithName = nameFetchIds.length
    ? await prisma.student.findMany({
        where: { id: { in: nameFetchIds } },
        select: { id: true, classId: true, user: { select: { name: true } } },
      })
    : []
  const studentNameById: Record<string, { name: string; classId: string | null }> = {}
  studentsWithName.forEach(
    (s) => (studentNameById[s.id] = { name: s.user.name, classId: s.classId }),
  )

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

  // Level distribution (activeStudents 기반 — 이미 로드됨)
  const levelCountMap: Record<number, number> = {}
  activeStudents.forEach((s) => {
    levelCountMap[s.currentLevel] = (levelCountMap[s.currentLevel] ?? 0) + 1
  })
  const levelDistribution = Object.entries(levelCountMap)
    .map(([lvl, cnt]) => ({ level: `레벨 ${lvl}`, count: cnt }))
    .sort((a, b) => parseInt(a.level.split(' ')[1]) - parseInt(b.level.split(' ')[1]))

  // Level avg scores
  const levelScoreMap: Record<number, number[]> = {}
  gradedSessions.forEach((s) => {
    const info = studentById[s.studentId]
    if (!info) return
    const lvl = info.currentLevel
    if (!levelScoreMap[lvl]) levelScoreMap[lvl] = []
    levelScoreMap[lvl].push(s.score as number)
  })
  const levelAvgScores = Object.entries(levelScoreMap)
    .map(([lvl, scores]) => ({ level: `레벨 ${lvl}`, avgScore: avg(scores) ?? 0 }))
    .sort((a, b) => parseInt(a.level.split(' ')[1]) - parseInt(b.level.split(' ')[1]))

  // Level-up students
  const levelUpStudents = levelUpBadges.map((b) => {
    const info = studentById[b.studentId]
    const classId = info?.classId ?? null
    return {
      name: b.student.user.name,
      className: classId ? classNameById[classId] ?? '반 미배정' : '반 미배정',
      level: b.student.currentLevel,
    }
  })

  // Domain averages
  const domainScores = {
    Grammar: gradedSessions.map((s) => s.grammarScore).filter((v): v is number => v !== null),
    Vocabulary: gradedSessions.map((s) => s.vocabularyScore).filter((v): v is number => v !== null),
    Reading: gradedSessions.map((s) => s.readingScore).filter((v): v is number => v !== null),
    Listening: gradedSessions.map((s) => s.listeningScore).filter((v): v is number => v !== null),
    Writing: gradedSessions.map((s) => s.writingScore).filter((v): v is number => v !== null),
  }
  const domainAvgs = Object.entries(domainScores).map(([domain, scores]) => ({
    domain,
    avg: avg(scores) ?? 0,
  }))
  const weakestDomain = domainAvgs.some((d) => d.avg > 0)
    ? domainAvgs.reduce((a, b) => (a.avg <= b.avg ? a : b)).domain
    : null

  // Monthly trend
  const monthKeys: string[] = []
  for (let i = 5; i >= 0; i--) {
    monthKeys.push(monthKey(new Date(now.getFullYear(), now.getMonth() - i, 1)))
  }
  const monthScoreMap: Record<string, number[]> = {}
  monthKeys.forEach((k) => (monthScoreMap[k] = []))
  monthlySessions.forEach((s) => {
    if (!s.completedAt) return
    const k = monthKey(s.completedAt)
    if (k in monthScoreMap) monthScoreMap[k].push(s.score as number)
  })
  const monthlyTrend = monthKeys.map((k) => ({
    month: `${parseInt(k.split('-')[1])}월`,
    avg: avg(monthScoreMap[k]),
  }))

  // Class monthly trend
  const classNames = allClasses.map((c) => c.name)
  const classByMonth: Record<string, Record<string, number[]>> = {}
  monthKeys.forEach((k) => {
    classByMonth[k] = {}
    classNames.forEach((cn) => (classByMonth[k][cn] = []))
  })
  monthlySessions.forEach((s) => {
    if (!s.completedAt) return
    const info = studentById[s.studentId]
    if (!info?.classId) return
    const cn = classNameById[info.classId]
    if (!cn) return
    const k = monthKey(s.completedAt)
    if (k in classByMonth && cn in classByMonth[k]) classByMonth[k][cn].push(s.score as number)
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

  // 반별 세션/점수 집계 (gradedSessions를 한 번 순회)
  type ClassAgg = {
    sessions: Array<{ score: number; completedAt: Date | null; g: number | null; v: number | null; r: number | null; w: number | null }>
    studentIds: Set<string>
    attendancePresent: number
    attendanceTotal: number
  }
  const classAggMap: Record<string, ClassAgg> = {}
  classIds.forEach((id) => {
    classAggMap[id] = { sessions: [], studentIds: new Set(), attendancePresent: 0, attendanceTotal: 0 }
  })
  activeStudents.forEach((s) => {
    if (s.classId && classAggMap[s.classId]) classAggMap[s.classId].studentIds.add(s.id)
  })
  gradedSessions.forEach((s) => {
    const info = studentById[s.studentId]
    if (!info?.classId) return
    const agg = classAggMap[info.classId]
    if (!agg) return
    agg.sessions.push({
      score: s.score as number,
      completedAt: s.completedAt,
      g: s.grammarScore,
      v: s.vocabularyScore,
      r: s.readingScore,
      w: s.writingScore,
    })
  })
  attendanceRaw.forEach((a) => {
    const info = studentById[a.studentId]
    if (!info?.classId) return
    const agg = classAggMap[info.classId]
    if (!agg) return
    agg.attendanceTotal++
    if (a.status === 'PRESENT') agg.attendancePresent++
  })

  const classComparison = allClasses.map((cls) => {
    const agg = classAggMap[cls.id]
    const scores = agg.sessions.map((s) => s.score)
    const avgScore = avg(scores)

    const sorted = [...agg.sessions].sort(
      (a, b) => (a.completedAt?.getTime() ?? 0) - (b.completedAt?.getTime() ?? 0),
    )
    const half = Math.floor(sorted.length / 2)
    const firstHalfScores = sorted.slice(0, half).map((s) => s.score)
    const secondHalfScores = sorted.slice(half).map((s) => s.score)
    const firstAvg = avg(firstHalfScores)
    const secondAvg = avg(secondHalfScores)
    const growthRate =
      firstAvg !== null && secondAvg !== null && firstHalfScores.length > 0 && secondHalfScores.length > 0
        ? secondAvg - firstAvg
        : null

    const attendanceRate = agg.attendanceTotal > 0
      ? Math.round((agg.attendancePresent / agg.attendanceTotal) * 100)
      : null

    return {
      id: cls.id,
      name: cls.name,
      studentCount: agg.studentIds.size,
      avgScore,
      growthRate,
      attendanceRate,
    }
  })

  const classDomainData = allClasses.map((cls) => {
    const sessions = classAggMap[cls.id].sessions
    const g = sessions.map((s) => s.g).filter((v): v is number => v !== null)
    const v = sessions.map((s) => s.v).filter((x): x is number => x !== null)
    const r = sessions.map((s) => s.r).filter((x): x is number => x !== null)
    const w = sessions.map((s) => s.w).filter((x): x is number => x !== null)
    return {
      name: cls.name,
      Grammar: avg(g) ?? 0,
      Vocabulary: avg(v) ?? 0,
      Reading: avg(r) ?? 0,
      Writing: avg(w) ?? 0,
    }
  })

  // ── TAB 3: Teacher Performance ────────────────────────────────────────────

  // 교사별 집계: 담당 반의 학생들의 세션
  // 반 → 교사 매핑
  const classToTeacher: Record<string, string | null> = {}
  allClasses.forEach((c) => (classToTeacher[c.id] = c.teacherId))
  const studentToTeacher: Record<string, string | null> = {}
  activeStudents.forEach((s) => {
    studentToTeacher[s.id] = s.classId ? classToTeacher[s.classId] ?? null : null
  })

  type TeacherAgg = {
    studentIds: Set<string>
    scores: number[]
    studentSessionMap: Record<string, Array<{ score: number; completedAt: Date | null }>>
  }
  const teacherAggMap: Record<string, TeacherAgg> = {}
  teacherIds.forEach((id) => {
    teacherAggMap[id] = { studentIds: new Set(), scores: [], studentSessionMap: {} }
  })
  activeStudents.forEach((s) => {
    const t = studentToTeacher[s.id]
    if (t && teacherAggMap[t]) teacherAggMap[t].studentIds.add(s.id)
  })
  gradedSessions.forEach((s) => {
    const t = studentToTeacher[s.studentId]
    if (!t || !teacherAggMap[t]) return
    teacherAggMap[t].scores.push(s.score as number)
    if (!teacherAggMap[t].studentSessionMap[s.studentId]) {
      teacherAggMap[t].studentSessionMap[s.studentId] = []
    }
    teacherAggMap[t].studentSessionMap[s.studentId].push({
      score: s.score as number,
      completedAt: s.completedAt,
    })
  })

  const testCountMap: Record<string, number> = {}
  testCountsByTeacher.forEach((r) => {
    if (r.createdBy) testCountMap[r.createdBy] = r._count.id
  })
  const commentCountMap: Record<string, number> = {}
  commentCountsByTeacher.forEach((r) => (commentCountMap[r.teacherId] = r._count.id))

  const teacherPerformance = allTeachers.map((teacher) => {
    const agg = teacherAggMap[teacher.id]
    const avgScore = avg(agg.scores)

    // Improvement rate: 학생별 첫 세션 vs 마지막 세션 차
    const improvements: number[] = []
    Object.values(agg.studentSessionMap).forEach((sessions) => {
      const sorted = [...sessions].sort(
        (a, b) => (a.completedAt?.getTime() ?? 0) - (b.completedAt?.getTime() ?? 0),
      )
      if (sorted.length >= 2) {
        improvements.push(sorted[sorted.length - 1].score - sorted[0].score)
      }
    })

    return {
      id: teacher.id,
      name: teacher.name,
      studentCount: agg.studentIds.size,
      avgScore,
      testCount: testCountMap[teacher.id] ?? 0,
      commentCount: commentCountMap[teacher.id] ?? 0,
      improvementRate: avg(improvements),
    }
  })

  const teacherActivityData = allTeachers.map((t) => ({
    name: t.name,
    tests: testCountMap[t.id] ?? 0,
    comments: commentCountMap[t.id] ?? 0,
  }))

  // ── TAB 4: Attendance Analysis ────────────────────────────────────────────

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
  }).filter((d, i) => weekdayMap[i].length > 0)

  // Absent top 10
  type StudentAttendanceSummary = { name: string; className: string; absentCount: number; total: number }
  const studentAttMap: Record<string, StudentAttendanceSummary> = {}
  attendanceRaw.forEach((a) => {
    const id = a.studentId
    if (!studentAttMap[id]) {
      const meta = studentNameById[id]
      const classId = meta?.classId ?? null
      studentAttMap[id] = {
        name: meta?.name ?? '학생',
        className: classId ? classNameById[classId] ?? '반 미배정' : '반 미배정',
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

  const nearPromotion = nearPromotionStudents
    .map((ps) => {
      const c2 = (ps.condition2Detail ?? {}) as Record<string, unknown>
      const completionRate = typeof c2.completionRate === 'number' ? c2.completionRate : 0
      const remaining = typeof c2.totalTests === 'number' && typeof c2.completedTests === 'number'
        ? Math.ceil((c2.totalTests as number) * 0.7) - (c2.completedTests as number)
        : null
      const classId = ps.student.classId
      return {
        name: ps.student.user.name,
        className: classId ? classNameById[classId] ?? '반 미배정' : '반 미배정',
        currentLevel: ps.currentLevel,
        targetLevel: ps.targetLevel,
        completionRate,
        remaining,
      }
    })
    .sort((a, b) => b.completionRate - a.completionRate)

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
    totalActiveStudents: activeStudents.length,
    nearPromotion,
  }
}

// ─── Cached Wrapper (period별 독립 캐시, 5분 TTL) ────────────────────────────

function getCachedAnalyticsData(academyId: string, period: string) {
  const { from, to } = getPeriodDates(period)
  return unstable_cache(
    () => getAnalyticsData(academyId, from, to),
    ['owner-analytics', academyId, period],
    { revalidate: 300, tags: [`academy-${academyId}-analytics`] },
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

  return <AnalyticsClient data={data} period={period} activeTab={activeTab} />
}
