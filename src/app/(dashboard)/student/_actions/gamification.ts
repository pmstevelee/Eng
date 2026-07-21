'use server'

import { unstable_cache, revalidateTag } from 'next/cache'
import { prisma } from '@/lib/prisma/client'
import { BadgeType, QuestionDomain } from '@/generated/prisma'
import { LEVEL_UP_THRESHOLDS } from '@/lib/constants/levels'
import { getCurrentUser } from '@/lib/auth'
import { getOrCreateTodayMission, buildDailyMissions } from '@/lib/missions/mission-engine'
import { updateStreak } from '@/lib/missions/streak-manager'
import { awardXP, BADGE_XP } from '@/lib/missions/xp-manager'
import { getPromotionProgress } from '@/lib/assessment/promotion-engine'

// ─── Auth helper ─────────────────────────────────────────────────────────────

async function getAuthedStudent() {
  // getCurrentUser: getSession(쿠키 로컬 검증) + 인메모리/unstable_cache → ~1ms
  // studentId는 user 캐시에 포함되어 별도 DB 왕복 없음
  const user = await getCurrentUser()
  if (!user || user.role !== 'STUDENT' || !user.student) return null
  return { userId: user.id, studentId: user.student.id }
}

// ─── Main dashboard data ──────────────────────────────────────────────────────

