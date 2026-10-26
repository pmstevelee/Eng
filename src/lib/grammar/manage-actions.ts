'use server'

// 문법학습 관리 Server Actions (교사·학원장) — 반·개인 진도 배정, 코스 템플릿, 학원 강의, 학원 AI 문항
// 모든 액션에서 접근 범위를 다시 확인한다 (교사: 담당 반만, 학원장: 본원+소유 지점).

import { revalidatePath, revalidateTag } from 'next/cache'
import { prisma } from '@/lib/prisma/client'
import type { Prisma } from '@/generated/prisma'
import { getCurrentUser } from '@/lib/auth'
import { logActivity } from '@/lib/activity-log'
import { ACTIVITY_ACTIONS, type ActivityAction } from '@/lib/constants/activity-actions'
import { LEVEL_TO_CEFR } from '@/lib/constants/levels'
import { dbDate } from '@/lib/attendance/time'
import { chargeAiCredits, getCreditPricing, getWallet, walletAcademyIdOf } from '@/lib/credits/wallet'
import { AI_MODEL } from '@/lib/openai/models'
import { generateGrammarQuestions } from '@/lib/openai/grammar-questions'
import { parseGrammarCommonErrors, parseGrammarExamples, parseGrammarRules } from '@/types/grammar'
import {
  ASSIGN_INTERVAL_RANGE,
  MAX_ASSIGN_POINTS,
  isValidDateKey,
  moveInOrder,
  planAssignmentImport,
  scheduleCourseDates,
} from './assignment-plan'
import { validateLectureInput } from './lecture-input'
import { deleteLecture, upsertLecture } from './lectures'
import {
  assignablePointWhere,
  findManagedClass,
  findManagedStudent,
  getGrammarManageScope,
  templateAcademyIdOf,
  type GrammarManageScope,
} from './manage-access'

type ActionResult = { ok: true } | { ok: false; error: string }
type AddResult = { ok: true; added: number; skippedDuplicate: number; skippedHidden: number } | { ok: false; error: string }

const NO_PERMISSION = '권한이 없습니다.'
const CLASS_NOT_FOUND = '반을 찾을 수 없거나 관리 권한이 없습니다.'
const COURSE_NAME_MAX = 50
const COURSE_DESCRIPTION_MAX = 200
const QUESTION_BANK_TAG = 'question-bank'
/** 원격 DB 왕복을 고려한 대화형 트랜잭션 제한 시간 */
const TX_OPTIONS = { maxWait: 10_000, timeout: 20_000 }

function revalidateManagePages() {
  revalidatePath('/teacher/grammar', 'layout')
  revalidatePath('/owner/grammar', 'layout')
  // 학생 문법 홈의 "이어서 학습"·마감일, 오늘의 학습 문법 카드
  revalidatePath('/student/grammar', 'layout')
  revalidatePath('/student/daily-mission')
}

function cleanIds(ids: unknown): string[] {
  if (!Array.isArray(ids)) return []
  const unique: string[] = []
  const seen = new Set<string>()
  for (const id of ids) {
    if (typeof id !== 'string' || !id || seen.has(id)) continue
    seen.add(id)
    unique.push(id)
  }
  return unique
}

async function logManage(scope: GrammarManageScope, academyId: string, action: ActivityAction, metadata: Prisma.InputJsonObject) {
  await logActivity({
    userId: scope.userId,
    role: scope.role,
    academyId,
    action,
    metadata,
  })
}

// ─── 반 배정 ─────────────────────────────────────────────────────────────────

/**
 * 반에 포인트를 이어 붙인다 — 반 행을 잠가(FOR UPDATE) 동시에 두 번 눌러도 같은 포인트가 두 번 들어가지 않게.
 * dates가 없으면 날짜 없이, 있으면 포인트 순서대로 그 날짜를 쓴다.
 */
