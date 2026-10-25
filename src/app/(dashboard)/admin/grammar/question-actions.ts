'use server'

// 관리자 문법 문항 — 기존 문항 AI 태깅·검수, 포인트별 AI 문항 생성·검수

import { revalidateTag } from 'next/cache'
import { prisma } from '@/lib/prisma/client'
import type { Prisma, Role } from '@/generated/prisma'
import { getCurrentUser } from '@/lib/auth'
import { logActivity } from '@/lib/activity-log'
import { ACTIVITY_ACTIONS } from '@/lib/constants/activity-actions'
import { LEVEL_TO_CEFR } from '@/lib/constants/levels'
import { getAdminGrammarTree } from '@/lib/grammar/curriculum'
import { untaggedQuestionWhere } from '@/lib/grammar/questions'
import { AUTO_ACCEPT_CONFIDENCE, TAG_BATCH_SIZE, type TaggingPointInput } from '@/lib/grammar/question-tagging'
import { updateQuestionBankStatsForDomain } from '@/lib/questions/share-to-pool'
import { generateGrammarQuestions, suggestGrammarTags } from '@/lib/openai/grammar-questions'
import { parseGrammarCommonErrors, parseGrammarExamples, parseGrammarRules } from '@/types/grammar'

type ActionResult = { ok: true } | { ok: false; error: string }

const QUESTION_BANK_TAG = 'question-bank'
const MAX_IDS = 200

async function getAdmin() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'SUPER_ADMIN') return null
  return user
}

function cleanIds(ids: unknown): string[] {
  if (!Array.isArray(ids)) return []
  return Array.from(new Set(ids.filter((id): id is string => typeof id === 'string' && id.length > 0))).slice(0, MAX_IDS)
}

/** 본사 공용 문법 문항 통계 캐시(question_bank_stats) 갱신 — 바뀐 난이도만 */
async function refreshGrammarStats(difficulties: number[]) {
  const unique = Array.from(new Set(difficulties))
  await Promise.all(unique.map((d) => updateQuestionBankStatsForDomain('GRAMMAR', d)))
}

// ─── 태깅: AI 제안 만들기 ────────────────────────────────────────────────────

/**
 * 미분류 문법 문항 TAG_BATCH_SIZE개를 AI에 보내 포인트 제안(PENDING)을 만든다.
 * 서버 시간 제한을 피하려고 한 번에 한 묶음만 — 화면에서 remaining이 0이 될 때까지 반복 호출한다.
 */
export async function runGrammarTaggingBatch(): Promise<
  { ok: true; processed: number; suggested: number; remaining: number } | { ok: false; error: string }
> {
  const admin = await getAdmin()
  if (!admin) return { ok: false, error: '권한이 없습니다.' }

  const [questions, tree] = await Promise.all([
    prisma.question.findMany({
      where: untaggedQuestionWhere,
      // 같은 subCategory끼리 한 묶음에 모이도록 (프롬프트에 분류명을 한 번만 적음)
      orderBy: [{ subCategory: 'asc' }, { id: 'asc' }],
      take: TAG_BATCH_SIZE,
      select: { id: true, subCategory: true, contentJson: true },
    }),
    getAdminGrammarTree(),
  ])
  if (questions.length === 0) return { ok: true, processed: 0, suggested: 0, remaining: 0 }

  const points: (TaggingPointInput & { id: string })[] = tree.flatMap((c) =>
    c.children.flatMap((s) => s.points.map((p) => ({ id: p.id, code: p.code, title: p.title, group: `${c.name} › ${s.name}` }))),
  )
  if (points.length === 0) return { ok: false, error: '문법 포인트가 없습니다. 커리큘럼 시드를 먼저 실행해 주세요.' }

  const res = await suggestGrammarTags(questions, points)
  if (!res.ok) return res

  const idByCode = new Map(points.map((p) => [p.code, p.id]))
  await prisma.grammarTagSuggestion.createMany({
    data: res.results.map((r) => ({
      questionId: r.questionId,
      suggestedPointId: r.code ? idByCode.get(r.code) ?? null : null,
      confidence: r.confidence,
    })),
    skipDuplicates: true, // 두 창에서 동시에 돌려도 문항당 제안 1개
  })

  const remaining = await prisma.question.count({ where: untaggedQuestionWhere })
  const suggested = res.results.filter((r) => r.code).length
  await logActivity({
    userId: admin.id,
    role: admin.role,
    action: ACTIVITY_ACTIONS.GRAMMAR_TAG_RUN,
    metadata: { processed: questions.length, suggested, remaining },
  })
  return { ok: true, processed: questions.length, suggested, remaining }
}