export async function getGamificationData() {
  const auth = await getAuthedStudent()
  if (!auth) return null
  const { studentId } = auth

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const weekStart = new Date()
  weekStart.setDate(weekStart.getDate() - weekStart.getDay())
  weekStart.setHours(0, 0, 0, 0)

  const [streak, mission, student, recentSessions, badgeEarnings, allBadges, weeklyCount] =
    await Promise.all([
      prisma.studentStreak.findUnique({ where: { studentId } }),
      prisma.dailyMission.findFirst({
        where: {
          studentId,
          missionDate: { gte: todayStart },
        },
      }),
      prisma.student.findUnique({
        where: { id: studentId },
        select: { currentLevel: true, weeklyGoalTarget: true },
      }),
      prisma.testSession.findMany({
        where: { studentId, status: { in: ['COMPLETED', 'GRADED'] }, score: { not: null } },
        orderBy: { completedAt: 'desc' },
        take: 3,
        select: { score: true },
      }),
      prisma.badgeEarning.findMany({
        where: { studentId },
        include: { badge: true },
        orderBy: { earnedAt: 'desc' },
      }),
      prisma.badge.findMany({
        where: { code: { not: null } },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.questionResponse.count({
        where: {
          session: {
            studentId,
            status: { in: ['COMPLETED', 'GRADED'] },
            completedAt: { gte: weekStart },
          },
        },
      }),
    ])

  const recentAvgScore =
    recentSessions.length > 0
      ? Math.round(recentSessions.reduce((s, r) => s + (r.score ?? 0), 0) / recentSessions.length)
      : null

  const isActiveToday = streak?.lastActivityDate
    ? new Date(streak.lastActivityDate) >= todayStart
    : false

  return {
    streak: streak ?? {
      currentStreak: 0,
      longestStreak: 0,
      lastActivityDate: null,
      totalDays: 0,
    },
    isActiveToday,
    mission,
    weeklyQuestionCount: weeklyCount,
    weeklyGoal: student?.weeklyGoalTarget ?? 20,
    currentLevel: student?.currentLevel ?? 1,
    recentAvgScore,
    badgeEarnings,
    allBadges,
  }
}

// ─── Record activity + badge check (called after test submit) ─────────────────

export async function recordActivityAndCheckBadges(
  studentId: string,
  sessionId: string,
): Promise<{ newBadges: string[] }> {
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  // 1. Update streak
  // [LEGACY] 기존 인라인 스트릭 업데이트 코드는 streak-manager.ts로 통합됨
  const streakResult = await updateStreak(studentId)

  // 3. Collect already-earned badge codes
  const existingEarnings = await prisma.badgeEarning.findMany({
    where: { studentId },
    include: { badge: true },
  })
  const earned = new Set(existingEarnings.map((e) => e.badge.code).filter(Boolean))

  const toAward: BadgeType[] = []

  // First test
  const sessionCount = await prisma.testSession.count({
    where: { studentId, status: { in: ['COMPLETED', 'GRADED'] } },
  })
  if (sessionCount === 1 && !earned.has('FIRST_TEST')) toAward.push('FIRST_TEST')

  // Perfect score
  const session = await prisma.testSession.findUnique({
    where: { id: sessionId },
    select: { score: true, startedAt: true, completedAt: true, timeLimitMin: true },
  })
  if (session?.score === 100 && !earned.has('PERFECT_SCORE')) toAward.push('PERFECT_SCORE')

  // Speed demon: finished in < 50% of time limit
  if (session?.timeLimitMin && session.completedAt) {
    const spentMin = (session.completedAt.getTime() - session.startedAt.getTime()) / 60000
    if (spentMin < session.timeLimitMin * 0.5 && !earned.has('SPEED_DEMON'))
      toAward.push('SPEED_DEMON')
  }

  // Streak badges
  const streakMap: { threshold: number; code: BadgeType }[] = [
    { threshold: 3, code: 'STREAK_3' },
    { threshold: 7, code: 'STREAK_7' },
    { threshold: 14, code: 'STREAK_14' },
    { threshold: 30, code: 'STREAK_30' },
    { threshold: 100, code: 'STREAK_100' },
  ]
  for (const { threshold, code } of streakMap) {
    if (streakResult.currentStreak >= threshold && !earned.has(code)) toAward.push(code)
  }

  // Weekly goal
  const weekStart = new Date()
  weekStart.setDate(weekStart.getDate() - weekStart.getDay())
  weekStart.setHours(0, 0, 0, 0)
  const [weeklyCount, studentForGoal] = await Promise.all([
    prisma.questionResponse.count({
      where: {
        session: {
          studentId,
          status: { in: ['COMPLETED', 'GRADED'] },
          completedAt: { gte: weekStart },
        },
      },
    }),
    prisma.student.findUnique({ where: { id: studentId }, select: { weeklyGoalTarget: true } }),
  ])
  const weeklyGoalTarget = studentForGoal?.weeklyGoalTarget ?? 20
  if (weeklyCount >= weeklyGoalTarget && !earned.has('WEEKLY_GOAL')) toAward.push('WEEKLY_GOAL')

  // 4. Level up check (last 3 sessions avg)
  const recent3 = await prisma.testSession.findMany({
    where: { studentId, status: { in: ['COMPLETED', 'GRADED'] }, score: { not: null } },
    orderBy: { completedAt: 'desc' },
    take: 3,
    select: { score: true },
  })
  if (recent3.length >= 3) {
    const avg = recent3.reduce((s, r) => s + (r.score ?? 0), 0) / 3
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: { currentLevel: true, weeklyGoalTarget: true },
    })
    if (student) {
      const threshold = LEVEL_UP_THRESHOLDS.find((t) => t.from === student.currentLevel)
      if (threshold && avg >= threshold.requiredAvg) {
        const newLevel = threshold.to
        await prisma.student.update({ where: { id: studentId }, data: { currentLevel: newLevel } })
        if (!earned.has('LEVEL_UP')) toAward.push('LEVEL_UP')
        if (newLevel >= 10 && !earned.has('MASTER')) toAward.push('MASTER')
      }
    }
  }

  // 5. Award badges + XP
  for (const code of toAward) {
    const badge = await prisma.badge.findFirst({ where: { code } })
    if (badge) {
      try {
        const badgeEarning = await prisma.badgeEarning.create({ data: { studentId, badgeId: badge.id } })
        const xpAmount = BADGE_XP[code]
        if (xpAmount) await awardXP(studentId, xpAmount, 'BADGE_EARNED', badgeEarning.id)
      } catch {
        // unique constraint – already earned
      }
    }
  }

  return { newBadges: toAward as string[] }
}

// ─── Generate or get today's daily mission ────────────────────────────────────

