import { prisma } from '@/lib/prisma/client'
import type { Role, Prisma } from '@/generated/prisma'
import type { ActivityAction } from '@/lib/constants/activity-actions'

type LogActivityParams = {
  userId: string
  role: Role
  academyId?: string | null
  action: ActivityAction
  metadata?: Prisma.InputJsonValue
}

/** 구독자 활동 로그 기록. 실패해도 원래 액션 흐름을 막지 않도록 에러를 삼킴. */
export async function logActivity({ userId, role, academyId, action, metadata }: LogActivityParams) {
  try {
    await prisma.activityLog.create({
      data: {
        userId,
        role,
        academyId: academyId ?? null,
        action,
        metadata,
      },
    })
  } catch (error) {
    console.error('[activity-log] 기록 실패:', error)
  }
}
