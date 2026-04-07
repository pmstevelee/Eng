import { prisma } from '@/lib/prisma/client'

/**
 * 문제 응답 데이터를 바탕으로 품질 점수를 자동 갱신합니다.
 * - 최근 100회 응답의 정답률 기반
 * - 정답률 30~70%일 때 변별력 최고 (qualityScore = 0.9)
 * - 비동기로 호출하여 학생 응답 속도에 영향을 주지 않습니다.
 */
export async function updateQuestionQuality(questionId: string): Promise<void> {
  try {
    const responses = await prisma.questionResponse.findMany({
      where: { questionId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: { isCorrect: true },
    })

    if (responses.length < 10) return // 데이터 부족 시 건너뜀

    const correctRate =
      responses.filter((r) => r.isCorrect === true).length / responses.length

    let qualityScore: number
    if (correctRate >= 0.3 && correctRate <= 0.7) {
      qualityScore = 0.9 // 최고 품질: 변별력 있음
    } else if (correctRate >= 0.2 && correctRate <= 0.8) {
      qualityScore = 0.7
    } else if (correctRate >= 0.1 && correctRate <= 0.9) {
      qualityScore = 0.5
    } else {
      qualityScore = 0.3 // 너무 쉽거나 너무 어려움
    }

    await prisma.question.update({
      where: { id: questionId },
      data: {
        qualityScore,
        usageCount: { increment: 1 },
        statsJson: {
          correctRate,
          totalResponses: responses.length,
          lastCalculated: new Date().toISOString(),
        },
      },
    })
  } catch (err) {
    console.error('[quality-updater] 품질 업데이트 실패:', err)
  }
}
