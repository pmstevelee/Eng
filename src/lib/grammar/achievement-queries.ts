import 'server-only'

// 문법 성취도 조회 — 반 히트맵, 교사 학생 상세 문법 탭, 학원장 분석 카드
//
// 원격 DB 왕복이 병목이라 관계 조건으로 한 웨이브에 모은다.
// 범위(권한) 확인은 부르는 쪽(screens·actions·analytics page)에서 끝낸 값만 넘길 것.

import { prisma } from '@/lib/prisma/client'
import type { GrammarAttemptKind, GrammarMasteryState, Prisma } from '@/generated/prisma'
import { fromDbDate, todayKst } from '@/lib/attendance/time'
import { getGrammarTree, type GrammarTreeCategory } from './curriculum'
import { getGrammarClassCards } from './manage-queries'
import { classStudentWhere, type GrammarManageScope } from './manage-access'
import { getGrammarWeeklyReport, type GrammarWeeklyReport } from './weekly-report'
import { countPassedStates, groupStudentPoints, type StudentPointGroup, type StudentPointRowInput } from './achievement-logic'

// ─── 반 히트맵 ───────────────────────────────────────────────────────────────

export interface AchievementPoint {
  id: string
  code: string
  title: string
  dueKey: string | null
}

export interface AchievementProgressRow {
  studentId: string
  grammarPointId: string
  state: GrammarMasteryState
  bestCheckScore: number | null
  checkAttempts: number
}

export interface ClassAchievementData {
  classId: string
  students: { id: string; name: string }[]
  /** 배정 순서 */
  points: AchievementPoint[]
  progress: AchievementProgressRow[]
  todayKey: string
}

export async function getClassAchievementData(cls: { id: string }): Promise<ClassAchievementData> {
  const classId = cls.id
  const studentWhere = classStudentWhere(classId)
  const [assignments, students, progress] = await Promise.all([
    prisma.grammarAssignment.findMany({
      where: { classId },
      select: { grammarPointId: true, dueDate: true, grammarPoint: { select: { code: true, title: true } } },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    }),
    prisma.student.findMany({
      where: studentWhere,
      select: { id: true, user: { select: { name: true } } },
      orderBy: { user: { name: 'asc' } },
    }),
    // 반 학생 × 반 배정 포인트의 진도 행을 한 번에
    prisma.grammarPointProgress.findMany({
      where: { student: studentWhere, grammarPoint: { assignments: { some: { classId } } } },
      select: { studentId: true, grammarPointId: true, state: true, bestCheckScore: true, checkAttempts: true },
    }),
  ])

  const seen = new Set<string>()
  const points: AchievementPoint[] = []
  for (const a of assignments) {
    if (seen.has(a.grammarPointId)) continue
    seen.add(a.grammarPointId)
    points.push({
      id: a.grammarPointId,
      code: a.grammarPoint.code,
      title: a.grammarPoint.title,
      dueKey: a.dueDate ? fromDbDate(a.dueDate) : null,
    })
  }

  return {
    classId,
    students: students.map((s) => ({ id: s.id, name: s.user.name })),
    points,
    progress,
    todayKey: todayKst(),
  }
}

// ─── 시도 기록 (히트맵 칸 팝오버 · 학생 탭) ──────────────────────────────────

export interface GrammarAttemptItem {
  id: string
  kind: GrammarAttemptKind
  score: number
  correctCount: number
  totalCount: number
  /** ISO */
  createdAt: string
}

const attemptSelect = {
  id: true,
  kind: true,
  score: true,
  correctCount: true,
  totalCount: true,
  createdAt: true,
} satisfies Prisma.GrammarAttemptSelect

function toAttemptItem(a: Prisma.GrammarAttemptGetPayload<{ select: typeof attemptSelect }>): GrammarAttemptItem {
  return { ...a, createdAt: a.createdAt.toISOString() }
}

export const CELL_ATTEMPT_LIMIT = 20

export async function getPointAttempts(studentId: string, grammarPointId: string): Promise<GrammarAttemptItem[]> {
  const rows = await prisma.grammarAttempt.findMany({
    where: { studentId, grammarPointId },
    select: attemptSelect,
    orderBy: { createdAt: 'desc' },
    take: CELL_ATTEMPT_LIMIT,
  })
  return rows.map(toAttemptItem)
}

