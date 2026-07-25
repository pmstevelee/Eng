import { unstable_cache } from 'next/cache'
import { prisma } from '@/lib/prisma/client'
import type { QuestionDomain } from '@/generated/prisma'

// ── 공용 문제 ID 캐시 (10분) ────────────────────────────────────────────────────

/**
 * 영역+난이도별 공용 문제 ID 목록 캐시 (10분)
 * 문제 검색 쿼리 중 가장 빈번하게 호출되는 것을 캐싱
 */
export const getPublicQuestionIds = unstable_cache(
  async (domain: string, difficulty: number) => {
    const questions = await prisma.question.findMany({
      where: {
        academyId: null,
        domain: domain as QuestionDomain,
        difficulty,
        isActive: true,
        isVerified: true,
      },
      select: { id: true, qualityScore: true },
      orderBy: { qualityScore: 'desc' },
    })
    return questions
  },
  ['public-questions'],
  { revalidate: 600, tags: ['question-bank'] },
)

// ── 학원 전용 문제 ID 캐시 (5분) ────────────────────────────────────────────────

/**
 * 학원 전용 문제 ID 목록 캐시 (5분)
 */
export const getAcademyQuestionIds = unstable_cache(
  async (academyId: string, domain: string, difficulty: number) => {
    const questions = await prisma.question.findMany({
      where: {
        academyId,
        domain: domain as QuestionDomain,
        difficulty,
        isActive: true,
      },
      select: { id: true },
    })
    return questions
  },
  ['academy-questions'],
  { revalidate: 300, tags: ['question-bank'] },
)

// ── 문제 뱅크 개요 실시간 통계 (캐시 없음, 관리자 페이지용) ──────────────────────

/**
 * 관리자 대시보드용 실시간 집계 — question 테이블에서 직접 count.
 * question_bank_stats 캐시를 거치지 않아 항상 최신 값을 반환하고,
 * 호출 시 question_bank_stats도 동기화한다.
 */
export async function getQuestionBankOverviewLive() {
  const domains = ['GRAMMAR', 'VOCABULARY', 'READING', 'WRITING', 'LISTENING'] as const

  const [domainCounts, qualityAgg] = await Promise.all([
    prisma.question.groupBy({
      by: ['domain'],
      where: { academyId: null, isActive: true },
      _count: { id: true },
    }),
    prisma.question.aggregate({
      where: { academyId: null, isActive: true, qualityScore: { not: null } },
      _avg: { qualityScore: true },
    }),
  ])

  const byDomain = Object.fromEntries(
    domains.map((d) => [d, domainCounts.find((r) => r.domain === d)?._count.id ?? 0]),
  ) as Record<(typeof domains)[number], number>

  const totalPublic = Object.values(byDomain).reduce((s, v) => s + v, 0)
  const avgQuality = qualityAgg._avg.qualityScore ?? 0

  // question_bank_stats 동기화 (비동기 — 완료를 기다리지 않음)
  syncQuestionBankStats().catch(() => {})

  return { totalPublic, byDomain, avgQuality }
}

async function syncQuestionBankStats() {
  const domains = ['GRAMMAR', 'VOCABULARY', 'READING', 'WRITING', 'LISTENING']
  for (const domain of domains) {
    for (let diff = 1; diff <= 10; diff++) {
      const [totalCount, verifiedCount, qualityAgg] = await Promise.all([
        prisma.question.count({ where: { domain: domain as QuestionDomain, difficulty: diff, isActive: true, academyId: null } }),
        prisma.question.count({ where: { domain: domain as QuestionDomain, difficulty: diff, isActive: true, isVerified: true, academyId: null } }),
        prisma.question.aggregate({
          where: { domain: domain as QuestionDomain, difficulty: diff, isActive: true, academyId: null, qualityScore: { not: null } },
          _avg: { qualityScore: true },
        }),
      ])
      await prisma.questionBankStats.upsert({
        where: { domain_difficulty: { domain, difficulty: diff } },
        create: { domain, difficulty: diff, totalCount, verifiedCount, avgQualityScore: qualityAgg._avg.qualityScore ?? null, lastUpdatedAt: new Date() },
        update: { totalCount, verifiedCount, avgQualityScore: qualityAgg._avg.qualityScore ?? null, lastUpdatedAt: new Date() },
      })
    }
  }
}

