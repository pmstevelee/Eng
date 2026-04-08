'use server'

import { revalidateTag } from 'next/cache'
import { prisma } from '@/lib/prisma/client'
import { getCurrentUser } from '@/lib/auth'
import { updateStreak } from '@/lib/missions/streak-manager'
import { awardXP, BADGE_XP } from '@/lib/missions/xp-manager'
import { BadgeType, QuestionDomain } from '@/generated/prisma'
import { checkPromotionStatus } from '@/lib/assessment/promotion-engine'

// ── Types ─────────────────────────────────────────────────────────────────────

type AnsweredQuestion = {
  questionId: string
  answer: string
  isCorrect: boolean
  xpEarned: number
}

type MissionItemRaw = {
  id: string
  type: string
  title: string
  description: string
  domain: string | null
  subCategory: string | null
  questionIds: string[]
  questionCount: number
  xpReward: number
  status: string
  completedAt: string | null
  correctCount: number
  order: number
  reason: string
  answeredQuestions?: AnsweredQuestion[]
}

export type SubmitAnswerResult = {
  error?: string
  isCorrect?: boolean
  correctAnswer?: string
  explanation?: string
  tip?: string
  xpEarned?: number
  categoryAccuracy?: number | null
  prevCategoryAccuracy?: number | null
  domainLabel?: string
}

export type CompleteMissionResult = {
  error?: string
  correctCount?: number
  totalCount?: number
  xpEarned?: number
  categoryAccuracy?: number | null
  prevCategoryAccuracy?: number | null
  nextMission?: { index: number; title: string } | null
  streakBonusXp?: number
  newBadges?: string[]
  isAllComplete?: boolean
}

// ── Auth helper ───────────────────────────────────────────────────────────────

async function getAuthedStudent() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'STUDENT') return null
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id, isDeleted: false },
    select: { student: { select: { id: true } } },
  })
  if (!dbUser?.student) return null
  return { studentId: dbUser.student.id }
}

const DOMAIN_LABEL: Record<string, string> = {
  GRAMMAR: '문법',
  VOCABULARY: '어휘',
  READING: '읽기',
  WRITING: '쓰기',
}

// ── Spaced repetition interval (days) based on consecutive correct count ──────

function calcNextReviewDays(consecutiveCorrect: number): number {
  const intervals = [1, 3, 7, 14, 30]
  return intervals[Math.min(consecutiveCorrect - 1, intervals.length - 1)] ?? 30
}

// ── submitMissionAnswer ───────────────────────────────────────────────────────
//
// 문제 하나 제출 → 즉시 피드백 반환
// 1. 정답 체크
// 2. question_responses 스페이스드 리피티션 업데이트 (기존 응답이 있을 경우)
// 3. SkillAssessment 기록
// 4. XP 적립
// 5. Student.weeklyGoalCurrent + 1
// 6. missions_json.answeredQuestions 업데이트