// ─── 교사 학생 상세 '문법' 탭 ────────────────────────────────────────────────

export interface StudentPointRow extends StudentPointRowInput {
  /** ISO — 마지막 활동 */
  lastActivityAt: string | null
  dueKey: string | null
}

export interface StudentCheckAttempt extends GrammarAttemptItem {
  point: { code: string; title: string } | null
}

export interface StudentGrammarDetail {
  studentId: string
  groups: StudentPointGroup<StudentPointRow>[]
  weak: { pointId: string; code: string; title: string; bestCheckScore: number | null; lastActivityAt: string | null }[]
  recentChecks: StudentCheckAttempt[]
  /** 개인 배정 — 삭제 가능 */
  personalAssignments: { id: string; pointId: string; code: string; title: string; dueKey: string | null }[]
  totals: { passed: number; mastered: number; weak: number; inProgress: number; assigned: number }
  /** 단원 추가 배정용 트리 (공개 포인트) */
  tree: GrammarTreeCategory[]
  /** 최근 7일 주간 리포트 (탭 상단 '이번 주 문법') */
  weekly: GrammarWeeklyReport
  todayKey: string
}

const pointInfoSelect = {
  id: true,
  code: true,
  title: true,
  sortOrder: true,
  category: { select: { sortOrder: true, parent: { select: { id: true, name: true, sortOrder: true } } } },
} satisfies Prisma.GrammarPointSelect

type PointInfo = Prisma.GrammarPointGetPayload<{ select: typeof pointInfoSelect }>

export const RECENT_CHECK_LIMIT = 10

export async function getStudentGrammarDetail(student: { id: string; academyId: string }): Promise<StudentGrammarDetail> {
  const studentId = student.id
  const [progress, assignments, recentChecks, tree, weekly] = await Promise.all([
    prisma.grammarPointProgress.findMany({
      where: { studentId },
      select: {
        state: true,
        bestCheckScore: true,
        checkAttempts: true,
        lastActivityAt: true,
        grammarPoint: { select: pointInfoSelect },
      },
    }),
    // 개인 + 소속 반 배정 (반 소속은 students.class_id와 enrollments 둘 다)
    prisma.grammarAssignment.findMany({
      where: {
        academyId: student.academyId,
        OR: [
          { studentId },
          { class: { isActive: true, OR: [{ students: { some: { id: studentId } } }, { enrollments: { some: { studentId } } }] } },
        ],
      },
      select: { id: true, studentId: true, dueDate: true, grammarPoint: { select: pointInfoSelect } },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    }),
    prisma.grammarAttempt.findMany({
      where: { studentId, kind: 'CHECK' },
      select: { ...attemptSelect, grammarPoint: { select: { code: true, title: true } } },
      orderBy: { createdAt: 'desc' },
      take: RECENT_CHECK_LIMIT,
    }),
    getGrammarTree(student.academyId),
    getGrammarWeeklyReport(studentId),
  ])

  // 포인트별 한 행 — 진도가 없어도 배정된 포인트는 미학습으로 보인다
  const rows = new Map<string, StudentPointRow>()
  const baseRow = (p: PointInfo): StudentPointRow => ({
    pointId: p.id,
    code: p.code,
    title: p.title,
    groupId: p.category.parent?.id ?? 'etc',
    groupName: p.category.parent?.name ?? '기타',
    groupOrder: p.category.parent?.sortOrder ?? Number.MAX_SAFE_INTEGER,
    subOrder: p.category.sortOrder,
    pointOrder: p.sortOrder,
    state: 'NOT_STARTED',
    bestCheckScore: null,
    checkAttempts: 0,
    assigned: null,
    lastActivityAt: null,
    dueKey: null,
  })
  for (const p of progress) {
    rows.set(p.grammarPoint.id, {
      ...baseRow(p.grammarPoint),
      state: p.state,
      bestCheckScore: p.bestCheckScore,
      checkAttempts: p.checkAttempts,
      lastActivityAt: p.lastActivityAt.toISOString(),
    })
  }
  const personalAssignments: StudentGrammarDetail['personalAssignments'] = []
  const assignedIds = new Set<string>()
  for (const a of assignments) {
    const p = a.grammarPoint
    assignedIds.add(p.id)
    const row = rows.get(p.id) ?? baseRow(p)
    const dueKey = a.dueDate ? fromDbDate(a.dueDate) : null
    // 반 배정이 우선 표시, 마감일은 빠른 쪽
    row.assigned = row.assigned === 'CLASS' || !a.studentId ? 'CLASS' : 'STUDENT'
    if (dueKey && (!row.dueKey || dueKey < row.dueKey)) row.dueKey = dueKey
    rows.set(p.id, row)
    if (a.studentId) personalAssignments.push({ id: a.id, pointId: p.id, code: p.code, title: p.title, dueKey })
  }

  const all = Array.from(rows.values())
  const counts = countPassedStates(all.map((r) => ({ state: r.state, count: 1 })))
  return {
    studentId,
    groups: groupStudentPoints(all),
    weak: all
      .filter((r) => r.state === 'WEAK')
      .sort((a, b) => (b.lastActivityAt ?? '').localeCompare(a.lastActivityAt ?? ''))
      .map((r) => ({ pointId: r.pointId, code: r.code, title: r.title, bestCheckScore: r.bestCheckScore, lastActivityAt: r.lastActivityAt })),
    recentChecks: recentChecks.map((a) => ({ ...toAttemptItem(a), point: a.grammarPoint })),
    personalAssignments,
    totals: {
      ...counts,
      weak: all.filter((r) => r.state === 'WEAK').length,
      inProgress: all.filter((r) => r.state === 'IN_PROGRESS').length,
      assigned: assignedIds.size,
    },
    tree,
    weekly,
    todayKey: todayKst(),
  }
}

