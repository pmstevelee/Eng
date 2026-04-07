'use server'

import { redirect } from 'next/navigation'
import { unstable_cache } from 'next/cache'
import OpenAI from 'openai'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma/client'
import { getStudentProfile } from '@/lib/ai/student-analyzer'
import { updateQuestionQuality } from '@/lib/questions/quality-updater'
import { selectAdaptiveQuestions, selectSmartDomainQuestions } from '@/lib/ai/question-selector'
import type {
  QuestionContentJson,
  QuestionDomainType,
} from '@/components/shared/question-bank-client'
import type { QuestionTag } from '@/lib/ai/question-selector'

const DOMAINS: QuestionDomainType[] = ['GRAMMAR', 'VOCABULARY', 'READING', 'WRITING']

// ── 공개 타입 ──────────────────────────────────────────────────────────────────

export type PracticeContent = {
  type: string
  question_text: string
  question_text_ko?: string
  options?: string[]
  passage?: string
  word_limit?: number
}

export type PracticeQuestion = {
  id: string
  domain: string
  difficulty: number
  content: PracticeContent
}

// 태그가 포함된 맞춤형 문제 타입
export type AdaptiveQuestion = PracticeQuestion & {
  tag: QuestionTag
  subCategory?: string | null
}

export type { QuestionTag }

// 학생 프로필 요약 (클라이언트에 전달용)
export type StudentProfileSummary = {
  currentLevel: number
  cefrLevel: string
  overallWeakest: string
  overallStrongest: string
  weakestScore: number | null
  strongestScore: number | null
  topWeakCategories: string[]
  weakCount: number
  maintainCount: number
  challengeCount: number
  readyForLevelUp: boolean
  streakDays: number
}

export type GradeResult = {
  isCorrect: boolean
  correctAnswer: string | null
  explanation: string | null
}

export type PracticeResultItem = {
  questionId: string
  domain: string
  isCorrect: boolean
}

export type WrongAnswerItem = {
  questionId: string
  domain: string
  difficulty: number
  wrongAt: string
  content: PracticeContent
}

// ── 스마트 도메인 연습 타입 ──────────────────────────────────────────────────

export type LearningMode = 'weakness' | 'balanced' | 'levelup'

export type CategoryAccuracy = {
  name: string
  correct: number
  total: number
  accuracy: number // 0~100
}

export type DomainProfileData = {
  domainScore: number | null
  currentLevel: number
  cefrLevel: string
  categories: CategoryAccuracy[]
  levelUpScore: number  // 80
  levelUpGap: number    // 80 - domainScore (양수면 부족)
  weakestCategories: string[]
  strongestCategories: string[]
}

// 스마트 도메인 문제 (subCategory 포함)
export type SmartDomainQuestion = PracticeQuestion & {
  subCategory?: string | null
}

export type SessionAdvice = {
  advice: string
  nextRecommendation: {
    mode: LearningMode
    reason: string
  }
}

// ── 내부 헬퍼 ─────────────────────────────────────────────────────────────────

// gamification.ts의 getCachedStudentRecord와 동일한 캐시 키 → 같은 캐시 엔트리 공유
const getCachedStudentRecord = (userId: string) =>
  unstable_cache(
    () =>
      prisma.user.findUnique({
        where: { id: userId, isDeleted: false },
        select: { id: true, role: true, student: { select: { id: true } } },
      }),
    ['student-record', userId],
    { revalidate: 60, tags: [`user-${userId}`] },
  )()

async function requireStudentId(): Promise<string> {
  const user = await getCurrentUser()
  if (!user || user.role !== 'STUDENT') redirect('/login')
  const dbUser = await getCachedStudentRecord(user.id)
  if (!dbUser?.student) redirect('/login')
  return dbUser.student.id
}

function sanitizeQuestion(q: {
  id: string
  domain: string
  difficulty: number
  contentJson: unknown
}): PracticeQuestion {
  const content = q.contentJson as QuestionContentJson
  return {
    id: q.id,
    domain: q.domain,
    difficulty: q.difficulty,
    content: {
      type: content.type,
      question_text: content.question_text,
      ...(content.question_text_ko ? { question_text_ko: content.question_text_ko } : {}),
      ...(content.options ? { options: content.options } : {}),
      ...(content.passage ? { passage: content.passage } : {}),
      ...(content.word_limit ? { word_limit: content.word_limit } : {}),
    },
  }
}

