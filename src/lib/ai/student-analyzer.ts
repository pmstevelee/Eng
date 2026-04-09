import { prisma } from '@/lib/prisma/client'

import { LEVEL_TO_CEFR, LEVEL_UP_THRESHOLDS } from '@/lib/constants/levels'

// ── CEFR 매핑 ──────────────────────────────────────────────────────────────────

const CEFR_MAP: Record<number, string> = LEVEL_TO_CEFR

// ── 타입 정의 ──────────────────────────────────────────────────────────────────

export type DomainTrend = 'improving' | 'stable' | 'declining' | 'unknown'

export type DomainScoreInfo = {
  avg: number | null
  trend: DomainTrend
  weakCategories: string[]
}

export type RecentMistake = {
  category: string
  domain: string
  count: number
  lastMistake: string // ISO string
}

export type StudentProfile = {
  studentId: string
  currentLevel: number
  cefrLevel: string
  domainScores: {
    grammar: DomainScoreInfo
    vocabulary: DomainScoreInfo
    reading: DomainScoreInfo
    listening: DomainScoreInfo | null  // null: 듣기 데이터 없음
    writing: DomainScoreInfo
  }
  overallWeakest: string
  overallStrongest: string
  recentMistakes: RecentMistake[]
  readyForLevelUp: boolean
  levelUpGap: Record<string, number>
  streakDays: number
  weeklyQuestions: number
}

// ── 메인 함수 ──────────────────────────────────────────────────────────────────