async function appendToClass(params: {
  scope: GrammarManageScope
  cls: { id: string; academyId: string }
  pointIds: string[]
  dates: (pointCount: number) => { startKey: string | null; dueKey: string | null }[]
}): Promise<{ added: number; skippedDuplicate: number; skippedHidden: number }> {
  const { scope, cls, pointIds } = params
  return prisma.$transaction(async (tx) => {
    await tx.$queryRawUnsafe('SELECT id FROM classes WHERE id = $1 FOR UPDATE', cls.id)
    const [existing, visible] = await Promise.all([
      tx.grammarAssignment.findMany({ where: { classId: cls.id }, select: { grammarPointId: true, sortOrder: true } }),
      tx.grammarPoint.findMany({
        where: { id: { in: pointIds }, ...assignablePointWhere(cls.academyId) },
        select: { id: true },
      }),
    ])
    const plan = planAssignmentImport({
      pointIds,
      existingPointIds: existing.map((e) => e.grammarPointId),
      visiblePointIds: new Set(visible.map((p) => p.id)),
    })
    if (plan.toAdd.length > 0) {
      const base = existing.reduce((max, e) => Math.max(max, e.sortOrder), -1) + 1
      const dates = params.dates(plan.toAdd.length)
      await tx.grammarAssignment.createMany({
        data: plan.toAdd.map((grammarPointId, i) => ({
          academyId: cls.academyId,
          classId: cls.id,
          grammarPointId,
          sortOrder: base + i,
          startDate: dates[i]?.startKey ? dbDate(dates[i].startKey as string) : null,
          dueDate: dates[i]?.dueKey ? dbDate(dates[i].dueKey as string) : null,
          assignedById: scope.userId,
        })),
      })
    }
    return { added: plan.toAdd.length, skippedDuplicate: plan.skippedDuplicate, skippedHidden: plan.skippedHidden }
  }, TX_OPTIONS)
}

/** ① 코스 불러오기 — 템플릿 포인트를 반 배정으로 복사 (템플릿을 나중에 고쳐도 배정은 그대로) */
export async function importCourseToClass(
  classId: string,
  input: { courseId: string; startDate: string; intervalDays: number },
): Promise<AddResult> {
  const scope = await getGrammarManageScope()
  if (!scope) return { ok: false, error: NO_PERMISSION }
  const cls = await findManagedClass(scope, classId)
  if (!cls) return { ok: false, error: CLASS_NOT_FOUND }

  const courseId = typeof input?.courseId === 'string' ? input.courseId : ''
  if (!courseId) return { ok: false, error: '불러올 코스를 골라 주세요.' }
  if (!isValidDateKey(input.startDate)) return { ok: false, error: '시작일을 입력해 주세요.' }
  const interval = input.intervalDays
  if (!Number.isInteger(interval) || interval < ASSIGN_INTERVAL_RANGE.min || interval > ASSIGN_INTERVAL_RANGE.max) {
    return { ok: false, error: `단원 간격은 ${ASSIGN_INTERVAL_RANGE.min}~${ASSIGN_INTERVAL_RANGE.max}일 사이로 입력해 주세요.` }
  }

  const templateAcademyId = await templateAcademyIdOf(cls.academyId)
  const course = await prisma.grammarCourse.findFirst({
    where: { id: courseId, isActive: true, OR: [{ academyId: null }, { academyId: templateAcademyId }] },
    select: { id: true, name: true, items: { orderBy: { sortOrder: 'asc' }, select: { grammarPointId: true } } },
  })
  if (!course) return { ok: false, error: '코스를 찾을 수 없습니다.' }
  if (course.items.length === 0) return { ok: false, error: '이 코스에는 포인트가 없습니다.' }

  try {
    const res = await appendToClass({
      scope,
      cls,
      pointIds: course.items.map((i) => i.grammarPointId),
      dates: (count) => scheduleCourseDates(input.startDate, interval, count),
    })
    await logManage(scope, cls.academyId, ACTIVITY_ACTIONS.GRAMMAR_ASSIGNMENT_CHANGE, {
      op: 'import-course',
      classId: cls.id,
      courseId: course.id,
      courseName: course.name,
      startDate: input.startDate,
      intervalDays: interval,
      ...res,
    })
    revalidateManagePages()
    return { ok: true, ...res }
  } catch (error) {
    console.error('[grammar-manage] 코스 불러오기 실패:', error)
    return { ok: false, error: '코스를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.' }
  }
}

