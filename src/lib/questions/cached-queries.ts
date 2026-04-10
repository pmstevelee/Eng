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

// ── 적응형 테스트 사전 로드 ──────────────────────────────────────────────────────

type PreloadedQuestion = {
  id: string
  difficulty: number
  subCategory: string | null
  qualityScore: number | null
  contentJson: unknown
}

/**
 * 적응형 테스트 시작 시 해당 영역의 모든 난이도 문제를 한 번에 로드.
 * 이후 문제 선택은 메모리에서 즉시 처리 (DB 호출 없음).
 */
export async function preloadAdaptiveQuestions(
  academyId: string,
  domain: string,
): Promise<Map<number, PreloadedQuestion[]>> {
  const allQuestions = await prisma.question.findMany({
    where: {
      OR: [{ academyId: null }, { academyId }],
      domain: domain as QuestionDomain,
      isActive: true,
      isVerified: true,
    },
    select: {
      id: true,
      difficulty: true,
      subCategory: true,
      qualityScore: true,
      contentJson: true,
    },
    orderBy: { qualityScore: 'desc' },
  })

  const byDifficulty = new Map<number, PreloadedQuestion[]>()
  for (const q of allQuestions) {
    const list = byDifficulty.get(q.difficulty) ?? []
    list.push(q)
    byDifficulty.set(q.difficulty, list)
  }

  return byDifficulty
}

/**
 * 사전 로드된 문제 맵에서 즉시 문제 선택 (DB 호출 없음).
 */
export function selectFromPreloaded(
  preloaded: Map<number, PreloadedQuestion[]>,
  difficulty: number,
  excludeIds: string[],
): PreloadedQuestion | undefined {
  const candidates = preloaded.get(difficulty) ?? []
  return candidates.find((q) => !excludeIds.includes(q.id))
}
