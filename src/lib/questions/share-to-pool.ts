import { prisma } from '@/lib/prisma/client'
import type { QuestionDomain } from '@/generated/prisma'

type ShareableQuestion = {
  id: string
  domain: QuestionDomain
  subCategory: string | null
  difficulty: number
  cefrLevel: string | null
  contentJson: { question_text: string; [key: string]: unknown }
}

/**
 * AI 유사문제를 공용 풀에 복사합니다.
 * - 같은 question_text가 공용 풀에 이미 있으면 건너뜁니다.
 * - 비동기로 호출하여 학생 응답 속도에 영향을 주지 않습니다.
 */
export async function shareQuestionToPublicPool(question: ShareableQuestion): Promise<void> {
  try {
    // 중복 체크: 공용 풀에서 같은 도메인/난이도의 문제 조회 후 텍스트 비교
    const candidates = await prisma.question.findMany({
      where: {
        academyId: null,
        domain: question.domain,
        difficulty: question.difficulty,
      },
      select: { contentJson: true },
      take: 100,
    })

    const exists = candidates.some((c) => {
      const content = c.contentJson as { question_text?: string }
      return content.question_text === question.contentJson.question_text
    })

    if (exists) return

    await prisma.question.create({
      data: {
        academyId: null,
        domain: question.domain,
        subCategory: question.subCategory,
        difficulty: question.difficulty,
        cefrLevel: question.cefrLevel,
        contentJson: question.contentJson as Parameters<typeof prisma.question.create>[0]['data']['contentJson'],
        source: 'AI_SHARED',
        isVerified: true,
        isActive: true,
        originalQuestionId: question.id,
        qualityScore: 0.6,
      },
    })

    // 통계 캐시 비동기 업데이트
    updateQuestionBankStatsForDomain(question.domain, question.difficulty).catch(console.error)
  } catch (err) {
    console.error('[share-to-pool] 공용 풀 공유 실패:', err)
  }
}

/**
 * 특정 도메인/난이도의 공용 문제 뱅크 통계 캐시를 갱신합니다.
 */
export async function updateQuestionBankStatsForDomain(
  domain: string,
  difficulty: number,
): Promise<void> {
  try {
    const domainEnum = domain as QuestionDomain

    const [totalCount, verifiedCount, qualityAgg] = await Promise.all([
      prisma.question.count({
        where: { domain: domainEnum, difficulty, isActive: true, academyId: null },
      }),
      prisma.question.count({
        where: { domain: domainEnum, difficulty, isActive: true, isVerified: true, academyId: null },
      }),
      prisma.question.aggregate({
        where: {
          domain: domainEnum,
          difficulty,
          isActive: true,
          academyId: null,
          qualityScore: { not: null },
        },
        _avg: { qualityScore: true },
      }),
    ])

    await prisma.questionBankStats.upsert({
      where: { domain_difficulty: { domain, difficulty } },
      create: {
        domain,
        difficulty,
        totalCount,
        verifiedCount,
        avgQualityScore: qualityAgg._avg.qualityScore ?? null,
        lastUpdatedAt: new Date(),
      },
      update: {
        totalCount,
        verifiedCount,
        avgQualityScore: qualityAgg._avg.qualityScore ?? null,
        lastUpdatedAt: new Date(),
      },
    })
  } catch (err) {
    console.error('[share-to-pool] 통계 업데이트 실패:', err)
  }
}
