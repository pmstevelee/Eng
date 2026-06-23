import { BadgeType } from '@/generated/prisma'
import { prisma } from '@/lib/prisma/client'
import { awardXP, type XpResult } from '@/lib/missions/xp-manager'
import { updateStreak, type StreakResult } from '@/lib/missions/streak-manager'

export type WordEventType =
  | 'FLASHCARD_COMPLETED'
  | 'RECALL_CORRECT'
  | 'SPELL_CORRECT'
  | 'WORD_MASTERED'
  | 'DAILY_REVIEW_COMPLETED'
  | 'TEST_PASSED'
  | 'PERFECT_SET'

const WORD_EVENT_XP: Record<WordEventType, number> = {
  FLASHCARD_COMPLETED: 2,
  RECALL_CORRECT: 3,
  SPELL_CORRECT: 5,
  WORD_MASTERED: 10,
  DAILY_REVIEW_COMPLETED: 20,
  TEST_PASSED: 50,
  PERFECT_SET: 100,
}

const WORD_EVENT_SOURCE: Record<WordEventType, string> = {
  FLASHCARD_COMPLETED: 'WORD_FLASHCARD',
  RECALL_CORRECT: 'WORD_RECALL',
  SPELL_CORRECT: 'WORD_SPELL',
  WORD_MASTERED: 'WORD_MASTERED',
  DAILY_REVIEW_COMPLETED: 'WORD_DAILY_REVIEW',
  TEST_PASSED: 'WORD_TEST',
  PERFECT_SET: 'WORD_PERFECT_SET',
}

const WORD_EVENT_BADGE: Partial<Record<WordEventType, BadgeType>> = {
  DAILY_REVIEW_COMPLETED: BadgeType.MISSION_COMPLETE,
  PERFECT_SET: BadgeType.PERFECT_SCORE,
  WORD_MASTERED: BadgeType.MASTER,
}

async function tryAwardBadge(
  studentId: string,
  badgeType: BadgeType,
): Promise<BadgeType | null> {
  const badge = await prisma.badge.findUnique({ where: { code: badgeType } })
  if (!badge) return null

  const existing = await prisma.badgeEarning.findUnique({
    where: { studentId_badgeId: { studentId, badgeId: badge.id } },
  })
  if (existing) return null

  await prisma.badgeEarning.create({ data: { studentId, badgeId: badge.id } })
  return badgeType
}

export type WordEventResult = {
  xp: XpResult
  streak?: StreakResult
  badgeEarned?: BadgeType
}

export async function emitWordEvent(
  studentId: string,
  type: WordEventType,
  sourceId?: string,
): Promise<WordEventResult> {
  const amount = WORD_EVENT_XP[type]
  const source = WORD_EVENT_SOURCE[type]

  const xp = await awardXP(studentId, amount, source, sourceId)

  let streak: StreakResult | undefined
  if (type === 'DAILY_REVIEW_COMPLETED') {
    streak = await updateStreak(studentId)
  }

  let badgeEarned: BadgeType | undefined
  const badgeType = WORD_EVENT_BADGE[type]
  if (badgeType) {
    const awarded = await tryAwardBadge(studentId, badgeType)
    if (awarded) badgeEarned = awarded
  }

  return { xp, streak, badgeEarned }
}
