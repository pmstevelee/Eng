import { prisma } from '@/lib/prisma/client'
import { QuestionDomain } from '@/generated/prisma'
import { kstDateTime, todayKst } from '@/lib/attendance/time'
import { getAcademyWordLearningSettings } from '@/lib/words/access-guard'
import { DEFAULT_DAILY_GRAMMAR_QUESTIONS } from '@/lib/words/settings'

// ── Types ──────────────────────────────────────────────────────────────────────

export type WeaknessAnalysis = {
  domainScores: {
    grammar: number
    vocabulary: number
    reading: number
    listening: number
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
  academyId: string | null
}

type MissionType =
  | 'VOCAB_QUIZ'
  | 'WEAKNESS_DRILL'
  | 'REVIEW_MISSION'
  | 'BALANCE_PRACTICE'
  | 'CHALLENGE'
  | 'MINI_WRITING'
  | 'LISTENING_DRILL'

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

const ALL_DOMAINS: QuestionDomain[] = ['GRAMMAR', 'VOCABULARY', 'READING', 'LISTENING', 'WRITING']

// 오늘의 학습에서 어휘는 '오늘의 단어'(단어 DB 10,000+개)가 담당하고,
// 문제은행 미션은 문법에 집중한다. (어휘 문제은행은 수가 적어 반복 출제됨)
const MISSION_DOMAINS: QuestionDomain[] = ['GRAMMAR']
// 오답 복습은 시험·미션에서 틀린 문법/어휘 문제 모두 대상
const REVIEW_DOMAINS: QuestionDomain[] = ['GRAMMAR', 'VOCABULARY']

// ── Internal helpers ───────────────────────────────────────────────────────────

// Fisher-Yates 셔플 (sort(() => Math.random() - 0.5)는 분포가 균등하지 않음)
function shuffle<T>(array: T[]): T[] {
  const result = [...array]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

// 최근 days일 내 학생에게 출제된(정답 여부 무관) 문제 ID 집합
function idsUsedWithinDays(
  history: { missionDate: Date; questionIds: unknown }[],
  days: number,
): string[] {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  const ids = new Set<string>()
  for (const m of history) {
    if (m.missionDate < cutoff) continue
    for (const id of (m.questionIds as string[] | null) ?? []) ids.add(id)
  }
  return Array.from(ids)
}

async function fetchQuestions(params: {
  domain?: QuestionDomain
  subCategory?: string
  minDifficulty: number
  maxDifficulty: number
  contentType?: string
  excludeIds: string[]
  take: number
}): Promise<string[]> {
  const rows = await prisma.question.findMany({
    where: {
      isActive: true,
      ...(params.domain ? { domain: params.domain } : {}),
      ...(params.subCategory ? { subCategory: params.subCategory } : {}),
      difficulty: { gte: params.minDifficulty, lte: params.maxDifficulty },
      ...(params.contentType
        ? { contentJson: { path: ['type'], equals: params.contentType } }
        : {}),
      ...(params.excludeIds.length > 0 ? { id: { notIn: params.excludeIds } } : {}),
    },
    select: { id: true },
  })

  return shuffle(rows.map((r) => r.id)).slice(0, params.take)
}

function missionTitle(type: MissionType, subCategory: string | null): string {
  switch (type) {
    case 'VOCAB_QUIZ':
      return '단어 퀴즈'
    case 'WEAKNESS_DRILL':
      return subCategory ? `약점 보강: ${subCategory}` : '약점 보강'
    case 'REVIEW_MISSION':
      return '오답 복습'
    case 'BALANCE_PRACTICE':
      return '문법 실력 다지기'
    case 'CHALLENGE':
      return '도전 문제'
    case 'MINI_WRITING':
      return '미니 쓰기 연습'
    case 'LISTENING_DRILL':
      return '듣기 연습'
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
      return '내 레벨의 문법을 탄탄하게 다져요'
    case 'CHALLENGE':
      return '한 단계 높은 문법에 도전해요'
    case 'MINI_WRITING':
      return '영어 쓰기 실력을 키워요'
    case 'LISTENING_DRILL':
      return '영어 듣기 능력을 키워요'
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

  const [student, assessments, responses, responseDueCount, wrongNoteDueCount] = await Promise.all([
    prisma.student.findUnique({
      where: { id: studentId },
      select: { currentLevel: true, user: { select: { academyId: true } } },
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
        question: { domain: { in: REVIEW_DOMAINS } },
      },
    }),
    prisma.questionReview.count({
      where: { studentId, isMastered: false, nextReviewAt: { lte: now } },
    }),
  ])
  const reviewDueCount = responseDueCount + wrongNoteDueCount

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
    listening: domainAvg['LISTENING'],
    writing: domainAvg['WRITING'],
  }

  // 오늘의 미션은 문법/단어 문제로만 구성하므로 가중치 비교도 두 영역으로 한정
  let weakestDomain: QuestionDomain = 'GRAMMAR'
  let strongestDomain: QuestionDomain = 'GRAMMAR'
  let lowestScore = Infinity
  let highestScore = -Infinity

  for (const domain of MISSION_DOMAINS) {
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
    .filter((c) => c.total >= 2 && MISSION_DOMAINS.includes(c.domain))
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
    academyId: student?.user.academyId ?? null,
  }
}

/**
 * 미션 유형별 문제 선별
 * 공통: 최근 30일 내 출제된 문제 제외 (부족 시 최근 7일만 제외하도록 완화)
 */
export async function selectMissionQuestions(
  studentId: string,
  analysis: WeaknessAnalysis,
  missionType: MissionType,
  count: number,
  usedIds: string[] = [],
  recentIds: { strict: string[]; relaxed: string[] } = { strict: [], relaxed: [] },
): Promise<SelectResult> {
  const { currentLevel, weakCategories, weakestDomain, strongestDomain } = analysis

  // REVIEW_MISSION: ① 미션 오답노트(QuestionReview) → ② 시험 응답 스페이스드 리피티션
  // (문법/어휘 영역만, 복습 목적상 최근 출제 제외는 적용하지 않음)
  if (missionType === 'REVIEW_MISSION') {
    const now = new Date()
    const [wrongNotes, responses] = await Promise.all([
      prisma.questionReview.findMany({
        where: {
          studentId,
          isMastered: false,
          nextReviewAt: { lte: now },
          question: { isActive: true, domain: { in: REVIEW_DOMAINS } },
        },
        select: { questionId: true },
        orderBy: [{ wrongCount: 'desc' }, { nextReviewAt: 'asc' }],
        take: count * 2,
      }),
      prisma.questionResponse.findMany({
        where: {
          isMastered: false,
          reviewDueAt: { lte: now },
          session: { studentId },
          question: { domain: { in: REVIEW_DOMAINS } },
        },
        select: { question: { select: { id: true } } },
        orderBy: { reviewDueAt: 'asc' },
        take: count * 3,
      }),
    ])

    const seen = new Set<string>(usedIds)
    const questionIds: string[] = []
    for (const qId of [...wrongNotes.map((w) => w.questionId), ...responses.map((r) => r.question.id)]) {
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
    return { questionIds, domain: null, subCategory: null, reason: '지난번에 틀린 문제를 다시 풀어요' }
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
        excludeIds: [...usedIds, ...questionIds, ...recentIds.strict],
        take: perCat,
      })
      questionIds.push(...ids)
    }

    // Fallback: subCategory 없이 weakest domain, 최근 출제 제외 범위를 7일로 완화
    if (questionIds.length < count) {
      const domain = topWeak[0]?.domain ?? weakestDomain
      const ids = await fetchQuestions({
        domain,
        minDifficulty: Math.max(1, currentLevel - 1),
        maxDifficulty: currentLevel,
        excludeIds: [...usedIds, ...questionIds, ...recentIds.relaxed],
        take: count - questionIds.length,
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

  // BALANCE_PRACTICE: 현재 레벨 문법 문제로 실력 다지기 (부족 시 ±1 레벨, 최근 출제 제외 완화)
  if (missionType === 'BALANCE_PRACTICE') {
    let questionIds = await fetchQuestions({
      domain: 'GRAMMAR',
      minDifficulty: currentLevel,
      maxDifficulty: currentLevel,
      excludeIds: [...usedIds, ...recentIds.strict],
      take: count,
    })
    if (questionIds.length < count) {
      const more = await fetchQuestions({
        domain: 'GRAMMAR',
        minDifficulty: Math.max(1, currentLevel - 1),
        maxDifficulty: Math.min(10, currentLevel + 1),
        excludeIds: [...usedIds, ...questionIds, ...recentIds.relaxed],
        take: count - questionIds.length,
      })
      questionIds = [...questionIds, ...more]
    }
    if (questionIds.length < count) {
      console.log(
        `[MissionEngine] BALANCE_PRACTICE: 문제 부족 - 요청 ${count}개, 실제 ${questionIds.length}개`,
      )
    }
    return {
      questionIds: questionIds.slice(0, count),
      domain: 'GRAMMAR',
      subCategory: null,
      reason: '내 레벨의 문법을 탄탄하게 다져요',
    }
  }

  // CHALLENGE: 가장 강한 영역에서 레벨+1
  if (missionType === 'CHALLENGE') {
    const targetLevel = Math.min(10, currentLevel + 1)
    let questionIds = await fetchQuestions({
      domain: strongestDomain,
      minDifficulty: targetLevel,
      maxDifficulty: targetLevel,
      excludeIds: [...usedIds, ...recentIds.strict],
      take: count,
    })

    // Fallback: 최근 출제 제외 범위를 7일로 완화
    if (questionIds.length < count) {
      const more = await fetchQuestions({
        domain: strongestDomain,
        minDifficulty: targetLevel,
        maxDifficulty: targetLevel,
        excludeIds: [...usedIds, ...questionIds, ...recentIds.relaxed],
        take: count - questionIds.length,
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
      excludeIds: [...usedIds, ...recentIds.strict],
      take: count,
    })

    // Fallback: type 필터 제거, 난이도 범위 확장, 최근 출제 제외 범위를 7일로 완화
    if (questionIds.length < count) {
      const more = await fetchQuestions({
        domain: 'VOCABULARY',
        minDifficulty: Math.max(1, currentLevel - 1),
        maxDifficulty: Math.min(10, currentLevel + 1),
        excludeIds: [...usedIds, ...questionIds, ...recentIds.relaxed],
        take: count - questionIds.length,
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
      excludeIds: [...usedIds, ...recentIds.strict],
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

  // LISTENING_DRILL: 오디오가 등록된 듣기 문제 (무제한 재생)
  if (missionType === 'LISTENING_DRILL') {
    // 오디오 URL이 있는 듣기 문제만 선택
    const listeningRows = await prisma.question.findMany({
      where: {
        domain: 'LISTENING',
        isActive: true,
        difficulty: { gte: Math.max(1, currentLevel - 1), lte: Math.min(10, currentLevel + 1) },
        ...(usedIds.length > 0 ? { id: { notIn: usedIds } } : {}),
      },
      select: { id: true, contentJson: true },
      take: count * 4,
    })

    // audio_url이 실제로 존재하는 문제만 필터
    const withAudio = listeningRows.filter((q) => {
      const c = q.contentJson as { audio_url?: string }
      return c?.audio_url
    })
    const questionIds = [...withAudio]
      .sort(() => Math.random() - 0.5)
      .slice(0, count)
      .map((r) => r.id)

    if (questionIds.length < count) {
      console.log(
        `[MissionEngine] LISTENING_DRILL: 문제 부족 - 요청 ${count}개, 실제 ${questionIds.length}개`,
      )
    }
    return {
      questionIds,
      domain: 'LISTENING',
      subCategory: null,
      reason: '영어 듣기 능력을 키워요',
    }
  }

  return { questionIds: [], domain: null, subCategory: null, reason: '' }
}

const XP_PER_QUESTION: Record<MissionType, number> = {
  REVIEW_MISSION: 15,
  WEAKNESS_DRILL: 10,
  BALANCE_PRACTICE: 10,
  CHALLENGE: 12,
  VOCAB_QUIZ: 8,
  MINI_WRITING: 10,
  LISTENING_DRILL: 10,
}

/**
 * 문법 미션 구성: 총 total문제를 오답 복습 → 약점 보강 → 실력 다지기 → 도전 순으로 배분.
 * - 오답 복습: 복습 대상이 있을 때 최대 40%
 * - 도전(레벨+1): Level 5 이상에서 약 20% (최소 1문제)
 * - 나머지: 약점 보강 60%, 실력 다지기 40%
 */
export function planGrammarMissions(total: number, level: number, reviewDue: number): MissionConfig[] {
  const review = Math.min(reviewDue, Math.ceil(total * 0.4))
  const challenge = level >= 5 && total - review >= 3 ? Math.max(1, Math.round(total * 0.2)) : 0
  const remaining = Math.max(0, total - review - challenge)
  const weakness = Math.ceil(remaining * 0.6)
  const balance = remaining - weakness

  const plan: { type: MissionType; count: number }[] = [
    { type: 'REVIEW_MISSION', count: review },
    { type: 'WEAKNESS_DRILL', count: weakness },
    { type: 'BALANCE_PRACTICE', count: balance },
    { type: 'CHALLENGE', count: challenge },
  ]
  return plan
    .filter((m) => m.count > 0)
    .map((m) => ({ ...m, xpReward: m.count * XP_PER_QUESTION[m.type] }))
}

/**
 * 학생 레벨 맞춤형 일일 미션 생성 (메인 함수)
 */
export async function buildDailyMissions(studentId: string) {
  const analysis = await analyzeStudentWeakness(studentId)
  const { currentLevel, reviewDueCount } = analysis

  // 문법 문제 수는 학원 설정(settingsJson.wordLearning.dailyGrammarQuestions, 기본 5)
  const grammarCount = analysis.academyId
    ? (await getAcademyWordLearningSettings(analysis.academyId)).dailyGrammarQuestions
    : DEFAULT_DAILY_GRAMMAR_QUESTIONS
  const missionConfigs = planGrammarMissions(grammarCount, currentLevel, reviewDueCount)

  // 최근 60일간 학생에게 실제로 출제된 문제 이력 (정답 여부와 무관하게 반복 출제 방지에 사용)
  const sixtyDaysAgo = new Date()
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60)
  const missionHistory = await prisma.dailyMission.findMany({
    where: { studentId, missionDate: { gte: sixtyDaysAgo } },
    select: { missionDate: true, questionIds: true },
  })
  const recentIds = {
    strict: idsUsedWithinDays(missionHistory, 30),
    relaxed: idsUsedWithinDays(missionHistory, 7),
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
      recentIds,
    )
    usedIds.push(...result.questionIds)
    // 문제가 하나도 선정되지 않은 미션은 빈 카드가 되지 않도록 제외
    if (result.questionIds.length === 0) continue
    const order = missionsJson.length

    missionsJson.push({
      id: `m-${order}`,
      type: config.type,
      title: missionTitle(config.type, result.subCategory),
      description: missionDescription(config.type),
      domain: result.domain,
      subCategory: result.subCategory,
      questionIds: result.questionIds,
      questionCount: result.questionIds.length,
      difficulty: config.type === 'CHALLENGE' ? Math.min(10, currentLevel + 1) : currentLevel,
      status: order === 0 ? 'AVAILABLE' : 'LOCKED',
      completedAt: null,
      correctCount: 0,
      xpReward: Math.round((config.xpReward / config.count) * result.questionIds.length),
      order,
      reason: result.reason,
    })
  }

  const allQuestionIds = missionsJson.flatMap((m) => m.questionIds)

  // missionDate는 KST 자정으로 정규화한다. 동시 요청으로 buildDailyMissions가 중복
  // 호출되어도 (studentId, missionDate) 유니크 제약이 실제로 충돌을 감지해
  // getOrCreateTodayMission의 fallback 재조회 로직이 정상 동작하도록 한다.
  // (서버가 UTC라 setHours(0)을 쓰면 KST 오전 9시가 하루 경계가 됨)
  const missionDate = kstDateTime(todayKst(), '00:00')

  return prisma.dailyMission.create({
    data: {
      studentId,
      missionDate,
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
  const todayStart = kstDateTime(todayKst(), '00:00')

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
