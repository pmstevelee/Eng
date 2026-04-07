import { prisma } from '@/lib/prisma/client'
import { QuestionDomain } from '@/generated/prisma'

// ── Types ──────────────────────────────────────────────────────────────────────

export type WeaknessAnalysis = {
  domainScores: {
    grammar: number
    vocabulary: number
    reading: number
    writing: number
  }
  weakestDomain: QuestionDomain
  strongestDomain: QuestionDomain
  weakCategories: Array<{
    domain: QuestionDomain
    category: string
    accuracy: number
  }>
  reviewDueCount: number
  currentLevel: number
}

type MissionType =
  | 'VOCAB_QUIZ'
  | 'WEAKNESS_DRILL'
  | 'REVIEW_MISSION'
  | 'BALANCE_PRACTICE'
  | 'CHALLENGE'
  | 'MINI_WRITING'

type MissionConfig = {
  type: MissionType
  count: number
  xpReward: number
}

export type MissionItem = {
  id: string
  type: string
  title: string
  description: string
  domain: string | null
  subCategory: string | null
  questionIds: string[]
  questionCount: number
  difficulty: number
  status: 'AVAILABLE' | 'LOCKED'
  completedAt: null
  correctCount: number
  xpReward: number
  order: number
  reason: string
}

type SelectResult = {
  questionIds: string[]
  domain: QuestionDomain | null
  subCategory: string | null
  reason: string
}

// ── Constants ──────────────────────────────────────────────────────────────────

const ALL_DOMAINS: QuestionDomain[] = ['GRAMMAR', 'VOCABULARY', 'READING', 'WRITING']

// ── Internal helpers ───────────────────────────────────────────────────────────

async function fetchQuestions(params: {
  domain?: QuestionDomain
  subCategory?: string
  minDifficulty: number
  maxDifficulty: number
  contentType?: string
  studentId: string
  excludeIds: string[]
  take: number
  excludeDays?: number
}): Promise<string[]> {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - (params.excludeDays ?? 30))

  const rows = await prisma.question.findMany({
    where: {
      ...(params.domain ? { domain: params.domain } : {}),
      ...(params.subCategory ? { subCategory: params.subCategory } : {}),
      difficulty: { gte: params.minDifficulty, lte: params.maxDifficulty },
      ...(params.contentType
        ? { contentJson: { path: ['type'], equals: params.contentType } }
        : {}),
      ...(params.excludeIds.length > 0 ? { id: { notIn: params.excludeIds } } : {}),
      NOT: {
        responses: {
          some: {
            isCorrect: true,
            createdAt: { gte: cutoff },
            session: { studentId: params.studentId },
          },
        },
      },
    },
    select: { id: true },
    take: params.take * 4,
  })

  return [...rows].sort(() => Math.random() - 0.5).slice(0, params.take).map((r) => r.id)
}

function missionTitle(type: MissionType, subCategory: string | null): string {
  switch (type) {
    case 'VOCAB_QUIZ':
      return '단어 퀴즈'
    case 'WEAKNESS_DRILL':
      return subCategory ? `약점 보강: ${subCategory}` : '약점 보강'
    case 'REVIEW_MISSION':
      return '오늘의 복습'
    case 'BALANCE_PRACTICE':
      return '균형 연습'
    case 'CHALLENGE':
      return '도전 문제'
    case 'MINI_WRITING':
      return '미니 쓰기 연습'
  }
}

function missionDescription(type: MissionType): string {
  switch (type) {
    case 'VOCAB_QUIZ':
      return '어휘력은 매일 조금씩 키워야 해요'
    case 'WEAKNESS_DRILL':
      return '가장 약한 부분을 집중 연습합니다'
    case 'REVIEW_MISSION':
      return '복습은 기억을 오래 유지시켜 줘요'
    case 'BALANCE_PRACTICE':
      return '모든 영역을 골고루 연습해요'
    case 'CHALLENGE':
      return '한 단계 더 높은 난이도에 도전해요'
    case 'MINI_WRITING':
      return '영어 쓰기 실력을 키워요'
  }
}

// ── Exported functions ─────────────────────────────────────────────────────────