// ─── 태깅: 검수 ──────────────────────────────────────────────────────────────

async function logTagReview(adminId: string, role: Role, op: string, count: number) {
  revalidateTag(QUESTION_BANK_TAG)
  await logActivity({
    userId: adminId,
    role,
    action: ACTIVITY_ACTIONS.GRAMMAR_TAG_REVIEW,
    metadata: { op, count },
  })
}

/** 고른 제안을 AI 제안 포인트로 확정 */
export async function acceptGrammarTagSuggestions(ids: string[]): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  const admin = await getAdmin()
  if (!admin) return { ok: false, error: '권한이 없습니다.' }
  const clean = cleanIds(ids)
  if (clean.length === 0) return { ok: false, error: '확정할 문항을 골라 주세요.' }

  const rows = await prisma.grammarTagSuggestion.findMany({
    where: { id: { in: clean }, status: 'PENDING', suggestedPointId: { not: null } },
    select: { id: true, questionId: true, suggestedPointId: true },
  })
  if (rows.length === 0) return { ok: false, error: '확정할 수 있는 제안이 없습니다. 새로고침 후 다시 시도해 주세요.' }

  const now = new Date()
  await prisma.$transaction([
    ...rows.map((r) =>
      prisma.question.update({ where: { id: r.questionId }, data: { grammarPointId: r.suggestedPointId } }),
    ),
    prisma.grammarTagSuggestion.updateMany({
      where: { id: { in: rows.map((r) => r.id) } },
      data: { status: 'ACCEPTED', reviewedAt: now },
    }),
  ])
  await logTagReview(admin.id, admin.role, 'accept', rows.length)
  return { ok: true, count: rows.length }
}

/** 확신도 AUTO_ACCEPT_CONFIDENCE 이상 제안 전체를 한 번에 확정 */
export async function acceptHighConfidenceSuggestions(): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  const admin = await getAdmin()
  if (!admin) return { ok: false, error: '권한이 없습니다.' }

  const [, count] = await prisma.$transaction([
    prisma.$executeRaw`
      UPDATE questions q
         SET grammar_point_id = s.suggested_point_id
        FROM grammar_tag_suggestions s
       WHERE s.question_id = q.id
         AND s.status = 'PENDING'
         AND s.suggested_point_id IS NOT NULL
         AND s.confidence >= ${AUTO_ACCEPT_CONFIDENCE}`,
    prisma.$executeRaw`
      UPDATE grammar_tag_suggestions
         SET status = 'ACCEPTED', reviewed_at = NOW()
       WHERE status = 'PENDING'
         AND suggested_point_id IS NOT NULL
         AND confidence >= ${AUTO_ACCEPT_CONFIDENCE}`,
  ])
  if (count === 0) return { ok: false, error: '일괄 확정할 제안이 없습니다.' }
  await logTagReview(admin.id, admin.role, 'accept-high', count)
  return { ok: true, count }
}

