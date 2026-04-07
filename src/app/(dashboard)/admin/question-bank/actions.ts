'use server'

import { revalidateTag } from 'next/cache'
import { prisma } from '@/lib/prisma/client'
import { createClient } from '@/lib/supabase/server'
import OpenAI from 'openai'
import { updateQuestionBankStatsForDomain } from '@/lib/questions/share-to-pool'
import type { QuestionDomain, QuestionSource } from '@/generated/prisma'

// ── 인증 헬퍼 ──────────────────────────────────────────────────────────────────

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

// ── 문제 목록 조회 ─────────────────────────────────────────────────────────────

export type AdminQuestionRow = {
  id: string
  domain: QuestionDomain
  subCategory: string | null
  difficulty: number
  questionType: string
  questionText: string
  source: QuestionSource
  qualityScore: number | null
  usageCount: number
  isVerified: boolean
  isActive: boolean
  correctRate: number | null
  createdAt: string
}

export async function getAdminQuestions(filters: {
  domain?: string
  difficulty?: number
  source?: string
  quality?: string
  onlyInactive?: boolean
}): Promise<AdminQuestionRow[]> {
  const admin = await getAuthedAdmin()
  if (!admin) return []

  const where: Record<string, unknown> = {
    academyId: null,
  }

  if (filters.domain) where.domain = filters.domain as QuestionDomain
  if (filters.difficulty) where.difficulty = filters.difficulty
  if (filters.source) where.source = filters.source as QuestionSource
  if (filters.onlyInactive) {
    where.isActive = false
  }

  if (filters.quality === 'high') {
    where.qualityScore = { gte: 0.7 }
  } else if (filters.quality === 'mid') {
    where.qualityScore = { gte: 0.4, lt: 0.7 }
  } else if (filters.quality === 'low') {
    where.qualityScore = { lt: 0.4 }
  }

  const rows = await prisma.question.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }],
    take: 300,
    select: {
      id: true,
      domain: true,
      subCategory: true,
      difficulty: true,
      contentJson: true,
      source: true,
      qualityScore: true,
      usageCount: true,
      isVerified: true,
      isActive: true,
      statsJson: true,
      createdAt: true,
    },
  })

  return rows.map((q) => {
    const content = q.contentJson as { type?: string; question_text?: string }
    const stats = q.statsJson as { correctRate?: number } | null
    return {
      id: q.id,
      domain: q.domain,
      subCategory: q.subCategory,
      difficulty: q.difficulty,
      questionType: content.type ?? 'multiple_choice',
      questionText: content.question_text ?? '',
      source: q.source,
      qualityScore: q.qualityScore,
      usageCount: q.usageCount,
      isVerified: q.isVerified,
      isActive: q.isActive,
      correctRate: stats?.correctRate ?? null,
      createdAt: q.createdAt.toISOString(),
    }
  })
}

// ── 문제 비활성화 ──────────────────────────────────────────────────────────────

export async function deactivateQuestion(id: string): Promise<{ error?: string }> {
  const admin = await getAuthedAdmin()
  if (!admin) return { error: '권한이 없습니다.' }

  try {
    const q = await prisma.question.findUnique({
      where: { id },
      select: { academyId: true, domain: true, difficulty: true },
    })
    if (!q || q.academyId !== null) return { error: '공용 문제만 관리할 수 있습니다.' }

    await prisma.question.update({ where: { id }, data: { isActive: false } })

    await updateQuestionBankStatsForDomain(q.domain, q.difficulty)
    revalidateTag('question-bank')
    return {}
  } catch {
    return { error: '비활성화에 실패했습니다.' }
  }
}

// ── 문제 활성화 ────────────────────────────────────────────────────────────────

export async function activateQuestion(id: string): Promise<{ error?: string }> {
  const admin = await getAuthedAdmin()
  if (!admin) return { error: '권한이 없습니다.' }

  try {
    const q = await prisma.question.findUnique({
      where: { id },
      select: { academyId: true, domain: true, difficulty: true },
    })
    if (!q || q.academyId !== null) return { error: '공용 문제만 관리할 수 있습니다.' }

    await prisma.question.update({ where: { id }, data: { isActive: true } })

    await updateQuestionBankStatsForDomain(q.domain, q.difficulty)
    revalidateTag('question-bank')
    return {}
  } catch {
    return { error: '활성화에 실패했습니다.' }
  }
}

// ── 난이도 조정 ────────────────────────────────────────────────────────────────

