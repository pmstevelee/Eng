// 문법 커리큘럼 조회 — 대분류 → 중분류 → 포인트 트리
//
// 트리는 자주 읽고 거의 안 바뀌므로 unstable_cache(tag 'grammar-curriculum')로 1시간 캐시한다.
// 포인트·카테고리를 고치는 서버 액션은 revalidateGrammarCurriculum()을 호출할 것.
// 반환값에 Date를 넣지 않는다 (캐시 적중 시 문자열로 바뀌는 문제 회피).

import { revalidateTag, unstable_cache } from 'next/cache'
import { prisma } from '@/lib/prisma/client'
import type { GrammarPointStatus, Prisma } from '@/generated/prisma'
import { GRAMMAR_CURRICULUM_TAG } from './constants'

const CACHE_SECONDS = 3600

// ─── 타입 ────────────────────────────────────────────────────────────────────

export interface GrammarTreePoint {
  id: string
  code: string
  title: string
  /** null: 본사 공용, 값: 학원 전용 */
  academyId: string | null
  levelMin: number
  levelMax: number
  sortOrder: number
  summary: string | null
  status: GrammarPointStatus
  /** 선수 포인트 id (권장만, 잠금 없음) */
  prerequisiteIds: string[]
}

export interface GrammarTreeSubCategory {
  id: string
  code: string
  name: string
  sortOrder: number
  points: GrammarTreePoint[]
}

export interface GrammarTreeCategory {
  id: string
  code: string
  name: string
  description: string | null
  sortOrder: number
  children: GrammarTreeSubCategory[]
}

export interface GrammarPointDetail extends GrammarTreePoint {
  rulesJson: Prisma.JsonValue
  examplesJson: Prisma.JsonValue
  commonErrorsJson: Prisma.JsonValue
  category: { id: string; code: string; name: string }
  parentCategory: { id: string; code: string; name: string } | null
  prerequisites: { id: string; code: string; title: string }[]
}

// ─── 내부: 트리 조립 ─────────────────────────────────────────────────────────

const pointSelect = {
  id: true,
  code: true,
  title: true,
  academyId: true,
  categoryId: true,
  levelMin: true,
  levelMax: true,
  sortOrder: true,
  summary: true,
  status: true,
  prerequisites: { select: { requiredPointId: true } },
} satisfies Prisma.GrammarPointSelect

type PointRow = Prisma.GrammarPointGetPayload<{ select: typeof pointSelect }>

async function buildTree(pointWhere: Prisma.GrammarPointWhereInput, dropEmpty: boolean): Promise<GrammarTreeCategory[]> {
  // 카테고리(약 60행)와 포인트를 한 번에 병렬 조회 후 메모리에서 조립
  const [categories, points] = await Promise.all([
    prisma.grammarCategory.findMany({
      select: { id: true, code: true, name: true, description: true, parentId: true, depth: true, sortOrder: true },
      orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
    }),
    prisma.grammarPoint.findMany({
      where: pointWhere,
      select: pointSelect,
      orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
    }),
  ])

  const pointsByCategory = new Map<string, GrammarTreePoint[]>()
  for (const p of points as PointRow[]) {
    const list = pointsByCategory.get(p.categoryId) ?? []
    list.push({
      id: p.id,
      code: p.code,
      title: p.title,
      academyId: p.academyId,
      levelMin: p.levelMin,
      levelMax: p.levelMax,
      sortOrder: p.sortOrder,
      summary: p.summary,
      status: p.status,
      prerequisiteIds: p.prerequisites.map((r) => r.requiredPointId),
    })
    pointsByCategory.set(p.categoryId, list)
  }

  const childrenByParent = new Map<string, GrammarTreeSubCategory[]>()
  for (const c of categories) {
    if (c.depth !== 2 || !c.parentId) continue
    const sub: GrammarTreeSubCategory = {
      id: c.id,
      code: c.code,
      name: c.name,
      sortOrder: c.sortOrder,
      points: pointsByCategory.get(c.id) ?? [],
    }
    if (dropEmpty && sub.points.length === 0) continue
    const list = childrenByParent.get(c.parentId) ?? []
    list.push(sub)
    childrenByParent.set(c.parentId, list)
  }

  const tree: GrammarTreeCategory[] = []
  for (const c of categories) {
    if (c.depth !== 1) continue
    const children = childrenByParent.get(c.id) ?? []
    if (dropEmpty && children.length === 0) continue
    tree.push({ id: c.id, code: c.code, name: c.name, description: c.description, sortOrder: c.sortOrder, children })
  }
  return tree
}

// ─── 조회 함수 ───────────────────────────────────────────────────────────────