/** ② 포인트 추가 — 트리에서 고른 포인트를 배정 목록 끝에 붙인다 */
export async function addPointsToClass(
  classId: string,
  input: { pointIds: string[]; startDate?: string | null; dueDate?: string | null },
): Promise<AddResult> {
  const scope = await getGrammarManageScope()
  if (!scope) return { ok: false, error: NO_PERMISSION }
  const cls = await findManagedClass(scope, classId)
  if (!cls) return { ok: false, error: CLASS_NOT_FOUND }

  const pointIds = cleanIds(input?.pointIds)
  if (pointIds.length === 0) return { ok: false, error: '추가할 포인트를 골라 주세요.' }
  if (pointIds.length > MAX_ASSIGN_POINTS) return { ok: false, error: `한 번에 ${MAX_ASSIGN_POINTS}개까지 추가할 수 있습니다.` }
  const dates = checkDates(input?.startDate ?? null, input?.dueDate ?? null)
  if (!dates.ok) return dates

  try {
    const res = await appendToClass({
      scope,
      cls,
      pointIds,
      dates: (count) => Array.from({ length: count }, () => ({ startKey: dates.startKey, dueKey: dates.dueKey })),
    })
    await logManage(scope, cls.academyId, ACTIVITY_ACTIONS.GRAMMAR_ASSIGNMENT_CHANGE, {
      op: 'add-points',
      classId: cls.id,
      ...res,
    })
    revalidateManagePages()
    return { ok: true, ...res }
  } catch (error) {
    console.error('[grammar-manage] 포인트 추가 실패:', error)
    return { ok: false, error: '포인트를 추가하지 못했습니다. 잠시 후 다시 시도해 주세요.' }
  }
}

function checkDates(
  startKey: string | null,
  dueKey: string | null,
): { ok: true; startKey: string | null; dueKey: string | null } | { ok: false; error: string } {
  const start = startKey || null
  const due = dueKey || null
  if (start !== null && !isValidDateKey(start)) return { ok: false, error: '시작일 형식이 올바르지 않습니다.' }
  if (due !== null && !isValidDateKey(due)) return { ok: false, error: '마감일 형식이 올바르지 않습니다.' }
  if (start && due && due < start) return { ok: false, error: '마감일은 시작일보다 빠를 수 없습니다.' }
  return { ok: true, startKey: start, dueKey: due }
}

/** 배정 1건 + 그 반 접근 권한 확인 (반 배정만) */
async function findManagedClassAssignment(scope: GrammarManageScope, assignmentId: unknown) {
  if (typeof assignmentId !== 'string' || !assignmentId) return null
  const a = await prisma.grammarAssignment.findUnique({
    where: { id: assignmentId },
    select: { id: true, classId: true, grammarPointId: true },
  })
  if (!a?.classId) return null
  const cls = await findManagedClass(scope, a.classId)
  return cls ? { assignment: a, cls } : null
}

/** ③ 순서 변경 — 위/아래 한 칸 */
export async function moveClassAssignment(assignmentId: string, direction: 'up' | 'down'): Promise<ActionResult> {
  const scope = await getGrammarManageScope()
  if (!scope) return { ok: false, error: NO_PERMISSION }
  if (direction !== 'up' && direction !== 'down') return { ok: false, error: '잘못된 요청입니다.' }
  const found = await findManagedClassAssignment(scope, assignmentId)
  if (!found) return { ok: false, error: '배정을 찾을 수 없습니다.' }

  const items = await prisma.grammarAssignment.findMany({
    where: { classId: found.cls.id },
    select: { id: true, sortOrder: true },
  })
  const changes = moveInOrder(items, found.assignment.id, direction)
  if (changes.length > 0) {
    await prisma.$transaction(
      changes.map((c) => prisma.grammarAssignment.update({ where: { id: c.id }, data: { sortOrder: c.sortOrder } })),
    )
    revalidateManagePages()
  }
  return { ok: true }
}

