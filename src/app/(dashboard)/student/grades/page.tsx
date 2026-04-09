import { redirect } from 'next/navigation'
import { unstable_cache } from 'next/cache'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma/client'
import { GradesRadarChart } from './_components/grades-radar-chart'
import { GradesLineChartWrapper } from './_components/grades-line-chart-wrapper'
import { GradesTabs } from './_components/grades-tabs'

type DomainKey = 'GRAMMAR' | 'VOCABULARY' | 'READING' | 'LISTENING' | 'WRITING'

const DOMAIN_COLOR: Record<DomainKey, string> = {
  GRAMMAR: '#1865F2',
  VOCABULARY: '#7854F7',
  READING: '#0FBFAD',
  LISTENING: '#E91E8A',
  WRITING: '#E35C20',
}

const DOMAIN_LABELS: Record<DomainKey, string> = {
  GRAMMAR: '문법',
  VOCABULARY: '어휘',
  READING: '독해',
  LISTENING: '듣기',
  WRITING: '쓰기',
}

const DOMAINS: DomainKey[] = ['GRAMMAR', 'VOCABULARY', 'READING', 'LISTENING', 'WRITING']

function avg(nums: (number | null)[]): number | null {
  const valid = nums.filter((n): n is number => n !== null)
  if (!valid.length) return null
  return Math.round(valid.reduce((a, b) => a + b, 0) / valid.length)
}

function getScoreColor(score: number | null): string {
  if (score === null) return '#6B6F7A'
  if (score >= 80) return '#1FAF54'
  if (score >= 60) return '#FFB100'
  return '#D92916'
}

function getDomainScore(
  session: {
    grammarScore: number | null
    vocabularyScore: number | null
    readingScore: number | null
    listeningScore: number | null
    writingScore: number | null
  },
  domain: DomainKey,
): number | null {
  if (domain === 'GRAMMAR') return session.grammarScore
  if (domain === 'VOCABULARY') return session.vocabularyScore
  if (domain === 'READING') return session.readingScore
  if (domain === 'LISTENING') return session.listeningScore
  return session.writingScore
}

// ── Cached data fetcher ───────────────────────────────────────────────────────

