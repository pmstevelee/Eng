'use server'

import { prisma } from '@/lib/prisma/client'
import type { GrammarPointStatus, Prisma } from '@/generated/prisma'
import { getCurrentUser } from '@/lib/auth'
import { logActivity } from '@/lib/activity-log'
import { ACTIVITY_ACTIONS } from '@/lib/constants/activity-actions'
import { revalidateGrammarCurriculum } from '@/lib/grammar/curriculum'
import { getVerifiedQuestionCount } from '@/lib/grammar/admin'
import { findPrerequisiteCycle } from '@/lib/grammar/curriculum-data'
import {
  SCRIPT_CONTENT_MAX,
  formatScriptsForPrompt,
  getStatusChangeBlockReason,
  validateGrammarPointInput,
  type GrammarContentGapDraft,
  type GrammarPointDraft,
} from '@/lib/grammar/point-editing'
import { GRAMMAR_POINT_STATUS_LABEL } from '@/lib/grammar/constants'
import { GAP_ORIGIN, GAP_STATUS, getScriptsForCategory, getScriptsForPoint } from '@/lib/grammar/source-scripts'
import { analyzeCategoryScripts, generateGrammarPointDraft } from '@/lib/openai/grammar-point-draft'

type ActionResult = { ok: true } | { ok: false; error: string }

const STATUSES: GrammarPointStatus[] = ['DRAFT', 'REVIEW', 'PUBLISHED']

async function getAdmin() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'SUPER_ADMIN') return null
  return user
}

/** 본사 공용 포인트만 관리자 화면에서 편집한다 */
function findHqPoint(pointId: string) {
  return prisma.grammarPoint.findFirst({
    where: { id: pointId, academyId: null },
    select: { id: true, code: true, status: true },
  })
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue
}

// ─── 포인트 저장 ─────────────────────────────────────────────────────────────

export async function saveGrammarPoint(pointId: string, input: unknown): Promise<ActionResult> {
  const admin = await getAdmin()
  if (!admin) return { ok: false, error: '권한이 없습니다.' }

  const validated = validateGrammarPointInput(input, pointId)
  if (!validated.ok) return validated
  const v = validated.value

  // 포인트 · 선수 후보 · 전체 선수 관계(순환 검사용)를 한 번에
  const [point, prereqPoints, edges] = await Promise.all([
    findHqPoint(pointId),
    v.prerequisiteIds.length
      ? prisma.grammarPoint.findMany({
          where: { id: { in: v.prerequisiteIds }, academyId: null },
          select: { id: true },
        })
      : Promise.resolve([]),
    prisma.grammarPrerequisite.findMany({ select: { pointId: true, requiredPointId: true } }),
  ])
  if (!point) return { ok: false, error: '포인트를 찾을 수 없습니다.' }
  if (prereqPoints.length !== v.prerequisiteIds.length) {
    return { ok: false, error: '선수 포인트 중 찾을 수 없는 항목이 있습니다. 새로고침 후 다시 시도해 주세요.' }
  }

  const graph = new Map<string, string[]>()
  for (const e of edges) {
    if (e.pointId === pointId) continue
    graph.set(e.pointId, [...(graph.get(e.pointId) ?? []), e.requiredPointId])
  }
  graph.set(pointId, v.prerequisiteIds)
  if (findPrerequisiteCycle(graph)) {
    return { ok: false, error: '선수 포인트가 서로 꼬리를 무는 순환이 생깁니다. 선수 포인트를 다시 골라 주세요.' }
  }

  try {
    await prisma.$transaction([
      prisma.grammarPoint.update({
        where: { id: pointId },
        data: {
          title: v.title,
          levelMin: v.levelMin,
          levelMax: v.levelMax,
          summary: v.summary || null,
          rulesJson: toJson(v.rules),
          examplesJson: toJson(v.examples),
          commonErrorsJson: toJson(v.commonErrors),
        },
      }),
      prisma.grammarPrerequisite.deleteMany({ where: { pointId } }),
      prisma.grammarPrerequisite.createMany({
        data: v.prerequisiteIds.map((requiredPointId) => ({ pointId, requiredPointId })),
      }),
    ])
  } catch (error) {
    console.error('[admin/grammar] 저장 실패:', error)
    return { ok: false, error: '저장에 실패했습니다. 잠시 후 다시 시도해 주세요.' }
  }

  revalidateGrammarCurriculum()
  await logActivity({
    userId: admin.id,
    role: admin.role,
    action: ACTIVITY_ACTIONS.GRAMMAR_POINT_UPDATE,
    metadata: { pointId, code: point.code },
  })
  return { ok: true }
}