/**
 * 학생 약점 분석
 * 1) SkillAssessment 최근 20개 → 영역별 평균
 * 2) question_responses 최근 60일 → 하위 카테고리별 정답률
 * 3) 오늘 복습 예정 문제 수
 */
export async function analyzeStudentWeakness(studentId: string): Promise<WeaknessAnalysis> {
  const now = new Date()
  const sixtyDaysAgo = new Date()
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60)

  const [student, assessments, responses, reviewDueCount] = await Promise.all([
    prisma.student.findUnique({
      where: { id: studentId },
      select: { currentLevel: true },
    }),
    prisma.skillAssessment.findMany({
      where: { studentId },
      orderBy: { assessedAt: 'desc' },
      take: 20,
      select: { domain: true, score: true },
    }),
    prisma.questionResponse.findMany({
      where: {
        session: { studentId },
        createdAt: { gte: sixtyDaysAgo },
      },
      select: {
        isCorrect: true,
        question: { select: { domain: true, subCategory: true } },
      },
    }),
    prisma.questionResponse.count({
      where: {
        isMastered: false,
        reviewDueAt: { lte: now },
        session: { studentId },
      },
    }),
  ])

  // 영역별 평균 (SkillAssessment 기반)
  const domainAvg: Record<string, number> = {}
  for (const domain of ALL_DOMAINS) {
    const relevant = assessments.filter((a) => a.domain === domain)
    domainAvg[domain] =
      relevant.length > 0
        ? Math.round(relevant.reduce((s, a) => s + (a.score ?? 0), 0) / relevant.length)
        : 50
  }

  const domainScores = {
    grammar: domainAvg['GRAMMAR'],
    vocabulary: domainAvg['VOCABULARY'],
    reading: domainAvg['READING'],
    writing: domainAvg['WRITING'],
  }

  let weakestDomain: QuestionDomain = 'GRAMMAR'
  let strongestDomain: QuestionDomain = 'GRAMMAR'
  let lowestScore = Infinity
  let highestScore = -Infinity

  for (const domain of ALL_DOMAINS) {
    const score = domainAvg[domain]
    if (score < lowestScore) {
      lowestScore = score
      weakestDomain = domain
    }
    if (score > highestScore) {
      highestScore = score
      strongestDomain = domain
    }
  }

  // 하위 카테고리별 정답률 (question_responses 최근 60일)
  const catMap = new Map<
    string,
    { domain: QuestionDomain; category: string; total: number; correct: number }
  >()
  for (const r of responses) {
    const cat = r.question.subCategory
    if (!cat) continue
    const key = `${r.question.domain}:${cat}`
    const entry = catMap.get(key) ?? {
      domain: r.question.domain as QuestionDomain,
      category: cat,
      total: 0,
      correct: 0,
    }
    entry.total++
    if (r.isCorrect) entry.correct++
    catMap.set(key, entry)
  }

  const weakCategories = Array.from(catMap.values())
    .filter((c) => c.total >= 2)
    .map((c) => ({
      domain: c.domain,
      category: c.category,
      accuracy: Math.round((c.correct / c.total) * 100),
    }))
    .sort((a, b) => a.accuracy - b.accuracy)

  return {
    domainScores,
    weakestDomain,
    strongestDomain,
    weakCategories,
    reviewDueCount,
    currentLevel: student?.currentLevel ?? 1,
  }
}

/**
 * 미션 유형별 문제 선별
 * 공통: 최근 30일 내 정답 처리한 문제 제외 (부족 시 60일로 완화)
 */