// ── 허브 페이지 데이터 (30초 캐싱) ───────────────────────────────────────────

const getCachedLearnHubData = (studentId: string) =>
  unstable_cache(
    async () => {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      // 3개 쿼리 병렬 실행
      const [wrongAnswerCount, skillAssessments, todayResponses] = await Promise.all([
        prisma.questionResponse.count({
          where: {
            session: { studentId, status: { in: ['COMPLETED', 'GRADED'] } },
            isCorrect: false,
            createdAt: { gte: thirtyDaysAgo },
          },
        }),
        prisma.skillAssessment.findMany({
          where: { studentId },
          orderBy: { assessedAt: 'desc' },
          take: 40,
          select: { domain: true, score: true },
        }),
        prisma.questionResponse.findMany({
          where: { session: { studentId }, createdAt: { gte: today } },
          select: { isCorrect: true },
        }),
      ])

      const domainScores: Partial<Record<QuestionDomainType, number | null>> = {}
      for (const sa of skillAssessments) {
        const domain = sa.domain as QuestionDomainType
        if (domainScores[domain] === undefined) {
          domainScores[domain] = sa.score
        }
      }

      return {
        wrongAnswerCount,
        domainScores,
        todayQuestions: todayResponses.length,
        todayCorrect: todayResponses.filter((r) => r.isCorrect === true).length,
      }
    },
    ['student-learn-hub', studentId],
    { revalidate: 30, tags: [`student-${studentId}-learn`] },
  )()

export async function getLearnHubData() {
  const studentId = await requireStudentId()
  return getCachedLearnHubData(studentId)
}

// ── AI 스마트 맞춤형 학습 (신규) ─────────────────────────────────────────────

export async function getSmartAdaptiveData(count = 7): Promise<{
  questions: AdaptiveQuestion[]
  summary: StudentProfileSummary
}> {
  const studentId = await requireStudentId()

  const profile = await getStudentProfile(studentId)
  const selected = await selectAdaptiveQuestions(profile, count)

  const weakCount = selected.filter((q) => q.tag.type === 'weakness').length
  const maintainCount = selected.filter((q) => q.tag.type === 'maintain').length
  const challengeCount = selected.filter((q) => q.tag.type === 'challenge').length

  const domainScores = profile.domainScores
  const weakestKey = profile.overallWeakest as keyof typeof domainScores
  const strongestKey = profile.overallStrongest as keyof typeof domainScores

  const questions: AdaptiveQuestion[] = selected.map((q) => {
    const content = q.contentJson as QuestionContentJson
    return {
      id: q.id,
      domain: q.domain,
      difficulty: q.difficulty,
      subCategory: q.subCategory,
      tag: q.tag,
      content: {
        type: content.type,
        question_text: content.question_text,
        ...(content.question_text_ko ? { question_text_ko: content.question_text_ko } : {}),
        ...(content.options ? { options: content.options } : {}),
        ...(content.passage ? { passage: content.passage } : {}),
        ...(content.word_limit ? { word_limit: content.word_limit } : {}),
      },
    }
  })

  const summary: StudentProfileSummary = {
    currentLevel: profile.currentLevel,
    cefrLevel: profile.cefrLevel,
    overallWeakest: profile.overallWeakest,
    overallStrongest: profile.overallStrongest,
    weakestScore: domainScores[weakestKey]?.avg ?? null,
    strongestScore: domainScores[strongestKey]?.avg ?? null,
    topWeakCategories: profile.recentMistakes.slice(0, 2).map((m) => m.category),
    weakCount,
    maintainCount,
    challengeCount,
    readyForLevelUp: profile.readyForLevelUp,
    streakDays: profile.streakDays,
  }

  return { questions, summary }
}

// ── 맞춤형 학습 문제 (레거시) ─────────────────────────────────────────────────

