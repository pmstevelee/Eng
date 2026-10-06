import 'server-only'

import { randomUUID } from 'node:crypto'
import { unstable_cache } from 'next/cache'
import { prisma } from '@/lib/prisma/client'
import { dbDate, endOfTodayKst, kstDateTime, todayKst } from '@/lib/attendance/time'
import { getAcademyWordLearningSettings } from '@/lib/words/access-guard'
import { awardXP } from '@/lib/missions/xp-manager'
import { updateStreak, type StreakResult } from '@/lib/missions/streak-manager'
import { dailyStatUpsert, todayStatDate } from '@/lib/learning/daily-stats'
import type { DailyWordPlan } from '@/generated/prisma'

// ─── 오늘의 단어학습 ──────────────────────────────────────────────────────────
// 학생 레벨에 맞춰 매일 신규 단어를 자동 생성하고(학원 설정 dailyNewWords),
// 기존 플래시카드/리콜/스펠 화면을 재사용하도록 학생 소유 비공개 세트를 만든다.
// 오늘의 학습 = ① 복습(SRS 기한 도래) ② 새 단어 ③ 문법 미션(DailyMission).

/** 오늘의 학습 완료 보너스 포인트 */
export const DAILY_PLAN_BONUS_XP = 30
/** 복습 목표 상한 */
const REVIEW_TARGET_MAX = 50
const REVIEW_TARGET_PER_NEW = 3
const REVIEW_TARGET_MIN = 10

/** Word.cefrLevel 밴드(2/4/6/8/10) — Oxford CEFR → 위고업 레벨 매핑(cefr-mapping.ts)과 동일 */
export function wordBandForLevel(level: number): number {
  return Math.min(10, Math.max(2, Math.ceil(level / 2) * 2))
}

/** 밴드 소진 시 보충 순서: 현재 → 한 단계 위 → 한 단계 아래 → 두 단계 위 … */
function bandFallbackOrder(band: number): number[] {
  const order: number[] = [band]
  for (let step = 2; step <= 8; step += 2) {
    if (band + step <= 10) order.push(band + step)
    if (band - step >= 2) order.push(band - step)
  }
  return order
}