export async function selectMissionQuestions(
  studentId: string,
  analysis: WeaknessAnalysis,
  missionType: MissionType,
  count: number,
  usedIds: string[] = [],
): Promise<SelectResult> {
  const { currentLevel, weakCategories, weakestDomain, strongestDomain } = analysis

  // REVIEW_MISSION: 스페이스드 리피티션 기반
  if (missionType === 'REVIEW_MISSION') {
    const now = new Date()
    const responses = await prisma.questionResponse.findMany({
      where: {
        isMastered: false,
        reviewDueAt: { lte: now },
        session: { studentId },
      },
      select: { question: { select: { id: true } } },
      orderBy: { reviewDueAt: 'asc' },
      take: count * 3,
    })

    const seen = new Set<string>(usedIds)
    const questionIds: string[] = []
    for (const r of responses) {
      const qId = r.question.id
      if (!seen.has(qId)) {
        seen.add(qId)
        questionIds.push(qId)
        if (questionIds.length >= count) break
      }
    }
    if (questionIds.length < count) {
      console.log(
        `[MissionEngine] REVIEW_MISSION: 문제 부족 - 요청 ${count}개, 실제 ${questionIds.length}개`,
      )
    }
    return { questionIds, domain: null, subCategory: null, reason: '오늘 복습해야 할 문제예요' }
  }

  // WEAKNESS_DRILL: 약점 카테고리 상위 2개에서 선택
  if (missionType === 'WEAKNESS_DRILL') {
    const topWeak = weakCategories.slice(0, 2)
    const questionIds: string[] = []

    for (const weakCat of topWeak) {
      if (questionIds.length >= count) break
      const perCat = Math.ceil(count / Math.max(topWeak.length, 1))
      const ids = await fetchQuestions({
        domain: weakCat.domain,
        subCategory: weakCat.category,
        minDifficulty: Math.max(1, currentLevel - 1),
        maxDifficulty: currentLevel,
        studentId,
        excludeIds: [...usedIds, ...questionIds],
        take: perCat,
      })
      questionIds.push(...ids)
    }

    // Fallback: subCategory 없이 weakest domain, 60일로 완화
    if (questionIds.length < count) {
      const domain = topWeak[0]?.domain ?? weakestDomain
      const ids = await fetchQuestions({
        domain,
        minDifficulty: Math.max(1, currentLevel - 1),
        maxDifficulty: currentLevel,
        studentId,
        excludeIds: [...usedIds, ...questionIds],
        take: count - questionIds.length,
        excludeDays: 60,
      })
      questionIds.push(...ids)
    }

    if (questionIds.length < count) {
      console.log(
        `[MissionEngine] WEAKNESS_DRILL: 문제 부족 - 요청 ${count}개, 실제 ${questionIds.length}개`,
      )
    }

    const topCat = topWeak[0]
    return {
      questionIds: questionIds.slice(0, count),
      domain: topCat?.domain ?? weakestDomain,
      subCategory: topCat?.category ?? null,
      reason: topCat
        ? `${topCat.category} 정답률이 ${topCat.accuracy}%로 낮아요`
        : '약점 영역을 집중 연습합니다',
    }
  }

  // BALANCE_PRACTICE: 각 영역에서 1개씩
  if (missionType === 'BALANCE_PRACTICE') {
    const questionIds: string[] = []
    for (const domain of ALL_DOMAINS) {
      if (questionIds.length >= count) break
      const ids = await fetchQuestions({
        domain,
        minDifficulty: currentLevel,
        maxDifficulty: currentLevel,
        studentId,
        excludeIds: [...usedIds, ...questionIds],
        take: 1,
      })
      questionIds.push(...ids)
    }
    if (questionIds.length < count) {
      console.log(
        `[MissionEngine] BALANCE_PRACTICE: 문제 부족 - 요청 ${count}개, 실제 ${questionIds.length}개`,
      )
    }
    return {
      questionIds: questionIds.slice(0, count),
      domain: null,
      subCategory: null,
      reason: '모든 영역을 균형 있게 연습해요',
    }
  }

  // CHALLENGE: 가장 강한 영역에서 레벨+1
  if (missionType === 'CHALLENGE') {
    const targetLevel = Math.min(10, currentLevel + 1)
    let questionIds = await fetchQuestions({
      domain: strongestDomain,
      minDifficulty: targetLevel,
      maxDifficulty: targetLevel,
      studentId,
      excludeIds: usedIds,
      take: count,
    })

    // Fallback: 60일로 완화
    if (questionIds.length < count) {
      const more = await fetchQuestions({
        domain: strongestDomain,
        minDifficulty: targetLevel,
        maxDifficulty: targetLevel,
        studentId,
        excludeIds: [...usedIds, ...questionIds],
        take: count - questionIds.length,
        excludeDays: 60,
      })
      questionIds = [...questionIds, ...more]
    }
    if (questionIds.length < count) {
      console.log(
        `[MissionEngine] CHALLENGE: 문제 부족 - 요청 ${count}개, 실제 ${questionIds.length}개`,
      )
    }
    return {
      questionIds: questionIds.slice(0, count),
      domain: strongestDomain,
      subCategory: null,
      reason: '가장 강한 영역에서 한 단계 더 도전해요',
    }
  }

  // VOCAB_QUIZ: VOCABULARY 객관식
  if (missionType === 'VOCAB_QUIZ') {
    let questionIds = await fetchQuestions({
      domain: 'VOCABULARY',
      minDifficulty: currentLevel,
      maxDifficulty: currentLevel,
      contentType: 'multiple_choice',
      studentId,
      excludeIds: usedIds,
      take: count,
    })

    // Fallback: type 필터 제거, 60일 완화, 난이도 범위 확장
    if (questionIds.length < count) {
      const more = await fetchQuestions({
        domain: 'VOCABULARY',
        minDifficulty: Math.max(1, currentLevel - 1),
        maxDifficulty: Math.min(10, currentLevel + 1),
        studentId,
        excludeIds: [...usedIds, ...questionIds],
        take: count - questionIds.length,
        excludeDays: 60,
      })
      questionIds = [...questionIds, ...more]
    }
    if (questionIds.length < count) {
      console.log(
        `[MissionEngine] VOCAB_QUIZ: 문제 부족 - 요청 ${count}개, 실제 ${questionIds.length}개`,
      )
    }
    return {
      questionIds: questionIds.slice(0, count),
      domain: 'VOCABULARY',
      subCategory: null,
      reason: '어휘력은 매일 조금씩 키워야 해요',
    }
  }

  // MINI_WRITING: WRITING 영역 (Level 7+ 전용)
  if (missionType === 'MINI_WRITING') {
    const questionIds = await fetchQuestions({
      domain: 'WRITING',
      minDifficulty: Math.max(1, currentLevel - 1),
      maxDifficulty: Math.min(10, currentLevel + 1),
      studentId,
      excludeIds: usedIds,
      take: count,
    })
    if (questionIds.length < count) {
      console.log(
        `[MissionEngine] MINI_WRITING: 문제 부족 - 요청 ${count}개, 실제 ${questionIds.length}개`,
      )
    }
    return {
      questionIds: questionIds.slice(0, count),
      domain: 'WRITING',
      subCategory: null,
      reason: '쓰기 실력을 한 단계 끌어올려요',
    }
  }

  return { questionIds: [], domain: null, subCategory: null, reason: '' }
}

