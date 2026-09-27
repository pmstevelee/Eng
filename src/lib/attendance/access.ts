import 'server-only'
import type { Prisma } from '@/generated/prisma'
import { getCurrentUser } from '@/lib/auth'
import { getOwnerAcademyIds } from '@/lib/branch'
import { todayKst } from './time'

/** 출결 화면 접근 범위 — 학원장: 본원+소유 지점 전체 반 / 교사: 소속 학원의 담당 반만 */
export type AttendanceScope = {
  userId: string
  role: 'ACADEMY_OWNER' | 'TEACHER'
  academyIds: string[]
}

export async function getAttendanceScope(): Promise<AttendanceScope | null> {
  const user = await getCurrentUser()
  if (!user || !user.academyId) return null
  if (user.role === 'ACADEMY_OWNER') {
    const ids = await getOwnerAcademyIds(user.id)
    return { userId: user.id, role: 'ACADEMY_OWNER', academyIds: ids.length > 0 ? ids : [user.academyId] }
  }
  if (user.role === 'TEACHER') {
    return { userId: user.id, role: 'TEACHER', academyIds: [user.academyId] }
  }
  return null
}

/** 범위 안의 반 조건 (교사는 담당 반만) */
export function classWhereForScope(scope: AttendanceScope, academyId?: string): Prisma.ClassWhereInput {
  const academyFilter = academyId ? academyId : { in: scope.academyIds }
  return scope.role === 'TEACHER'
    ? { academyId: academyFilter, teacherId: scope.userId }
    : { academyId: academyFilter }
}

export function canAccessClass(scope: AttendanceScope, cls: { academyId: string; teacherId: string | null }): boolean {
  if (!scope.academyIds.includes(cls.academyId)) return false
  return scope.role === 'ACADEMY_OWNER' || cls.teacherId === scope.userId
}

/** 오늘 이전 날짜 기록은 학원장만 수정 */
export function canEditDate(scope: AttendanceScope, dateKey: string): boolean {
  return scope.role === 'ACADEMY_OWNER' || dateKey >= todayKst()
}
