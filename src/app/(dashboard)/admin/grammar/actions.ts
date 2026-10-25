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
  getStatusChangeBlockReason,
  validateGrammarPointInput,
  type GrammarPointDraft,
} from '@/lib/grammar/point-editing'
import { GRAMMAR_POINT_STATUS_LABEL } from '@/lib/grammar/constants'
import { generateGrammarPointDraft } from '@/lib/openai/grammar-point-draft'

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

// ─── 저장 ────────────────────────────────────────────────────────────────────

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

  const data: Prisma.GrammarPointUpdateInput = {
    title: v.title,
    levelMin: v.levelMin,
    levelMax: v.levelMax,
    summary: v.summary || null,
    rulesJson: v.rules as unknown as Prisma.InputJsonValue,
    examplesJson: v.examples as unknown as Prisma.InputJsonValue,
    commonErrorsJson: v.commonErrors as unknown as Prisma.InputJsonValue,
  }

  try {
    await prisma.$transaction([
      prisma.grammarPoint.update({ where: { id: pointId }, data }),
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

// ─── AI 초안 ─────────────────────────────────────────────────────────────────

/**
 * 현재 폼의 제목·레벨·선수 포인트로 개념 정리 초안을 만든다. 저장하지 않는다.
 */
export async function generateGrammarPointDraftAction(
  pointId: string,
  form: { title: string; levelMin: number; levelMax: number; prerequisiteIds: string[] },
): Promise<{ ok: true; draft: GrammarPointDraft } | { ok: false; error: string }> {
  const admin = await getAdmin()
  if (!admin) return { ok: false, error: '권한이 없습니다.' }

  const title = typeof form.title === 'string' ? form.title.trim() : ''
  if (!title) return { ok: false, error: '제목을 먼저 입력해 주세요.' }
  const levelMin = Number.isInteger(form.levelMin) ? Math.min(10, Math.max(1, form.levelMin)) : 1
  const levelMax = Number.isInteger(form.levelMax) ? Math.min(10, Math.max(levelMin, form.levelMax)) : 10
  const prereqIds = Array.isArray(form.prerequisiteIds)
    ? form.prerequisiteIds.filter((id): id is string => typeof id === 'string').slice(0, 20)
    : []

  const [point, prereqs] = await Promise.all([
    prisma.grammarPoint.findFirst({
      where: { id: pointId, academyId: null },
      select: { code: true, category: { select: { name: true, parent: { select: { name: true } } } } },
    }),
    prereqIds.length
      ? prisma.grammarPoint.findMany({ where: { id: { in: prereqIds } }, select: { title: true } })
      : Promise.resolve([]),
  ])
  if (!point) return { ok: false, error: '포인트를 찾을 수 없습니다.' }

  return generateGrammarPointDraft({
    code: point.code,
    title,
    categoryName: point.category.name,
    parentCategoryName: point.category.parent?.name ?? null,
    levelMin,
    levelMax,
    prerequisiteTitles: prereqs.map((p) => p.title),
  })
}