export async function submitMissionAnswer(
  dailyMissionId: string,
  missionIndex: number,
  questionId: string,
  answer: string,
): Promise<SubmitAnswerResult> {
  const auth = await getAuthedStudent()
  if (!auth) return { error: '권한이 없습니다.' }
  const { studentId } = auth

  // 미션 + 문제 병렬 조회
  const [mission, question] = await Promise.all([
    prisma.dailyMission.findUnique({ where: { id: dailyMissionId } }),
    prisma.question.findUnique({
      where: { id: questionId },
      select: {
        id: true,
        domain: true,
        subCategory: true,
        contentJson: true,
      },
    }),
  ])

  if (!mission || mission.studentId !== studentId) return { error: '미션을 찾을 수 없습니다.' }
  if (!question) return { error: '문제를 찾을 수 없습니다.' }

  const missionsJson = (mission.missionsJson ?? []) as MissionItemRaw[]
  const missionItem = missionsJson[missionIndex]
  if (!missionItem) return { error: '미션 정보를 찾을 수 없습니다.' }

  // 중복 제출 방지
  const alreadyAnswered = missionItem.answeredQuestions?.some(
    (a) => a.questionId === questionId,
  )
  if (alreadyAnswered) return { error: '이미 답변한 문제입니다.' }

  // ── 정답 체크 ──────────────────────────────────────────────────────────────

  type ContentJson = {
    type: string
    correct_answer?: string
    explanation?: string
    options?: string[]
  }
  const content = question.contentJson as ContentJson
  const isEssay = content.type === 'essay'
  const correctAnswer = content.correct_answer ?? ''
  const isCorrect = isEssay
    ? false
    : answer.toLowerCase().trim() === correctAnswer.toLowerCase().trim()

  // ── XP 계산 ────────────────────────────────────────────────────────────────

  const perQuestionXP =
    missionItem.questionCount > 0
      ? Math.floor(missionItem.xpReward / missionItem.questionCount)
      : 5
  const isChallenge = missionItem.type === 'CHALLENGE'
  const xpEarned = isEssay ? 5 : isCorrect ? perQuestionXP : isChallenge ? 5 : 0

  // ── 이전 카테고리 정확도 조회 ───────────────────────────────────────────────

  const domainAssessmentsBefore = await prisma.skillAssessment.findMany({
    where: { studentId, domain: question.domain },
    orderBy: { assessedAt: 'desc' },
    take: 10,
    select: { score: true },
  })
  const prevCategoryAccuracy =
    domainAssessmentsBefore.length > 0
      ? Math.round(
          domainAssessmentsBefore.reduce((s, a) => s + (a.score ?? 0), 0) /
            domainAssessmentsBefore.length,
        )
      : null

  // ── DB 업데이트 (병렬) ─────────────────────────────────────────────────────

  // 스페이스드 리피티션: 기존 question_response 가 있으면 업데이트
  const existingResponse = await prisma.questionResponse.findFirst({
    where: { questionId, session: { studentId } },
    orderBy: { createdAt: 'desc' },
    select: { id: true, consecutiveCorrect: true },
  })

  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setHours(0, 0, 0, 0)

  await Promise.all([
    // SkillAssessment 기록 (essay 제외)
    isEssay
      ? Promise.resolve()
      : prisma.skillAssessment.create({
          data: {
            studentId,
            domain: question.domain,
            level: 1,
            score: isCorrect ? 100 : 0,
            notes: `미션: ${missionItem.title}`,
          },
        }),

    // 스페이스드 리피티션 업데이트 (기존 응답 있을 때만)
    existingResponse
      ? (() => {
          const newConsecutive = isCorrect ? existingResponse.consecutiveCorrect + 1 : 0
          const reviewDueAt = isCorrect
            ? (() => {
                const d = new Date()
                d.setDate(d.getDate() + calcNextReviewDays(newConsecutive))
                return d
              })()
            : tomorrow
          return prisma.questionResponse.update({
            where: { id: existingResponse.id },
            data: {
              consecutiveCorrect: newConsecutive,
              reviewDueAt,
              reviewCount: { increment: 1 },
              isMastered: newConsecutive >= 5,
            },
          })
        })()
      : Promise.resolve(),

    // 주간 목표 +1
    prisma.student.update({
      where: { id: studentId },
      data: { weeklyGoalCurrent: { increment: 1 } },
    }),
  ])

  // XP 적립
  if (xpEarned > 0) {
    await awardXP(studentId, xpEarned, 'MISSION_ANSWER', dailyMissionId)
  }

  // missions_json answeredQuestions 업데이트
  const answeredQuestion: AnsweredQuestion = { questionId, answer, isCorrect, xpEarned }
  const updatedMissions = missionsJson.map((m, idx) => {
    if (idx !== missionIndex) return m
    return {
      ...m,
      status: m.status === 'AVAILABLE' ? 'IN_PROGRESS' : m.status,
      answeredQuestions: [...(m.answeredQuestions ?? []), answeredQuestion],
    }
  })

  await prisma.dailyMission.update({
    where: { id: dailyMissionId },
    data: { missionsJson: updatedMissions as object[] },
  })

  // 업데이트 후 카테고리 정확도
  const domainAssessmentsAfter = await prisma.skillAssessment.findMany({
    where: { studentId, domain: question.domain },
    orderBy: { assessedAt: 'desc' },
    take: 10,
    select: { score: true },
  })
  const categoryAccuracy =
    domainAssessmentsAfter.length > 0
      ? Math.round(
          domainAssessmentsAfter.reduce((s, a) => s + (a.score ?? 0), 0) /
            domainAssessmentsAfter.length,
        )
      : null

  return {
    isCorrect,
    correctAnswer,
    explanation: content.explanation,
    xpEarned,
    categoryAccuracy,
    prevCategoryAccuracy,
    domainLabel: DOMAIN_LABEL[question.domain] ?? question.domain,
  }
}

// ── completeMission ───────────────────────────────────────────────────────────
//
// 한 미션의 모든 문제 완료 시 호출
// 1. missions_json: status = "COMPLETED"
// 2. completedMissions + 1
// 3. 다음 미션 AVAILABLE
// 4. MISSION_COMPLETE 배지 체크
// 5. 전체 완료 시: isCompleted, updateStreak, streak bonus XP, streak badges

