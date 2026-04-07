import { prisma } from '@/lib/prisma/client'
import { scoreToLevel, getLevelInfo } from '@/lib/constants/levels'

// ── 타입 ──────────────────────────────────────────────────────────────────────

export type DomainLevelInfo = {
  score: number
  level: number
  cefr: string
  nameKo: string
}

export type DomainLevels = {
  grammar: DomainLevelInfo
  vocabulary: DomainLevelInfo
  reading: DomainLevelInfo
  writing: DomainLevelInfo
  overall: { avgScore: number; level: number }
  gaps: {
    strongest: { domain: string; level: number; score: number }
    weakest: { domain: string; level: number; score: number }
    maxGap: number
    scoreGap: number
  }
}

// ── 도메인별 최근 5회 평균 → 10단계 레벨 변환 ────────────────────────────────

export async function calculateDomainLevels(studentId: string): Promise<DomainLevels> {
  const domains = ['GRAMMAR', 'VOCABULARY', 'READING', 'WRITING'] as const

  // 각 도메인별 최근 5회 점수 병렬 조회
  const results = await Promise.all(
    domains.map((domain) =>
      prisma.skillAssessment.findMany({
        where: { studentId, domain, score: { not: null } },
        orderBy: { assessedAt: 'desc' },
        take: 5,
        select: { score: true },
      }),
    ),
  )

  const domainScores: Record<string, number> = {}
  domains.forEach((domain, i) => {
    const rows = results[i]
    if (rows.length > 0) {
      const avg = rows.reduce((sum, r) => sum + (r.score ?? 0), 0) / rows.length
      domainScores[domain] = Math.round(avg)
    } else {
      domainScores[domain] = 0
    }
  })

  const makeDomainInfo = (score: number): DomainLevelInfo => {
    const level = scoreToLevel(score)
    const info = getLevelInfo(level)
    return { score, level, cefr: info.cefr, nameKo: info.nameKo }
  }

  const grammar = makeDomainInfo(domainScores['GRAMMAR'] ?? 0)
  const vocabulary = makeDomainInfo(domainScores['VOCABULARY'] ?? 0)
  const reading = makeDomainInfo(domainScores['READING'] ?? 0)
  const writing = makeDomainInfo(domainScores['WRITING'] ?? 0)

  const avgScore = Math.round(
    (grammar.score + vocabulary.score + reading.score + writing.score) / 4,
  )
  const overall = { avgScore, level: scoreToLevel(avgScore) }

  const allDomains = [
    { domain: 'grammar', level: grammar.level, score: grammar.score },
    { domain: 'vocabulary', level: vocabulary.level, score: vocabulary.score },
    { domain: 'reading', level: reading.level, score: reading.score },
    { domain: 'writing', level: writing.level, score: writing.score },
  ]

  const sorted = [...allDomains].sort((a, b) => b.level - a.level)
  const strongest = sorted[0]
  const weakest = sorted[sorted.length - 1]

  return {
    grammar,
    vocabulary,
    reading,
    writing,
    overall,
    gaps: {
      strongest,
      weakest,
      maxGap: strongest.level - weakest.level,
      scoreGap: strongest.score - weakest.score,
    },
  }
}