export async function adjustDifficulty(
  id: string,
  newDifficulty: number,
): Promise<{ error?: string }> {
  const admin = await getAuthedAdmin()
  if (!admin) return { error: '권한이 없습니다.' }

  if (newDifficulty < 1 || newDifficulty > 10) return { error: '난이도는 1~10이어야 합니다.' }

  try {
    const q = await prisma.question.findUnique({
      where: { id },
      select: { academyId: true, domain: true, difficulty: true },
    })
    if (!q || q.academyId !== null) return { error: '공용 문제만 관리할 수 있습니다.' }

    const oldDifficulty = q.difficulty
    await prisma.question.update({ where: { id }, data: { difficulty: newDifficulty } })

    // 기존/신규 난이도 통계 모두 갱신
    await Promise.all([
      updateQuestionBankStatsForDomain(q.domain, oldDifficulty),
      updateQuestionBankStatsForDomain(q.domain, newDifficulty),
    ])
    revalidateTag('question-bank')
    return {}
  } catch {
    return { error: '난이도 조정에 실패했습니다.' }
  }
}

// ── AI 문제 자동 생성 ──────────────────────────────────────────────────────────

const DOMAIN_NAMES: Record<string, string> = {
  GRAMMAR: '문법(Grammar)',
  VOCABULARY: '어휘(Vocabulary)',
  READING: '읽기(Reading)',
  WRITING: '쓰기(Writing)',
}

const CEFR_LEVELS = [
  'Pre-A1', 'A1 하', 'A1 상', 'A2 하', 'A2 상',
  'B1 하', 'B1 상', 'B2 하', 'B2 상', 'C1+',
]

type GeneratedResult = {
  domain: string
  difficulty: number
  generated: number
  error?: string
}

/**
 * 문제가 부족한 영역(< MIN_COUNT)에 대해 AI로 자동 생성
 * 한 번 호출에 최대 3개 영역 처리 (timeout 방지)
 */
export async function generateQuestionsForGaps(minCount = 10): Promise<{
  results: GeneratedResult[]
  error?: string
}> {
  const admin = await getAuthedAdmin()
  if (!admin) return { results: [], error: '권한이 없습니다.' }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

  // 부족한 영역 찾기
  const stats = await prisma.questionBankStats.findMany({
    where: { totalCount: { lt: minCount } },
    orderBy: { totalCount: 'asc' },
    take: 3, // 한 번에 최대 3개 처리
  })

  if (stats.length === 0) {
    return { results: [], error: '부족한 영역이 없습니다.' }
  }

  const results: GeneratedResult[] = []

  for (const stat of stats) {
    const needed = minCount - stat.totalCount
    const cefrLevel = CEFR_LEVELS[stat.difficulty - 1] ?? 'A1 하'
    const domainName = DOMAIN_NAMES[stat.domain] ?? stat.domain

    try {
      const prompt = `영어 학원용 ${domainName} 문제를 ${needed}개 생성하세요.
레벨: Level ${stat.difficulty} (${cefrLevel})
형식: JSON 배열, 각 문제는 아래 구조를 따를 것:
{
  "question_text": "영어 문제",
  "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
  "correct_answer": "A",
  "explanation": "한국어 해설"
}
- 보기 4개 필수
- 정답은 A/B/C/D 중 하나
- 해설은 반드시 한국어로
- 레벨에 맞는 적절한 난이도
응답은 JSON 배열만 출력하세요.`

      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.8,
      })

      const raw = response.choices[0]?.message?.content ?? '{}'
      const parsed = JSON.parse(raw) as { questions?: unknown[] } | unknown[]

      const questionList = Array.isArray(parsed)
        ? parsed
        : (parsed as { questions?: unknown[] }).questions ?? []

      let savedCount = 0
      for (const q of questionList) {
        const qObj = q as {
          question_text?: string
          options?: string[]
          correct_answer?: string
          explanation?: string
        }
        if (!qObj.question_text) continue

        await prisma.question.create({
          data: {
            academyId: null,
            domain: stat.domain as QuestionDomain,
            difficulty: stat.difficulty,
            cefrLevel,
            source: 'AI_GENERATED',
            isVerified: true,
            isActive: true,
            qualityScore: 0.6,
            contentJson: {
              type: 'multiple_choice',
              question_text: qObj.question_text,
              options: qObj.options ?? [],
              correct_answer: qObj.correct_answer ?? 'A',
              explanation: qObj.explanation ?? '',
            },
          },
        })
        savedCount++
      }

      await updateQuestionBankStatsForDomain(stat.domain, stat.difficulty)
      results.push({ domain: stat.domain, difficulty: stat.difficulty, generated: savedCount })
    } catch (err) {
      results.push({
        domain: stat.domain,
        difficulty: stat.difficulty,
        generated: 0,
        error: String(err),
      })
    }
  }

  revalidateTag('question-bank')
  return { results }
}

// ── 통계 전체 재계산 ───────────────────────────────────────────────────────────

export async function recalculateAllStats(): Promise<{ error?: string }> {
  const admin = await getAuthedAdmin()
  if (!admin) return { error: '권한이 없습니다.' }

  const domains = ['GRAMMAR', 'VOCABULARY', 'READING', 'WRITING']
  const difficulties = Array.from({ length: 10 }, (_, i) => i + 1)

  for (const domain of domains) {
    for (const difficulty of difficulties) {
      await updateQuestionBankStatsForDomain(domain, difficulty)
    }
  }

  revalidateTag('question-bank')
  return {}
}