/** 제안과 다른 포인트로 바꿔 확정 */
export async function assignGrammarTagSuggestion(suggestionId: string, pointId: string): Promise<ActionResult> {
  const admin = await getAdmin()
  if (!admin) return { ok: false, error: '권한이 없습니다.' }

  const [suggestion, point] = await Promise.all([
    prisma.grammarTagSuggestion.findUnique({ where: { id: suggestionId }, select: { questionId: true } }),
    prisma.grammarPoint.findFirst({ where: { id: pointId, academyId: null }, select: { id: true } }),
  ])
  if (!suggestion) return { ok: false, error: '제안을 찾을 수 없습니다.' }
  if (!point) return { ok: false, error: '포인트를 찾을 수 없습니다.' }

  await prisma.$transaction([
    prisma.question.update({ where: { id: suggestion.questionId }, data: { grammarPointId: point.id } }),
    prisma.grammarTagSuggestion.update({
      where: { id: suggestionId },
      data: { status: 'ACCEPTED', reviewedAt: new Date() },
    }),
  ])
  await logTagReview(admin.id, admin.role, 'assign', 1)
  return { ok: true }
}

/** "해당 없음" — 포인트에 연결하지 않고 다시 태깅하지도 않음 */
export async function rejectGrammarTagSuggestions(ids: string[]): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  const admin = await getAdmin()
  if (!admin) return { ok: false, error: '권한이 없습니다.' }
  const clean = cleanIds(ids)
  if (clean.length === 0) return { ok: false, error: '문항을 골라 주세요.' }

  const res = await prisma.grammarTagSuggestion.updateMany({
    where: { id: { in: clean }, status: 'PENDING' },
    data: { status: 'REJECTED', reviewedAt: new Date() },
  })
  if (res.count === 0) return { ok: false, error: '이미 처리된 제안입니다.' }
  await logTagReview(admin.id, admin.role, 'reject', res.count)
  return { ok: true, count: res.count }
}

// ─── 포인트 문항: AI 생성 ────────────────────────────────────────────────────

