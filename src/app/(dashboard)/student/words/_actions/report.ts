'use server'

import { prisma } from '@/lib/prisma/client'
import { requireStudent } from '@/lib/auth-student'

const CEFR_LABEL: Record<number, string> = {
  1: 'Pre-A1', 2: 'A1 하', 3: 'A1 상', 4: 'A2 하', 5: 'A2 상',
  6: 'B1 하', 7: 'B1 상', 8: 'B2 하', 9: 'B2 상', 10: 'C1+',
}

export type StudentWordStats = {
  totalLearned: number
  totalMastered: number
  cefrProgress: { level: number; label: string; learned: number; mastered: number }[]
  weeklyActivity: { date: string; count: number }[]
  weakWords: { word: string; meaning: string | null; wrongCount: number; correctCount: number }[]
  nextRecommendedSet: { id: string; title: string; cefrLevel: number; itemCount: number } | null
}

export async function getStudentWordStats(): Promise<StudentWordStats> {
  const { studentId, userId } = await requireStudent()

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { academyId: true, student: { select: { currentLevel: true } } },
  })

  const progress = await prisma.wordProgress.findMany({
    where: { studentId },
    select: {
      stage: true,
      wrongCount: true,
      correctCount: true,
      lastStudiedAt: true,
      word: { select: { term: true, meaning: true, cefrLevel: true } },
    },
  })

  const totalLearned = progress.length
  const totalMastered = progress.filter((p) => p.stage === 'MASTERED').length

  // CEFR level 1~10 별 집계
  const cefrMap = new Map<number, { learned: number; mastered: number }>()
  for (let i = 1; i <= 10; i++) cefrMap.set(i, { learned: 0, mastered: 0 })
  for (const p of progress) {
    const lvl = p.word.cefrLevel
    const entry = cefrMap.get(lvl)
    if (entry) {
      entry.learned++
      if (p.stage === 'MASTERED') entry.mastered++
    }
  }
  const cefrProgress = Array.from(cefrMap.entries()).map(([level, data]) => ({
    level,
    label: CEFR_LABEL[level] ?? `L${level}`,
    ...data,
  }))

  // 최근 7일 활동 (lastStudiedAt 기준)
  const now = new Date()
  const weeklyActivity = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now)
    d.setDate(d.getDate() - (6 - i))
    const dateStr = d.toISOString().slice(0, 10)
    const count = progress.filter((p) => p.lastStudiedAt?.toISOString().slice(0, 10) === dateStr).length
    return { date: dateStr, count }
  })

  // 약점 단어 TOP10
  const weakWords = progress
    .filter((p) => p.wrongCount > 0)
    .sort((a, b) => b.wrongCount - a.wrongCount)
    .slice(0, 10)
    .map((p) => ({
      word: p.word.term,
      meaning: p.word.meaning,
      wrongCount: p.wrongCount,
      correctCount: p.correctCount,
    }))

  // 다음 추천 세트: 현재 레벨 이상 단어 세트 중 학생이 아직 학습 안 한 것
  const currentLevel = user?.student?.currentLevel ?? 1
  const academyId = user?.academyId ?? null

  const learnedWordIds = new Set(progress.map((p) => p.word.term))
  const nextSet = await prisma.wordSet.findFirst({
    where: {
      cefrLevel: { gte: currentLevel },
      OR: [{ isPublic: true }, ...(academyId ? [{ academyId }] : [])],
    },
    select: {
      id: true,
      title: true,
      cefrLevel: true,
      _count: { select: { items: true } },
    },
    orderBy: { cefrLevel: 'asc' },
  })

  return {
    totalLearned,
    totalMastered,
    cefrProgress,
    weeklyActivity,
    weakWords,
    nextRecommendedSet: nextSet
      ? { id: nextSet.id, title: nextSet.title, cefrLevel: nextSet.cefrLevel, itemCount: nextSet._count.items }
      : null,
  }
}