/** ③ 날짜 수정 — 빈 값이면 날짜 없음 */
export async function updateClassAssignmentDates(
  assignmentId: string,
  input: { startDate: string | null; dueDate: string | null },
): Promise<ActionResult> {
  const scope = await getGrammarManageScope()
  if (!scope) return { ok: false, error: NO_PERMISSION }
  const found = await findManagedClassAssignment(scope, assignmentId)
  if (!found) return { ok: false, error: '배정을 찾을 수 없습니다.' }
  const dates = checkDates(input?.startDate ?? null, input?.dueDate ?? null)
  if (!dates.ok) return dates

  await prisma.grammarAssignment.update({
    where: { id: found.assignment.id },
    data: {
      startDate: dates.startKey ? dbDate(dates.startKey) : null,
      dueDate: dates.dueKey ? dbDate(dates.dueKey) : null,
    },
  })
  revalidateManagePages()
  return { ok: true }
}

/** ③ 배정 삭제 (학생 학습 기록은 그대로) */
export async function removeClassAssignments(assignmentIds: string[]): Promise<ActionResult> {
  const scope = await getGrammarManageScope()
  if (!scope) return { ok: false, error: NO_PERMISSION }
  const ids = cleanIds(assignmentIds).slice(0, MAX_ASSIGN_POINTS)
  if (ids.length === 0) return { ok: false, error: '삭제할 배정을 골라 주세요.' }

  const rows = await prisma.grammarAssignment.findMany({
    where: { id: { in: ids }, classId: { not: null } },
    select: { id: true, classId: true },
  })
  const classIds = Array.from(new Set(rows.map((r) => r.classId as string)))
  const allowed = await Promise.all(classIds.map((id) => findManagedClass(scope, id)))
  if (classIds.length === 0 || allowed.some((c) => !c)) return { ok: false, error: '배정을 찾을 수 없습니다.' }

  await prisma.grammarAssignment.deleteMany({ where: { id: { in: rows.map((r) => r.id) } } })
  await logManage(scope, allowed[0]!.academyId, ACTIVITY_ACTIONS.GRAMMAR_ASSIGNMENT_CHANGE, {
    op: 'remove',
    classIds,
    count: rows.length,
  })
  revalidateManagePages()
  return { ok: true }
}

// ─── 개인 배정 (UI는 3-2 학생 상세 '문법' 탭) ───────────────────────────────

/**
 * 학생 한 명에게 포인트 추가 배정 — 개인 배정끼리 같은 포인트는 한 번만.
 * 반 배정과 겹치면 학생 화면에서 마감일이 빠른 쪽 하나만 보인다.
 */
export async function assignGrammarToStudent(
  studentId: string,
  input: { pointIds: string[]; startDate?: string | null; dueDate?: string | null },
): Promise<AddResult> {
  const scope = await getGrammarManageScope()
  if (!scope) return { ok: false, error: NO_PERMISSION }
  const student = await findManagedStudent(scope, studentId)
  if (!student) return { ok: false, error: '학생을 찾을 수 없거나 관리 권한이 없습니다.' }

  const pointIds = cleanIds(input?.pointIds)
  if (pointIds.length === 0) return { ok: false, error: '배정할 포인트를 골라 주세요.' }
  if (pointIds.length > MAX_ASSIGN_POINTS) return { ok: false, error: `한 번에 ${MAX_ASSIGN_POINTS}개까지 배정할 수 있습니다.` }
  const dates = checkDates(input?.startDate ?? null, input?.dueDate ?? null)
  if (!dates.ok) return dates

  try {
    const res = await prisma.$transaction(async (tx) => {
      await tx.$queryRawUnsafe('SELECT id FROM students WHERE id = $1 FOR UPDATE', student.id)
      const [existing, visible] = await Promise.all([
        tx.grammarAssignment.findMany({
          where: { studentId: student.id },
          select: { grammarPointId: true, sortOrder: true },
        }),
        tx.grammarPoint.findMany({
          where: { id: { in: pointIds }, ...assignablePointWhere(student.academyId) },
          select: { id: true },
        }),
      ])
      const plan = planAssignmentImport({
        pointIds,
        existingPointIds: existing.map((e) => e.grammarPointId),
        visiblePointIds: new Set(visible.map((p) => p.id)),
      })
      if (plan.toAdd.length > 0) {
        const base = existing.reduce((max, e) => Math.max(max, e.sortOrder), -1) + 1
        await tx.grammarAssignment.createMany({
          data: plan.toAdd.map((grammarPointId, i) => ({
            academyId: student.academyId,
            studentId: student.id,
            grammarPointId,
            sortOrder: base + i,
            startDate: dates.startKey ? dbDate(dates.startKey) : null,
            dueDate: dates.dueKey ? dbDate(dates.dueKey) : null,
            assignedById: scope.userId,
          })),
        })
      }
      return { added: plan.toAdd.length, skippedDuplicate: plan.skippedDuplicate, skippedHidden: plan.skippedHidden }
    }, TX_OPTIONS)
    await logManage(scope, student.academyId, ACTIVITY_ACTIONS.GRAMMAR_ASSIGNMENT_CHANGE, {
      op: 'assign-student',
      studentId: student.id,
      ...res,
    })
    revalidateManagePages()
    revalidatePath('/teacher/students', 'layout')
    return { ok: true, ...res }
  } catch (error) {
    console.error('[grammar-manage] 개인 배정 실패:', error)
    return { ok: false, error: '배정하지 못했습니다. 잠시 후 다시 시도해 주세요.' }
  }
}

