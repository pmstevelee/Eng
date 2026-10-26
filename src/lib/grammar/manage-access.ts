import 'server-only'

// 문법학습 관리(교사·학원장) 접근 범위 — 출결과 같은 규칙을 쓴다
// 학원장: 본원 + 소유 지점의 모든 반 / 교사: 소속 학원의 담당 반만
// 화면(page)과 모든 Server Action에서 다시 확인한다.

import type { Prisma } from '@/generated/prisma'
import { prisma } from '@/lib/prisma/client'
import { canAccessClass, classWhereForScope, getAttendanceScope, type AttendanceScope } from '@/lib/attendance/access'

export type GrammarManageScope = AttendanceScope

export function getGrammarManageScope(): Promise<GrammarManageScope | null> {
  return getAttendanceScope()
}

export function grammarClassWhere(scope: GrammarManageScope): Prisma.ClassWhereInput {
  return { ...classWhereForScope(scope), isActive: true }
}

export interface ManagedClass {
  id: string
  name: string
  academyId: string
  teacherId: string | null
}

/** 범위 안의 반이면 반 정보, 아니면 null */
export async function findManagedClass(scope: GrammarManageScope, classId: unknown): Promise<ManagedClass | null> {
  if (typeof classId !== 'string' || !classId) return null
  const cls = await prisma.class.findFirst({
    where: { id: classId, isActive: true, academyId: { in: scope.academyIds } },
    select: { id: true, name: true, academyId: true, teacherId: true },
  })
  return cls && canAccessClass(scope, cls) ? cls : null
}

/** 반 소속 재원 학생 조건 — 반 소속은 students.class_id와 enrollments 둘 다 본다 */
export function classStudentWhere(classId: string): Prisma.StudentWhereInput {
  return {
    status: 'ACTIVE',
    user: { isDeleted: false },
    OR: [{ classId }, { enrollments: { some: { classId } } }],
  }
}

/**
 * 학생 개인 배정 권한 — 학원장: 범위 안 학원의 학생 / 교사: 자기 담당 반 학생.
 * 학생의 학원 id를 돌려준다 (배정 행의 academyId).
 */
export async function findManagedStudent(
  scope: GrammarManageScope,
  studentId: unknown,
): Promise<{ id: string; academyId: string } | null> {
  if (typeof studentId !== 'string' || !studentId) return null
  const student = await prisma.student.findFirst({
    where: {
      id: studentId,
      status: 'ACTIVE',
      user: { isDeleted: false, academyId: { in: scope.academyIds } },
      ...(scope.role === 'TEACHER'
        ? {
            OR: [
              { class: { teacherId: scope.userId, isActive: true } },
              { enrollments: { some: { class: { teacherId: scope.userId, isActive: true } } } },
            ],
          }
        : {}),
    },
    select: { id: true, user: { select: { academyId: true } } },
  })
  if (!student?.user.academyId) return null
  return { id: student.id, academyId: student.user.academyId }
}

/** 학원 코스 템플릿은 본원에 둔다 — 지점 반도 본원 템플릿을 같이 쓴다 */
export async function templateAcademyIdOf(academyId: string): Promise<string> {
  const academy = await prisma.academy.findUnique({ where: { id: academyId }, select: { parentAcademyId: true } })
  return academy?.parentAcademyId ?? academyId
}

/** 포인트를 이 학원 반에 배정할 수 있는지 — 공개 + (본사 공용 또는 그 학원 전용) */
export function assignablePointWhere(academyId: string): Prisma.GrammarPointWhereInput {
  return { status: 'PUBLISHED', OR: [{ academyId: null }, { academyId }] }
}
