import 'server-only'

// 문법학습 관리(교사·학원장) 화면 데이터 — 반 목록, 반 배정, 코스 템플릿, 검수 대기 문항
//
// 원격 DB 왕복이 병목이라 관계 조건(where: { student: ..., grammarPoint: ... })으로 한 웨이브에 모은다.

import { prisma } from '@/lib/prisma/client'
import type { GrammarPointStatus, Prisma } from '@/generated/prisma'
import { fromDbDate, todayKst } from '@/lib/attendance/time'
import { getCreditPricing, getWallet, walletAcademyIdOf } from '@/lib/credits/wallet'
import { getGrammarTree, type GrammarTreeCategory } from './curriculum'
import { passKey, summarizeClassProgress } from './assignment-plan'
import { classStudentWhere, grammarClassWhere, templateAcademyIdOf, type GrammarManageScope } from './manage-access'

const PASSED_STATES = ['PASSED', 'MASTERED'] as const

// ─── 반 목록 ─────────────────────────────────────────────────────────────────

export interface GrammarClassCard {
  id: string
  name: string
  academyLabel: string | null
  teacherName: string | null
  studentCount: number
  assignedCount: number
  averagePercent: number | null
  overdueStudents: number
}

export async function getGrammarClassCards(scope: GrammarManageScope): Promise<GrammarClassCard[]> {
  const classWhere = grammarClassWhere(scope)
  const [classes, students] = await Promise.all([
    prisma.class.findMany({
      where: classWhere,
      select: {
        id: true,
        name: true,
        academy: { select: { name: true, branchName: true, parentAcademyId: true } },
        teacher: { select: { name: true } },
        grammarAssignments: { select: { grammarPointId: true, dueDate: true } },
      },
      orderBy: { name: 'asc' },
    }),
    prisma.student.findMany({
      where: {
        status: 'ACTIVE',
        user: { isDeleted: false },
        OR: [{ class: classWhere }, { enrollments: { some: { class: classWhere } } }],
      },
      select: { id: true, classId: true, enrollments: { select: { classId: true } } },
    }),
  ])

  const studentsByClass = new Map<string, Set<string>>()
  const add = (classId: string | null, studentId: string) => {
    if (!classId) return
    const set = studentsByClass.get(classId) ?? new Set<string>()
    set.add(studentId)
    studentsByClass.set(classId, set)
  }
  for (const s of students) {
    add(s.classId, s.id)
    for (const e of s.enrollments) add(e.classId, s.id)
  }

  const allPointIds = Array.from(new Set(classes.flatMap((c) => c.grammarAssignments.map((a) => a.grammarPointId))))
  const passedRows =
    allPointIds.length > 0 && students.length > 0
      ? await prisma.grammarPointProgress.findMany({
          where: {
            studentId: { in: students.map((s) => s.id) },
            grammarPointId: { in: allPointIds },
            state: { in: [...PASSED_STATES] },
          },
          select: { studentId: true, grammarPointId: true },
        })
      : []
  const passed = new Set(passedRows.map((r) => passKey(r.studentId, r.grammarPointId)))
  const today = todayKst()
  const multiAcademy = scope.academyIds.length > 1

  return classes.map((c) => {
    const studentIds = Array.from(studentsByClass.get(c.id) ?? [])
    const assignments = c.grammarAssignments.map((a) => ({
      grammarPointId: a.grammarPointId,
      dueKey: a.dueDate ? fromDbDate(a.dueDate) : null,
    }))
    const summary = summarizeClassProgress({ studentIds, assignments, passed, todayKey: today })
    return {
      id: c.id,
      name: c.name,
      academyLabel: multiAcademy ? (c.academy.parentAcademyId ? (c.academy.branchName ?? c.academy.name) : '본원') : null,
      teacherName: c.teacher?.name ?? null,
      studentCount: studentIds.length,
      assignedCount: new Set(assignments.map((a) => a.grammarPointId)).size,
      ...summary,
    }
  })
}

// ─── 반 배정 화면 ────────────────────────────────────────────────────────────

export interface AssignmentLecture {
  id: string
  title: string
  videoId: string
  durationSec: number | null
  notesUrl: string | null
  createdByName: string | null
}

export interface ClassAssignmentRow {
  id: string
  grammarPointId: string
  code: string
  title: string
  categoryLabel: string
  /** 학생에게 보이는 포인트인지 (공개 상태) */
  published: boolean
  sortOrder: number
  startKey: string | null
  dueKey: string | null
  passedCount: number
  /** 학생에게 보이는 강의 — 학원 강의가 있으면 그것, 없으면 본사 기본 */
  lecture: (AssignmentLecture & { scope: 'ACADEMY' | 'HQ'; completedCount: number }) | null
  /** 학원 자체 강의 (수정·삭제용) */
  academyLecture: AssignmentLecture | null
  /** 우리 학원 AI 문항 중 검수 대기 수 */
  pendingQuestions: number
}

export interface CourseTemplateOption {
  id: string
  name: string
  description: string | null
  scope: 'HQ' | 'ACADEMY'
  itemCount: number
}

