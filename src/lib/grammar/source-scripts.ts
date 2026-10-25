// 관리자 원고(GrammarSourceScript)·보완 요청(GrammarContentGap) 조회 — 관리자 화면·AI 생성 전용, 캐시 없음
//
// 원고는 대분류·중분류·포인트 어디에나 붙는다. 포인트 하나에 쓰이는 원고 = 포인트 원고 + 중분류 원고 + 대분류 원고(사용 중인 것만).

import { prisma } from '@/lib/prisma/client'
import type { SourceScriptForPrompt } from './point-editing'

export const GAP_STATUS = { OPEN: 'OPEN', RESOLVED: 'RESOLVED', DISMISSED: 'DISMISSED' } as const
/** 보완 요청이 생긴 곳 — LECTURE는 강의 스크립트 생성(2-5)에서 쓴다 */
export const GAP_ORIGIN = { ANALYZE: 'ANALYZE', DRAFT: 'DRAFT', LECTURE: 'LECTURE' } as const

export interface AdminScriptRow {
  id: string
  scopeLabel: string
  categoryId: string | null
  grammarPointId: string | null
  title: string | null
  content: string
  isActive: boolean
  createdByName: string | null
  /** ISO 문자열 */
  createdAt: string
  updatedAt: string
}

export interface AdminGapRow {
  id: string
  scopeLabel: string
  categoryId: string | null
  grammarPointId: string | null
  pointCode: string | null
  message: string
  request: string | null
  origin: string
  createdAt: string
}

const scriptSelect = {
  id: true,
  categoryId: true,
  grammarPointId: true,
  title: true,
  content: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  createdBy: { select: { name: true } },
  category: { select: { code: true, name: true, depth: true } },
  grammarPoint: { select: { code: true, title: true } },
} as const

type ScriptRecord = {
  id: string
  categoryId: string | null
  grammarPointId: string | null
  title: string | null
  content: string
  isActive: boolean
  createdAt: Date
  updatedAt: Date
  createdBy: { name: string } | null
  category: { code: string; name: string; depth: number } | null
  grammarPoint: { code: string; title: string } | null
}

function scopeLabel(r: { category: { code: string; name: string; depth: number } | null; grammarPoint: { code: string; title: string } | null }): string {
  if (r.grammarPoint) return `포인트 ${r.grammarPoint.code} ${r.grammarPoint.title}`
  if (r.category) return `${r.category.depth === 1 ? '대분류' : '중분류'} ${r.category.code} ${r.category.name}`
  return '분류 없음'
}

function toScriptRow(r: ScriptRecord): AdminScriptRow {
  return {
    id: r.id,
    scopeLabel: scopeLabel(r),
    categoryId: r.categoryId,
    grammarPointId: r.grammarPointId,
    title: r.title,
    content: r.content,
    isActive: r.isActive,
    createdByName: r.createdBy?.name ?? null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }
}

/** 좁은 범위(포인트) → 넓은 범위(대분류), 같은 범위 안에서는 먼저 쓴 원고 → 보완 원고 순 */
function sortForPrompt(rows: ScriptRecord[], pointIds: Set<string>, subId: string | null): ScriptRecord[] {
  const rank = (r: ScriptRecord) => (r.grammarPointId && pointIds.has(r.grammarPointId) ? 0 : r.categoryId === subId ? 1 : 2)
  return [...rows].sort((a, b) => rank(a) - rank(b) || a.createdAt.getTime() - b.createdAt.getTime())
}

function toPrompt(rows: ScriptRecord[]): SourceScriptForPrompt[] {
  return rows.filter((r) => r.isActive).map((r) => ({ scope: scopeLabel(r), title: r.title, content: r.content }))
}

/** 포인트 하나에 쓰는 원고 전체 (화면 표시용 행 + AI 프롬프트용) */
export async function getScriptsForPoint(
  pointId: string,
  /** 호출하는 쪽이 이미 아는 중분류·대분류 id (넘기면 조회 1번 절약) */
  known?: { categoryId: string; parentCategoryId: string | null },
): Promise<{ rows: AdminScriptRow[]; prompt: SourceScriptForPrompt[] }> {
  const point =
    known ??
    (await prisma.grammarPoint
      .findUnique({ where: { id: pointId }, select: { categoryId: true, category: { select: { parentId: true } } } })
      .then((p) => (p ? { categoryId: p.categoryId, parentCategoryId: p.category.parentId } : null)))
  if (!point) return { rows: [], prompt: [] }
  const categoryIds = [point.categoryId, point.parentCategoryId].filter((id): id is string => !!id)

  const records = await prisma.grammarSourceScript.findMany({
    where: { OR: [{ grammarPointId: pointId }, { categoryId: { in: categoryIds } }] },
    select: scriptSelect,
  })
  const sorted = sortForPrompt(records, new Set([pointId]), point.categoryId)
  return { rows: sorted.map(toScriptRow), prompt: toPrompt(sorted) }
}