const getGrammarTreeCached = unstable_cache(
  (academyId: string | null) =>
    buildTree(
      {
        status: 'PUBLISHED',
        OR: academyId ? [{ academyId: null }, { academyId }] : [{ academyId: null }],
      },
      true,
    ),
  ['grammar-tree'],
  { revalidate: CACHE_SECONDS, tags: [GRAMMAR_CURRICULUM_TAG] },
)

/**
 * 학생·교사용 커리큘럼 트리 — 공개(PUBLISHED) 포인트만, 본사 공용 + 해당 학원 전용.
 * 포인트가 하나도 없는 중분류·대분류는 빠진다.
 */
export function getGrammarTree(academyId: string | null): Promise<GrammarTreeCategory[]> {
  return getGrammarTreeCached(academyId)
}

const getAdminGrammarTreeCached = unstable_cache(
  () => buildTree({ academyId: null }, false),
  ['grammar-tree-admin'],
  { revalidate: CACHE_SECONDS, tags: [GRAMMAR_CURRICULUM_TAG] },
)

/** 관리자용 본사 커리큘럼 트리 — 모든 상태(초안·검수 요청·공개), 빈 분류도 포함 */
export function getAdminGrammarTree(): Promise<GrammarTreeCategory[]> {
  return getAdminGrammarTreeCached()
}

const getGrammarPointByCodeCached = unstable_cache(
  async (code: string): Promise<GrammarPointDetail | null> => {
    const p = await prisma.grammarPoint.findUnique({
      where: { code },
      select: {
        ...pointSelect,
        rulesJson: true,
        examplesJson: true,
        commonErrorsJson: true,
        category: {
          select: { id: true, code: true, name: true, parent: { select: { id: true, code: true, name: true } } },
        },
        prerequisites: {
          select: { requiredPointId: true, requiredPoint: { select: { id: true, code: true, title: true } } },
        },
      },
    })
    if (!p) return null
    return {
      id: p.id,
      code: p.code,
      title: p.title,
      academyId: p.academyId,
      levelMin: p.levelMin,
      levelMax: p.levelMax,
      sortOrder: p.sortOrder,
      summary: p.summary,
      status: p.status,
      prerequisiteIds: p.prerequisites.map((r) => r.requiredPointId),
      rulesJson: p.rulesJson,
      examplesJson: p.examplesJson,
      commonErrorsJson: p.commonErrorsJson,
      category: { id: p.category.id, code: p.category.code, name: p.category.name },
      parentCategory: p.category.parent,
      prerequisites: p.prerequisites
        .map((r) => r.requiredPoint)
        .sort((a, b) => a.code.localeCompare(b.code)),
    }
  },
  ['grammar-point-by-code'],
  { revalidate: CACHE_SECONDS, tags: [GRAMMAR_CURRICULUM_TAG] },
)

/**
 * 코드로 포인트 하나 조회 (상태와 무관). 공개 여부·학원 접근 권한은 호출하는 쪽에서 확인할 것.
 */
export function getGrammarPointByCode(code: string): Promise<GrammarPointDetail | null> {
  return getGrammarPointByCodeCached(code)
}

/** 커리큘럼(카테고리·포인트·선수 관계·코스) 변경 후 캐시 무효화 */
export function revalidateGrammarCurriculum(): void {
  revalidateTag(GRAMMAR_CURRICULUM_TAG)
}

// ─── 본사 기본 코스 ──────────────────────────────────────────────────────────

export interface GrammarCourseSummary {
  id: string
  name: string
  targetLevel: number | null
  sortOrder: number
  /** 코스 순서대로 정렬된 포인트 id (공개 여부와 무관 — 쓰는 쪽에서 트리로 거를 것) */
  pointIds: string[]
}

const getDefaultGrammarCoursesCached = unstable_cache(
  async (): Promise<GrammarCourseSummary[]> => {
    const courses = await prisma.grammarCourse.findMany({
      where: { academyId: null, isActive: true },
      select: {
        id: true,
        name: true,
        targetLevel: true,
        sortOrder: true,
        items: { select: { grammarPointId: true }, orderBy: { sortOrder: 'asc' } },
      },
      orderBy: { sortOrder: 'asc' },
    })
    return courses.map((c) => ({
      id: c.id,
      name: c.name,
      targetLevel: c.targetLevel,
      sortOrder: c.sortOrder,
      pointIds: c.items.map((i) => i.grammarPointId),
    }))
  },
  ['grammar-default-courses'],
  { revalidate: CACHE_SECONDS, tags: [GRAMMAR_CURRICULUM_TAG] },
)

/** 본사 기본 코스 (자율 모드 추천용) */
export function getDefaultGrammarCourses(): Promise<GrammarCourseSummary[]> {
  return getDefaultGrammarCoursesCached()
}