export async function completeMission(
  dailyMissionId: string,
  missionIndex: number,
): Promise<CompleteMissionResult> {
  const auth = await getAuthedStudent()
  if (!auth) return { error: '권한이 없습니다.' }
  const { studentId } = auth

  const mission = await prisma.dailyMission.findUnique({ where: { id: dailyMissionId } })
  if (!mission || mission.studentId !== studentId) return { error: '미션을 찾을 수 없습니다.' }

  const missionsJson = (mission.missionsJson ?? []) as MissionItemRaw[]
  const missionItem = missionsJson[missionIndex]
  if (!missionItem) return { error: '미션 정보를 찾을 수 없습니다.' }

  // 이미 완료된 미션 체크
  if (missionItem.status === 'COMPLETED') {
    return { error: '이미 완료된 미션입니다.' }
  }

  // 점수 계산
  const answered = missionItem.answeredQuestions ?? []
  const correctCount = answered.filter((a) => a.isCorrect).length
  const totalCount = missionItem.questionCount
  const xpEarned = answered.reduce((sum, a) => sum + a.xpEarned, 0)

  // 이전 카테고리 정확도 (완료 전)
  let prevCategoryAccuracy: number | null = null
  if (missionItem.domain) {
    const domainBefore = await prisma.skillAssessment.findMany({
      where: { studentId, domain: missionItem.domain as QuestionDomain },
      orderBy: { assessedAt: 'desc' },
      // 마지막 답 제출 전 데이터 (총 10개 중 최신 것 제외)
      take: 10,
      skip: totalCount, // 방금 제출한 것들 제외
      select: { score: true },
    })
    if (domainBefore.length > 0) {
      prevCategoryAccuracy = Math.round(
        domainBefore.reduce((s, a) => s + (a.score ?? 0), 0) / domainBefore.length,
      )
    }
  }

  // missions_json 업데이트
  const nextIndex = missionIndex + 1
  const hasNext = nextIndex < missionsJson.length
  const updatedMissions = missionsJson.map((m, idx) => {
    if (idx === missionIndex) {
      return {
        ...m,
        status: 'COMPLETED',
        completedAt: new Date().toISOString(),
        correctCount,
      }
    }
    if (idx === nextIndex && m.status === 'LOCKED') {
      return { ...m, status: 'AVAILABLE' }
    }
    return m
  })

  const newCompletedCount = mission.completedMissions + 1
  const isAllComplete = newCompletedCount >= mission.totalMissions

  // 배지 체크
  const existingEarnings = await prisma.badgeEarning.findMany({
    where: { studentId },
    include: { badge: true },
  })
  const earned = new Set(existingEarnings.map((e) => e.badge.code).filter(Boolean))
  const toAward: BadgeType[] = []

  if (!earned.has('MISSION_COMPLETE')) toAward.push('MISSION_COMPLETE')

  let streakBonusXp = 0

  if (isAllComplete) {
    const streakResult = await updateStreak(studentId)

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

    // 스트릭 보너스 XP
    const streakBonuses = [
      { threshold: 30, xp: 100 },
      { threshold: 14, xp: 50 },
      { threshold: 7, xp: 25 },
      { threshold: 3, xp: 10 },
    ]
    for (const { threshold, xp } of streakBonuses) {
      if (streakResult.currentStreak >= threshold) {
        streakBonusXp = xp
        break
      }
    }
    if (streakBonusXp > 0) {
      await awardXP(studentId, streakBonusXp, 'STREAK_BONUS', dailyMissionId)
    }
  }

  // DB 업데이트
  await prisma.dailyMission.update({
    where: { id: dailyMissionId },
    data: {
      missionsJson: updatedMissions as object[],
      completedMissions: newCompletedCount,
      xpEarned: { increment: xpEarned },
      ...(isAllComplete
        ? {
            isCompleted: true,
            completedAt: new Date(),
            streakCounted: true,
          }
        : {}),
    },
  })

  // 배지 수여
  const newBadges: string[] = []
  for (const code of toAward) {
    const badge = await prisma.badge.findFirst({ where: { code } })
    if (badge) {
      try {
        const badgeEarning = await prisma.badgeEarning.create({
          data: { studentId, badgeId: badge.id },
        })
        const xpAmount = BADGE_XP[code]
        if (xpAmount) await awardXP(studentId, xpAmount, 'BADGE_EARNED', badgeEarning.id)
        newBadges.push(code)
      } catch {
        // 이미 획득한 배지
      }
    }
  }

  // 최신 카테고리 정확도
  let categoryAccuracy: number | null = null
  if (missionItem.domain) {
    const domainAfter = await prisma.skillAssessment.findMany({
      where: { studentId, domain: missionItem.domain as QuestionDomain },
      orderBy: { assessedAt: 'desc' },
      take: 10,
      select: { score: true },
    })
    if (domainAfter.length > 0) {
      categoryAccuracy = Math.round(
        domainAfter.reduce((s, a) => s + (a.score ?? 0), 0) / domainAfter.length,
      )
    }
  }

  // 미션 전체 완료 시 승급 조건 3 업데이트 (비동기)
  // 오늘의 미션 완료일 수가 변경되어 학습 활동량 조건 재계산 필요
  if (isAllComplete) {
    checkPromotionStatus(studentId).catch(console.error)
  }

  // 대시보드 캐시 무효화
  revalidateTag(`student-${studentId}-dashboard`)

  return {
    correctCount,
    totalCount,
    xpEarned,
    categoryAccuracy,
    prevCategoryAccuracy,
    nextMission:
      hasNext && !isAllComplete
        ? {
            index: nextIndex,
            title: updatedMissions[nextIndex]?.title ?? '다음 미션',
          }
        : null,
    streakBonusXp,
    newBadges,
    isAllComplete,
  }
}
