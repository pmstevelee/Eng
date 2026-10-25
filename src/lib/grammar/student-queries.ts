// 학생 문법학습 화면 데이터 — 문법 홈(/student/grammar)·커리큘럼 지도(/student/grammar/map)
//
// 원격 DB 왕복이 병목이므로 화면마다 독립 쿼리를 Promise.all 한 번(1웨이브)으로 모은다.
// 트리·코스는 unstable_cache(1시간)라 대부분 DB에 가지 않는다.

import { prisma } from '@/lib/prisma/client'
import type { GrammarMasteryState, Prisma } from '@/generated/prisma'
import { addDays, endOfTodayKst, fromDbDate, todayKst } from '@/lib/attendance/time'
import {
  getDefaultGrammarCourses,
  getGrammarTree,
  type GrammarTreeCategory,
  type GrammarTreePoint,
  type GrammarTreeSubCategory,
} from './curriculum'
import { GRAMMAR_STEP_LABEL, isGrammarStep } from './constants'
import { isPointReviewDue } from './review-logic'
import { getNextGrammarUnit, isPassedState, pickCourseForLevel, sortAssignments, type NextUnitReason } from './next-unit'

/** 홈 "마감 임박"에 보여 줄 기간(일) */
const DUE_SOON_DAYS = 7
const WEAK_TOP_N = 3

// ─── 공통 조회 ───────────────────────────────────────────────────────────────

const progressSelect = {
  grammarPointId: true,
  state: true,
  currentStep: true,
  lastCheckScore: true,
  bestCheckScore: true,
  nextReviewAt: true,
  lastActivityAt: true,
} satisfies Prisma.GrammarPointProgressSelect

type ProgressRow = Prisma.GrammarPointProgressGetPayload<{ select: typeof progressSelect }>

/** 내 배정(개인 + 내가 속한 반) — 반 소속은 students.class_id와 enrollments 둘 다 본다 */
function findMyAssignments(studentId: string, academyId: string) {
  return prisma.grammarAssignment.findMany({
    where: {
      academyId,
      OR: [
        { studentId },
        {
          class: {
            OR: [{ students: { some: { id: studentId } } }, { enrollments: { some: { studentId } } }],
          },
        },
      ],
    },
    select: { grammarPointId: true, sortOrder: true, startDate: true, dueDate: true },
  })
}

export interface MyAssignment {
  grammarPointId: string
  sortOrder: number
  /** KST 날짜 키 'YYYY-MM-DD' */
  dueKey: string | null
  dueDate: Date | null
}

/**
 * 같은 포인트가 개인·반으로 겹쳐 배정되면 마감일이 빠른 것 하나만 남긴다.
 * 시작일이 아직 안 된 배정은 뺀다.
 */
function normalizeAssignments(
  rows: { grammarPointId: string; sortOrder: number; startDate: Date | null; dueDate: Date | null }[],
  today: string,
): MyAssignment[] {
  const byPoint = new Map<string, MyAssignment>()
  for (const r of rows) {
    if (r.startDate && fromDbDate(r.startDate) > today) continue
    const item: MyAssignment = {
      grammarPointId: r.grammarPointId,
      sortOrder: r.sortOrder,
      dueKey: r.dueDate ? fromDbDate(r.dueDate) : null,
      dueDate: r.dueDate,
    }
    const prev = byPoint.get(r.grammarPointId)
    if (!prev || (item.dueKey && (!prev.dueKey || item.dueKey < prev.dueKey))) byPoint.set(r.grammarPointId, item)
  }
  return sortAssignments(Array.from(byPoint.values()))
}

export interface PointLocation {
  point: GrammarTreePoint
  sub: GrammarTreeSubCategory
  category: GrammarTreeCategory
}

function indexTree(tree: GrammarTreeCategory[]): Map<string, PointLocation> {
  const map = new Map<string, PointLocation>()
  for (const category of tree) {
    for (const sub of category.children) {
      for (const point of sub.points) map.set(point.id, { point, sub, category })
    }
  }
  return map
}

// ─── 문법 홈 ─────────────────────────────────────────────────────────────────

export interface GrammarUnitCard {
  code: string
  title: string
  categoryName: string
  subCategoryName: string
}