export async function generateOrGetDailyMission() {
  const auth = await getAuthedStudent()
  if (!auth) return null
  const { studentId } = auth

  // 새 미션 엔진 사용
  return await getOrCreateTodayMission(studentId)

  // [LEGACY] 기존 최신순 5개 선택 로직
  // const todayStart = new Date()
  // todayStart.setHours(0, 0, 0, 0)
  // const existing = await prisma.dailyMission.findFirst({
  //   where: { studentId, missionDate: { gte: todayStart } },
  // })
  // if (existing) return existing
  // const assessments = await prisma.skillAssessment.findMany({
  //   where: { studentId },
  //   orderBy: { assessedAt: 'desc' },
  //   take: 20,
  // })
  // const domainScores: Record<string, { sum: number; count: number }> = {}
  // for (const a of assessments) {
  //   if (!domainScores[a.domain]) domainScores[a.domain] = { sum: 0, count: 0 }
  //   domainScores[a.domain].sum += a.score ?? 0
  //   domainScores[a.domain].count++
  // }
  // const domains: QuestionDomain[] = ['GRAMMAR', 'VOCABULARY', 'READING', 'WRITING']
  // let weakestDomain: QuestionDomain = 'GRAMMAR'
  // let lowestScore = Infinity
  // for (const domain of domains) {
  //   const stats = domainScores[domain]
  //   if (stats && stats.count > 0) {
  //     const avg = stats.sum / stats.count
  //     if (avg < lowestScore) { lowestScore = avg; weakestDomain = domain }
  //   }
  // }
  // const questions = await prisma.question.findMany({
  //   where: { domain: weakestDomain },
  //   take: 5,
  //   orderBy: { createdAt: 'desc' },
  //   select: { id: true },
  // })
  // if (questions.length === 0) return null
  // return prisma.dailyMission.create({
  //   data: { studentId, missionDate: new Date(), questionIds: questions.map((q) => q.id),
  //     domainFocus: weakestDomain, isCompleted: false },
  // })
}

// ─── Get mission questions detail (with 30s cache) ───────────────────────────

const getCachedMissionWithQuestions = (studentId: string) =>
  unstable_cache(
    async () => {
      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)

      // 오늘 미션 조회 (없으면 생성)
      let mission = await prisma.dailyMission.findFirst({
        where: { studentId, missionDate: { gte: todayStart } },
      })
      if (!mission) {
        try {
          mission = await buildDailyMissions(studentId)
        } catch {
          mission = await prisma.dailyMission.findFirst({
            where: { studentId, missionDate: { gte: todayStart } },
          })
        }
      }
      if (!mission) return null

      const questionIds = mission.questionIds as string[]
      const questions = await prisma.question.findMany({
        where: { id: { in: questionIds } },
        select: { id: true, domain: true, difficulty: true, cefrLevel: true, contentJson: true },
      })

      const ordered = questionIds
        .map((id) => questions.find((q) => q.id === id))
        .filter(Boolean) as typeof questions

      return {
        mission: {
          ...mission,
          missionDate: mission.missionDate.toISOString(),
          completedAt: mission.completedAt?.toISOString() ?? null,
          createdAt: mission.createdAt.toISOString(),
        },
        questions: ordered,
        studentId,
      }
    },
    ['student-mission-questions', studentId],
    { revalidate: 120, tags: [`student-${studentId}-dashboard`] },
  )()

export async function getDailyMissionWithQuestions() {
  const auth = await getAuthedStudent()
  if (!auth) return null
  const { studentId } = auth

  const cached = await getCachedMissionWithQuestions(studentId)
  if (!cached) return null

  return {
    mission: {
      ...cached.mission,
      missionDate: new Date(cached.mission.missionDate),
      completedAt: cached.mission.completedAt ? new Date(cached.mission.completedAt) : null,
      createdAt: new Date(cached.mission.createdAt),
    },
    questions: cached.questions,
    studentId: cached.studentId,
  }
}

// ─── Submit mission answers ───────────────────────────────────────────────────

export type MissionAnswerResult = {
  questionId: string
  studentAnswer: string
  isCorrect: boolean
  correctAnswer?: string
  explanation?: string
}

