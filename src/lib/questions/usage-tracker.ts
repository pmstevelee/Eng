import { unstable_cache } from 'next/cache'
import { revalidateTag } from 'next/cache'
import { prisma } from '@/lib/prisma/client'

/**
 * 특정 학원에서 LEVEL_TEST에 사용된 문제 ID 목록을 반환합니다.
 * - 최근 1년 이내 사용된 문제만 제외 (1년 이상 지난 문제는 재사용 허용)
 * - 5분 캐시 (태그: level-test-usage-{academyId})
 */
export function getUsedLevelTestQuestions(academyId: string): Promise<string[]> {
  return unstable_cache(
    async () => {
      const oneYearAgo = new Date()
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)

      const logs = await prisma.questionUsageLog.findMany({
        where: {
          academyId,
          testType: 'LEVEL_TEST',
          usedAt: { gte: oneYearAgo },
        },
        select: { questionId: true },
      })

      return logs.map((l) => l.questionId)
    },
    [`used-level-questions`, academyId],
    { revalidate: 300, tags: [`level-test-usage-${academyId}`] },
  )()
}

/**
 * 레벨 테스트 완료 시 사용된 문제 이력을 기록합니다.
 * - skipDuplicates로 이미 기록된 항목은 무시
 * - 캐시 무효화로 다음 레벨 테스트에 즉시 반영
 */
export async function recordLevelTestUsage(
  academyId: string,
  testId: string,
  questionIds: string[],
): Promise<void> {
  if (questionIds.length === 0) return

  await prisma.questionUsageLog.createMany({
    data: questionIds.map((qId) => ({
      questionId: qId,
      academyId,
      testType: 'LEVEL_TEST',
      testId,
    })),
    skipDuplicates: true,
  })

  revalidateTag(`level-test-usage-${academyId}`)
}