/**
 * 분류 화면용 원고 — 중분류면 자기 원고 + 대분류 원고 + 소속 포인트 원고, 대분류면 자기 원고 + 하위 중분류 원고.
 */
export async function getScriptsForCategory(categoryId: string): Promise<{ rows: AdminScriptRow[]; prompt: SourceScriptForPrompt[] }> {
  const category = await prisma.grammarCategory.findUnique({
    where: { id: categoryId },
    select: { id: true, depth: true, parentId: true, children: { select: { id: true } }, points: { select: { id: true } } },
  })
  if (!category) return { rows: [], prompt: [] }

  const where =
    category.depth === 1
      ? { categoryId: { in: [category.id, ...category.children.map((c) => c.id)] } }
      : {
          OR: [
            { categoryId: { in: [category.id, ...(category.parentId ? [category.parentId] : [])] } },
            { grammarPointId: { in: category.points.map((p) => p.id) } },
          ],
        }

  const records = await prisma.grammarSourceScript.findMany({ where, select: scriptSelect })
  const sorted = sortForPrompt(records, new Set(category.points.map((p) => p.id)), category.depth === 2 ? category.id : null)
  return { rows: sorted.map(toScriptRow), prompt: toPrompt(sorted) }
}

/** 열린 보완 요청 — 분류(하위 분류·포인트 포함) 또는 포인트 기준 */
export async function getOpenGaps(scope: { categoryIds?: string[]; pointIds?: string[] }): Promise<AdminGapRow[]> {
  const or = [
    ...(scope.categoryIds?.length ? [{ categoryId: { in: scope.categoryIds } }] : []),
    ...(scope.pointIds?.length ? [{ grammarPointId: { in: scope.pointIds } }] : []),
  ]
  if (or.length === 0) return []
  const rows = await prisma.grammarContentGap.findMany({
    where: { status: GAP_STATUS.OPEN, OR: or },
    orderBy: [{ createdAt: 'desc' }],
    select: {
      id: true,
      categoryId: true,
      grammarPointId: true,
      message: true,
      request: true,
      origin: true,
      createdAt: true,
      category: { select: { code: true, name: true, depth: true } },
      grammarPoint: { select: { code: true, title: true } },
    },
  })
  return rows.map((r) => ({
    id: r.id,
    scopeLabel: scopeLabel(r),
    categoryId: r.categoryId,
    grammarPointId: r.grammarPointId,
    pointCode: r.grammarPoint?.code ?? null,
    message: r.message,
    request: r.request,
    origin: r.origin,
    createdAt: r.createdAt.toISOString(),
  }))
}

/** 목록 화면용 집계 — 분류·포인트별 사용 중 원고 수, 열린 보완 요청 수 */
export async function getScriptAndGapCounts(): Promise<{
  scriptsByCategory: Map<string, number>
  scriptsByPoint: Map<string, number>
  gapsByCategory: Map<string, number>
  gapsByPoint: Map<string, number>
}> {
  const [scriptCat, scriptPoint, gapCat, gapPoint] = await Promise.all([
    prisma.grammarSourceScript.groupBy({ by: ['categoryId'], where: { isActive: true, categoryId: { not: null } }, _count: { _all: true } }),
    prisma.grammarSourceScript.groupBy({ by: ['grammarPointId'], where: { isActive: true, grammarPointId: { not: null } }, _count: { _all: true } }),
    prisma.grammarContentGap.groupBy({ by: ['categoryId'], where: { status: GAP_STATUS.OPEN, categoryId: { not: null } }, _count: { _all: true } }),
    prisma.grammarContentGap.groupBy({ by: ['grammarPointId'], where: { status: GAP_STATUS.OPEN, grammarPointId: { not: null } }, _count: { _all: true } }),
  ])
  const toMap = <K extends string>(rows: ({ _count: { _all: number } } & Record<K, string | null>)[], key: K) => {
    const m = new Map<string, number>()
    for (const r of rows) {
      const id = r[key]
      if (id) m.set(id, r._count._all)
    }
    return m
  }
  return {
    scriptsByCategory: toMap(scriptCat, 'categoryId'),
    scriptsByPoint: toMap(scriptPoint, 'grammarPointId'),
    gapsByCategory: toMap(gapCat, 'categoryId'),
    gapsByPoint: toMap(gapPoint, 'grammarPointId'),
  }
}
