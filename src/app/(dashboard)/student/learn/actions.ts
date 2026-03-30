'use server'

import { redirect } from 'next/navigation'
import { unstable_cache } from 'next/cache'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma/client'
import type {
  QuestionContentJson,
  QuestionDomainType,
} from '@/components/shared/question-bank-client'

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

// ── 맞춤형 학습 문제 ──────────────────────────────────────────────────────────

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

  return {
    isCorrect,
    correctAnswer,
    explanation: content.explanation ?? null,
  }
}