export async function submitMissionAnswers(
  missionId: string,
  answers: { questionId: string; answer: string }[],
): Promise<{
  error?: string
  newBadges?: string[]
  score?: number
  results?: MissionAnswerResult[]
}> {
  const auth = await getAuthedStudent()
  if (!auth) return { error: '권한이 없습니다.' }
  const { studentId } = auth

  const mission = await prisma.dailyMission.findUnique({ where: { id: missionId } })
  if (!mission || mission.studentId !== studentId) return { error: '미션을 찾을 수 없습니다.' }
  if (mission.isCompleted) return { error: '이미 완료된 미션입니다.' }

  // Score the answers
  const questionIds = mission.questionIds as string[]
  const questions = await prisma.question.findMany({
    where: { id: { in: questionIds } },
    select: { id: true, contentJson: true, domain: true },
  })

  type ContentJson = {
    type: string
    correct_answer?: string
    explanation?: string
  }

  let correct = 0
  let total = 0
  const results: MissionAnswerResult[] = []

  // 문제 순서(questionIds) 보장을 위해 정렬
  const orderedQuestions = questionIds
    .map((id) => questions.find((q) => q.id === id))
    .filter(Boolean) as typeof questions

  for (const q of orderedQuestions) {
    const content = q.contentJson as ContentJson
    const studentAnswer = answers.find((a) => a.questionId === q.id)?.answer ?? ''

    if (content.type === 'essay' || !content.correct_answer) {
      results.push({ questionId: q.id, studentAnswer, isCorrect: false, explanation: content.explanation })
      continue
    }

    total++
    const isCorrect =
      studentAnswer.toLowerCase().trim() === content.correct_answer.toLowerCase().trim()
    if (isCorrect) correct++

    results.push({
      questionId: q.id,
      studentAnswer,
      isCorrect,
      correctAnswer: content.correct_answer,
      explanation: content.explanation,
    })

    // Record skill assessment
    await prisma.skillAssessment.create({
      data: {
        studentId,
        domain: q.domain,
        level: 1,
        score: isCorrect ? 100 : 0,
        notes: '오늘의 미션',
      },
    })
  }

  const score = total > 0 ? Math.round((correct / total) * 100) : 100

  // Mark mission complete
  await prisma.dailyMission.update({
    where: { id: missionId },
    data: { isCompleted: true, completedAt: new Date() },
  })

  // Update streak
  // [LEGACY] 기존 인라인 스트릭 업데이트 코드는 streak-manager.ts로 통합됨
  const streakResult = await updateStreak(studentId)

  // Check badges
  const existingEarnings = await prisma.badgeEarning.findMany({
    where: { studentId },
    include: { badge: true },
  })
  const earned = new Set(existingEarnings.map((e) => e.badge.code).filter(Boolean))
  const toAward: BadgeType[] = []

  if (!earned.has('MISSION_COMPLETE')) toAward.push('MISSION_COMPLETE')

  const streakMap: { threshold: number; code: BadgeType }[] = [
    { threshold: 3, code: 'STREAK_3' },
    { threshold: 7, code: 'STREAK_7' },
    { threshold: 14, code: 'STREAK_14' },
    { threshold: 30, code: 'STREAK_30' },
    { threshold: 100, code: 'STREAK_100' },
  ]
  for (const { threshold, code } of streakMap) {
    if (streakResult.currentStreak >= threshold && !earned.has(code)) toAward.push(code)
  }

  for (const code of toAward) {
    const badge = await prisma.badge.findFirst({ where: { code } })
    if (badge) {
      try {
        const badgeEarning = await prisma.badgeEarning.create({ data: { studentId, badgeId: badge.id } })
        const xpAmount = BADGE_XP[code]
        if (xpAmount) await awardXP(studentId, xpAmount, 'BADGE_EARNED', badgeEarning.id)
      } catch {
        // already earned
      }
    }
  }

  // 대시보드 캐시 무효화는 결과 화면 확인 후 완료 버튼 클릭 시 처리
  // (여기서 즉시 무효화하면 Server Action 후 자동 리프레시로 결과 화면이 사라짐)

  return { newBadges: toAward as string[], score, results }
}

// ─── 결과 화면 확인 후 대시보드 캐시 무효화 ────────────────────────────────────
//
// submitMissionAnswers에서 즉시 revalidateTag를 호출하면 Next.js가 현재 라우트를
// 자동으로 리프레시하면서 미션 완료 여부가 바뀐 서버 컴포넌트가 결과 화면을
// 곧바로 덮어써버린다. 학생이 결과를 확인하고 완료 버튼을 눌러 페이지를
// 벗어날 때 별도로 호출한다.

