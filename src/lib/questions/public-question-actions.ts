'use server'

import { prisma } from '@/lib/prisma/client'
import type { Prisma, QuestionDomain, QuestionSource } from '@/generated/prisma'
import type { PublicQuestionRow } from '@/components/shared/public-question-list'
import { getCurrentUser } from '@/lib/auth'

export type PublicQuestionPageParams = {
  page: number
  pageSize: number
  search?: string
  domain?: string
  difficulty?: number
  source?: string
}

async function getAuthedAcademyUser() {
  const user = await getCurrentUser()
  if (!user) return null
  if (user.role !== 'ACADEMY_OWNER' && user.role !== 'TEACHER' && user.role !== 'SUPER_ADMIN') return null
  return user
}

export async function getPublicQuestionsPage(
  params: PublicQuestionPageParams,
): Promise<{ rows: PublicQuestionRow[]; total: number }> {
  const user = await getAuthedAcademyUser()
  if (!user) return { rows: [], total: 0 }

  const AND: Prisma.QuestionWhereInput[] = [{ academyId: null, isActive: true }]

  if (params.domain) AND.push({ domain: params.domain as QuestionDomain })
  if (params.difficulty) AND.push({ difficulty: params.difficulty })
  if (params.source) AND.push({ source: params.source as QuestionSource })
  if (params.search?.trim()) {
    const search = params.search.trim()
    AND.push({
      OR: [
        { contentJson: { path: ['question_text'], string_contains: search, mode: 'insensitive' } },
        { subCategory: { contains: search, mode: 'insensitive' } },
      ],
    })
  }

  const where: Prisma.QuestionWhereInput = { AND }
  const pageSize = Math.min(Math.max(params.pageSize, 1), 100)
  const page = Math.max(params.page, 1)

  const [rows, total] = await Promise.all([
    prisma.question.findMany({
      where,
      orderBy: [{ qualityScore: 'desc' }, { createdAt: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        domain: true,
        subCategory: true,
        difficulty: true,
        cefrLevel: true,
        contentJson: true,
        source: true,
        qualityScore: true,
        usageCount: true,
        createdAt: true,
      },
    }),
    prisma.question.count({ where }),
  ])

  return {
    rows: rows.map((q) => {
      const content = q.contentJson as { type?: string; question_text?: string }
      return {
        id: q.id,
        domain: q.domain,
        subCategory: q.subCategory,
        difficulty: q.difficulty,
        cefrLevel: q.cefrLevel,
        questionType: content.type ?? 'multiple_choice',
        questionText: content.question_text ?? '',
        source: q.source,
        qualityScore: q.qualityScore,
        usageCount: q.usageCount,
        createdAt: q.createdAt.toISOString(),
      }
    }),
    total,
  }
}