/** 개인 배정 삭제 */
export async function removeStudentAssignment(assignmentId: string): Promise<ActionResult> {
  const scope = await getGrammarManageScope()
  if (!scope) return { ok: false, error: NO_PERMISSION }
  if (typeof assignmentId !== 'string' || !assignmentId) return { ok: false, error: '배정을 찾을 수 없습니다.' }
  const a = await prisma.grammarAssignment.findUnique({ where: { id: assignmentId }, select: { id: true, studentId: true } })
  const student = a?.studentId ? await findManagedStudent(scope, a.studentId) : null
  if (!a || !student) return { ok: false, error: '배정을 찾을 수 없습니다.' }
  await prisma.grammarAssignment.delete({ where: { id: a.id } })
  revalidateManagePages()
  revalidatePath('/teacher/students', 'layout')
  return { ok: true }
}

// ─── 코스 템플릿 (학원장만) ──────────────────────────────────────────────────

async function getOwnerTemplateAcademy(): Promise<{ scope: GrammarManageScope; templateAcademyId: string } | null> {
  const scope = await getGrammarManageScope()
  if (!scope || scope.role !== 'ACADEMY_OWNER' || scope.academyIds.length === 0) return null
  return { scope, templateAcademyId: await templateAcademyIdOf(scope.academyIds[0]) }
}

function revalidateCoursePages() {
  revalidatePath('/owner/grammar', 'layout')
  revalidatePath('/teacher/grammar', 'layout')
}

/** 템플릿에 넣을 수 있는 포인트만 (본사 공용 + 이 학원 전용), 고른 순서 유지 */
async function filterTemplatePoints(pointIds: string[], templateAcademyId: string): Promise<string[]> {
  if (pointIds.length === 0) return []
  const rows = await prisma.grammarPoint.findMany({
    where: { id: { in: pointIds }, OR: [{ academyId: null }, { academyId: templateAcademyId }] },
    select: { id: true },
  })
  const ok = new Set(rows.map((r) => r.id))
  return pointIds.filter((id) => ok.has(id))
}

/** 본사·학원 템플릿 복제 → 학원 템플릿 */
export async function duplicateCourseTemplate(courseId: string): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const owner = await getOwnerTemplateAcademy()
  if (!owner) return { ok: false, error: NO_PERMISSION }
  if (typeof courseId !== 'string' || !courseId) return { ok: false, error: '코스를 찾을 수 없습니다.' }

  const course = await prisma.grammarCourse.findFirst({
    where: { id: courseId, isActive: true, OR: [{ academyId: null }, { academyId: owner.templateAcademyId }] },
    select: {
      name: true,
      description: true,
      targetLevel: true,
      items: { orderBy: { sortOrder: 'asc' }, select: { grammarPointId: true } },
    },
  })
  if (!course) return { ok: false, error: '코스를 찾을 수 없습니다.' }

  const pointIds = await filterTemplatePoints(
    course.items.map((i) => i.grammarPointId),
    owner.templateAcademyId,
  )
  const name = `${course.name} (복사본)`.slice(0, COURSE_NAME_MAX)
  const created = await prisma.grammarCourse.create({
    data: {
      name,
      description: course.description,
      targetLevel: course.targetLevel,
      academyId: owner.templateAcademyId,
      items: { create: pointIds.map((grammarPointId, i) => ({ grammarPointId, sortOrder: i })) },
    },
    select: { id: true },
  })
  await logManage(owner.scope, owner.templateAcademyId, ACTIVITY_ACTIONS.GRAMMAR_COURSE_SAVE, {
    op: 'duplicate',
    sourceCourseId: courseId,
    courseId: created.id,
  })
  revalidateCoursePages()
  return { ok: true, id: created.id }
}