export async function getStudentProfile(studentId: string): Promise<StudentProfile> {
  const now = new Date()
  const thirtyDaysAgo = new Date(now)
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const sevenDaysAgo = new Date(now)
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  const [student, recentSessions, wrongResponses, streakData, weeklyResponses] =
    await Promise.all([
      prisma.student.findUnique({
        where: { id: studentId },
        select: { currentLevel: true },
      }),
      // 최근 5회 완료된 테스트 세션
      prisma.testSession.findMany({
        where: {
          studentId,
          status: { in: ['COMPLETED', 'GRADED'] },
          completedAt: { gte: thirtyDaysAgo },
        },
        orderBy: { completedAt: 'desc' },
        take: 5,
        select: {
          grammarScore: true,
          vocabularyScore: true,
          readingScore: true,
          listeningScore: true,
          writingScore: true,
          completedAt: true,
        },
      }),
      // 최근 30일 오답
      prisma.questionResponse.findMany({
        where: {
          isCorrect: false,
          createdAt: { gte: thirtyDaysAgo },
          session: { studentId, status: { in: ['COMPLETED', 'GRADED'] } },
        },
        select: {
          createdAt: true,
          question: { select: { domain: true, subCategory: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.studentStreak.findUnique({
        where: { studentId },
        select: { currentStreak: true },
      }),
      // 이번 주 푼 문제 수
      prisma.questionResponse.findMany({
        where: {
          createdAt: { gte: sevenDaysAgo },
          session: { studentId },
        },
        select: { isCorrect: true },
      }),
    ])

  const currentLevel = student?.currentLevel ?? 1
  const cefrLevel = CEFR_MAP[currentLevel] ?? 'A1-A2'

  // ── 영역별 점수 계산 ────────────────────────────────────────────────────────

  type ScoreField = 'grammarScore' | 'vocabularyScore' | 'readingScore' | 'writingScore' | 'listeningScore'

  const domainScoreFields: Record<string, ScoreField> = {
    grammar: 'grammarScore',
    vocabulary: 'vocabularyScore',
    reading: 'readingScore',
    listening: 'listeningScore',
    writing: 'writingScore',
  }

  function computeDomainInfo(domain: string): DomainScoreInfo | null {
    const field = domainScoreFields[domain]
    const scores = recentSessions
      .map((s) => s[field])
      .filter((v): v is number => v !== null && v !== undefined)

    if (scores.length === 0) {
      // 듣기는 데이터 없으면 null 반환, 나머지는 unknown 반환
      if (domain === 'listening') return null
      return { avg: null, trend: 'unknown', weakCategories: [] }
    }

    const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)

    let trend: DomainTrend = 'stable'
    if (scores.length >= 3) {
      const recent = scores[0]
      const older = scores[scores.length - 1]
      if (recent - older >= 5) trend = 'improving'
      else if (older - recent >= 5) trend = 'declining'
    }

    return { avg, trend, weakCategories: [] }
  }

  const domainScores = {
    grammar: computeDomainInfo('grammar') ?? { avg: null, trend: 'unknown' as DomainTrend, weakCategories: [] },
    vocabulary: computeDomainInfo('vocabulary') ?? { avg: null, trend: 'unknown' as DomainTrend, weakCategories: [] },
    reading: computeDomainInfo('reading') ?? { avg: null, trend: 'unknown' as DomainTrend, weakCategories: [] },
    listening: computeDomainInfo('listening'),
    writing: computeDomainInfo('writing') ?? { avg: null, trend: 'unknown' as DomainTrend, weakCategories: [] },
  }

  // ── 하위 카테고리 오답 집계 ─────────────────────────────────────────────────

  const categoryMap: Record<
    string,
    { count: number; domain: string; lastMistake: string }
  > = {}

  for (const r of wrongResponses) {
    const cat = r.question.subCategory ?? 'general'
    const domain = r.question.domain
    const isoDate = r.createdAt.toISOString()

    if (!categoryMap[cat]) {
      categoryMap[cat] = { count: 0, domain, lastMistake: isoDate }
    }
    categoryMap[cat].count++
    if (isoDate > categoryMap[cat].lastMistake) {
      categoryMap[cat].lastMistake = isoDate
    }
  }

  // 영역별 weakCategories 채우기
  for (const [cat, info] of Object.entries(categoryMap)) {
    const dk = info.domain.toLowerCase() as keyof typeof domainScores
    if (domainScores[dk] && !domainScores[dk].weakCategories.includes(cat)) {
      domainScores[dk].weakCategories.push(cat)
    }
  }

  // Top 5 오답 카테고리
  const recentMistakes: RecentMistake[] = Object.entries(categoryMap)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 5)
    .map(([cat, info]) => ({
      category: cat,
      domain: info.domain,
      count: info.count,
      lastMistake: info.lastMistake,
    }))

  // ── 가장 약한/강한 영역 ─────────────────────────────────────────────────────

  const domainKeys = ['grammar', 'vocabulary', 'reading', 'listening', 'writing'] as const
  const scored = domainKeys.filter((d) => {
    const info = domainScores[d]
    return info !== null && info.avg !== null
  })

  let overallWeakest = 'grammar'
  let overallStrongest = 'reading'

  if (scored.length > 0) {
    overallWeakest = scored.reduce((a, b) =>
      ((domainScores[a]?.avg ?? 100) < (domainScores[b]?.avg ?? 100) ? a : b),
    )
    overallStrongest = scored.reduce((a, b) =>
      ((domainScores[a]?.avg ?? 0) > (domainScores[b]?.avg ?? 0) ? a : b),
    )
  }

  // ── 레벨업 판정 ─────────────────────────────────────────────────────────────

  const levelThreshold = LEVEL_UP_THRESHOLDS.find((t) => t.from === currentLevel)
  const levelUpRequired = levelThreshold?.requiredAvg ?? 93

  const readyForLevelUp =
    recentSessions.length >= 3 &&
    recentSessions.slice(0, 3).every((s) => {
      const vals = [s.grammarScore, s.vocabularyScore, s.readingScore, s.listeningScore, s.writingScore].filter(
        (v): v is number => v !== null && v !== undefined,
      )
      if (vals.length === 0) return false
      return vals.reduce((a, b) => a + b, 0) / vals.length >= levelUpRequired
    })

  const levelUpGap: Record<string, number> = {
    grammar: (domainScores.grammar.avg ?? 0) - levelUpRequired,
    vocabulary: (domainScores.vocabulary.avg ?? 0) - levelUpRequired,
    reading: (domainScores.reading.avg ?? 0) - levelUpRequired,
    writing: (domainScores.writing.avg ?? 0) - levelUpRequired,
  }
  if (domainScores.listening !== null) {
    levelUpGap.listening = (domainScores.listening.avg ?? 0) - levelUpRequired
  }

  return {
    studentId,
    currentLevel,
    cefrLevel,
    domainScores,
    overallWeakest,
    overallStrongest,
    recentMistakes,
    readyForLevelUp,
    levelUpGap,
    streakDays: streakData?.currentStreak ?? 0,
    weeklyQuestions: weeklyResponses.length,
  }
}