export async function revalidateMissionDashboard() {
  const auth = await getAuthedStudent()
  if (!auth) return
  revalidateTag(`student-${auth.studentId}-dashboard`)
}

// ─── 대시보드 전체 데이터 캐싱 (30초) ────────────────────────────────────────
// 미션 확인/생성, 핵심 지표, 최근 활동, 문제 미리보기를 모두 캐시 안에서 처리.
// 캐시 히트 시 DB 쿼리 0건 → ~5ms 응답.
// 미션 완료 시 revalidateTag(`student-${studentId}-dashboard`)로 즉시 무효화.

const getCachedDashboardData = (studentId: string) =>
  unstable_cache(
    async () => {
      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)
      const weekStart = new Date()
      weekStart.setDate(weekStart.getDate() - weekStart.getDay())
      weekStart.setHours(0, 0, 0, 0)

      // ── 미션 확인 (없으면 새 엔진으로 생성) ─────────────────────────────
      const missionPromise = (async () => {
        let mission = await prisma.dailyMission.findFirst({
          where: { studentId, missionDate: { gte: todayStart } },
        })
        if (!mission) {
          try {
            mission = await buildDailyMissions(studentId)
          } catch {
            mission = await prisma.dailyMission.findFirst({
              where: { studentId, missionDate: { gte: todayStart } },
            })
          }
        }
        return mission
      })()

      // ── 나머지 전체를 미션 조회와 동시에 단일 웨이브로 병렬 실행 ─────────
      // (원격 DB RTT가 병목이므로 순차 웨이브를 만들지 않는다)
      const [
        mission,
        streak,
        student,
        weeklyCount,
        completedSessions,
        badgeEarnings,
        assessments,
        upcomingSessions,
        completedMissions,
        dueWordCount,
      ] = await Promise.all([
        missionPromise,
        prisma.studentStreak.findUnique({
          where: { studentId },
          select: { currentStreak: true, longestStreak: true, lastActivityDate: true, totalDays: true },
        }),
        prisma.student.findUnique({
          where: { id: studentId },
          select: { currentLevel: true, weeklyGoalTarget: true, totalXp: true },
        }),
        prisma.questionResponse.count({
          where: {
            session: {
              studentId,
              status: { in: ['COMPLETED', 'GRADED'] },
              completedAt: { gte: weekStart },
            },
          },
        }),
        prisma.testSession.findMany({
          where: { studentId, status: { in: ['COMPLETED', 'GRADED'] }, completedAt: { not: null } },
          select: { id: true, score: true, completedAt: true, test: { select: { title: true } } },
          orderBy: { completedAt: 'desc' },
          take: 5,
        }),
        prisma.badgeEarning.findMany({
          where: { studentId },
          select: { id: true, earnedAt: true, badge: { select: { name: true, iconUrl: true } } },
          orderBy: { earnedAt: 'desc' },
          take: 5,
        }),
        prisma.skillAssessment.findMany({
          where: { studentId },
          orderBy: { assessedAt: 'desc' },
          take: 50,
          select: { domain: true, score: true },
        }),
        prisma.testSession.findMany({
          where: { studentId, status: 'NOT_STARTED' },
          select: {
            id: true,
            timeLimitMin: true,
            test: { select: { title: true, isActive: true, totalScore: true } },
          },
          orderBy: { startedAt: 'asc' },
          take: 3,
        }),
        prisma.dailyMission.findMany({
          where: { studentId, isCompleted: true },
          select: { id: true, domainFocus: true, questionIds: true, completedAt: true },
          orderBy: { completedAt: 'desc' },
          take: 5,
        }),
        prisma.wordProgress.count({
          where: { studentId, nextReviewAt: { lte: new Date() } },
        }),
      ])

      // 미션 문제 미리보기 (미완료 미션이 있을 때만 1회 추가 조회)
      const missionIds = !mission?.isCompleted ? (mission?.questionIds as string[] | undefined) ?? [] : []
      const missionQuestions =
        missionIds.length > 0
          ? await prisma.question.findMany({
              where: { id: { in: missionIds } },
              select: { id: true, domain: true, difficulty: true },
            })
          : []

      // Date → ISO 문자열 직렬화
      return {
        mission: mission
          ? {
              ...mission,
              missionDate: mission.missionDate.toISOString(),
              completedAt: mission.completedAt?.toISOString() ?? null,
              createdAt: mission.createdAt.toISOString(),
            }
          : null,
        streak: streak
          ? { ...streak, lastActivityDate: streak.lastActivityDate?.toISOString() ?? null }
          : null,
        student,
        weeklyCount,
        completedSessions: completedSessions.map((s) => ({
          ...s,
          completedAt: s.completedAt?.toISOString() ?? null,
        })),
        badgeEarnings: badgeEarnings.map((b) => ({
          ...b,
          earnedAt: b.earnedAt.toISOString(),
        })),
        assessments,
        upcomingSessions,
        completedMissions: completedMissions.map((m) => ({
          ...m,
          completedAt: m.completedAt?.toISOString() ?? null,
        })),
        missionQuestions: missionIds.map((id) => missionQuestions.find((q) => q.id === id)).filter(
          (q): q is { id: string; domain: QuestionDomain; difficulty: number } => Boolean(q),
        ),
        dueWordCount,
      }
    },
    ['student-dashboard', studentId],
    { revalidate: 30, tags: [`student-${studentId}-dashboard`] },
  )()