// ─── 상태 변경 ───────────────────────────────────────────────────────────────

export async function changeGrammarPointStatus(pointId: string, to: string): Promise<ActionResult> {
  const admin = await getAdmin()
  if (!admin) return { ok: false, error: '권한이 없습니다.' }

  const next = STATUSES.find((s) => s === to)
  if (!next) return { ok: false, error: '알 수 없는 상태입니다.' }

  const [point, verifiedCount] = await Promise.all([findHqPoint(pointId), getVerifiedQuestionCount(pointId)])
  if (!point) return { ok: false, error: '포인트를 찾을 수 없습니다.' }

  const blocked = getStatusChangeBlockReason(point.status, next, verifiedCount)
  if (blocked) return { ok: false, error: blocked }

  await prisma.grammarPoint.update({
    where: { id: pointId },
    data: { status: next, ...(next === 'PUBLISHED' ? { publishedAt: new Date() } : {}) },
  })

  revalidateGrammarCurriculum()
  await logActivity({
    userId: admin.id,
    role: admin.role,
    action: ACTIVITY_ACTIONS.GRAMMAR_POINT_STATUS_CHANGE,
    metadata: {
      pointId,
      code: point.code,
      from: point.status,
      to: next,
      label: `${GRAMMAR_POINT_STATUS_LABEL[point.status]} → ${GRAMMAR_POINT_STATUS_LABEL[next]}`,
    },
  })
  return { ok: true }
}

// ─── AI 초안 (원고 기반) ─────────────────────────────────────────────────────

/** 포인트 초안 생성 때 AI가 낸 보완 요청으로 그 포인트의 열린 DRAFT 요청을 바꾼다 */
async function replaceDraftGaps(pointId: string, gaps: GrammarContentGapDraft[]) {
  await prisma.$transaction([
    prisma.grammarContentGap.deleteMany({
      where: { grammarPointId: pointId, status: GAP_STATUS.OPEN, origin: GAP_ORIGIN.DRAFT },
    }),
    prisma.grammarContentGap.createMany({
      data: gaps.map((g) => ({
        grammarPointId: pointId,
        message: g.message,
        request: g.request || null,
        origin: GAP_ORIGIN.DRAFT,
      })),
    }),
  ])
}

type DraftActionResult =
  | { ok: true; draft: GrammarPointDraft; gaps: GrammarContentGapDraft[]; scriptCount: number }
  | { ok: false; error: string }

async function buildDraft(
  pointId: string,
  form: { title: string; levelMin: number; levelMax: number; prerequisiteIds: string[] } | null,
): Promise<DraftActionResult> {
  const [point, scripts] = await Promise.all([
    prisma.grammarPoint.findFirst({
      where: { id: pointId, academyId: null },
      select: {
        code: true,
        title: true,
        levelMin: true,
        levelMax: true,
        status: true,
        category: { select: { name: true, parent: { select: { name: true } } } },
        prerequisites: { select: { requiredPoint: { select: { id: true, title: true } } } },
      },
    }),
    getScriptsForPoint(pointId),
  ])
  if (!point) return { ok: false, error: '포인트를 찾을 수 없습니다.' }

  // 편집 화면에서는 아직 저장 안 한 폼 값(제목·레벨·선수)을 쓴다
  const title = form ? form.title.trim() : point.title
  if (!title) return { ok: false, error: '제목을 먼저 입력해 주세요.' }
  const levelMin = form && Number.isInteger(form.levelMin) ? Math.min(10, Math.max(1, form.levelMin)) : point.levelMin
  const levelMax = form && Number.isInteger(form.levelMax) ? Math.min(10, Math.max(levelMin, form.levelMax)) : point.levelMax
  let prerequisiteTitles = point.prerequisites.map((p) => p.requiredPoint.title)
  if (form && Array.isArray(form.prerequisiteIds)) {
    const ids = form.prerequisiteIds.filter((id): id is string => typeof id === 'string').slice(0, 20)
    prerequisiteTitles = ids.length
      ? (await prisma.grammarPoint.findMany({ where: { id: { in: ids } }, select: { title: true } })).map((p) => p.title)
      : []
  }

  const res = await generateGrammarPointDraft({
    code: point.code,
    title,
    categoryName: point.category.name,
    parentCategoryName: point.category.parent?.name ?? null,
    levelMin,
    levelMax,
    prerequisiteTitles,
    sourceText: formatScriptsForPrompt(scripts.prompt),
  })
  if (!res.ok) return res

  await replaceDraftGaps(pointId, res.gaps)
  return { ok: true, draft: res.draft, gaps: res.gaps, scriptCount: scripts.prompt.length }
}

