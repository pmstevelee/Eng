import { prisma } from '@/lib/prisma/client'
import { scoreToLevel, getLevelInfo } from '@/lib/constants/levels'

// ── NELT 스타일 테스트 결과표 데이터 타입 ──────────────────────────────────────

export type ReportDomainKey = 'GRAMMAR' | 'VOCABULARY' | 'READING' | 'WRITING' | 'LISTENING'

export const REPORT_DOMAIN_LABEL: Record<ReportDomainKey, string> = {
  GRAMMAR: '문법',
  VOCABULARY: '어휘',
  READING: '독해',
  WRITING: '쓰기',
  LISTENING: '듣기',
}

export type SubCategoryStat = {
  subCategory: string
  myCorrect: number
  myTotal: number
  myRate: number // 0~100
  peerRate: number | null // 0~100, 동일 테스트 응시자 평균
}

export type QuestionOxItem = {
  subCategory: string
  summary: string // 문제 요약 (question_text 앞부분)
  correct: boolean | null // null = 미채점(서술형 등)
}

export type DomainReportStat = {
  domain: ReportDomainKey
  score: number | null // 0~100
  level: number // 1~10
  cefr: string
  levelNameKo: string
  correctCount: number
  gradedCount: number
  correctRate: number | null // 0~100
  peerAvgScore: number | null
  rankPercent: number | null // 상위 N%
  timeSpentSec: number | null
  peerAvgTimeSec: number | null
  subCategories: SubCategoryStat[]
  oxItems: QuestionOxItem[]
}

export type ScoreBucket = {
  label: string // "0~10" 등
  count: number
  isMine: boolean
}

export type TestResultReportData = {
  sessionId: string
  generatedAt: string
  academyName: string | null
  student: {
    name: string
    className: string | null
    currentLevel: number
    grade: string | null
  }
  test: {
    title: string
    type: string
    isAdaptive: boolean
    /** 영역 카테고리 (null = 전체 영역 테스트) */
    domain?: ReportDomainKey | null
  }
  completedAt: string | null
  totalScore: number | null
  overallLevel: number
  overallCefr: string
  overallNameKo: string
  overallRankPercent: number | null
  peerCount: number // 동일 테스트 완료 응시자 수 (본인 포함)
  peerAvgScore: number | null
  totalDurationSec: number | null
  peerAvgDurationSec: number | null
  distribution: ScoreBucket[]
  domains: DomainReportStat[]
}

// AI 생성 총평/처방
// domainBenchmarks: 영역별 환산 평가 — 문법/듣기/어휘/독해는 수능 영어 기준,
// 쓰기는 토론토대 학술 영작문 기준 (src/lib/reports/domain-analysis-prompts.ts)
export type TestReportNarrative = {
  overall: string
  domainComments: Partial<Record<'grammar' | 'vocabulary' | 'reading' | 'writing' | 'listening', string>>
  prescriptions: Partial<Record<'grammar' | 'vocabulary' | 'reading' | 'writing' | 'listening', string[]>>
  domainBenchmarks?: Partial<
    Record<
      'grammar' | 'vocabulary' | 'reading' | 'writing' | 'listening',
      { standard: string; grade: string; comment: string }
    >
  >
}

export type TestResultReportSnapshot = {
  stats: TestResultReportData
  narrative: TestReportNarrative | null
  metadata: {
    sessionId: string
    testTitle: string
    studentName: string
    generatedAt: string
  }
}

export const TEST_RESULT_REPORT_TYPE = 'TEST_RESULT_REPORT'

// ── 헬퍼 ──────────────────────────────────────────────────────────────────────

function avg(nums: number[]): number | null {
  if (nums.length === 0) return null
  return nums.reduce((a, b) => a + b, 0) / nums.length
}

/** 상위 N% (점수가 높을수록 상위) */
function rankPercent(myScore: number, allScores: number[]): number | null {
  if (allScores.length < 2) return null
  const better = allScores.filter((s) => s > myScore).length
  return Math.max(1, Math.round(((better + 1) / allScores.length) * 100))
}

const DOMAIN_SCORE_FIELD: Record<ReportDomainKey, 'grammarScore' | 'vocabularyScore' | 'readingScore' | 'writingScore' | 'listeningScore'> = {
  GRAMMAR: 'grammarScore',
  VOCABULARY: 'vocabularyScore',
  READING: 'readingScore',
  WRITING: 'writingScore',
  LISTENING: 'listeningScore',
}

const ALL_DOMAINS: ReportDomainKey[] = ['GRAMMAR', 'VOCABULARY', 'READING', 'WRITING', 'LISTENING']

type AssessedLevelsJson = {
  grammar?: number
  vocabulary?: number
  reading?: number
  listening?: number
  writing?: number
  overall?: number
}