// ─── Unified student dashboard data ──────────────────────────────────────────

export async function getStudentDashboardData() {
  const auth = await getAuthedStudent()
  if (!auth) return null
  const { studentId } = auth

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  // 모든 쿼리가 캐시 안에 있음 → 캐시 히트 시 DB 왕복 0건
  const [
    {
      mission: rawMission,
      streak: cachedStreak,
      student,
      weeklyCount,
      completedSessions: rawSessions,
      badgeEarnings: rawBadges,
      assessments,
      upcomingSessions,
      completedMissions: rawMissions,
      missionQuestions,
      dueWordCount,
    },
    promotionProgress,
  ] = await Promise.all([
    getCachedDashboardData(studentId),
    getPromotionProgress(studentId),
  ])

  // ISO 문자열 → Date 역직렬화
  const mission = rawMission
    ? {
        ...rawMission,
        missionDate: new Date(rawMission.missionDate),
        completedAt: rawMission.completedAt ? new Date(rawMission.completedAt) : null,
        createdAt: new Date(rawMission.createdAt),
      }
    : null
  const streak = cachedStreak
    ? {
        ...cachedStreak,
        lastActivityDate: cachedStreak.lastActivityDate
          ? new Date(cachedStreak.lastActivityDate)
          : null,
      }
    : null
  const completedSessions = rawSessions.map((s) => ({
    ...s,
    completedAt: s.completedAt ? new Date(s.completedAt) : null,
  }))
  const badgeEarnings = rawBadges.map((b) => ({
    ...b,
    earnedAt: new Date(b.earnedAt),
  }))
  const completedMissions = rawMissions.map((m) => ({
    ...m,
    completedAt: m.completedAt ? new Date(m.completedAt) : null,
  }))

  // ── Derived values ────────────────────────────────────────────────────────
  const isActiveToday = streak?.lastActivityDate
    ? streak.lastActivityDate >= todayStart
    : false

  const scoredSessions = completedSessions.filter((s) => s.score !== null)
  const recentAvgScore =
    scoredSessions.length >= 3
      ? Math.round(scoredSessions.slice(0, 3).reduce((s, r) => s + (r.score ?? 0), 0) / 3)
      : null

  const domainList: QuestionDomain[] = ['GRAMMAR', 'VOCABULARY', 'READING', 'WRITING']
  const domainScores: Record<string, number> = {}
  for (const domain of domainList) {
    const relevant = assessments.filter((a) => a.domain === domain)
    domainScores[domain] =
      relevant.length > 0
        ? Math.round(relevant.reduce((s, a) => s + (a.score ?? 0), 0) / relevant.length)
        : 0
  }

  type ActivityItem = {
    id: string
    type: 'test' | 'badge' | 'mission'
    label: string
    detail?: string
    time: Date
    emoji: string
  }
  const activities: ActivityItem[] = []
  for (const s of completedSessions) {
    if (s.completedAt) {
      activities.push({
        id: s.id,
        type: 'test',
        label: s.test.title + ' 완료',
        detail: s.score !== null ? `${s.score}점` : undefined,
        time: s.completedAt,
        emoji: '📝',
      })
    }
  }
  for (const b of badgeEarnings) {
    activities.push({
      id: b.id,
      type: 'badge',
      label: `${b.badge.name} 배지 획득!`,
      time: b.earnedAt,
      emoji: b.badge.iconUrl ?? '🏅',
    })
  }
  for (const m of completedMissions) {
    if (m.completedAt) {
      activities.push({
        id: m.id,
        type: 'mission',
        label: `${DASH_DOMAIN_LABEL[m.domainFocus ?? ''] ?? '영어'} 오늘의 미션 완료`,
        detail: `${(m.questionIds as string[]).length}문제`,
        time: m.completedAt,
        emoji: '✅',
      })
    }
  }
  activities.sort((a, b) => b.time.getTime() - a.time.getTime())

  return {
    mission,
    streak: streak ?? { currentStreak: 0, longestStreak: 0, lastActivityDate: null, totalDays: 0 },
    isActiveToday,
    weeklyQuestionCount: weeklyCount,
    weeklyGoal: student?.weeklyGoalTarget ?? 20,
    currentLevel: student?.currentLevel ?? 1,
    totalXp: student?.totalXp ?? 0,
    recentAvgScore,
    domainScores,
    upcomingSessions: upcomingSessions.filter((s) => s.test.isActive),
    recentActivities: activities.slice(0, 3),
    missionQuestions,
    promotionProgress,
    dueWordCount,
  }
}