export interface ClassAssignmentData {
  classId: string
  className: string
  academyId: string
  studentCount: number
  rows: ClassAssignmentRow[]
  tree: GrammarTreeCategory[]
  templates: CourseTemplateOption[]
  credit: { balance: number; perGeneration: number }
  todayKey: string
}

const lectureSelect = {
  id: true,
  title: true,
  videoId: true,
  durationSec: true,
  notesUrl: true,
  academyId: true,
  createdBy: { select: { name: true } },
} satisfies Prisma.GrammarLectureSelect

type LectureRow = Prisma.GrammarLectureGetPayload<{ select: typeof lectureSelect }>

function toAssignmentLecture(l: LectureRow): AssignmentLecture {
  return {
    id: l.id,
    title: l.title,
    videoId: l.videoId,
    durationSec: l.durationSec,
    notesUrl: l.notesUrl,
    createdByName: l.createdBy?.name ?? null,
  }
}

function categoryLabelOf(category: { name: string; parent: { name: string } | null }): string {
  return category.parent ? `${category.parent.name} › ${category.name}` : category.name
}

/** 범위 확인은 호출하는 쪽에서 findManagedClass로 끝낸 반만 넘길 것 */
export async function getClassAssignmentData(cls: { id: string; name: string; academyId: string }): Promise<ClassAssignmentData> {
  const classId = cls.id
  const studentWhere = classStudentWhere(classId)
  const assignedPointWhere: Prisma.GrammarPointWhereInput = { assignments: { some: { classId } } }

  const [assignments, studentCount, passedGroups, lectures, viewGroups, pendingGroups, templates, tree, walletAcademyId, pricing] =
    await Promise.all([
      prisma.grammarAssignment.findMany({
        where: { classId },
        select: {
          id: true,
          grammarPointId: true,
          sortOrder: true,
          startDate: true,
          dueDate: true,
          grammarPoint: {
            select: {
              code: true,
              title: true,
              status: true,
              category: { select: { name: true, parent: { select: { name: true } } } },
            },
          },
        },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      }),
      prisma.student.count({ where: studentWhere }),
      prisma.grammarPointProgress.groupBy({
        by: ['grammarPointId'],
        where: { state: { in: [...PASSED_STATES] }, student: studentWhere, grammarPoint: assignedPointWhere },
        _count: { _all: true },
      }),
      prisma.grammarLecture.findMany({
        where: {
          isActive: true,
          grammarPoint: assignedPointWhere,
          OR: [{ academyId: null }, { academyId: cls.academyId }],
        },
        select: { ...lectureSelect, grammarPointId: true },
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.grammarLectureView.groupBy({
        by: ['lectureId'],
        where: { completedAt: { not: null }, student: studentWhere, lecture: { grammarPoint: assignedPointWhere } },
        _count: { _all: true },
      }),
      prisma.question.groupBy({
        by: ['grammarPointId'],
        where: {
          academyId: cls.academyId,
          source: 'AI_GENERATED',
          isVerified: false,
          isActive: true,
          grammarPoint: assignedPointWhere,
        },
        _count: { _all: true },
      }),
      getCourseTemplateOptions(cls.academyId),
      getGrammarTree(cls.academyId),
      walletAcademyIdOf(cls.academyId),
      getCreditPricing(),
    ])
  const wallet = await getWallet(walletAcademyId)

  const passedByPoint = new Map(passedGroups.map((g) => [g.grammarPointId, g._count._all]))
  const completedByLecture = new Map(viewGroups.map((g) => [g.lectureId, g._count._all]))
  const pendingByPoint = new Map(pendingGroups.map((g) => [g.grammarPointId ?? '', g._count._all]))
  const lecturesByPoint = new Map<string, (LectureRow & { grammarPointId: string })[]>()
  for (const l of lectures) {
    const list = lecturesByPoint.get(l.grammarPointId) ?? []
    list.push(l)
    lecturesByPoint.set(l.grammarPointId, list)
  }

  const rows: ClassAssignmentRow[] = assignments.map((a) => {
    const pointLectures = lecturesByPoint.get(a.grammarPointId) ?? []
    const academyLecture = pointLectures.find((l) => l.academyId === cls.academyId) ?? null
    const hqLecture = pointLectures.find((l) => l.academyId === null) ?? null
    const shown = academyLecture ?? hqLecture
    return {
      id: a.id,
      grammarPointId: a.grammarPointId,
      code: a.grammarPoint.code,
      title: a.grammarPoint.title,
      categoryLabel: categoryLabelOf(a.grammarPoint.category),
      published: a.grammarPoint.status === ('PUBLISHED' satisfies GrammarPointStatus),
      sortOrder: a.sortOrder,
      startKey: a.startDate ? fromDbDate(a.startDate) : null,
      dueKey: a.dueDate ? fromDbDate(a.dueDate) : null,
      passedCount: passedByPoint.get(a.grammarPointId) ?? 0,
      lecture: shown
        ? {
            ...toAssignmentLecture(shown),
            scope: shown.academyId ? 'ACADEMY' : 'HQ',
            completedCount: completedByLecture.get(shown.id) ?? 0,
          }
        : null,
      academyLecture: academyLecture ? toAssignmentLecture(academyLecture) : null,
      pendingQuestions: pendingByPoint.get(a.grammarPointId) ?? 0,
    }
  })

  return {
    classId,
    className: cls.name,
    academyId: cls.academyId,
    studentCount,
    rows,
    tree,
    templates,
    credit: { balance: wallet.balance, perGeneration: pricing.AI_QUESTION },
    todayKey: todayKst(),
  }
}

// ─── 코스 템플릿 ─────────────────────────────────────────────────────────────

/** 반 배정에서 고를 수 있는 템플릿 — 본사 기본 + 학원(본원) 템플릿 */
export async function getCourseTemplateOptions(academyId: string): Promise<CourseTemplateOption[]> {
  const templateAcademyId = await templateAcademyIdOf(academyId)
  const courses = await prisma.grammarCourse.findMany({
    where: { isActive: true, OR: [{ academyId: null }, { academyId: templateAcademyId }] },
    select: { id: true, name: true, description: true, academyId: true, sortOrder: true, _count: { select: { items: true } } },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  })
  return courses
    .map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      scope: c.academyId ? ('ACADEMY' as const) : ('HQ' as const),
      itemCount: c._count.items,
    }))
    .sort((a, b) => Number(a.scope === 'HQ') - Number(b.scope === 'HQ'))
}