// ── 문제 뱅크 개요 통계 캐시 (1시간) ────────────────────────────────────────────

/**
 * 관리자 대시보드용 문제 뱅크 개요 통계
 * question_bank_stats 테이블에서 집계 (매번 count 쿼리 불필요)
 */
export const getQuestionBankOverview = unstable_cache(
  async () => {
    const stats = await prisma.questionBankStats.findMany()

    const totalPublic = stats.reduce((sum, s) => sum + s.totalCount, 0)
    const byDomain = {
      GRAMMAR: stats.filter((s) => s.domain === 'GRAMMAR').reduce((sum, s) => sum + s.totalCount, 0),
      VOCABULARY: stats.filter((s) => s.domain === 'VOCABULARY').reduce((sum, s) => sum + s.totalCount, 0),
      READING: stats.filter((s) => s.domain === 'READING').reduce((sum, s) => sum + s.totalCount, 0),
      WRITING: stats.filter((s) => s.domain === 'WRITING').reduce((sum, s) => sum + s.totalCount, 0),
      LISTENING: stats.filter((s) => s.domain === 'LISTENING').reduce((sum, s) => sum + s.totalCount, 0),
    }
    const byDifficulty = Object.fromEntries(
      Array.from({ length: 10 }, (_, i) => [
        i + 1,
        stats.filter((s) => s.difficulty === i + 1).reduce((sum, s) => sum + s.totalCount, 0),
      ]),
    )
    const qualityStats = stats.filter((s) => s.avgQualityScore !== null)
    const avgQuality =
      qualityStats.length > 0
        ? qualityStats.reduce((sum, s) => sum + (s.avgQualityScore ?? 0), 0) / qualityStats.length
        : 0

    return { totalPublic, byDomain, byDifficulty, avgQuality }
  },
  ['question-bank-overview'],
  { revalidate: 3600, tags: ['question-bank'] },
)

// ── 히트맵 데이터 캐시 (30분) ───────────────────────────────────────────────────

/**
 * 도메인 × 난이도 히트맵 데이터 (30분 캐시)
 */
export const getHeatmapData = unstable_cache(
  async () => {
    const stats = await prisma.questionBankStats.findMany({
      orderBy: [{ domain: 'asc' }, { difficulty: 'asc' }],
    })
    return stats
  },
  ['question-bank-heatmap'],
  { revalidate: 1800, tags: ['question-bank'] },
)

// ── 적응형 테스트 문제 풀 메타데이터 캐시 (5분) ─────────────────────────────────

export type AdaptivePoolItem = {
  id: string
  difficulty: number
  qualityScore: number | null
}

/**
 * 적응형 테스트용 영역별 문제 풀 메타데이터 (id/난이도/품질점수만).
 * 본문(contentJson)은 제외해 캐시를 가볍게 유지하고,
 * 문제 선택은 메모리에서 처리 후 선택된 1건만 본문을 조회한다.
 */
export function getAdaptivePoolMeta(
  academyId: string | null,
  domain: string,
): Promise<AdaptivePoolItem[]> {
  return unstable_cache(
    async () => {
      return prisma.question.findMany({
        where: {
          domain: domain as QuestionDomain,
          isActive: true,
          OR: [
            { academyId: null, isVerified: true },
            ...(academyId ? [{ academyId }] : []),
          ],
        },
        select: { id: true, difficulty: true, qualityScore: true },
      })
    },
    ['adaptive-pool-meta', academyId ?? 'public', domain],
    { revalidate: 300, tags: ['question-bank'] },
  )()
}

// 적응형 테스트 사전 로드는 getAdaptivePoolMeta (위 섹션)로 대체됨.
// 과거 preloadAdaptiveQuestions/selectFromPreloaded는 호출부 없이 방치되던 죽은 코드였음.