export interface GrammarHomeData {
  /** 학생이 볼 수 있는 공개 포인트가 하나라도 있는지 */
  hasPoints: boolean
  next:
    | (GrammarUnitCard & {
        reason: NextUnitReason
        state: GrammarMasteryState
        /** 현재 단계 라벨 (학습 중일 때만) */
        stepLabel: string | null
        dueKey: string | null
      })
    | null
  /** 오늘 복습: 포인트 복습 + 문항 복습(GRAMMAR) */
  review: { points: number; questions: number }
  dueSoon: (GrammarUnitCard & { dueKey: string; daysLeft: number; state: GrammarMasteryState })[]
  progress: { done: number; total: number; scope: 'ASSIGNED' | 'COURSE' | 'ALL'; courseName: string | null }
  weak: (GrammarUnitCard & { lastCheckScore: number | null })[]
}

function toCard(loc: PointLocation): GrammarUnitCard {
  return {
    code: loc.point.code,
    title: loc.point.title,
    categoryName: loc.category.name,
    subCategoryName: loc.sub.name,
  }
}

function daysBetween(fromKey: string, toKey: string): number {
  return Math.round((Date.parse(`${toKey}T00:00:00Z`) - Date.parse(`${fromKey}T00:00:00Z`)) / 86_400_000)
}

export async function getGrammarHomeData(studentId: string, academyId: string): Promise<GrammarHomeData> {
  const now = new Date()
  const today = todayKst(now.getTime())
  const reviewDue = endOfTodayKst(now.getTime())

  const [tree, courses, progresses, assignmentRows, student, questionReviews] = await Promise.all([
    getGrammarTree(academyId),
    getDefaultGrammarCourses(),
    prisma.grammarPointProgress.findMany({ where: { studentId }, select: progressSelect }),
    findMyAssignments(studentId, academyId),
    prisma.student.findUnique({ where: { id: studentId }, select: { currentLevel: true } }),
    prisma.questionReview.count({
      where: { studentId, isMastered: false, nextReviewAt: { lt: reviewDue }, question: { domain: 'GRAMMAR', isActive: true } },
    }),
  ])

  const index = indexTree(tree)
  const visibleIds = new Set(index.keys())
  const visibleProgress = (progresses as ProgressRow[]).filter((p) => visibleIds.has(p.grammarPointId))
  const progressById = new Map(visibleProgress.map((p) => [p.grammarPointId, p]))
  const assignments = normalizeAssignments(assignmentRows, today).filter((a) => visibleIds.has(a.grammarPointId))
  const currentLevel = student?.currentLevel ?? 1

  // ① 이어서 학습
  const nextUnit = getNextGrammarUnit({
    progresses: visibleProgress,
    assignments,
    courses,
    currentLevel,
    visiblePointIds: visibleIds,
    now,
  })
  let next: GrammarHomeData['next'] = null
  if (nextUnit) {
    const loc = index.get(nextUnit.grammarPointId)
    const prog = progressById.get(nextUnit.grammarPointId)
    if (loc) {
      const state = prog?.state ?? 'NOT_STARTED'
      next = {
        ...toCard(loc),
        reason: nextUnit.reason,
        state,
        stepLabel:
          state === 'IN_PROGRESS' && prog && isGrammarStep(prog.currentStep) ? GRAMMAR_STEP_LABEL[prog.currentStep] : null,
        dueKey: assignments.find((a) => a.grammarPointId === nextUnit.grammarPointId)?.dueKey ?? null,
      }
    }
  }

  // ② 오늘 복습
  const pointReviews = visibleProgress.filter((p) => isPointReviewDue(p, reviewDue)).length

  // ③ 마감 7일 이내(지난 것 포함) 미통과 배정
  const dueLimit = addDays(today, DUE_SOON_DAYS)
  const dueSoon: GrammarHomeData['dueSoon'] = []
  for (const a of assignments) {
    if (!a.dueKey || a.dueKey > dueLimit) continue
    const state = progressById.get(a.grammarPointId)?.state ?? 'NOT_STARTED'
    if (isPassedState(state)) continue
    const loc = index.get(a.grammarPointId)
    if (!loc) continue
    dueSoon.push({ ...toCard(loc), dueKey: a.dueKey, daysLeft: daysBetween(today, a.dueKey), state })
  }

  // ④ 진도율 — 배정이 있으면 배정 기준, 없으면 레벨에 맞는 코스 기준, 코스도 없으면 전체
  let scopeIds: string[]
  let scope: GrammarHomeData['progress']['scope']
  let courseName: string | null = null
  if (assignments.length > 0) {
    scopeIds = assignments.map((a) => a.grammarPointId)
    scope = 'ASSIGNED'
  } else {
    const course = pickCourseForLevel(courses, currentLevel)
    const coursePoints = course ? course.pointIds.filter((id) => visibleIds.has(id)) : []
    if (course && coursePoints.length > 0) {
      scopeIds = coursePoints
      scope = 'COURSE'
      courseName = course.name
    } else {
      scopeIds = Array.from(visibleIds)
      scope = 'ALL'
    }
  }
  const done = scopeIds.filter((id) => isPassedState(progressById.get(id)?.state)).length

  // ⑤ 취약 포인트 — 최근 확인 테스트 점수가 낮은 순, 같으면 오래 방치된 순
  const weak = visibleProgress
    .filter((p) => p.state === 'WEAK')
    .sort(
      (a, b) =>
        (a.lastCheckScore ?? 0) - (b.lastCheckScore ?? 0) || a.lastActivityAt.getTime() - b.lastActivityAt.getTime(),
    )
    .slice(0, WEAK_TOP_N)
    .flatMap((p) => {
      const loc = index.get(p.grammarPointId)
      return loc ? [{ ...toCard(loc), lastCheckScore: p.lastCheckScore }] : []
    })

  return {
    hasPoints: visibleIds.size > 0,
    next,
    review: { points: pointReviews, questions: questionReviews },
    dueSoon,
    progress: { done, total: scopeIds.length, scope, courseName },
    weak,
  }
}

