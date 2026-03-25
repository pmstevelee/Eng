'use server'

import { prisma } from '@/lib/prisma/client'
import { createClient } from '@/lib/supabase/server'
import { BadgeType, QuestionDomain } from '@/generated/prisma'
import { calcLevelFromScore } from '@/app/(dashboard)/student/_utils/level'

// ─── Auth helper ─────────────────────────────────────────────────────────────

async function getAuthedStudent() {
  const supabase = await createClient()
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()
  if (!authUser) return null

  const user = await prisma.user.findUnique({
    where: { id: authUser.id, isDeleted: false },
    select: { id: true, role: true, student: { select: { id: true } } },
  })
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
        select: { currentLevel: true },
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
    weeklyGoal: 20,
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
  const existingStreak = await prisma.studentStreak.findUnique({ where: { studentId } })

  let newStreakValue = 1
  let isNewDay = true

  if (existingStreak?.lastActivityDate) {
    const last = new Date(existingStreak.lastActivityDate)
    last.setHours(0, 0, 0, 0)
    const diffDays = Math.round((todayStart.getTime() - last.getTime()) / 86400000)
    if (diffDays === 0) {
      newStreakValue = existingStreak.currentStreak
      isNewDay = false
    } else if (diffDays === 1) {
      newStreakValue = existingStreak.currentStreak + 1
    } else {
      newStreakValue = 1
    }
  }

  const updatedStreak = await prisma.studentStreak.upsert({
    where: { studentId },
    create: {
      studentId,
      currentStreak: 1,
      longestStreak: 1,
      lastActivityDate: new Date(),
      totalDays: 1,
    },
    update: {
      currentStreak: newStreakValue,
      longestStreak: Math.max(existingStreak?.longestStreak ?? 0, newStreakValue),
      lastActivityDate: new Date(),
      totalDays: isNewDay ? (existingStreak?.totalDays ?? 0) + 1 : (existingStreak?.totalDays ?? 1),
    },
  })

  // 2. Mark today's mission complete if exists
  const mission = await prisma.dailyMission.findFirst({
    where: { studentId, missionDate: { gte: todayStart }, isCompleted: false },
  })
  if (mission) {
    await prisma.dailyMission.update({
      where: { id: mission.id },
      data: { isCompleted: true, completedAt: new Date() },
    })
  }

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
    if (updatedStreak.currentStreak >= threshold && !earned.has(code)) toAward.push(code)
  }

  // Weekly goal
  const weekStart = new Date()
  weekStart.setDate(weekStart.getDate() - weekStart.getDay())
  weekStart.setHours(0, 0, 0, 0)
  const weeklyCount = await prisma.questionResponse.count({
    where: {
      session: {
        studentId,
        status: { in: ['COMPLETED', 'GRADED'] },
        completedAt: { gte: weekStart },
      },
    },
  })
  if (weeklyCount >= 20 && !earned.has('WEEKLY_GOAL')) toAward.push('WEEKLY_GOAL')

  // Mission complete
  if (mission && !earned.has('MISSION_COMPLETE')) toAward.push('MISSION_COMPLETE')

  // 4. Level up check (last 3 sessions avg)
  const recent3 = await prisma.testSession.findMany({
    where: { studentId, status: { in: ['COMPLETED', 'GRADED'] }, score: { not: null } },
    orderBy: { completedAt: 'desc' },
    take: 3,
    select: { score: true },
  })
  if (recent3.length >= 3) {
    const avg = recent3.reduce((s, r) => s + (r.score ?? 0), 0) / 3
    const newLevel = calcLevelFromScore(avg)
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: { currentLevel: true },
    })
    if (student && newLevel > student.currentLevel) {
      await prisma.student.update({ where: { id: studentId }, data: { currentLevel: newLevel } })
      if (!earned.has('LEVEL_UP')) toAward.push('LEVEL_UP')
      if (newLevel >= 7 && !earned.has('MASTER')) toAward.push('MASTER')
    }
  }

  // 5. Award badges
  for (const code of toAward) {
    const badge = await prisma.badge.findFirst({ where: { code } })
    if (badge) {
      try {
        await prisma.badgeEarning.create({ data: { studentId, badgeId: badge.id } })
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

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const existing = await prisma.dailyMission.findFirst({
    where: { studentId, missionDate: { gte: todayStart } },
  })
  if (existing) return existing

  // Find weakest domain from recent assessments
  const assessments = await prisma.skillAssessment.findMany({
    where: { studentId },
    orderBy: { assessedAt: 'desc' },
    take: 20,
  })

  const domainScores: Record<string, { sum: number; count: number }> = {}
  for (const a of assessments) {
    if (!domainScores[a.domain]) domainScores[a.domain] = { sum: 0, count: 0 }
    domainScores[a.domain].sum += a.score ?? 0
    domainScores[a.domain].count++
  }

  const domains: QuestionDomain[] = ['GRAMMAR', 'VOCABULARY', 'READING', 'WRITING']
  let weakestDomain: QuestionDomain = 'GRAMMAR'
  let lowestScore = Infinity

  for (const domain of domains) {
    const stats = domainScores[domain]
    if (stats && stats.count > 0) {
      const avg = stats.sum / stats.count
      if (avg < lowestScore) {
        lowestScore = avg
        weakestDomain = domain
      }
    }
  }

  // Pick 5 questions from weakest domain
  const questions = await prisma.question.findMany({
    where: { domain: weakestDomain },
    take: 5,
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  })

  if (questions.length === 0) return null

  return prisma.dailyMission.create({
    data: {
      studentId,
      missionDate: new Date(),
      questionIds: questions.map((q) => q.id),
      domainFocus: weakestDomain,
      isCompleted: false,
    },
  })
}

// ─── Get mission questions detail ────────────────────────────────────────────

export async function getDailyMissionWithQuestions() {
  const auth = await getAuthedStudent()
  if (!auth) return null
  const { studentId } = auth

  const mission = await generateOrGetDailyMission()
  if (!mission) return null

  const questionIds = mission.questionIds as string[]
  const questions = await prisma.question.findMany({
    where: { id: { in: questionIds } },
    select: { id: true, domain: true, difficulty: true, cefrLevel: true, contentJson: true },
  })

  // preserve order
  const ordered = questionIds
    .map((id) => questions.find((q) => q.id === id))
    .filter(Boolean) as typeof questions

  return { mission, questions: ordered, studentId }
}

// ─── Submit mission answers ───────────────────────────────────────────────────

export async function submitMissionAnswers(
  missionId: string,
  answers: { questionId: string; answer: string }[],
): Promise<{ error?: string; newBadges?: string[]; score?: number }> {
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
  }

  let correct = 0
  let total = 0

  for (const q of questions) {
    const content = q.contentJson as ContentJson
    if (content.type === 'essay') continue
    if (!content.correct_answer) continue

    total++
    const studentAnswer = answers.find((a) => a.questionId === q.id)?.answer ?? ''
    if (studentAnswer.toLowerCase().trim() === content.correct_answer.toLowerCase().trim()) {
      correct++
    }

    // Record skill assessment
    await prisma.skillAssessment.create({
      data: {
        studentId,
        domain: q.domain,
        level: 1,
        score: studentAnswer.toLowerCase().trim() === content.correct_answer.toLowerCase().trim() ? 100 : 0,
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
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const existingStreak = await prisma.studentStreak.findUnique({ where: { studentId } })
  let newStreakValue = 1
  let isNewDay = true

  if (existingStreak?.lastActivityDate) {
    const last = new Date(existingStreak.lastActivityDate)
    last.setHours(0, 0, 0, 0)
    const diffDays = Math.round((todayStart.getTime() - last.getTime()) / 86400000)
    if (diffDays === 0) {
      newStreakValue = existingStreak.currentStreak
      isNewDay = false
    } else if (diffDays === 1) {
      newStreakValue = existingStreak.currentStreak + 1
    }
  }

  const updatedStreak = await prisma.studentStreak.upsert({
    where: { studentId },
    create: {
      studentId,
      currentStreak: 1,
      longestStreak: 1,
      lastActivityDate: new Date(),
      totalDays: 1,
    },
    update: {
      currentStreak: newStreakValue,
      longestStreak: Math.max(existingStreak?.longestStreak ?? 0, newStreakValue),
      lastActivityDate: new Date(),
      totalDays: isNewDay
        ? (existingStreak?.totalDays ?? 0) + 1
        : existingStreak?.totalDays ?? 1,
    },
  })

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
    if (updatedStreak.currentStreak >= threshold && !earned.has(code)) toAward.push(code)
  }

  for (const code of toAward) {
    const badge = await prisma.badge.findFirst({ where: { code } })
    if (badge) {
      try {
        await prisma.badgeEarning.create({ data: { studentId, badgeId: badge.id } })
      } catch {
        // already earned
      }
    }
  }

  return { newBadges: toAward as string[], score }
}

// ─── Unified student dashboard data (connection-pool-safe) ───────────────────
//
// Runs queries in sequential batches (max 3 per batch) to stay within
// Supabase's transaction-pooler connection_limit: 1 / timeout: 10s.

export async function getStudentDashboardData() {
  const auth = await getAuthedStudent()
  if (!auth) return null
  const { studentId } = auth

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const weekStart = new Date()
  weekStart.setDate(weekStart.getDate() - weekStart.getDay())
  weekStart.setHours(0, 0, 0, 0)

  // ── Step 1: Check for today's mission ─────────────────────────────────────
  let mission = await prisma.dailyMission.findFirst({
    where: { studentId, missionDate: { gte: todayStart } },
  })

  // ── Step 2: Create mission if it doesn't exist yet ────────────────────────
  if (!mission) {
    const recentAssessments = await prisma.skillAssessment.findMany({
      where: { studentId },
      orderBy: { assessedAt: 'desc' },
      take: 20,
      select: { domain: true, score: true },
    })
    const weakestDomain = pickWeakestDomain(recentAssessments)
    const questionPool = await prisma.question.findMany({
      where: { domain: weakestDomain },
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    })
    if (questionPool.length > 0) {
      try {
        mission = await prisma.dailyMission.create({
          data: {
            studentId,
            missionDate: new Date(),
            questionIds: questionPool.map((q) => q.id),
            domainFocus: weakestDomain,
            isCompleted: false,
          },
        })
      } catch {
        // Race condition: another request already created it
        mission = await prisma.dailyMission.findFirst({
          where: { studentId, missionDate: { gte: todayStart } },
        })
      }
    }
  }

  // ── Step 3: Core metrics (streak, level, weekly count) ────────────────────
  const [streak, student, weeklyCount] = await Promise.all([
    prisma.studentStreak.findUnique({ where: { studentId } }),
    prisma.student.findUnique({
      where: { id: studentId },
      select: { currentLevel: true },
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

  // ── Step 4: Sessions, badges, and skill assessments ───────────────────────
  const [completedSessions, badgeEarnings, assessments] = await Promise.all([
    prisma.testSession.findMany({
      where: {
        studentId,
        status: { in: ['COMPLETED', 'GRADED'] },
        completedAt: { not: null },
      },
      select: {
        id: true,
        score: true,
        completedAt: true,
        test: { select: { title: true } },
      },
      orderBy: { completedAt: 'desc' },
      take: 5,
    }),
    prisma.badgeEarning.findMany({
      where: { studentId },
      select: {
        id: true,
        earnedAt: true,
        badge: { select: { name: true, iconUrl: true } },
      },
      orderBy: { earnedAt: 'desc' },
      take: 5,
    }),
    prisma.skillAssessment.findMany({
      where: { studentId },
      orderBy: { assessedAt: 'desc' },
      take: 50,
      select: { domain: true, score: true },
    }),
  ])

  // ── Step 5: Upcoming tests and completed missions ─────────────────────────
  const [upcomingSessions, completedMissions] = await Promise.all([
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
  ])

  // ── Step 6: Mission question preview ──────────────────────────────────────
  type MissionQuestion = { id: string; domain: QuestionDomain; difficulty: number }
  let missionQuestions: MissionQuestion[] = []
  if (mission && !mission.isCompleted) {
    const ids = mission.questionIds as string[]
    if (ids.length > 0) {
      const qs = await prisma.question.findMany({
        where: { id: { in: ids } },
        select: { id: true, domain: true, difficulty: true },
      })
      missionQuestions = ids
        .map((id) => qs.find((q) => q.id === id))
        .filter((q): q is MissionQuestion => Boolean(q))
    }
  }

  // ── Derived values ────────────────────────────────────────────────────────
  const isActiveToday = streak?.lastActivityDate
    ? new Date(streak.lastActivityDate) >= todayStart
    : false

  const scoredSessions = completedSessions.filter((s) => s.score !== null)
  const recentAvgScore =
    scoredSessions.length >= 3
      ? Math.round(
          scoredSessions.slice(0, 3).reduce((s, r) => s + (r.score ?? 0), 0) / 3,
        )
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
    weeklyGoal: 20,
    currentLevel: student?.currentLevel ?? 1,
    recentAvgScore,
    domainScores,
    upcomingSessions: upcomingSessions.filter((s) => s.test.isActive),
    recentActivities: activities.slice(0, 3),
    missionQuestions,
  }
}

function pickWeakestDomain(
  assessments: Array<{ domain: QuestionDomain; score: number | null }>,
): QuestionDomain {
  const domains: QuestionDomain[] = ['GRAMMAR', 'VOCABULARY', 'READING', 'WRITING']
  let weakest: QuestionDomain = 'GRAMMAR'
  let lowestAvg = Infinity
  for (const domain of domains) {
    const relevant = assessments.filter((a) => a.domain === domain)
    if (relevant.length > 0) {
      const avg = relevant.reduce((s, a) => s + (a.score ?? 0), 0) / relevant.length
      if (avg < lowestAvg) {
        lowestAvg = avg
        weakest = domain
      }
    }
  }
  return weakest
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
    { code: 'MASTER', name: '마스터', description: 'C2 최고 레벨에 도달했어요!', iconUrl: '🏆' },
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