export async function getAdaptiveQuestions() {
  const studentId = await requireStudentId()

  const skillAssessments = await prisma.skillAssessment.findMany({
    where: { studentId },
    orderBy: { assessedAt: 'desc' },
    take: 40,
  })

  const domainScores: Partial<Record<QuestionDomainType, number | null>> = {}
  for (const sa of skillAssessments) {
    const domain = sa.domain as QuestionDomainType
    if (domainScores[domain] === undefined) {
      domainScores[domain] = sa.score
    }
  }

  // 가장 낮은 점수 영역 선택
  let weakestDomain: QuestionDomainType = DOMAINS[Math.floor(Math.random() * DOMAINS.length)]
  let lowestScore: number | null = null

  for (const domain of DOMAINS) {
    const score = domainScores[domain]
    if (score !== undefined && score !== null) {
      if (lowestScore === null || score < lowestScore) {
        lowestScore = score
        weakestDomain = domain
      }
    }
  }

  const rawQuestions = await prisma.question.findMany({
    where: { domain: weakestDomain },
    orderBy: { createdAt: 'desc' },
    take: 30,
    select: { id: true, domain: true, difficulty: true, contentJson: true },
  })

  const shuffled = [...rawQuestions].sort(() => Math.random() - 0.5).slice(0, 8)

  return {
    questions: shuffled.map(sanitizeQuestion),
    domain: weakestDomain,
    domainScore: domainScores[weakestDomain] ?? null,
  }
}

// ── 영역별 연습 문제 ──────────────────────────────────────────────────────────

export async function getDomainQuestions(
  domain: string,
  difficulty: number,
  excludeIds: string[] = [],
): Promise<PracticeQuestion[]> {
  await requireStudentId()

  const domainKey = domain.toUpperCase() as QuestionDomainType
  if (!DOMAINS.includes(domainKey)) return []

  const whereBase = {
    domain: domainKey,
    id: excludeIds.length > 0 ? { notIn: excludeIds } : undefined,
  }

  let rawQuestions = await prisma.question.findMany({
    where: { ...whereBase, difficulty },
    take: 30,
    select: { id: true, domain: true, difficulty: true, contentJson: true },
  })

  // 해당 난이도 문제 부족 시 전체 영역에서 가져오기
  if (rawQuestions.length < 5) {
    rawQuestions = await prisma.question.findMany({
      where: whereBase,
      take: 30,
      select: { id: true, domain: true, difficulty: true, contentJson: true },
    })
  }

  return [...rawQuestions].sort(() => Math.random() - 0.5).slice(0, 5).map(sanitizeQuestion)
}

// ── 도메인 스킬 프로필 (카테고리별 정확도) ──────────────────────────────────

export async function getDomainProfileData(domain: string): Promise<DomainProfileData> {
  const studentId = await requireStudentId()

  const domainKey = domain.toUpperCase() as QuestionDomainType
  if (!DOMAINS.includes(domainKey)) {
    return {
      domainScore: null,
      currentLevel: 1,
      cefrLevel: 'A1-A2',
      categories: [],
      levelUpScore: 80,
      levelUpGap: 80,
      weakestCategories: [],
      strongestCategories: [],
    }
  }

  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const [student, skillAssessment, responses] = await Promise.all([
    prisma.student.findUnique({
      where: { id: studentId },
      select: { currentLevel: true },
    }),
    prisma.skillAssessment.findFirst({
      where: { studentId, domain: domainKey },
      orderBy: { assessedAt: 'desc' },
      select: { score: true },
    }),
    prisma.questionResponse.findMany({
      where: {
        session: {
          studentId,
          status: { in: ['COMPLETED', 'GRADED'] },
        },
        question: { domain: domainKey },
        createdAt: { gte: thirtyDaysAgo },
      },
      select: {
        isCorrect: true,
        question: { select: { subCategory: true } },
      },
    }),
  ])

  const currentLevel = student?.currentLevel ?? 1
  const CEFR_MAP: Record<number, string> = {
    1: 'Pre-A1',
    2: 'A1-A2',
    3: 'B1',
    4: 'B2',
    5: 'C1-C2',
  }
  const cefrLevel = CEFR_MAP[currentLevel] ?? 'A1-A2'
  const domainScore = skillAssessment?.score ?? null

  // 카테고리별 집계
  const catMap: Record<string, { correct: number; total: number }> = {}
  for (const r of responses) {
    const cat = r.question.subCategory ?? 'general'
    if (!catMap[cat]) catMap[cat] = { correct: 0, total: 0 }
    catMap[cat].total++
    if (r.isCorrect === true) catMap[cat].correct++
  }

  const categories: CategoryAccuracy[] = Object.entries(catMap)
    .map(([name, { correct, total }]) => ({
      name,
      correct,
      total,
      accuracy: total > 0 ? Math.round((correct / total) * 100) : 0,
    }))
    .sort((a, b) => a.accuracy - b.accuracy) // 낮은 순 (약한 것 먼저)

  const weakestCategories = categories
    .filter((c) => c.accuracy < 65)
    .slice(0, 3)
    .map((c) => c.name)

  const strongestCategories = [...categories]
    .sort((a, b) => b.accuracy - a.accuracy)
    .filter((c) => c.total >= 2)
    .slice(0, 2)
    .map((c) => c.name)

  const levelUpScore = 80
  const levelUpGap = levelUpScore - (domainScore ?? 0)

  return {
    domainScore,
    currentLevel,
    cefrLevel,
    categories,
    levelUpScore,
    levelUpGap,
    weakestCategories,
    strongestCategories,
  }
}