/** 학원 템플릿 만들기(id 없음)·수정 — 포인트 목록은 통째로 바꾼다 */
export async function saveCourseTemplate(input: {
  id?: string | null
  name: string
  description?: string | null
  pointIds: string[]
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const owner = await getOwnerTemplateAcademy()
  if (!owner) return { ok: false, error: NO_PERMISSION }

  const name = typeof input?.name === 'string' ? input.name.trim() : ''
  if (!name) return { ok: false, error: '코스 이름을 입력해 주세요.' }
  if (name.length > COURSE_NAME_MAX) return { ok: false, error: `코스 이름은 ${COURSE_NAME_MAX}자 이내로 입력해 주세요.` }
  const description = typeof input.description === 'string' ? input.description.trim() : ''
  if (description.length > COURSE_DESCRIPTION_MAX) {
    return { ok: false, error: `설명은 ${COURSE_DESCRIPTION_MAX}자 이내로 입력해 주세요.` }
  }
  const requested = cleanIds(input.pointIds)
  if (requested.length === 0) return { ok: false, error: '포인트를 1개 이상 넣어 주세요.' }
  if (requested.length > MAX_ASSIGN_POINTS) return { ok: false, error: `포인트는 ${MAX_ASSIGN_POINTS}개까지 넣을 수 있습니다.` }
  const pointIds = await filterTemplatePoints(requested, owner.templateAcademyId)
  if (pointIds.length === 0) return { ok: false, error: '넣을 수 있는 포인트가 없습니다.' }

  const items = pointIds.map((grammarPointId, i) => ({ grammarPointId, sortOrder: i }))
  let id: string
  if (input.id) {
    const existing = await prisma.grammarCourse.findFirst({
      where: { id: input.id, academyId: owner.templateAcademyId, isActive: true },
      select: { id: true },
    })
    if (!existing) return { ok: false, error: '수정할 수 있는 코스가 아닙니다. 본사 코스는 복제해서 고쳐 주세요.' }
    await prisma.$transaction([
      prisma.grammarCourseItem.deleteMany({ where: { courseId: existing.id } }),
      prisma.grammarCourse.update({
        where: { id: existing.id },
        data: { name, description: description || null, items: { create: items } },
      }),
    ])
    id = existing.id
  } else {
    const created = await prisma.grammarCourse.create({
      data: { name, description: description || null, academyId: owner.templateAcademyId, items: { create: items } },
      select: { id: true },
    })
    id = created.id
  }
  await logManage(owner.scope, owner.templateAcademyId, ACTIVITY_ACTIONS.GRAMMAR_COURSE_SAVE, {
    op: input.id ? 'update' : 'create',
    courseId: id,
    pointCount: pointIds.length,
  })
  revalidateCoursePages()
  return { ok: true, id }
}

/** 학원 템플릿 삭제 — 이미 반에 복사된 배정은 그대로 남는다 */
export async function deleteCourseTemplate(courseId: string): Promise<ActionResult> {
  const owner = await getOwnerTemplateAcademy()
  if (!owner) return { ok: false, error: NO_PERMISSION }
  if (typeof courseId !== 'string' || !courseId) return { ok: false, error: '코스를 찾을 수 없습니다.' }
  const res = await prisma.grammarCourse.deleteMany({ where: { id: courseId, academyId: owner.templateAcademyId } })
  if (res.count === 0) return { ok: false, error: '삭제할 수 있는 코스가 아닙니다.' }
  await logManage(owner.scope, owner.templateAcademyId, ACTIVITY_ACTIONS.GRAMMAR_COURSE_SAVE, { op: 'delete', courseId })
  revalidateCoursePages()
  return { ok: true }
}

// ─── 학원 강의 ───────────────────────────────────────────────────────────────

/** 학원 자체 강의 저장 — 반이 속한 학원의 강의로 (포인트·학원당 1편) */
export async function saveAcademyLecture(classId: string, pointId: string, input: unknown): Promise<ActionResult> {
  const scope = await getGrammarManageScope()
  if (!scope) return { ok: false, error: NO_PERMISSION }
  const cls = await findManagedClass(scope, classId)
  if (!cls) return { ok: false, error: CLASS_NOT_FOUND }
  const parsed = validateLectureInput(input)
  if (!parsed.ok) return parsed

  const point = await prisma.grammarPoint.findFirst({
    where: { id: typeof pointId === 'string' ? pointId : '', ...assignablePointWhere(cls.academyId) },
    select: { id: true, code: true },
  })
  if (!point) return { ok: false, error: '포인트를 찾을 수 없습니다.' }

  try {
    const saved = await upsertLecture({
      grammarPointId: point.id,
      academyId: cls.academyId,
      input: parsed.value,
      userId: scope.userId,
    })
    await logManage(scope, cls.academyId, ACTIVITY_ACTIONS.GRAMMAR_LECTURE_SAVE, {
      pointCode: point.code,
      lectureId: saved.id,
      videoId: parsed.value.videoId,
      created: saved.created,
    })
  } catch (error) {
    console.error('[grammar-manage] 학원 강의 저장 실패:', error)
    return { ok: false, error: '강의를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.' }
  }
  revalidateManagePages()
  return { ok: true }
}

/** 학원 자체 강의 삭제 — 본사 기본 강의는 지울 수 없다 */
export async function deleteAcademyLecture(classId: string, lectureId: string): Promise<ActionResult> {
  const scope = await getGrammarManageScope()
  if (!scope) return { ok: false, error: NO_PERMISSION }
  const cls = await findManagedClass(scope, classId)
  if (!cls) return { ok: false, error: CLASS_NOT_FOUND }
  if (typeof lectureId !== 'string' || !lectureId) return { ok: false, error: '강의를 찾을 수 없습니다.' }

  const removed = await deleteLecture(lectureId, cls.academyId)
  if (!removed) return { ok: false, error: '강의를 찾을 수 없습니다.' }
  await logManage(scope, cls.academyId, ACTIVITY_ACTIONS.GRAMMAR_LECTURE_DELETE, { lectureId })
  revalidateManagePages()
  return { ok: true }
}

// ─── 학원 전용 AI 문항 ──────────────────────────────────────────────────────

export type AcademyQuestionGenResult =
  | { ok: true; saved: number; credits: number; balanceAfter: number }
  | { ok: false; error: string; code?: 'NO_CREDIT' }

/**
 * 우리 학원 문제 AI 생성 (1회 = 10문항, AI_QUESTION 1회분).
 * 기존 쓰기 AI 채점과 같이 AI 응답을 받은 뒤에 차감한다 — OpenAI가 실패하면 차감하지 않는다.
 * 미리 잔액을 확인하고, 응답 후 차감이 성공했을 때만 문항을 저장한다(동시 사용으로 잔액이 먼저 소진되면 저장 안 함).
 * 만든 문항은 isVerified=false — 교사·학원장이 검수해야 학생에게 나간다.
 */
export async function generateAcademyGrammarQuestions(classId: string, pointId: string): Promise<AcademyQuestionGenResult> {
  const user = await getCurrentUser()
  const scope = await getGrammarManageScope()
  if (!user || !scope) return { ok: false, error: NO_PERMISSION }
  const cls = await findManagedClass(scope, classId)
  if (!cls) return { ok: false, error: CLASS_NOT_FOUND }

  const [point, existing, walletAcademyId, pricing] = await Promise.all([
    prisma.grammarPoint.findFirst({
      where: { id: typeof pointId === 'string' ? pointId : '', ...assignablePointWhere(cls.academyId) },
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
      where: { grammarPointId: typeof pointId === 'string' ? pointId : '', isActive: true, OR: [{ academyId: null }, { academyId: cls.academyId }] },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: { contentJson: true },
    }),
    walletAcademyIdOf(cls.academyId),
    getCreditPricing(),
  ])
  if (!point) return { ok: false, error: '포인트를 찾을 수 없습니다.' }
  const rules = parseGrammarRules(point.rulesJson)
  if (!point.summary && rules.length === 0) return { ok: false, error: '이 포인트는 아직 개념 정리가 없어 문제를 만들 수 없습니다.' }

  const wallet = await getWallet(walletAcademyId)
  if (wallet.balance < pricing.AI_QUESTION) {
    return { ok: false, code: 'NO_CREDIT', error: '크레딧이 부족해 문제를 만들 수 없습니다. 크레딧을 충전해 주세요.' }
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
    model: AI_MODEL,
  })
  if (!res.ok) return { ok: false, error: res.error }

  const charged = await chargeAiCredits({ academyId: cls.academyId, item: 'AI_QUESTION', count: 1 })
  if (!charged.ok) {
    return { ok: false, code: 'NO_CREDIT', error: '크레딧이 부족해 문제를 저장하지 못했습니다. 크레딧을 충전해 주세요.' }
  }

  try {
    await prisma.question.createMany({
      data: res.questions.map((q) => ({
        academyId: cls.academyId,
        domain: 'GRAMMAR' as const,
        subCategory: point.title,
        difficulty: q.difficulty,
        cefrLevel: LEVEL_TO_CEFR[q.difficulty] ?? null,
        contentJson: q.content as unknown as Prisma.InputJsonObject,
        source: 'AI_GENERATED' as const,
        isVerified: false,
        isActive: true,
        grammarPointId: point.id,
        createdBy: user.id,
      })),
    })
  } catch (error) {
    // 차감은 끝났는데 저장이 실패한 경우 — 수동 환불 대상이므로 활동 로그에 남긴다
    console.error('[grammar-manage] AI 문항 저장 실패(차감 완료):', error)
    await logManage(scope, cls.academyId, ACTIVITY_ACTIONS.GRAMMAR_QUESTION_GENERATE, {
      pointCode: point.code,
      saved: 0,
      credits: charged.credits,
      failed: 'save',
    })
    return { ok: false, error: '문제를 저장하지 못했습니다. 차감된 크레딧은 고객센터로 문의해 주세요.' }
  }

  revalidateTag(QUESTION_BANK_TAG)
  await logManage(scope, cls.academyId, ACTIVITY_ACTIONS.GRAMMAR_QUESTION_GENERATE, {
    pointCode: point.code,
    saved: res.questions.length,
    dropped: res.dropped,
    credits: charged.credits,
  })
  revalidateManagePages()
  return { ok: true, saved: res.questions.length, credits: charged.credits, balanceAfter: charged.balanceAfter }
}

