// 관리자 문법 문항 조회 — 태깅 검수 화면(/admin/grammar/tagging)과 포인트 "문항" 탭
// 관리자 화면 전용, 캐시 없음(검수하면서 바로 바뀌는 값).

import { prisma } from '@/lib/prisma/client'
import type { Prisma, QuestionSource } from '@/generated/prisma'
import { AUTO_ACCEPT_CONFIDENCE, TAG_BATCH_SIZE } from './question-tagging'

/** 태깅 대상 = 활성 문법 문항 중 포인트가 없고 아직 제안도 없는 것 */
export const untaggedQuestionWhere = {
  domain: 'GRAMMAR',
  isActive: true,
  grammarPointId: null,
  grammarTagSuggestion: { is: null },
} satisfies Prisma.QuestionWhereInput

// ─── 태깅 검수 ───────────────────────────────────────────────────────────────

export const TAG_VIEWS = ['high', 'low', 'none', 'all'] as const
export type TagView = (typeof TAG_VIEWS)[number]

export function parseTagView(value: string | undefined): TagView {
  return TAG_VIEWS.find((v) => v === value) ?? 'high'
}

function pendingWhere(view: TagView): Prisma.GrammarTagSuggestionWhereInput {
  const base: Prisma.GrammarTagSuggestionWhereInput = { status: 'PENDING' }
  if (view === 'high') return { ...base, suggestedPointId: { not: null }, confidence: { gte: AUTO_ACCEPT_CONFIDENCE } }
  if (view === 'low') return { ...base, suggestedPointId: { not: null }, confidence: { lt: AUTO_ACCEPT_CONFIDENCE } }
  if (view === 'none') return { ...base, suggestedPointId: null }
  return base
}

export interface TaggingSummary {
  remaining: number
  pendingHigh: number
  pendingLow: number
  pendingNone: number
  accepted: number
  rejected: number
}

export async function getTaggingSummary(): Promise<TaggingSummary> {
  const [remaining, pendingHigh, pendingLow, pendingNone, accepted, rejected] = await Promise.all([
    prisma.question.count({ where: untaggedQuestionWhere }),
    prisma.grammarTagSuggestion.count({ where: pendingWhere('high') }),
    prisma.grammarTagSuggestion.count({ where: pendingWhere('low') }),
    prisma.grammarTagSuggestion.count({ where: pendingWhere('none') }),
    prisma.grammarTagSuggestion.count({ where: { status: 'ACCEPTED' } }),
    prisma.grammarTagSuggestion.count({ where: { status: 'REJECTED' } }),
  ])
  return { remaining, pendingHigh, pendingLow, pendingNone, accepted, rejected }
}

export interface TagSuggestionRow {
  id: string
  confidence: number | null
  question: {
    id: string
    subCategory: string | null
    difficulty: number
    /** null이면 본사 공용 */
    academyName: string | null
    contentJson: Prisma.JsonValue
  }
  suggestedPoint: { id: string; code: string; title: string } | null
}

export const TAG_PAGE_SIZE = TAG_BATCH_SIZE

export async function getPendingSuggestions(view: TagView, page: number): Promise<{ rows: TagSuggestionRow[]; total: number }> {
  const where = pendingWhere(view)
  const [rows, total] = await Promise.all([
    prisma.grammarTagSuggestion.findMany({
      where,
      orderBy: [{ confidence: 'desc' }, { createdAt: 'asc' }, { id: 'asc' }],
      skip: (page - 1) * TAG_PAGE_SIZE,
      take: TAG_PAGE_SIZE,
      select: {
        id: true,
        confidence: true,
        question: {
          select: {
            id: true,
            subCategory: true,
            difficulty: true,
            contentJson: true,
            academy: { select: { name: true } },
          },
        },
        suggestedPoint: { select: { id: true, code: true, title: true } },
      },
    }),
    prisma.grammarTagSuggestion.count({ where }),
  ])
  return {
    total,
    rows: rows.map((r) => ({
      id: r.id,
      confidence: r.confidence,
      question: {
        id: r.question.id,
        subCategory: r.question.subCategory,
        difficulty: r.question.difficulty,
        academyName: r.question.academy?.name ?? null,
        contentJson: r.question.contentJson,
      },
      suggestedPoint: r.suggestedPoint,
    })),
  }
}

// ─── 포인트 "문항" 탭 ────────────────────────────────────────────────────────

export interface PointQuestionRow {
  id: string
  difficulty: number
  isVerified: boolean
  isActive: boolean
  source: QuestionSource
  contentJson: Prisma.JsonValue
}

/** 포인트에 연결된 본사 공용 문항 — 검수 안 된 것 먼저 */
export async function getPointQuestions(pointId: string): Promise<PointQuestionRow[]> {
  return prisma.question.findMany({
    where: { grammarPointId: pointId, academyId: null },
    orderBy: [{ isActive: 'desc' }, { isVerified: 'asc' }, { createdAt: 'desc' }],
    select: { id: true, difficulty: true, isVerified: true, isActive: true, source: true, contentJson: true },
  })
}
