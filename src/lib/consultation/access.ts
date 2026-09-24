import 'server-only'

import type { Prisma } from '@/generated/prisma'
import { getCurrentUser } from '@/lib/auth'
import { getOwnerAcademyIds } from '@/lib/branch'
import { prisma } from '@/lib/prisma/client'

/**
 * 상담관리 접근 주체
 * - 학원장: 본원 + 소유 지점 전체 (academyIds)
 * - 교사: 소속 학원 1곳, assigneeId가 본인인 문의만
 * - 학생/관리자/비로그인: null (접근 불가)
 */
export type ConsultationActor = {
  userId: string
  role: 'ACADEMY_OWNER' | 'TEACHER'
  /** 신규 문의 기본 소속 학원 (학원장=본원, 교사=소속 학원) */
  academyId: string
  /** 접근 가능한 학원 ID 전체 */
  academyIds: string[]
}

export async function getConsultationActor(): Promise<ConsultationActor | null> {
  const user = await getCurrentUser()
  if (!user || !user.academyId) return null

  if (user.role === 'ACADEMY_OWNER') {
    const ids = await getOwnerAcademyIds(user.id)
    const academyIds = ids.length > 0 ? ids : [user.academyId]
    return { userId: user.id, role: 'ACADEMY_OWNER', academyId: user.academyId, academyIds }
  }

  if (user.role === 'TEACHER') {
    return { userId: user.id, role: 'TEACHER', academyId: user.academyId, academyIds: [user.academyId] }
  }

  return null
}

/**
 * 모든 Lead 조회에 반드시 붙이는 권한 조건.
 * 학원 범위(academyId) + 교사는 본인 담당만.
 */
export function leadScopeWhere(actor: ConsultationActor): Prisma.LeadWhereInput {
  if (actor.role === 'TEACHER') {
    return { academyId: actor.academyId, assigneeId: actor.userId }
  }
  return { academyId: { in: actor.academyIds } }
}

/** 권한 범위 안의 Lead 1건 조회 (없거나 권한 밖이면 null) */
export async function findScopedLead(actor: ConsultationActor, leadId: string) {
  return prisma.lead.findFirst({
    where: { id: leadId, ...leadScopeWhere(actor) },
    select: { id: true, academyId: true, status: true, studentId: true, assigneeId: true, studentName: true, grade: true },
  })
}

/**
 * 담당자로 지정 가능한 사용자인지 확인 — 해당 학원 소속 교사 또는 학원장 본인.
 * (다른 학원 사용자를 담당자로 넣는 것을 방지)
 */
export async function isValidAssignee(
  actor: ConsultationActor,
  leadAcademyId: string,
  assigneeId: string,
): Promise<boolean> {
  if (actor.role === 'ACADEMY_OWNER' && assigneeId === actor.userId) return true
  const user = await prisma.user.findFirst({
    where: {
      id: assigneeId,
      academyId: leadAcademyId,
      role: { in: ['TEACHER', 'ACADEMY_OWNER'] },
      isDeleted: false,
      isActive: true,
    },
    select: { id: true },
  })
  return !!user
}