// ─── 커리큘럼 지도 ───────────────────────────────────────────────────────────

export interface GrammarMapPoint {
  id: string
  code: string
  title: string
  state: GrammarMasteryState
  assigned: boolean
  dueKey: string | null
  /** 아직 통과하지 않은 선수 포인트 제목 (권장 안내만) */
  pendingPrerequisites: string[]
}

export interface GrammarMapSubCategory {
  id: string
  code: string
  name: string
  points: GrammarMapPoint[]
}

export interface GrammarMapCategory {
  id: string
  code: string
  name: string
  passed: number
  total: number
  children: GrammarMapSubCategory[]
}

export interface GrammarMapData {
  categories: GrammarMapCategory[]
  counts: { all: number; assigned: number; weak: number }
}

export async function getGrammarMapData(studentId: string, academyId: string): Promise<GrammarMapData> {
  const today = todayKst()
  const [tree, progresses, assignmentRows] = await Promise.all([
    getGrammarTree(academyId),
    prisma.grammarPointProgress.findMany({ where: { studentId }, select: { grammarPointId: true, state: true } }),
    findMyAssignments(studentId, academyId),
  ])

  const index = indexTree(tree)
  const stateById = new Map(progresses.map((p) => [p.grammarPointId, p.state]))
  const assignmentById = new Map(normalizeAssignments(assignmentRows, today).map((a) => [a.grammarPointId, a]))
  const counts = { all: 0, assigned: 0, weak: 0 }

  const categories: GrammarMapCategory[] = tree.map((category) => {
    let passed = 0
    let total = 0
    const children = category.children.map((sub) => ({
      id: sub.id,
      code: sub.code,
      name: sub.name,
      points: sub.points.map((p): GrammarMapPoint => {
        const state = stateById.get(p.id) ?? 'NOT_STARTED'
        const assignment = assignmentById.get(p.id)
        total += 1
        counts.all += 1
        if (isPassedState(state)) passed += 1
        if (assignment) counts.assigned += 1
        if (state === 'WEAK') counts.weak += 1
        return {
          id: p.id,
          code: p.code,
          title: p.title,
          state,
          assigned: Boolean(assignment),
          dueKey: assignment?.dueKey ?? null,
          pendingPrerequisites: isPassedState(state)
            ? []
            : p.prerequisiteIds
                .filter((id) => !isPassedState(stateById.get(id)))
                .flatMap((id) => {
                  const loc = index.get(id)
                  return loc ? [loc.point.title] : []
                }),
        }
      }),
    }))
    return { id: category.id, code: category.code, name: category.name, passed, total, children }
  })

  return { categories, counts }
}