const DASH_DOMAIN_LABEL: Record<string, string> = {
  GRAMMAR: 'Grammar',
  VOCABULARY: 'Vocabulary',
  READING: 'Reading',
  WRITING: 'Writing',
}

// ─── Seed system badges ───────────────────────────────────────────────────────

export async function seedSystemBadges() {
  const BADGE_DEFS: { code: BadgeType; name: string; description: string; iconUrl: string }[] = [
    { code: 'STREAK_3', name: '3일 연속', description: '3일 연속으로 학습했어요!', iconUrl: '🔥' },
    { code: 'STREAK_7', name: '7일 연속', description: '1주일 연속 학습 달성!', iconUrl: '⚡' },
    { code: 'STREAK_14', name: '14일 연속', description: '2주 연속 학습 달성!', iconUrl: '💫' },
    { code: 'STREAK_30', name: '30일 연속', description: '한 달 연속 학습 달성!', iconUrl: '🌟' },
    { code: 'STREAK_100', name: '100일 연속', description: '100일 연속 학습! 전설의 학습자!', iconUrl: '👑' },
    { code: 'FIRST_TEST', name: '첫 테스트', description: '첫 번째 테스트를 완료했어요!', iconUrl: '🎯' },
    { code: 'PERFECT_SCORE', name: '퍼펙트!', description: '테스트에서 100점을 받았어요!', iconUrl: '💯' },
    { code: 'SPEED_DEMON', name: '빠른 영웅', description: '시간 절반 안에 테스트를 완료했어요!', iconUrl: '⚡' },
    { code: 'LEVEL_UP', name: '레벨업!', description: '영어 레벨이 올라갔어요!', iconUrl: '🆙' },
    { code: 'MASTER', name: '마스터', description: 'Level 10 C1+ 최고 레벨에 도달했어요!', iconUrl: '🏆' },
    { code: 'WEEKLY_GOAL', name: '주간 목표', description: '이번 주 20문제 목표 달성!', iconUrl: '🎉' },
    { code: 'MISSION_COMPLETE', name: '미션 클리어', description: '오늘의 미션을 완료했어요!', iconUrl: '✅' },
  ]

  let created = 0
  for (const def of BADGE_DEFS) {
    await prisma.badge.upsert({
      where: { code: def.code },
      create: def,
      update: { name: def.name, description: def.description, iconUrl: def.iconUrl },
    })
    created++
  }
  return { created }
}