// ─── 학원장 분석 '문법 성취도' 카드 ──────────────────────────────────────────

export interface AcademyGrammarSummary {
  passed: number
  mastered: number
  /** 문법 학습 기록이 있는 학생 수 */
  activeStudents: number
  classes: { id: string; name: string; academyLabel: string | null; studentCount: number; assignedCount: number; averagePercent: number | null }[]
  weakTop: { pointId: string; code: string; title: string; students: number }[]
}

export const WEAK_TOP_LIMIT = 5

/** scope.academyIds는 분석 페이지의 조회 범위(getViewableAcademyIds) */
export async function getAcademyGrammarSummary(scope: GrammarManageScope): Promise<AcademyGrammarSummary> {
  const studentWhere: Prisma.StudentWhereInput = {
    status: 'ACTIVE',
    user: { academyId: { in: scope.academyIds }, isDeleted: false },
  }
  const [stateGroups, weakGroups, activeStudents, classCards] = await Promise.all([
    prisma.grammarPointProgress.groupBy({
      by: ['state'],
      where: { student: studentWhere, state: { in: ['PASSED', 'MASTERED'] } },
      _count: { _all: true },
    }),
    prisma.grammarPointProgress.groupBy({
      by: ['grammarPointId'],
      where: { student: studentWhere, state: 'WEAK' },
      _count: { _all: true },
      orderBy: { _count: { grammarPointId: 'desc' } },
      take: WEAK_TOP_LIMIT,
    }),
    prisma.student.count({ where: { ...studentWhere, grammarProgresses: { some: {} } } }),
    getGrammarClassCards(scope),
  ])
  const weakPoints =
    weakGroups.length > 0
      ? await prisma.grammarPoint.findMany({
          where: { id: { in: weakGroups.map((g) => g.grammarPointId) } },
          select: { id: true, code: true, title: true },
        })
      : []
  const pointById = new Map(weakPoints.map((p) => [p.id, p]))

  return {
    ...countPassedStates(stateGroups.map((g) => ({ state: g.state, count: g._count._all }))),
    activeStudents,
    classes: classCards
      .filter((c) => c.assignedCount > 0)
      .sort((a, b) => (b.averagePercent ?? -1) - (a.averagePercent ?? -1))
      .map((c) => ({
        id: c.id,
        name: c.name,
        academyLabel: c.academyLabel,
        studentCount: c.studentCount,
        assignedCount: c.assignedCount,
        averagePercent: c.averagePercent,
      })),
    weakTop: weakGroups.flatMap((g) => {
      const p = pointById.get(g.grammarPointId)
      return p ? [{ pointId: p.id, code: p.code, title: p.title, students: g._count._all }] : []
    }),
  }
}