/**
 * 편집 화면용 — 관리자 원고와 현재 폼의 제목·레벨·선수 포인트로 개념 정리 초안을 만든다.
 * 초안은 폼에만 채우고 저장하지 않는다. 원고 보완 요청은 바로 기록한다.
 */
export async function generateGrammarPointDraftAction(
  pointId: string,
  form: { title: string; levelMin: number; levelMax: number; prerequisiteIds: string[] },
): Promise<DraftActionResult> {
  const admin = await getAdmin()
  if (!admin) return { ok: false, error: '권한이 없습니다.' }
  return buildDraft(pointId, form)
}

/**
 * 분류 화면 일괄 생성용 — 초안(DRAFT) 상태 포인트만 원고로 개념 정리를 만들어 바로 저장한다.
 * 검수 요청·공개 포인트는 건드리지 않는다.
 */
export async function generateAndSavePointDraft(
  pointId: string,
): Promise<{ ok: true; gapCount: number } | { ok: false; error: string }> {
  const admin = await getAdmin()
  if (!admin) return { ok: false, error: '권한이 없습니다.' }

  const point = await findHqPoint(pointId)
  if (!point) return { ok: false, error: '포인트를 찾을 수 없습니다.' }
  if (point.status !== 'DRAFT') return { ok: false, error: '초안 상태 포인트만 일괄 생성할 수 있습니다.' }

  const res = await buildDraft(pointId, null)
  if (!res.ok) return res

  await prisma.grammarPoint.update({
    where: { id: pointId },
    data: {
      summary: res.draft.summary,
      rulesJson: toJson(res.draft.rules),
      examplesJson: toJson(res.draft.examples),
      commonErrorsJson: toJson(res.draft.commonErrors),
    },
  })
  revalidateGrammarCurriculum()
  await logActivity({
    userId: admin.id,
    role: admin.role,
    action: ACTIVITY_ACTIONS.GRAMMAR_POINT_UPDATE,
    metadata: { pointId, code: point.code, via: 'AI_BULK' },
  })
  return { ok: true, gapCount: res.gaps.length }
}

// ─── 원고 ────────────────────────────────────────────────────────────────────

export async function addSourceScript(input: {
  categoryId?: string | null
  grammarPointId?: string | null
  title?: string
  content: string
  gapId?: string | null
}): Promise<ActionResult> {
  const admin = await getAdmin()
  if (!admin) return { ok: false, error: '권한이 없습니다.' }

  const content = typeof input.content === 'string' ? input.content.trim() : ''
  const title = typeof input.title === 'string' ? input.title.trim().slice(0, 100) : ''
  if (!content) return { ok: false, error: '원고 내용을 입력해 주세요.' }
  if (content.length > SCRIPT_CONTENT_MAX) {
    return { ok: false, error: `원고는 한 번에 ${SCRIPT_CONTENT_MAX.toLocaleString()}자까지 올릴 수 있습니다. 나눠서 올려 주세요.` }
  }
  const categoryId = input.categoryId || null
  const grammarPointId = input.grammarPointId || null
  if (!categoryId === !grammarPointId) return { ok: false, error: '원고를 붙일 분류나 포인트를 하나만 골라 주세요.' }

  const [category, point, gap] = await Promise.all([
    categoryId ? prisma.grammarCategory.findUnique({ where: { id: categoryId }, select: { code: true } }) : null,
    grammarPointId ? findHqPoint(grammarPointId) : null,
    input.gapId
      ? prisma.grammarContentGap.findFirst({ where: { id: input.gapId, status: GAP_STATUS.OPEN }, select: { id: true } })
      : null,
  ])
  if (categoryId && !category) return { ok: false, error: '분류를 찾을 수 없습니다.' }
  if (grammarPointId && !point) return { ok: false, error: '포인트를 찾을 수 없습니다.' }

  const script = await prisma.grammarSourceScript.create({
    data: { categoryId, grammarPointId, title: title || null, content, gapId: gap?.id ?? null, createdById: admin.id },
    select: { id: true },
  })
  if (gap) {
    await prisma.grammarContentGap.update({
      where: { id: gap.id },
      data: { status: GAP_STATUS.RESOLVED, resolvedScriptId: script.id, resolvedAt: new Date() },
    })
  }

  await logActivity({
    userId: admin.id,
    role: admin.role,
    action: ACTIVITY_ACTIONS.GRAMMAR_SCRIPT_SAVE,
    metadata: { scriptId: script.id, code: category?.code ?? point?.code ?? null, gapId: gap?.id ?? null, chars: content.length },
  })
  return { ok: true }
}