// ── 스마트 도메인 문제 선택 ───────────────────────────────────────────────────

export async function getSmartDomainQuestions(
  domain: string,
  mode: LearningMode,
  count: number = 5,
  excludeIds: string[] = [],
): Promise<SmartDomainQuestion[]> {
  const studentId = await requireStudentId()

  const domainKey = domain.toUpperCase() as QuestionDomainType
  if (!DOMAINS.includes(domainKey)) return []

  const profile = await getStudentProfile(studentId)
  const selected = await selectSmartDomainQuestions(profile, domain.toLowerCase(), mode, count, excludeIds)

  return selected.map((q) => {
    const content = q.contentJson as QuestionContentJson
    return {
      id: q.id,
      domain: q.domain,
      difficulty: q.difficulty,
      subCategory: q.subCategory,
      content: {
        type: content.type,
        question_text: content.question_text,
        ...(content.question_text_ko ? { question_text_ko: content.question_text_ko } : {}),
        ...(content.options ? { options: content.options } : {}),
        ...(content.passage ? { passage: content.passage } : {}),
        ...(content.word_limit ? { word_limit: content.word_limit } : {}),
      },
    }
  })
}

// ── AI 세션 분석 조언 ─────────────────────────────────────────────────────────

export async function generateSessionAdvice(params: {
  domain: string
  mode: LearningMode
  categoryResults: Array<{
    name: string
    correct: number
    total: number
    prevAccuracy: number
    newAccuracy: number
  }>
  totalCorrect: number
  totalCount: number
}): Promise<SessionAdvice> {
  const { domain, mode, categoryResults, totalCorrect, totalCount } = params

  const DOMAIN_LABEL_KO: Record<string, string> = {
    GRAMMAR: '문법',
    VOCABULARY: '어휘',
    READING: '독해',
    WRITING: '쓰기',
  }

  const MODE_LABEL: Record<string, string> = {
    weakness: '약점 집중 모드',
    balanced: '균형 연습 모드',
    levelup: '레벨업 도전 모드',
  }

  const catSummary = categoryResults
    .map((c) => {
      const trend =
        c.newAccuracy > c.prevAccuracy + 2
          ? '상승 ↑'
          : c.newAccuracy < c.prevAccuracy - 2
            ? '하락 ↓'
            : '유지 →'
      return `- ${c.name}: ${c.correct}/${c.total} (${c.prevAccuracy}% → ${c.newAccuracy}% ${trend})`
    })
    .join('\n')

  const userPrompt = `학생이 ${DOMAIN_LABEL_KO[domain.toUpperCase()] ?? domain} 영역 연습을 완료했어.

모드: ${MODE_LABEL[mode] ?? mode}
전체 결과: ${totalCorrect}/${totalCount} (${Math.round((totalCorrect / totalCount) * 100)}%)

카테고리별 결과:
${catSummary || '카테고리 데이터 없음'}

JSON 응답:
{
  "advice": "학생 결과 분석 + 구체적 학습 조언 (2~3문장, 한국어, 격려 포함)",
  "nextRecommendation": {
    "mode": "weakness 또는 balanced 또는 levelup",
    "reason": "이 모드를 추천하는 이유 한 문장 (한국어)"
  }
}`

  try {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) throw new Error('OPENAI_API_KEY not set')

    const openai = new OpenAI({ apiKey })

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            '너는 영어 교육 전문 AI 코치야. 학생의 연습 결과를 분석하고 격려와 구체적인 학습 조언을 한국어로 제공해. 반드시 JSON만 응답해.',
        },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.6,
      response_format: { type: 'json_object' },
    })

    const raw = completion.choices[0]?.message?.content
    if (!raw) throw new Error('No AI response')

    const parsed = JSON.parse(raw) as {
      advice: string
      nextRecommendation: { mode: string; reason: string }
    }

    const validModes: LearningMode[] = ['weakness', 'balanced', 'levelup']
    const nextMode = validModes.includes(parsed.nextRecommendation?.mode as LearningMode)
      ? (parsed.nextRecommendation.mode as LearningMode)
      : 'balanced'

    return {
      advice: parsed.advice ?? '수고했어요! 계속 연습하면 실력이 늘 거예요.',
      nextRecommendation: {
        mode: nextMode,
        reason: parsed.nextRecommendation?.reason ?? '균형 잡힌 연습이 도움이 됩니다.',
      },
    }
  } catch {
    return {
      advice: `${totalCorrect}/${totalCount} 정답이에요. 꾸준한 연습이 실력 향상의 지름길입니다!`,
      nextRecommendation: {
        mode: totalCorrect / totalCount < 0.6 ? 'weakness' : 'balanced',
        reason: totalCorrect / totalCount < 0.6 ? '약한 부분을 집중적으로 보완해보세요.' : '균형 있게 연습해보세요.',
      },
    }
  }
}