export interface CourseTemplateDetail {
  id: string
  name: string
  description: string | null
  scope: 'HQ' | 'ACADEMY'
  points: { id: string; code: string; title: string; categoryLabel: string; published: boolean }[]
}

/** 템플릿 하나 (본사 것 또는 이 학원 것만) — 포인트는 코스 순서대로 */
export async function getCourseTemplateDetail(courseId: string, templateAcademyId: string): Promise<CourseTemplateDetail | null> {
  const c = await prisma.grammarCourse.findFirst({
    where: { id: courseId, isActive: true, OR: [{ academyId: null }, { academyId: templateAcademyId }] },
    select: {
      id: true,
      name: true,
      description: true,
      academyId: true,
      items: {
        orderBy: { sortOrder: 'asc' },
        select: {
          grammarPoint: {
            select: {
              id: true,
              code: true,
              title: true,
              status: true,
              academyId: true,
              category: { select: { name: true, parent: { select: { name: true } } } },
            },
          },
        },
      },
    },
  })
  if (!c) return null
  return {
    id: c.id,
    name: c.name,
    description: c.description,
    scope: c.academyId ? 'ACADEMY' : 'HQ',
    points: c.items
      .map((i) => i.grammarPoint)
      // 다른 학원 전용 포인트는 보이지 않게
      .filter((p) => p.academyId === null || p.academyId === templateAcademyId)
      .map((p) => ({
        id: p.id,
        code: p.code,
        title: p.title,
        categoryLabel: categoryLabelOf(p.category),
        published: p.status === 'PUBLISHED',
      })),
  }
}

// ─── 검수 대기 문항 (학원 AI 생성) ───────────────────────────────────────────

export interface PendingAcademyQuestion {
  id: string
  contentJson: Prisma.JsonValue
  difficulty: number
  createdAt: Date
  point: { id: string; code: string; title: string }
  academyLabel: string | null
}

export const PENDING_QUESTION_LIMIT = 100

/** 범위 안 학원의 AI 생성 미검수 문법 문항 — 오래된 것부터 */
export async function getPendingAcademyQuestions(
  scope: GrammarManageScope,
): Promise<{ rows: PendingAcademyQuestion[]; total: number }> {
  const where: Prisma.QuestionWhereInput = {
    academyId: { in: scope.academyIds },
    domain: 'GRAMMAR',
    source: 'AI_GENERATED',
    isVerified: false,
    isActive: true,
    grammarPointId: { not: null },
  }
  const [rows, total] = await Promise.all([
    prisma.question.findMany({
      where,
      orderBy: [{ grammarPointId: 'asc' }, { createdAt: 'asc' }],
      take: PENDING_QUESTION_LIMIT,
      select: {
        id: true,
        contentJson: true,
        difficulty: true,
        createdAt: true,
        grammarPoint: { select: { id: true, code: true, title: true } },
        academy: { select: { name: true, branchName: true, parentAcademyId: true } },
      },
    }),
    prisma.question.count({ where }),
  ])
  const multiAcademy = scope.academyIds.length > 1
  return {
    total,
    rows: rows
      .filter((r): r is typeof r & { grammarPoint: NonNullable<typeof r.grammarPoint> } => r.grammarPoint !== null)
      .map((r) => ({
        id: r.id,
        contentJson: r.contentJson,
        difficulty: r.difficulty,
        createdAt: r.createdAt,
        point: r.grammarPoint,
        academyLabel:
          multiAcademy && r.academy
            ? r.academy.parentAcademyId
              ? (r.academy.branchName ?? r.academy.name)
              : '본원'
            : null,
      })),
  }
}