export async function updateSourceScript(
  scriptId: string,
  input: { title?: string; content: string; isActive: boolean },
): Promise<ActionResult> {
  const admin = await getAdmin()
  if (!admin) return { ok: false, error: '권한이 없습니다.' }

  const content = typeof input.content === 'string' ? input.content.trim() : ''
  if (!content) return { ok: false, error: '원고 내용을 입력해 주세요.' }
  if (content.length > SCRIPT_CONTENT_MAX) {
    return { ok: false, error: `원고는 한 번에 ${SCRIPT_CONTENT_MAX.toLocaleString()}자까지 저장할 수 있습니다.` }
  }
  const title = typeof input.title === 'string' ? input.title.trim().slice(0, 100) : ''

  const exists = await prisma.grammarSourceScript.findUnique({ where: { id: scriptId }, select: { id: true } })
  if (!exists) return { ok: false, error: '원고를 찾을 수 없습니다.' }

  await prisma.grammarSourceScript.update({
    where: { id: scriptId },
    data: { title: title || null, content, isActive: input.isActive === true },
  })
  await logActivity({
    userId: admin.id,
    role: admin.role,
    action: ACTIVITY_ACTIONS.GRAMMAR_SCRIPT_SAVE,
    metadata: { scriptId, chars: content.length, isActive: input.isActive === true },
  })
  return { ok: true }
}

// ─── 원고 AI 분석 · 보완 요청 ────────────────────────────────────────────────

/**
 * 중분류 원고를 AI로 검토해 포인트별 보완 요청을 새로 만든다.
 * 이 중분류 포인트의 열린 ANALYZE 요청은 이번 결과로 바뀐다(해결·무시한 요청은 기록으로 남음).
 */
export async function analyzeCategoryScriptsAction(
  categoryId: string,
): Promise<{ ok: true; enough: number; partial: number; missing: number } | { ok: false; error: string }> {
  const admin = await getAdmin()
  if (!admin) return { ok: false, error: '권한이 없습니다.' }

  const [category, scripts] = await Promise.all([
    prisma.grammarCategory.findUnique({
      where: { id: categoryId },
      select: {
        code: true,
        name: true,
        depth: true,
        parent: { select: { name: true } },
        points: {
          where: { academyId: null },
          orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
          select: { id: true, code: true, title: true, levelMin: true, levelMax: true },
        },
      },
    }),
    getScriptsForCategory(categoryId),
  ])
  if (!category) return { ok: false, error: '분류를 찾을 수 없습니다.' }
  if (category.depth !== 2) return { ok: false, error: 'AI 분석은 중분류에서 실행해 주세요.' }

  const res = await analyzeCategoryScripts({
    categoryCode: category.code,
    categoryName: category.name,
    parentCategoryName: category.parent?.name ?? null,
    points: category.points,
    sourceText: formatScriptsForPrompt(scripts.prompt),
  })
  if (!res.ok) return res

  const idByCode = new Map(category.points.map((p) => [p.code, p.id]))
  const pointIds = category.points.map((p) => p.id)
  const rows = res.points.flatMap((r) =>
    r.gaps.map((g) => ({
      grammarPointId: idByCode.get(r.code) ?? null,
      message: g.message,
      request: g.request || null,
      origin: GAP_ORIGIN.ANALYZE,
    })),
  )

  await prisma.$transaction([
    prisma.grammarContentGap.deleteMany({
      where: {
        status: GAP_STATUS.OPEN,
        origin: GAP_ORIGIN.ANALYZE,
        OR: [{ grammarPointId: { in: pointIds } }, { categoryId }],
      },
    }),
    prisma.grammarContentGap.createMany({ data: rows }),
  ])

  const count = (c: string) => res.points.filter((p) => p.coverage === c).length
  await logActivity({
    userId: admin.id,
    role: admin.role,
    action: ACTIVITY_ACTIONS.GRAMMAR_SCRIPT_ANALYZE,
    metadata: { categoryId, code: category.code, gaps: rows.length },
  })
  return { ok: true, enough: count('ENOUGH'), partial: count('PARTIAL'), missing: count('MISSING') }
}

/** 보완 요청 무시 (기록은 남김) */
export async function dismissContentGap(gapId: string): Promise<ActionResult> {
  const admin = await getAdmin()
  if (!admin) return { ok: false, error: '권한이 없습니다.' }
  const res = await prisma.grammarContentGap.updateMany({
    where: { id: gapId, status: GAP_STATUS.OPEN },
    data: { status: GAP_STATUS.DISMISSED, resolvedAt: new Date() },
  })
  if (res.count === 0) return { ok: false, error: '이미 처리된 요청입니다.' }
  return { ok: true }
}
