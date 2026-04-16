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
  listening: DomainLevelInfo | null  // null: 듣기 데이터 없음
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
//
// 개선: skillAssessment.level 필드를 우선 사용 (난이도 가중 레벨).
// level이 0이거나 1(구 하드코딩)인 경우에만 score 기반으로 폴백.
// 또한 적응형 레벨 테스트 결과(levelAssessment)가 있으면 이를 우선 반영.

export async function calculateDomainLevels(studentId: string): Promise<DomainLevels> {
  const domains = ['GRAMMAR', 'VOCABULARY', 'READING', 'LISTENING', 'WRITING'] as const

  // 1. 적응형 레벨 테스트 최신 결과 조회 (가장 신뢰도 높음)
  const latestAssessment = await prisma.levelAssessment.findFirst({
    where: { studentId, isCurrent: true },
    orderBy: { assessedAt: 'desc' },
    select: {
      grammarLevel: true,
      vocabularyLevel: true,
      readingLevel: true,
      listeningLevel: true,
      writingLevel: true,
      overallLevel: true,
      assessedAt: true,
    },
  })

  // 2. 각 도메인별 최근 5회 skillAssessment (score + level) 병렬 조회
  const results = await Promise.all(
    domains.map((domain) =>
      prisma.skillAssessment.findMany({
        where: { studentId, domain, score: { not: null } },
        orderBy: { assessedAt: 'desc' },
        take: 5,
        select: { score: true, level: true, assessedAt: true },
      }),
    ),
  )

  // 도메인별 레벨 계산: levelAssessment 우선, skillAssessment 보조
  const assessmentDomainMap: Record<string, number | null> = {
    GRAMMAR: latestAssessment?.grammarLevel ?? null,
    VOCABULARY: latestAssessment?.vocabularyLevel ?? null,
    READING: latestAssessment?.readingLevel ?? null,
    LISTENING: latestAssessment?.listeningLevel ?? null,
    WRITING: latestAssessment?.writingLevel ?? null,
  }

  const makeDomainInfo = (domain: string, skillRows: typeof results[0]): DomainLevelInfo => {
    const assessmentLevel = assessmentDomainMap[domain]

    // skillAssessment에서 레벨과 점수 추출
    let skillLevel: number | null = null
    let avgScore = 0

    if (skillRows.length > 0) {
      avgScore = Math.round(skillRows.reduce((sum, r) => sum + (r.score ?? 0), 0) / skillRows.length)

      // level 필드가 유효한 값(2 이상)이면 사용, 아니면 score 기반 변환
      const validLevels = skillRows.filter((r) => r.level >= 2).map((r) => r.level)
      if (validLevels.length > 0) {
        skillLevel = Math.round(validLevels.reduce((a, b) => a + b, 0) / validLevels.length)
      } else {
        skillLevel = scoreToLevel(avgScore)
      }
    }

    // 최종 레벨 결정: levelAssessment와 skillAssessment 레벨의 가중 평균
    // levelAssessment는 적응형 테스트 결과이므로 더 높은 신뢰도 (가중치 60%)
    let finalLevel: number
    if (assessmentLevel !== null && skillLevel !== null) {
      // 적응형 레벨 테스트 결과와 일반 테스트 결과를 혼합
      finalLevel = Math.round(assessmentLevel * 0.6 + skillLevel * 0.4)
    } else if (assessmentLevel !== null) {
      finalLevel = assessmentLevel
    } else if (skillLevel !== null) {
      finalLevel = skillLevel
    } else {
      finalLevel = 1
    }

    finalLevel = Math.max(1, Math.min(10, finalLevel))
    const info = getLevelInfo(finalLevel)
    return { score: avgScore, level: finalLevel, cefr: info.cefr, nameKo: info.nameKo }
  }

  const grammar = makeDomainInfo('GRAMMAR', results[0])
  const vocabulary = makeDomainInfo('VOCABULARY', results[1])
  const reading = makeDomainInfo('READING', results[2])
  const listeningRows = results[3]
  const listening = listeningRows.length > 0 || assessmentDomainMap['LISTENING'] !== null
    ? makeDomainInfo('LISTENING', listeningRows)
    : null
  const writing = makeDomainInfo('WRITING', results[4])

  // 종합 레벨: 가중 평균 (적응형 엔진과 동일한 가중치)
  let overallLevel: number
  if (listening !== null) {
    overallLevel = Math.round(
      grammar.level * 0.25 + vocabulary.level * 0.25 +
      reading.level * 0.20 + listening.level * 0.15 + writing.level * 0.15,
    )
  } else {
    overallLevel = Math.round(
      grammar.level * 0.30 + vocabulary.level * 0.30 +
      reading.level * 0.25 + writing.level * 0.15,
    )
  }
  overallLevel = Math.max(1, Math.min(10, overallLevel))

  // avgScore는 표시용: 레벨 기반 역산 (level * 10의 중간값)
  const avgScore = overallLevel * 10 - 5
  const overall = { avgScore, level: overallLevel }

  const allDomains = [
    { domain: 'grammar', level: grammar.level, score: grammar.score },
    { domain: 'vocabulary', level: vocabulary.level, score: vocabulary.score },
    { domain: 'reading', level: reading.level, score: reading.score },
    ...(listening ? [{ domain: 'listening', level: listening.level, score: listening.score }] : []),
    { domain: 'writing', level: writing.level, score: writing.score },
  ]

  const sorted = [...allDomains].sort((a, b) => b.level - a.level)
  const strongest = sorted[0]
  const weakest = sorted[sorted.length - 1]

  return {
    grammar,
    vocabulary,
    reading,
    listening,
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