/** 검수 대기 문항 검수 완료 / 사용 안 함 — 범위 안 학원의 AI 생성 문법 문항만 */
export async function reviewAcademyQuestions(ids: string[], op: 'verify' | 'discard'): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  const scope = await getGrammarManageScope()
  if (!scope) return { ok: false, error: NO_PERMISSION }
  if (op !== 'verify' && op !== 'discard') return { ok: false, error: '잘못된 요청입니다.' }
  const clean = cleanIds(ids).slice(0, 200)
  if (clean.length === 0) return { ok: false, error: '문항을 골라 주세요.' }

  const where: Prisma.QuestionWhereInput = {
    id: { in: clean },
    academyId: { in: scope.academyIds },
    domain: 'GRAMMAR',
    source: 'AI_GENERATED',
    grammarPointId: { not: null },
  }
  const res = await prisma.question.updateMany({
    where,
    data: op === 'verify' ? { isVerified: true } : { isActive: false },
  })
  if (res.count === 0) return { ok: false, error: '처리할 문항이 없습니다. 새로고침 후 다시 시도해 주세요.' }
  revalidateTag(QUESTION_BANK_TAG)
  await logManage(scope, scope.academyIds[0], ACTIVITY_ACTIONS.GRAMMAR_QUESTION_REVIEW, { op, count: res.count })
  revalidateManagePages()
  return { ok: true, count: res.count }
}