function shuffle<T>(array: T[]): T[] {
  const result = [...array]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

function planDateToday(): Date {
  return dbDate(todayKst())
}

function formatPlanTitle(dateKey: string): string {
  const [, m, d] = dateKey.split('-').map(Number)
  return `오늘의 단어 · ${m}월 ${d}일`
}

async function pickNewWordIds(studentId: string, band: number, count: number): Promise<string[]> {
  if (count <= 0) return []

  // 1) 이월: 지난 오늘의 단어 등으로 진도만 만들어지고 한 번도 학습하지 않은 단어
  const carryOver = await prisma.wordProgress.findMany({
    where: { studentId, lastStudiedAt: null, learnedAt: null, stage: 'FLASHCARD' },
    select: { wordId: true },
    orderBy: { createdAt: 'asc' },
    take: count,
  })
  const picked = carryOver.map((p) => p.wordId)

  // 2) 미학습 단어에서 무작위 (uuid 순서 자체가 무작위라 상위 후보만 조회 후 섞는다)
  for (const b of bandFallbackOrder(band)) {
    if (picked.length >= count) break
    const need = count - picked.length
    const candidates = await prisma.word.findMany({
      where: {
        cefrLevel: b,
        meaning: { not: null },
        wordProgress: { none: { studentId } },
        ...(picked.length > 0 ? { id: { notIn: picked } } : {}),
      },
      select: { id: true },
      orderBy: { id: 'asc' },
      take: Math.max(need * 5, 50),
    })
    picked.push(...shuffle(candidates.map((c) => c.id)).slice(0, need))
  }

  return picked
}

/**
 * 오늘의 단어학습 계획 조회 (없으면 생성).
 * 단어학습을 사용할 수 없는 학원(무료 플랜 등)은 null.
 */
export async function getOrCreateTodayWordPlan(params: {
  studentId: string
  userId: string
  academyId: string
}): Promise<DailyWordPlan | null> {
  const { studentId, userId, academyId } = params
  const planDate = planDateToday()

  const existing = await prisma.dailyWordPlan.findUnique({
    where: { studentId_planDate: { studentId, planDate } },
  })
  if (existing) return existing

  const settings = await getAcademyWordLearningSettings(academyId)
  if (!settings.canUseWords) return null

  const [student, dueCount] = await Promise.all([
    prisma.student.findUnique({ where: { id: studentId }, select: { currentLevel: true } }),
    prisma.wordProgress.count({ where: { studentId, nextReviewAt: { lte: endOfTodayKst() } } }),
  ])
  const band = wordBandForLevel(student?.currentLevel ?? 1)
  const newTarget = settings.dailyNewWords
  const newWordIds = await pickNewWordIds(studentId, band, newTarget)
  const reviewTarget = Math.min(
    dueCount,
    Math.max(REVIEW_TARGET_MIN, newTarget * REVIEW_TARGET_PER_NEW),
    REVIEW_TARGET_MAX,
  )

  const dateKey = todayKst()
  const setId = newWordIds.length > 0 ? randomUUID() : null

  // 학생 소유(ownerId=userId) 비공개 세트 — 학원 세트 목록에는 노출되지 않는다.
  const setOps = setId
    ? [
        prisma.wordSet.create({
          data: {
            id: setId,
            title: formatPlanTitle(dateKey),
            description: '레벨에 맞춰 자동으로 만들어진 오늘의 신규 단어',
            cefrLevel: band,
            isPublic: false,
            source: 'AI_GENERATED',
            ownerId: userId,
          },
        }),
        prisma.wordSetItem.createMany({
          data: newWordIds.map((wordId, order) => ({ setId, wordId, order })),
        }),
        prisma.wordProgress.createMany({
          data: newWordIds.map((wordId) => ({ studentId, wordId })),
          skipDuplicates: true,
        }),
      ]
    : []
  const planCreate = prisma.dailyWordPlan.create({
    data: {
      studentId,
      planDate,
      setId,
      targetLevel: band,
      newWordIds,
      newTarget: newWordIds.length,
      reviewTarget,
    },
  })

  try {
    const results = await prisma.$transaction([...setOps, planCreate])
    return results[results.length - 1] as DailyWordPlan
  } catch {
    // 동시 요청으로 이미 생성된 경우 재조회
    const fallback = await prisma.dailyWordPlan.findUnique({
      where: { studentId_planDate: { studentId, planDate } },
    })
    if (fallback) return fallback
    throw new Error('오늘의 단어학습 생성에 실패했습니다.')
  }
}

// ─── 진행 현황 ────────────────────────────────────────────────────────────────

export type WordPlanStep = 'FLASHCARD' | 'RECALL' | 'SPELL'

export interface TodayLearningSummary {
  plan: {
    id: string
    setId: string | null
    targetLevel: number
    newTarget: number
    learnedCount: number
    reviewTarget: number
    reviewedCount: number
    reviewRemaining: number
    flashcardDone: boolean
    recallDone: boolean
    spellDone: boolean
    nextStep: WordPlanStep | null
    newDone: boolean
    reviewDone: boolean
    status: string
    bonusAwarded: boolean
  } | null
  grammar: {
    missionId: string
    totalMissions: number
    completedMissions: number
    questionCount: number
    isCompleted: boolean
  } | null
  /** 레벨 밴드 단어 목표 (해당 밴드 전체 단어 대비 학습 완료/마스터) */
  levelGoal: {
    band: number
    totalWords: number
    learnedWords: number
    masteredWords: number
    /** 하루 신규 단어 수 기준 남은 예상 일수 */
    daysToGoal: number | null
  } | null
  todayPoints: number
  isAllComplete: boolean
}

const getBandWordCount = (band: number) =>
  unstable_cache(() => prisma.word.count({ where: { cefrLevel: band } }), ['word-band-count', String(band)], {
    revalidate: 86400,
  })()

function nextStepOf(plan: DailyWordPlan): WordPlanStep | null {
  if (!plan.flashcardDone) return 'FLASHCARD'
  if (!plan.recallDone) return 'RECALL'
  if (!plan.spellDone) return 'SPELL'
  return null
}

/** 오늘 생성된 문법 미션 (KST 오늘 0시 이후 생성분) */
export async function findTodayMission(studentId: string) {
  return prisma.dailyMission.findFirst({
    where: { studentId, missionDate: { gte: kstDateTime(todayKst(), '00:00') } },
    orderBy: { missionDate: 'desc' },
    select: {
      id: true,
      totalMissions: true,
      completedMissions: true,
      questionIds: true,
      isCompleted: true,
    },
  })
}

export async function getTodayLearningSummary(studentId: string): Promise<TodayLearningSummary> {
  const planDate = planDateToday()
  const [plan, mission, stat] = await Promise.all([
    prisma.dailyWordPlan.findUnique({ where: { studentId_planDate: { studentId, planDate } } }),
    findTodayMission(studentId),
    prisma.studentDailyStat.findUnique({
      where: { studentId_statDate: { studentId, statDate: todayStatDate() } },
      select: { reviewWords: true, points: true },
    }),
  ])

  const newWordIds = (plan?.newWordIds as string[] | null) ?? []
  const band = plan?.targetLevel ?? null

  const [learnedCount, dueRemaining, bandTotal, bandLearned, bandMastered] = await Promise.all([
    newWordIds.length > 0
      ? prisma.wordProgress.count({
          where: { studentId, wordId: { in: newWordIds }, learnedAt: { not: null } },
        })
      : Promise.resolve(0),
    plan
      ? prisma.wordProgress.count({ where: { studentId, nextReviewAt: { lte: endOfTodayKst() } } })
      : Promise.resolve(0),
    band ? getBandWordCount(band) : Promise.resolve(0),
    band
      ? prisma.wordProgress.count({
          where: { studentId, word: { cefrLevel: band }, OR: [{ learnedAt: { not: null } }, { stage: 'MASTERED' }] },
        })
      : Promise.resolve(0),
    band
      ? prisma.wordProgress.count({ where: { studentId, word: { cefrLevel: band }, stage: 'MASTERED' } })
      : Promise.resolve(0),
  ])

  const reviewedCount = stat?.reviewWords ?? 0
  const planSummary = plan
    ? (() => {
        const newDone = plan.newTarget === 0 || plan.spellDone || learnedCount >= plan.newTarget
        // 복습 목표를 채웠거나, 오늘 복습할 단어가 더 이상 없으면 완료
        const reviewDone = reviewedCount >= plan.reviewTarget || dueRemaining === 0
        return {
          id: plan.id,
          setId: plan.setId,
          targetLevel: plan.targetLevel,
          newTarget: plan.newTarget,
          learnedCount,
          reviewTarget: plan.reviewTarget,
          reviewedCount,
          reviewRemaining: dueRemaining,
          flashcardDone: plan.flashcardDone,
          recallDone: plan.recallDone,
          spellDone: plan.spellDone,
          nextStep: nextStepOf(plan),
          newDone,
          reviewDone,
          status: plan.status,
          bonusAwarded: plan.bonusAwarded,
        }
      })()
    : null

  const questionCount = mission ? ((mission.questionIds as string[] | null) ?? []).length : 0
  const grammar = mission
    ? {
        missionId: mission.id,
        totalMissions: mission.totalMissions,
        completedMissions: mission.completedMissions,
        questionCount,
        isCompleted: mission.isCompleted,
      }
    : null
  const grammarDone = !grammar || grammar.isCompleted || grammar.questionCount === 0

  const levelGoal =
    band && plan
      ? {
          band,
          totalWords: bandTotal,
          learnedWords: bandLearned,
          masteredWords: bandMastered,
          daysToGoal:
            plan.newTarget > 0 ? Math.ceil(Math.max(0, bandTotal - bandLearned) / plan.newTarget) : null,
        }
      : null

  const isAllComplete = planSummary
    ? planSummary.newDone && planSummary.reviewDone && grammarDone
    : !!grammar?.isCompleted

  return {
    plan: planSummary,
    grammar,
    levelGoal,
    todayPoints: stat?.points ?? 0,
    isAllComplete,
  }
}

// ─── 진행 반영 ────────────────────────────────────────────────────────────────

/** 오늘의 단어 세트의 학습 단계 라운드 완료 표시 (finishWordSession에서 호출) */
export async function markWordPlanStep(studentId: string, setId: string, step: WordPlanStep): Promise<boolean> {
  const data =
    step === 'FLASHCARD' ? { flashcardDone: true } : step === 'RECALL' ? { recallDone: true } : { spellDone: true }
  const res = await prisma.dailyWordPlan.updateMany({
    where: { studentId, setId, planDate: planDateToday() },
    data: { ...data, status: 'IN_PROGRESS' },
  })
  return res.count > 0
}

export interface PlanCompletionResult {
  completedNow: boolean
  bonusXp: number
  streak?: StreakResult
}

/**
 * 오늘의 학습(복습·새 단어·문법)이 모두 끝났으면 완료 처리하고 보너스를 1회 지급한다.
 * 단어 라운드 종료·복습 종료·문법 미션 완료 시점에 호출한다.
 */
export async function refreshTodayPlanCompletion(studentId: string): Promise<PlanCompletionResult> {
  const summary = await getTodayLearningSummary(studentId)
  if (!summary.plan || !summary.isAllComplete || summary.plan.bonusAwarded) {
    return { completedNow: false, bonusXp: 0 }
  }

  // bonusAwarded=false 조건부 갱신으로 동시 호출 시에도 보너스는 1회만 지급
  const claimed = await prisma.dailyWordPlan.updateMany({
    where: { id: summary.plan.id, bonusAwarded: false },
    data: { bonusAwarded: true, status: 'COMPLETED', completedAt: new Date() },
  })
  if (claimed.count === 0) return { completedNow: false, bonusXp: 0 }

  await awardXP(studentId, DAILY_PLAN_BONUS_XP, 'DAILY_WORD_PLAN', summary.plan.id)
  const [streak] = await Promise.all([
    updateStreak(studentId),
    dailyStatUpsert(studentId, {}, { planCompleted: true }),
  ])
  return { completedNow: true, bonusXp: DAILY_PLAN_BONUS_XP, streak }
}