// ── 데이터 집계 ────────────────────────────────────────────────────────────────

/**
 * 테스트 결과표(NELT 스타일)에 필요한 모든 통계를 집계한다.
 * 비교 통계는 동일 테스트를 완료한 학원 내 응시자 전체를 모수로 사용한다.
 */
export async function buildTestResultReportData(sessionId: string): Promise<TestResultReportData | null> {
  const session = await prisma.testSession.findUnique({
    where: { id: sessionId },
    include: {
      test: {
        select: { id: true, title: true, type: true, isAdaptive: true, domain: true },
      },
      student: {
        select: {
          currentLevel: true,
          grade: true,
          user: { select: { name: true, academyId: true } },
          class: { select: { name: true } },
        },
      },
    },
  })
  if (!session) return null

  const academy = session.student.user.academyId
    ? await prisma.academy.findUnique({
        where: { id: session.student.user.academyId },
        select: { name: true, businessName: true },
      })
    : null

  // 동일 테스트 완료 세션 (본인 포함)
  const peerSessions = await prisma.testSession.findMany({
    where: {
      testId: session.testId,
      status: { in: ['COMPLETED', 'GRADED'] },
      score: { not: null },
    },
    select: {
      id: true,
      score: true,
      grammarScore: true,
      vocabularyScore: true,
      readingScore: true,
      writingScore: true,
      listeningScore: true,
      startedAt: true,
      completedAt: true,
    },
  })

  const peerSessionIds = peerSessions.map((s) => s.id)

  // 응답 + 문제 메타 (동일 테스트 응시자 전체 — 항목별 평균 정답률/소요시간 계산용)
  const allResponses = peerSessionIds.length
    ? await prisma.questionResponse.findMany({
        where: { sessionId: { in: peerSessionIds } },
        select: {
          sessionId: true,
          questionId: true,
          isCorrect: true,
          timeSpentSec: true,
          question: { select: { domain: true, subCategory: true } },
        },
      })
    : []

  const myResponses = allResponses.filter((r) => r.sessionId === sessionId)

  // 내 문항의 문제 본문 (O/X 표용)
  const myQuestionIds = Array.from(new Set(myResponses.map((r) => r.questionId)))
  const myQuestions = myQuestionIds.length
    ? await prisma.question.findMany({
        where: { id: { in: myQuestionIds } },
        select: { id: true, contentJson: true },
      })
    : []
  const questionTextMap = new Map<string, string>()
  for (const q of myQuestions) {
    const content = q.contentJson as { question_text?: string }
    questionTextMap.set(q.id, content.question_text ?? '')
  }

  // ── 종합 통계 ──
  const allScores = peerSessions.map((s) => s.score).filter((s): s is number => s !== null)
  const myScore = session.score

  const assessed = (session.assessedLevels ?? null) as AssessedLevelsJson | null
  const overallLevel =
    assessed?.overall ?? (myScore !== null ? scoreToLevel(myScore) : session.student.currentLevel)
  const overallInfo = getLevelInfo(overallLevel)

  // 점수 분포 (10점 구간)
  const bucketRanges = [
    [0, 10], [11, 20], [21, 30], [31, 40], [41, 50],
    [51, 60], [61, 70], [71, 80], [81, 90], [91, 100],
  ] as const
  const distribution: ScoreBucket[] = bucketRanges.map(([min, max]) => ({
    label: `${min}~${max}`,
    count: allScores.filter((s) => s >= min && s <= max).length,
    isMine: myScore !== null && myScore >= min && myScore <= max,
  }))

  // 소요 시간
  function durationSec(s: { startedAt: Date; completedAt: Date | null }): number | null {
    if (!s.completedAt) return null
    const sec = Math.round((s.completedAt.getTime() - s.startedAt.getTime()) / 1000)
    return sec > 0 ? sec : null
  }
  const myDuration = durationSec(session)
  const peerDurations = peerSessions
    .map(durationSec)
    .filter((d): d is number => d !== null)

  // ── 영역별 통계 ──
  const domains: DomainReportStat[] = []

  for (const domain of ALL_DOMAINS) {
    const field = DOMAIN_SCORE_FIELD[domain]
    const myDomainScore = session[field]
    const myDomainResponses = myResponses.filter((r) => r.question.domain === domain)
    if (myDomainScore === null && myDomainResponses.length === 0) continue

    const peerDomainScores = peerSessions
      .map((s) => s[field])
      .filter((s): s is number => s !== null)

    // 항목별(subCategory) 정답률: 나 vs 전체 응시자
    const bySub = new Map<string, { myCorrect: number; myTotal: number; peerCorrect: number; peerTotal: number }>()
    for (const r of allResponses) {
      if (r.question.domain !== domain || r.isCorrect === null) continue
      const key = r.question.subCategory?.trim() || '기타'
      const entry = bySub.get(key) ?? { myCorrect: 0, myTotal: 0, peerCorrect: 0, peerTotal: 0 }
      entry.peerTotal++
      if (r.isCorrect) entry.peerCorrect++
      if (r.sessionId === sessionId) {
        entry.myTotal++
        if (r.isCorrect) entry.myCorrect++
      }
      bySub.set(key, entry)
    }
    const subCategories: SubCategoryStat[] = Array.from(bySub.entries())
      .filter(([, v]) => v.myTotal > 0)
      .map(([subCategory, v]) => ({
        subCategory,
        myCorrect: v.myCorrect,
        myTotal: v.myTotal,
        myRate: Math.round((v.myCorrect / v.myTotal) * 100),
        peerRate: v.peerTotal > 0 ? Math.round((v.peerCorrect / v.peerTotal) * 100) : null,
      }))
      .sort((a, b) => b.myTotal - a.myTotal)

    // 문항별 O/X
    const oxItems: QuestionOxItem[] = myDomainResponses.map((r) => ({
      subCategory: r.question.subCategory?.trim() || '기타',
      summary: (questionTextMap.get(r.questionId) ?? '').slice(0, 60),
      correct: r.isCorrect,
    }))

    const graded = myDomainResponses.filter((r) => r.isCorrect !== null)
    const correctCount = graded.filter((r) => r.isCorrect === true).length

    // 영역별 소요 시간 (문항 timeSpentSec 합)
    const myTime = myDomainResponses
      .map((r) => r.timeSpentSec)
      .filter((t): t is number => t !== null)
    const myDomainTime = myTime.length ? myTime.reduce((a, b) => a + b, 0) : null

    const peerTimeBySession = new Map<string, number>()
    for (const r of allResponses) {
      if (r.question.domain !== domain || r.timeSpentSec === null) continue
      peerTimeBySession.set(r.sessionId, (peerTimeBySession.get(r.sessionId) ?? 0) + r.timeSpentSec)
    }
    const peerDomainTimes = Array.from(peerTimeBySession.values())

    const assessedKey = domain.toLowerCase() as keyof AssessedLevelsJson
    const domainLevel =
      assessed?.[assessedKey] ?? (myDomainScore !== null ? scoreToLevel(myDomainScore) : 1)
    const levelInfo = getLevelInfo(domainLevel)

    domains.push({
      domain,
      score: myDomainScore,
      level: domainLevel,
      cefr: levelInfo.cefr,
      levelNameKo: levelInfo.nameKo,
      correctCount,
      gradedCount: graded.length,
      correctRate: graded.length > 0 ? Math.round((correctCount / graded.length) * 100) : null,
      peerAvgScore: avg(peerDomainScores) !== null ? Math.round(avg(peerDomainScores) as number) : null,
      rankPercent: myDomainScore !== null ? rankPercent(myDomainScore, peerDomainScores) : null,
      timeSpentSec: myDomainTime,
      peerAvgTimeSec: avg(peerDomainTimes) !== null ? Math.round(avg(peerDomainTimes) as number) : null,
      subCategories,
      oxItems,
    })
  }

  return {
    sessionId,
    generatedAt: new Date().toISOString(),
    academyName: academy?.businessName ?? academy?.name ?? null,
    student: {
      name: session.student.user.name,
      className: session.student.class?.name ?? null,
      currentLevel: session.student.currentLevel,
      grade: session.student.grade,
    },
    test: {
      title: session.test.title,
      type: session.test.type,
      isAdaptive: session.test.isAdaptive,
      domain: session.test.domain,
    },
    completedAt: session.completedAt?.toISOString() ?? null,
    totalScore: myScore,
    overallLevel,
    overallCefr: overallInfo.cefr,
    overallNameKo: overallInfo.nameKo,
    overallRankPercent: myScore !== null ? rankPercent(myScore, allScores) : null,
    peerCount: allScores.length,
    peerAvgScore: avg(allScores) !== null ? Math.round(avg(allScores) as number) : null,
    totalDurationSec: myDuration,
    peerAvgDurationSec: avg(peerDurations) !== null ? Math.round(avg(peerDurations) as number) : null,
    distribution,
    domains,
  }
}

/** 저장된 결과표 스냅샷 조회 */
export async function findSavedTestResultReport(sessionId: string): Promise<TestResultReportSnapshot | null> {
  const saved = await prisma.report.findFirst({
    where: {
      type: TEST_RESULT_REPORT_TYPE,
      dataJson: { path: ['metadata', 'sessionId'], equals: sessionId },
    },
    orderBy: { createdAt: 'desc' },
  })
  if (!saved) return null
  return saved.dataJson as unknown as TestResultReportSnapshot
}
