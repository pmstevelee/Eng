'use server'

import { revalidateTag } from 'next/cache'
import { prisma } from '@/lib/prisma/client'
import { createClient } from '@/lib/supabase/server'
import { updateQuestionBankStatsForDomain } from '@/lib/questions/share-to-pool'
import type { QuestionDomain } from '@/generated/prisma'

async function getAuthedAdmin() {
  const supabase = await createClient()
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()
  if (!authUser) return null

  const user = await prisma.user.findUnique({
    where: { id: authUser.id, isDeleted: false },
    select: { id: true, role: true },
  })
  if (!user || user.role !== 'SUPER_ADMIN') return null
  return user
}

// ── 저품질 문제 목록 ────────────────────────────────────────────────────────────

export type LowQualityQuestion = {
  id: string
  domain: QuestionDomain
  subCategory: string | null
  difficulty: number
  questionText: string
  source: string
  qualityScore: number | null
  correctRate: number | null
  usageCount: number
  isActive: boolean
  recommendation: 'increase_difficulty' | 'decrease_difficulty' | 'low_quality' | null
}

export async function getLowQualityQuestions(): Promise<LowQualityQuestion[]> {
  const admin = await getAuthedAdmin()
  if (!admin) return []

  const rows = await prisma.question.findMany({
    where: {
      academyId: null,
      isActive: true,
      OR: [
        { qualityScore: { lt: 0.4 } },
        // statsJson에서 correctRate가 극단적인 경우도 포함 (usageCount > 10 기준)
        { usageCount: { gt: 10 } },
      ],
    },
    select: {
      id: true,
      domain: true,
      subCategory: true,
      difficulty: true,
      contentJson: true,
      source: true,
      qualityScore: true,
      usageCount: true,
      isActive: true,
      statsJson: true,
    },
    orderBy: { qualityScore: 'asc' },
    take: 200,
  })

  return rows
    .map((q) => {
      const content = q.contentJson as { question_text?: string }
      const stats = q.statsJson as { correctRate?: number } | null
      const correctRate = stats?.correctRate ?? null

      let recommendation: LowQualityQuestion['recommendation'] = null
      if (correctRate !== null && correctRate > 0.95) {
        recommendation = 'increase_difficulty'
      } else if (correctRate !== null && correctRate < 0.05) {
        recommendation = 'decrease_difficulty'
      } else if (q.qualityScore !== null && q.qualityScore < 0.4) {
        recommendation = 'low_quality'
      }

      return {
        id: q.id,
        domain: q.domain,
        subCategory: q.subCategory,
        difficulty: q.difficulty,
        questionText: content.question_text ?? '',
        source: q.source,
        qualityScore: q.qualityScore,
        correctRate,
        usageCount: q.usageCount,
        isActive: q.isActive,
        recommendation,
      }
    })
    .filter((q) => q.recommendation !== null) // 권고사항 있는 것만
}

// ── 문제 비활성화 ──────────────────────────────────────────────────────────────

export async function deactivateLowQuality(id: string): Promise<{ error?: string }> {
  const admin = await getAuthedAdmin()
  if (!admin) return { error: '권한이 없습니다.' }

  const q = await prisma.question.findUnique({
    where: { id },
    select: { academyId: true, domain: true, difficulty: true },
  })
  if (!q || q.academyId !== null) return { error: '공용 문제만 관리할 수 있습니다.' }

  await prisma.question.update({ where: { id }, data: { isActive: false } })
  await updateQuestionBankStatsForDomain(q.domain, q.difficulty)
  revalidateTag('question-bank')
  return {}
}

// ── 난이도 자동 보정 ────────────────────────────────────────────────────────────

type CorrectionResult = {
  id: string
  domain: string
  oldDifficulty: number
  newDifficulty: number
}

/**
 * 정답률 기반 난이도 자동 보정:
 * - correctRate > 0.95 → 난이도 +1 (너무 쉬움)
 * - correctRate < 0.05 → 난이도 -1 (너무 어려움)
 */
export async function autoCorrectDifficulties(): Promise<{
  corrections: CorrectionResult[]
  error?: string
}> {
  const admin = await getAuthedAdmin()
  if (!admin) return { corrections: [], error: '권한이 없습니다.' }

  const rows = await prisma.question.findMany({
    where: {
      academyId: null,
      isActive: true,
      usageCount: { gt: 10 }, // 통계가 충분한 문제만
    },
    select: {
      id: true,
      domain: true,
      difficulty: true,
      statsJson: true,
    },
  })

  const corrections: CorrectionResult[] = []

  for (const q of rows) {
    const stats = q.statsJson as { correctRate?: number } | null
    const correctRate = stats?.correctRate
    if (correctRate === undefined || correctRate === null) continue

    let newDifficulty = q.difficulty
    if (correctRate > 0.95 && q.difficulty < 10) {
      newDifficulty = q.difficulty + 1
    } else if (correctRate < 0.05 && q.difficulty > 1) {
      newDifficulty = q.difficulty - 1
    }

    if (newDifficulty === q.difficulty) continue

    await prisma.question.update({
      where: { id: q.id },
      data: { difficulty: newDifficulty },
    })

    await Promise.all([
      updateQuestionBankStatsForDomain(q.domain, q.difficulty),
      updateQuestionBankStatsForDomain(q.domain, newDifficulty),
    ])

    corrections.push({
      id: q.id,
      domain: q.domain,
      oldDifficulty: q.difficulty,
      newDifficulty,
    })
  }

  revalidateTag('question-bank')
  return { corrections }
}
