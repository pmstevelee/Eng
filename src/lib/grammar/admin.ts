// 관리자 문법 커리큘럼 — 검수 완료 문항 수 집계 (실시간, 캐시 없음)
//
// "검수 완료 문항" = 본사 공용(academyId null) · isVerified · isActive 이면서 포인트에 연결된 문항.
// 공개 조건(MIN_PUBLISH_QUESTIONS)과 목록의 빨간 숫자가 이 값을 쓴다.

import { prisma } from '@/lib/prisma/client'
import type { Prisma } from '@/generated/prisma'

const verifiedWhere = {
  academyId: null,
  isVerified: true,
  isActive: true,
} satisfies Prisma.QuestionWhereInput

/** 포인트별 검수 완료 문항 수 (문항이 없는 포인트는 빠짐) */
export async function getVerifiedQuestionCounts(): Promise<Map<string, number>> {
  const rows = await prisma.question.groupBy({
    by: ['grammarPointId'],
    where: { ...verifiedWhere, grammarPointId: { not: null } },
    _count: { _all: true },
  })
  const counts = new Map<string, number>()
  for (const r of rows) {
    if (r.grammarPointId) counts.set(r.grammarPointId, r._count._all)
  }
  return counts
}

export function getVerifiedQuestionCount(pointId: string): Promise<number> {
  return prisma.question.count({ where: { ...verifiedWhere, grammarPointId: pointId } })
}