// ── 오답 복습 목록 ────────────────────────────────────────────────────────────

export async function getWrongAnswersForReview() {
  const studentId = await requireStudentId()

  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const wrongResponses = await prisma.questionResponse.findMany({
    where: {
      session: { studentId, status: { in: ['COMPLETED', 'GRADED'] } },
      isCorrect: false,
      createdAt: { gte: thirtyDaysAgo },
    },
    orderBy: { createdAt: 'desc' },
    select: {
      questionId: true,
      createdAt: true,
      question: {
        select: { id: true, domain: true, difficulty: true, contentJson: true },
      },
    },
    take: 60,
  })

  // 같은 문제 중 가장 최근 오답만 유지
  const seen = new Set<string>()
  const items: WrongAnswerItem[] = []

  for (const r of wrongResponses) {
    if (seen.has(r.questionId)) continue
    seen.add(r.questionId)
    const content = r.question.contentJson as QuestionContentJson
    items.push({
      questionId: r.questionId,
      domain: r.question.domain,
      difficulty: r.question.difficulty,
      wrongAt: r.createdAt.toISOString(),
      content: {
        type: content.type,
        question_text: content.question_text,
        ...(content.question_text_ko ? { question_text_ko: content.question_text_ko } : {}),
        ...(content.options ? { options: content.options } : {}),
        ...(content.passage ? { passage: content.passage } : {}),
      },
    })
  }

  return { items, total: items.length }
}

// ── 연습 세션 저장 ────────────────────────────────────────────────────────────

export async function savePracticeSession(params: {
  mode: string
  domain?: string
  results: PracticeResultItem[]
}): Promise<void> {
  const studentId = await requireStudentId()
  const { mode, domain, results } = params
  if (results.length === 0) return

  const correctCount = results.filter((r) => r.isCorrect).length
  const score = Math.round((correctCount / results.length) * 100)

  await prisma.practiceLog.create({
    data: {
      studentId,
      mode,
      domain: domain as Parameters<typeof prisma.practiceLog.create>[0]['data']['domain'],
      totalCount: results.length,
      correctCount,
      score,
      resultsJson: results,
    },
  })
}

// ── 답변 채점 (클라이언트에서 호출) ──────────────────────────────────────────

export async function gradeAnswer(
  questionId: string,
  answer: string,
): Promise<GradeResult> {
  const user = await getCurrentUser()
  if (!user || user.role !== 'STUDENT') redirect('/login')

  const question = await prisma.question.findUnique({
    where: { id: questionId },
    select: { contentJson: true },
  })

  if (!question) return { isCorrect: false, correctAnswer: null, explanation: null }

  const content = question.contentJson as QuestionContentJson

  if (content.type === 'essay') {
    return { isCorrect: true, correctAnswer: null, explanation: content.explanation ?? null }
  }

  const correctAnswer = content.correct_answer ?? ''
  const isCorrect =
    content.type === 'multiple_choice'
      ? answer.trim() === correctAnswer.trim()
      : answer.trim().toLowerCase() === correctAnswer.trim().toLowerCase()

  // 품질 점수 비동기 갱신 (학생 응답 속도에 영향 없음)
  updateQuestionQuality(questionId).catch(console.error)

  return {
    isCorrect,
    correctAnswer,
    explanation: content.explanation ?? null,
  }
}