/** 포인트 개념 정리를 바탕으로 문항 10개를 만들어 검수 대기(isVerified=false)로 저장 */
export async function generatePointQuestionsAction(
  pointId: string,
): Promise<{ ok: true; saved: number; dropped: number } | { ok: false; error: string }> {
  const admin = await getAdmin()
  if (!admin) return { ok: false, error: '권한이 없습니다.' }

  const [point, existing] = await Promise.all([
    prisma.grammarPoint.findFirst({
      where: { id: pointId, academyId: null },
      select: {
        id: true,
        code: true,
        title: true,
        levelMin: true,
        levelMax: true,
        summary: true,
        rulesJson: true,
        examplesJson: true,
        commonErrorsJson: true,
        category: { select: { name: true, parent: { select: { name: true } } } },
      },
    }),
    prisma.question.findMany({
      where: { grammarPointId: pointId, isActive: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: { contentJson: true },
    }),
  ])
  if (!point) return { ok: false, error: '포인트를 찾을 수 없습니다.' }

  const rules = parseGrammarRules(point.rulesJson)
  if (!point.summary && rules.length === 0) {
    return { ok: false, error: '개념 정리(요약·규칙)를 먼저 저장해 주세요. 문항은 개념 정리를 바탕으로 만듭니다.' }
  }

  const res = await generateGrammarQuestions({
    code: point.code,
    title: point.title,
    categoryName: point.category.name,
    parentCategoryName: point.category.parent?.name ?? null,
    levelMin: point.levelMin,
    levelMax: point.levelMax,
    summary: point.summary,
    rules,
    examples: parseGrammarExamples(point.examplesJson),
    commonErrors: parseGrammarCommonErrors(point.commonErrorsJson),
    existingContents: existing.map((q) => q.contentJson),
  })
  if (!res.ok) return res

  await prisma.question.createMany({
    data: res.questions.map((q) => ({
      academyId: null,
      domain: 'GRAMMAR' as const,
      subCategory: point.title,
      difficulty: q.difficulty,
      cefrLevel: LEVEL_TO_CEFR[q.difficulty] ?? null,
      contentJson: q.content as unknown as Prisma.InputJsonObject,
      source: 'AI_GENERATED' as const,
      isVerified: false,
      isActive: true,
      grammarPointId: point.id,
      createdBy: admin.id,
    })),
  })

  revalidateTag(QUESTION_BANK_TAG)
  await refreshGrammarStats(res.questions.map((q) => q.difficulty))
  await logActivity({
    userId: admin.id,
    role: admin.role,
    action: ACTIVITY_ACTIONS.GRAMMAR_QUESTION_GENERATE,
    metadata: { pointId, code: point.code, saved: res.questions.length, dropped: res.dropped },
  })
  return { ok: true, saved: res.questions.length, dropped: res.dropped }
}

// ─── 포인트 문항: 검수 ───────────────────────────────────────────────────────

/** 포인트에 연결된 본사 문항만 대상 (다른 포인트·학원 문항을 실수로 바꾸지 않게) */
async function findPointQuestions(pointId: string, ids: string[]) {
  return prisma.question.findMany({
    where: { id: { in: ids }, grammarPointId: pointId, academyId: null },
    select: { id: true, difficulty: true },
  })
}

async function afterQuestionReview(
  admin: { id: string; role: Role },
  pointId: string,
  op: string,
  rows: { id: string; difficulty: number }[],
) {
  revalidateTag(QUESTION_BANK_TAG)
  await refreshGrammarStats(rows.map((r) => r.difficulty))
  await logActivity({
    userId: admin.id,
    role: admin.role,
    action: ACTIVITY_ACTIONS.GRAMMAR_QUESTION_REVIEW,
    metadata: { pointId, op, count: rows.length },
  })
}

/** 검수 완료(isVerified=true) / 검수 취소 */
export async function setPointQuestionsVerified(
  pointId: string,
  ids: string[],
  verified: boolean,
): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  const admin = await getAdmin()
  if (!admin) return { ok: false, error: '권한이 없습니다.' }
  const rows = await findPointQuestions(pointId, cleanIds(ids))
  if (rows.length === 0) return { ok: false, error: '문항을 골라 주세요.' }

  await prisma.question.updateMany({
    where: { id: { in: rows.map((r) => r.id) } },
    data: { isVerified: verified === true },
  })
  await afterQuestionReview(admin, pointId, verified ? 'verify' : 'unverify', rows)
  return { ok: true, count: rows.length }
}

/** 사용 중지 / 다시 사용 (삭제 대신) */
export async function setPointQuestionActive(pointId: string, questionId: string, active: boolean): Promise<ActionResult> {
  const admin = await getAdmin()
  if (!admin) return { ok: false, error: '권한이 없습니다.' }
  const rows = await findPointQuestions(pointId, [questionId])
  if (rows.length === 0) return { ok: false, error: '문항을 찾을 수 없습니다.' }

  await prisma.question.update({ where: { id: questionId }, data: { isActive: active === true } })
  await afterQuestionReview(admin, pointId, active ? 'activate' : 'deactivate', rows)
  return { ok: true }
}

/** 포인트 연결 해제 — 태깅으로 붙은 문항이면 제안을 다시 검수 대기로 돌린다 */
export async function unlinkPointQuestion(pointId: string, questionId: string): Promise<ActionResult> {
  const admin = await getAdmin()
  if (!admin) return { ok: false, error: '권한이 없습니다.' }
  const rows = await findPointQuestions(pointId, [questionId])
  if (rows.length === 0) return { ok: false, error: '문항을 찾을 수 없습니다.' }

  await prisma.$transaction([
    prisma.question.update({ where: { id: questionId }, data: { grammarPointId: null } }),
    prisma.grammarTagSuggestion.updateMany({
      where: { questionId },
      data: { status: 'PENDING', reviewedAt: null },
    }),
  ])
  await afterQuestionReview(admin, pointId, 'unlink', rows)
  return { ok: true }
}