/**
 * 학생 레벨 맞춤형 일일 미션 생성 (메인 함수)
 */
export async function buildDailyMissions(studentId: string) {
  const analysis = await analyzeStudentWeakness(studentId)
  const { currentLevel, reviewDueCount } = analysis

  let missionConfigs: MissionConfig[]

  if (currentLevel <= 2) {
    // Level 1~2 (입문/기초): 3미션, 4문제, 쉬운 구성
    missionConfigs = [
      { type: 'VOCAB_QUIZ', count: 1, xpReward: 8 },
      { type: 'WEAKNESS_DRILL', count: 2, xpReward: 20 },
    ]
    if (reviewDueCount > 0) {
      missionConfigs.push({ type: 'REVIEW_MISSION', count: 1, xpReward: 15 })
    }
  } else if (currentLevel <= 4) {
    // Level 3~4 (초급): 4미션, 6문제
    missionConfigs = [
      { type: 'VOCAB_QUIZ', count: 1, xpReward: 8 },
      { type: 'REVIEW_MISSION', count: 2, xpReward: 30 },
      { type: 'WEAKNESS_DRILL', count: 3, xpReward: 30 },
      { type: 'BALANCE_PRACTICE', count: 2, xpReward: 20 },
    ]
    if (reviewDueCount === 0) {
      missionConfigs = missionConfigs.map((c) =>
        c.type === 'REVIEW_MISSION' ? { ...c, type: 'BALANCE_PRACTICE' as MissionType } : c,
      )
    }
  } else if (currentLevel <= 6) {
    // Level 5~6 (중급 입문): 4미션, 7문제
    missionConfigs = [
      { type: 'VOCAB_QUIZ', count: 1, xpReward: 8 },
      { type: 'REVIEW_MISSION', count: 2, xpReward: 30 },
      { type: 'WEAKNESS_DRILL', count: 3, xpReward: 30 },
      { type: 'BALANCE_PRACTICE', count: 2, xpReward: 20 },
      { type: 'CHALLENGE', count: 1, xpReward: 25 },
    ]
    if (reviewDueCount === 0) {
      missionConfigs = missionConfigs.map((c) =>
        c.type === 'REVIEW_MISSION' ? { ...c, type: 'BALANCE_PRACTICE' as MissionType } : c,
      )
    }
  } else if (currentLevel <= 8) {
    // Level 7~8 (중급~중상급): 5미션, 9문제
    missionConfigs = [
      { type: 'REVIEW_MISSION', count: 2, xpReward: 30 },
      { type: 'WEAKNESS_DRILL', count: 3, xpReward: 30 },
      { type: 'BALANCE_PRACTICE', count: 2, xpReward: 20 },
      { type: 'CHALLENGE', count: 1, xpReward: 25 },
      { type: 'MINI_WRITING', count: 1, xpReward: 30 },
    ]
    if (reviewDueCount === 0) {
      missionConfigs = missionConfigs.map((c) =>
        c.type === 'REVIEW_MISSION' ? { ...c, type: 'BALANCE_PRACTICE' as MissionType } : c,
      )
    }
  } else {
    // Level 9~10 (상급): 5미션, 10문제+에세이
    missionConfigs = [
      { type: 'REVIEW_MISSION', count: 2, xpReward: 30 },
      { type: 'WEAKNESS_DRILL', count: 3, xpReward: 30 },
      { type: 'BALANCE_PRACTICE', count: 2, xpReward: 20 },
      { type: 'CHALLENGE', count: 2, xpReward: 30 },
      { type: 'MINI_WRITING', count: 1, xpReward: 35 },
    ]
    if (reviewDueCount === 0) {
      missionConfigs = missionConfigs.map((c) =>
        c.type === 'REVIEW_MISSION' ? { ...c, type: 'BALANCE_PRACTICE' as MissionType } : c,
      )
    }
  }

  const usedIds: string[] = []
  const missionsJson: MissionItem[] = []

  for (let i = 0; i < missionConfigs.length; i++) {
    const config = missionConfigs[i]
    const result = await selectMissionQuestions(
      studentId,
      analysis,
      config.type,
      config.count,
      usedIds,
    )
    usedIds.push(...result.questionIds)

    missionsJson.push({
      id: `m-${i}`,
      type: config.type,
      title: missionTitle(config.type, result.subCategory),
      description: missionDescription(config.type),
      domain: result.domain,
      subCategory: result.subCategory,
      questionIds: result.questionIds,
      questionCount: result.questionIds.length,
      difficulty: config.type === 'CHALLENGE' ? Math.min(10, currentLevel + 1) : currentLevel,
      status: i === 0 ? 'AVAILABLE' : 'LOCKED',
      completedAt: null,
      correctCount: 0,
      xpReward: config.xpReward,
      order: i,
      reason: result.reason,
    })
  }

  const allQuestionIds = missionsJson.flatMap((m) => m.questionIds)

  return prisma.dailyMission.create({
    data: {
      studentId,
      missionDate: new Date(),
      questionIds: allQuestionIds,
      domainFocus: analysis.weakestDomain,
      isCompleted: false,
      missionsJson: missionsJson as object[],
      totalMissions: missionsJson.length,
      status: 'GENERATED',
    },
  })
}

/**
 * 오늘의 미션 조회 (없으면 새로 생성)
 * generateOrGetDailyMission()의 대체 함수
 */
export async function getOrCreateTodayMission(studentId: string) {
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const existing = await prisma.dailyMission.findFirst({
    where: { studentId, missionDate: { gte: todayStart } },
  })
  if (existing) return existing

  try {
    return await buildDailyMissions(studentId)
  } catch {
    // 동시 요청으로 이미 생성된 경우 재조회
    const fallback = await prisma.dailyMission.findFirst({
      where: { studentId, missionDate: { gte: todayStart } },
    })
    if (fallback) return fallback
    throw new Error('미션 생성에 실패했습니다.')
  }
}