const getCachedStudentGrades = (studentId: string) =>
  unstable_cache(
    async () => {
      const now = new Date()
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59)

      // Fetch student level + sessions + skill assessments + level assessments in parallel
      const [student, sessions, skillAssessments, levelAssessments] = await Promise.all([
        prisma.student.findUnique({
          where: { id: studentId },
          select: { currentLevel: true },
        }),
        prisma.testSession.findMany({
          where: {
            studentId,
            status: { in: ['COMPLETED', 'GRADED'] },
            completedAt: { not: null },
          },
          select: {
            id: true,
            score: true,
            grammarScore: true,
            vocabularyScore: true,
            readingScore: true,
            listeningScore: true,
            writingScore: true,
            startedAt: true,
            completedAt: true,
            test: { select: { title: true, type: true } },
          },
          orderBy: { completedAt: 'desc' },
          take: 100,
        }),
        prisma.skillAssessment.findMany({
          where: { studentId },
          orderBy: { assessedAt: 'asc' },
          take: 200,
          select: { level: true, score: true, assessedAt: true },
        }),
        prisma.levelAssessment.findMany({
          where: { studentId },
          orderBy: { assessedAt: 'desc' },
          take: 50,
          select: {
            id: true,
            assessmentType: true,
            grammarLevel: true,
            vocabularyLevel: true,
            readingLevel: true,
            listeningLevel: true,
            writingLevel: true,
            overallLevel: true,
            assessedAt: true,
            assessedBy: true,
            isCurrent: true,
          },
        }),
      ])

      const currentLevel = student?.currentLevel ?? 1

      // ── 날짜 기반 필터링 ──
      const thisMonthSessions = sessions.filter(
        (s) => s.completedAt != null && s.completedAt >= thisMonthStart,
      )
      const lastMonthSessions = sessions.filter(
        (s) =>
          s.completedAt != null &&
          s.completedAt >= lastMonthStart &&
          s.completedAt <= lastMonthEnd,
      )

      // ── 전체 평균 (최근 10회) ──
      const overallAvg = avg(sessions.slice(0, 10).map((s) => s.score))
      const thisMonthAvg = avg(thisMonthSessions.map((s) => s.score))
      const lastMonthAvg = avg(lastMonthSessions.map((s) => s.score))
      const monthDiff =
        thisMonthAvg !== null && lastMonthAvg !== null ? thisMonthAvg - lastMonthAvg : null

      // ── 영역별 평균 ──
      function domainAvgOf(
        list: typeof sessions,
        domain: DomainKey,
      ): number | null {
        return avg(list.map((s) => getDomainScore(s, domain)))
      }

      const allDomainAvg: Record<DomainKey, number | null> = {
        GRAMMAR: domainAvgOf(sessions, 'GRAMMAR'),
        VOCABULARY: domainAvgOf(sessions, 'VOCABULARY'),
        READING: domainAvgOf(sessions, 'READING'),
        LISTENING: domainAvgOf(sessions, 'LISTENING'),
        WRITING: domainAvgOf(sessions, 'WRITING'),
      }
      const thisMonthDomainAvg: Record<DomainKey, number | null> = {
        GRAMMAR: domainAvgOf(thisMonthSessions, 'GRAMMAR'),
        VOCABULARY: domainAvgOf(thisMonthSessions, 'VOCABULARY'),
        READING: domainAvgOf(thisMonthSessions, 'READING'),
        LISTENING: domainAvgOf(thisMonthSessions, 'LISTENING'),
        WRITING: domainAvgOf(thisMonthSessions, 'WRITING'),
      }
      const lastMonthDomainAvg: Record<DomainKey, number | null> = {
        GRAMMAR: domainAvgOf(lastMonthSessions, 'GRAMMAR'),
        VOCABULARY: domainAvgOf(lastMonthSessions, 'VOCABULARY'),
        READING: domainAvgOf(lastMonthSessions, 'READING'),
        LISTENING: domainAvgOf(lastMonthSessions, 'LISTENING'),
        WRITING: domainAvgOf(lastMonthSessions, 'WRITING'),
      }

      // ── 레이더 차트 데이터 ──
      const radarThisMonth = DOMAINS.map((d) => ({
        subject: DOMAIN_LABELS[d],
        score: thisMonthDomainAvg[d] ?? 0,
      }))
      const radarLastMonth = DOMAINS.map((d) => ({
        subject: DOMAIN_LABELS[d],
        score: lastMonthDomainAvg[d] ?? 0,
      }))

      // ── 추이 라인 차트 (최근 10회, 오래된 순) ──
      const sessionPoints = sessions
        .slice(0, 10)
        .reverse()
        .map((s) => ({
          id: s.id,
          title: s.test.title,
          type: s.test.type,
          date: s.completedAt
            ? new Date(s.completedAt).toLocaleDateString('ko-KR', {
                month: 'numeric',
                day: 'numeric',
              })
            : '',
          score: s.score,
          grammarScore: s.grammarScore,
          vocabularyScore: s.vocabularyScore,
          readingScore: s.readingScore,
          listeningScore: s.listeningScore,
          writingScore: s.writingScore,
        }))

      // ── 테스트 이력 테이블 ──
      const historyData = sessions.map((s) => ({
        id: s.id,
        date: s.completedAt ? new Date(s.completedAt).toLocaleDateString('ko-KR') : '',
        title: s.test.title,
        type: s.test.type,
        score: s.score,
        grammarScore: s.grammarScore,
        vocabularyScore: s.vocabularyScore,
        readingScore: s.readingScore,
        listeningScore: s.listeningScore,
        writingScore: s.writingScore,
        durationMin:
          s.completedAt && s.startedAt
            ? Math.round((s.completedAt.getTime() - s.startedAt.getTime()) / 60000)
            : null,
      }))

      // ── 영역별 하위 카테고리 정답률 (최근 20개 세션만) ──
      const recentSessionIds = sessions.slice(0, 20).map((s) => s.id)
      const responses =
        recentSessionIds.length > 0
          ? await prisma.questionResponse.findMany({
              where: { sessionId: { in: recentSessionIds } },
              select: {
                isCorrect: true,
                question: { select: { domain: true, subCategory: true } },
              },
            })
          : []

      type SubCategoryEntry = { correct: number; total: number }
      const subCategoryByDomain: Record<DomainKey, Map<string, SubCategoryEntry>> = {
        GRAMMAR: new Map(),
        VOCABULARY: new Map(),
        READING: new Map(),
        LISTENING: new Map(),
        WRITING: new Map(),
      }

      for (const r of responses) {
        const domain = r.question.domain as DomainKey
        const sub = r.question.subCategory ?? '기타'
        const map = subCategoryByDomain[domain]
        const prev = map.get(sub) ?? { correct: 0, total: 0 }
        map.set(sub, {
          correct: prev.correct + (r.isCorrect ? 1 : 0),
          total: prev.total + 1,
        })
      }

      const subCategoryData: Record<
        DomainKey,
        { subCategory: string; correct: number; total: number; rate: number }[]
      > = {
        GRAMMAR: [],
        VOCABULARY: [],
        READING: [],
        LISTENING: [],
        WRITING: [],
      }
      for (const domain of DOMAINS) {
        subCategoryData[domain] = Array.from(subCategoryByDomain[domain].entries())
          .map(([sub, { correct, total }]) => ({
            subCategory: sub,
            correct,
            total,
            rate: Math.round((correct / total) * 100),
          }))
          .sort((a, b) => a.rate - b.rate)
      }

      // ── 레벨 히스토리 (SkillAssessment 기반) ──
      const levelHistory: {
        date: string
        fromLevel: number
        toLevel: number
        score: number | null
      }[] = []
      let prevLevel: number | null = null
      for (const sa of skillAssessments) {
        if (prevLevel !== null && sa.level !== prevLevel) {
          levelHistory.push({
            date: new Date(sa.assessedAt).toLocaleDateString('ko-KR'),
            fromLevel: prevLevel,
            toLevel: sa.level,
            score: sa.score,
          })
        }
        prevLevel = sa.level
      }

      // ── 공식 레벨 평가 이력 (LevelAssessment 기반) ──
      const assessmentHistory = levelAssessments.map((la) => ({
        id: la.id,
        date: new Date(la.assessedAt).toLocaleDateString('ko-KR', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }),
        assessmentType: la.assessmentType,
        grammarLevel: la.grammarLevel,
        vocabularyLevel: la.vocabularyLevel,
        readingLevel: la.readingLevel,
        listeningLevel: la.listeningLevel,
        writingLevel: la.writingLevel,
        overallLevel: la.overallLevel,
        assessedBy: la.assessedBy,
        isCurrent: la.isCurrent,
      }))

      return {
        currentLevel,
        overallAvg,
        thisMonthAvg,
        lastMonthAvg,
        monthDiff,
        allDomainAvg,
        thisMonthDomainAvg,
        lastMonthDomainAvg,
        radarThisMonth,
        radarLastMonth,
        sessionPoints,
        historyData,
        subCategoryData,
        levelHistory,
        assessmentHistory,
      }
    },
    ['student-grades', studentId],
    { revalidate: 60, tags: [`student-${studentId}-grades`] },
  )()

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function GradesPage() {
  const pageStart = performance.now()

  const authStart = performance.now()
  const user = await getCurrentUser()
  console.log(`  [쿼리1] getCurrentUser: ${(performance.now() - authStart).toFixed(0)}ms`)
  if (!user || user.role !== 'STUDENT') redirect('/login')

  const userLookupStart = performance.now()
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { student: { select: { id: true } } },
  })
  console.log(`  [쿼리2] prisma.user.findUnique: ${(performance.now() - userLookupStart).toFixed(0)}ms`)
  if (!dbUser?.student) redirect('/login')

  const dataStart = performance.now()
  const {
    currentLevel,
    overallAvg,
    thisMonthAvg,
    lastMonthAvg,
    monthDiff,
    allDomainAvg,
    thisMonthDomainAvg,
    lastMonthDomainAvg,
    radarThisMonth,
    radarLastMonth,
    sessionPoints,
    historyData,
    subCategoryData,
    levelHistory,
    assessmentHistory,
  } = await getCachedStudentGrades(dbUser.student.id)
  console.log(`  [쿼리3] getCachedStudentGrades: ${(performance.now() - dataStart).toFixed(0)}ms`)

  const totalTime = performance.now() - pageStart
  console.log(`📊 [GradesPage] 전체 서버 시간: ${totalTime.toFixed(0)}ms`)
  if (totalTime > 200) console.log(`⚠️ SLOW PAGE: ${totalTime.toFixed(0)}ms`)

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      {/* 페이지 헤더 */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">내 성적</h1>
        <p className="mt-1 text-sm text-gray-500">학습 성과를 한눈에 확인하세요</p>
      </div>

      {/* ── 성적 요약 카드 ── */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex flex-col items-center gap-8 sm:flex-row sm:items-center">
          {/* 현재 레벨 배지 */}
          <div className="flex flex-col items-center gap-2">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#1865F2] text-white shadow-sm">
              <div className="text-center">
                <p className="text-[11px] font-semibold uppercase leading-none tracking-wide opacity-80">
                  Level
                </p>
                <p className="text-3xl font-bold leading-tight">{currentLevel}</p>
              </div>
            </div>
            <p className="text-sm font-medium text-gray-500">현재 레벨</p>
          </div>

          <div className="h-px w-full bg-gray-100 sm:h-16 sm:w-px" />

          {/* 전체 평균 */}
          <div className="flex flex-1 flex-col items-center gap-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              전체 평균
            </p>
            <p className="text-5xl font-bold" style={{ color: getScoreColor(overallAvg) }}>
              {overallAvg ?? '—'}
            </p>
            <p className="text-xs text-gray-400">최근 10회 기준</p>
          </div>

          <div className="h-px w-full bg-gray-100 sm:h-16 sm:w-px" />

          {/* 이번 달 평균 + 전월 대비 */}
          <div className="flex flex-col items-center gap-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              이번 달
            </p>
            <p className="text-4xl font-bold text-gray-900">{thisMonthAvg ?? '—'}</p>
            {monthDiff !== null ? (
              monthDiff > 0 ? (
                <span className="flex items-center gap-1 text-sm font-semibold text-[#1FAF54]">
                  <TrendingUp className="h-4 w-4" />▲ +{monthDiff}점
                </span>
              ) : monthDiff < 0 ? (
                <span className="flex items-center gap-1 text-sm font-semibold text-[#D92916]">
                  <TrendingDown className="h-4 w-4" />▼ {monthDiff}점
                </span>
              ) : (
                <span className="flex items-center gap-1 text-sm font-semibold text-gray-400">
                  <Minus className="h-4 w-4" />± 0점
                </span>
              )
            ) : (
              <p className="text-xs text-gray-300">이전 달 없음</p>
            )}
            <p className="text-xs text-gray-400">전월 대비</p>
          </div>
        </div>
      </div>

      {/* ── 영역별 점수 카드 (grid-cols-5 / grid-cols-2 혹은 3) ── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {DOMAINS.map((domain) => {
          const curr = allDomainAvg[domain]
          const thisM = thisMonthDomainAvg[domain]
          const lastM = lastMonthDomainAvg[domain]
          const diff = thisM !== null && lastM !== null ? thisM - lastM : null

          return (
            <div
              key={domain}
              className="rounded-xl border border-gray-200 bg-white p-4"
              style={{ borderTopColor: DOMAIN_COLOR[domain], borderTopWidth: 4 }}
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                {DOMAIN_LABELS[domain]}
              </p>
              <div className="mt-2 flex items-end gap-0.5">
                <p className="text-3xl font-bold" style={{ color: DOMAIN_COLOR[domain] }}>
                  {curr ?? '—'}
                </p>
                {curr !== null && (
                  <p className="mb-0.5 text-sm text-gray-400">점</p>
                )}
              </div>
              {diff !== null ? (
                diff > 0 ? (
                  <span className="mt-1.5 flex items-center gap-0.5 text-xs font-semibold text-[#1FAF54]">
                    <TrendingUp className="h-3.5 w-3.5" />+{diff}
                  </span>
                ) : diff < 0 ? (
                  <span className="mt-1.5 flex items-center gap-0.5 text-xs font-semibold text-[#D92916]">
                    <TrendingDown className="h-3.5 w-3.5" />{diff}
                  </span>
                ) : (
                  <span className="mt-1.5 flex items-center gap-0.5 text-xs font-semibold text-gray-400">
                    <Minus className="h-3.5 w-3.5" />±0
                  </span>
                )
              ) : (
                <p className="mt-1.5 text-xs text-gray-300">—</p>
              )}
            </div>
          )
        })}
      </div>

      {/* ── 영역별 레이더 차트 ── */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-gray-900">영역별 분석</h2>
          <div className="flex items-center gap-5 text-xs text-gray-500">
            <div className="flex items-center gap-1.5">
              <div className="h-0.5 w-6 rounded-full bg-[#1865F2]" />
              <span>이번 달</span>
            </div>
            <div className="flex items-center gap-1.5">
              <svg width="24" height="2" viewBox="0 0 24 2" fill="none">
                <line
                  x1="0"
                  y1="1"
                  x2="24"
                  y2="1"
                  stroke="#1865F2"
                  strokeWidth="1.5"
                  strokeDasharray="5 4"
                  strokeOpacity="0.5"
                />
              </svg>
              <span>지난 달</span>
            </div>
          </div>
        </div>
        <GradesRadarChart thisMonth={radarThisMonth} lastMonth={radarLastMonth} />
      </div>

      {/* ── 점수 추이 그래프 ── */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-base font-semibold text-gray-900">점수 추이</h2>
        <GradesLineChartWrapper sessions={sessionPoints} />
      </div>

      {/* ── 테스트 이력 탭 ── */}
      <GradesTabs
        historyData={historyData}
        subCategoryData={subCategoryData}
        levelHistory={levelHistory}
        assessmentHistory={assessmentHistory}
        currentLevel={currentLevel}
        domainSessionPoints={sessionPoints}
      />
    </div>
  )
}
