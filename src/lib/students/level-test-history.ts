import { prisma } from '@/lib/prisma/client'

/**
 * 학생이 레벨 테스트를 본 적이 있는지 (또는 교사가 레벨을 조정했는지).
 * 공식 레벨 평가가 한 번이라도 있으면 학생이 직접 학습레벨을 바꿀 수 없다.
 */
export async function hasOfficialLevelAssessment(studentId: string): Promise<boolean> {
  const [assessment, placement] = await Promise.all([
    prisma.levelAssessment.findFirst({ where: { studentId }, select: { id: true } }),
    prisma.testSession.findFirst({
      where: { studentId, isPlacement: true, status: { in: ['COMPLETED', 'GRADED'] } },
      select: { id: true },
    }),
  ])
  return Boolean(assessment || placement)
}
