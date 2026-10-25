// 학생 단원 학습(/student/grammar/[code]) 데이터 조회·채점 — 서버 전용
//
// 페이지는 getGrammarUnitData() 한 번으로 DB 왕복 1웨이브(Promise.all)에 필요한 것을 모두 읽는다.
// 채점은 항상 서버에서 문항 원본(contentJson)으로 한다 (클라이언트 정답 신뢰 금지).

import { prisma } from '@/lib/prisma/client'
import { isAnswerMatch } from '@/lib/assessment/answer-checker'
import type { GrammarPointProgress, Prisma } from '@/generated/prisma'
import type { QuestionContentJson } from '@/components/shared/question-bank-client'
import type { PracticeQuestion } from '@/app/(dashboard)/student/learn/actions'
import {
  parseGrammarAttemptAnswers,
  parseGrammarCommonErrors,
  parseGrammarExamples,
  parseGrammarRules,
  type GrammarCommonError,
  type GrammarExample,
  type GrammarRule,
} from '@/types/grammar'
import { getGrammarPointByCode, type GrammarPointDetail } from './curriculum'
import { isGrammarStep, type GrammarStep } from './constants'
import { initialProgress, isPassedMastery, type GrammarMastery, type MasteryProgress } from './mastery-engine'
import { pickQuestionIds, questionSetSeed } from './question-picker'
import { parseGrammarLearningSettings, type GrammarLearningSettings } from './settings'

// ─── 문항 풀 ─────────────────────────────────────────────────────────────────

/** 단원 학습에서 채점할 수 있는 문항 유형 (기존 문제 컴포넌트가 그리는 형식) */
const GRADABLE_TYPES = new Set(['multiple_choice', 'fill_blank', 'short_answer'])

export interface PoolQuestion {
  id: string
  domain: string
  difficulty: number
  content: QuestionContentJson
}

/** 포인트 문항 조건: 연결된 문항 + 활성 + (본사 공용은 검수 완료, 학원 전용 포함) */
function pointQuestionWhere(point: { id: string } | { code: string }, academyId: string): Prisma.QuestionWhereInput {
  return {
    ...('id' in point ? { grammarPointId: point.id } : { grammarPoint: { code: point.code } }),
    isActive: true,
    OR: [{ academyId: null, isVerified: true }, { academyId }],
  }
}

function isGradable(content: QuestionContentJson | null): content is QuestionContentJson {
  return (
    !!content &&
    typeof content.question_text === 'string' &&
    GRADABLE_TYPES.has(content.type) &&
    typeof content.correct_answer === 'string' &&
    content.correct_answer.trim() !== ''
  )
}

function findPool(point: { id: string } | { code: string }, academyId: string): Promise<PoolQuestion[]> {
  return prisma.question
    .findMany({
      where: pointQuestionWhere(point, academyId),
      select: { id: true, domain: true, difficulty: true, contentJson: true },
    })
    .then((rows) =>
      rows.flatMap((r) => {
        const content = r.contentJson as QuestionContentJson | null
        return isGradable(content) ? [{ id: r.id, domain: r.domain, difficulty: r.difficulty, content }] : []
      }),
    )
}

export function loadQuestionPool(pointId: string, academyId: string): Promise<PoolQuestion[]> {
  return findPool({ id: pointId }, academyId)
}

/** 포인트 문항 1개 (연습 문항 즉시 채점용) — 다른 포인트·숨김 문항이면 null */
export async function loadPoolQuestion(pointId: string, academyId: string, questionId: string): Promise<PoolQuestion | null> {
  const r = await prisma.question.findFirst({
    where: { AND: [{ id: questionId }, pointQuestionWhere({ id: pointId }, academyId)] },
    select: { id: true, domain: true, difficulty: true, contentJson: true },
  })
  const content = (r?.contentJson ?? null) as QuestionContentJson | null
  return r && isGradable(content) ? { id: r.id, domain: r.domain, difficulty: r.difficulty, content } : null
}

/** 학생 화면에 보낼 문항 — 정답·해설을 뺀다 */
export function toClientQuestion(q: PoolQuestion): PracticeQuestion {
  const c = q.content
  return {
    id: q.id,
    domain: q.domain,
    difficulty: q.difficulty,
    content: {
      type: c.type,
      question_text: c.question_text,
      ...(c.question_text_ko ? { question_text_ko: c.question_text_ko } : {}),
      ...(c.options ? { options: c.options } : {}),
      ...(c.passage ? { passage: c.passage } : {}),
      ...(c.passage_image_url ? { passage_image_url: c.passage_image_url } : {}),
      ...(c.question_image_url ? { question_image_url: c.question_image_url } : {}),
    },
  }
}

export interface GradedAnswer {
  questionId: string
  answer: string
  isCorrect: boolean
  correctAnswer: string
  explanation: string | null
}

export function gradePoolAnswer(q: PoolQuestion, answer: string): GradedAnswer {
  const correctAnswer = q.content.correct_answer ?? ''
  return {
    questionId: q.id,
    answer,
    isCorrect: isAnswerMatch(answer, correctAnswer, q.content.options),
    correctAnswer,
    explanation: q.content.explanation ?? null,
  }
}

/** 보기 문자 답("B")을 "B. were"처럼 보여 주기 */
export function formatAnswerLabel(content: QuestionContentJson, answer: string): string {
  const trimmed = answer.trim()
  const options = content.options ?? []
  const idx = /^[A-Ha-h]$/.test(trimmed) ? trimmed.toUpperCase().charCodeAt(0) - 65 : -1
  if (idx >= 0 && options[idx] !== undefined) return `${trimmed.toUpperCase()}. ${options[idx]}`
  return trimmed
}

// ─── 결과 ────────────────────────────────────────────────────────────────────

export interface GrammarResultItem {
  questionId: string
  questionText: string
  myAnswer: string
  correctAnswer: string
  isCorrect: boolean
  explanation: string | null
}

export interface GrammarCheckResult {
  score: number
  correctCount: number
  totalCount: number
  passed: boolean
  passScore: number
  state: GrammarMastery
  xpEarned: number
  items: GrammarResultItem[]
}

export function buildResultItems(pool: Map<string, PoolQuestion>, graded: GradedAnswer[]): GrammarResultItem[] {
  return graded.flatMap((g) => {
    const q = pool.get(g.questionId)
    if (!q) return []
    return [
      {
        questionId: g.questionId,
        questionText: q.content.question_text,
        myAnswer: g.answer ? formatAnswerLabel(q.content, g.answer) : '(답하지 않음)',
        correctAnswer: formatAnswerLabel(q.content, g.correctAnswer),
        isCorrect: g.isCorrect,
        explanation: g.explanation,
      },
    ]
  })
}

// ─── 진도·설정 ───────────────────────────────────────────────────────────────

export function toMasteryProgress(row: GrammarPointProgress | null): MasteryProgress | null {
  if (!row) return null
  return {
    state: row.state,
    currentStep: isGrammarStep(row.currentStep) ? row.currentStep : 'CONCEPT',
    conceptDoneAt: row.conceptDoneAt,
    practiceCorrect: row.practiceCorrect,
    practiceTotal: row.practiceTotal,
    bestCheckScore: row.bestCheckScore,
    lastCheckScore: row.lastCheckScore,
    checkAttempts: row.checkAttempts,
    lowScoreCount: row.lowScoreCount,
    reviewStreak: row.reviewStreak,
    nextReviewAt: row.nextReviewAt,
    passedAt: row.passedAt,
    masteredAt: row.masteredAt,
    lastActivityAt: row.lastActivityAt,
  }
}

/** Progress upsert용 데이터 (id·학생·포인트 제외 필드) */
export function progressData(p: MasteryProgress) {
  return {
    state: p.state,
    currentStep: p.currentStep,
    conceptDoneAt: p.conceptDoneAt,
    practiceCorrect: p.practiceCorrect,
    practiceTotal: p.practiceTotal,
    bestCheckScore: p.bestCheckScore,
    lastCheckScore: p.lastCheckScore,
    checkAttempts: p.checkAttempts,
    lowScoreCount: p.lowScoreCount,
    reviewStreak: p.reviewStreak,
    nextReviewAt: p.nextReviewAt,
    passedAt: p.passedAt,
    masteredAt: p.masteredAt,
    lastActivityAt: p.lastActivityAt,
  }
}

export function loadGrammarSettings(academyId: string): Promise<GrammarLearningSettings> {
  return prisma.academy
    .findUnique({ where: { id: academyId }, select: { settingsJson: true } })
    .then((a) => parseGrammarLearningSettings(a?.settingsJson ?? null))
}

/** 학생이 볼 수 있는 공개 포인트인지 (본사 공용 또는 자기 학원 전용) */
export function canStudentSeePoint(point: GrammarPointDetail | null, academyId: string): point is GrammarPointDetail {
  return !!point && point.status === 'PUBLISHED' && (point.academyId === null || point.academyId === academyId)
}

export function findStudentPoint(code: string, academyId: string): Promise<GrammarPointDetail | null> {
  return getGrammarPointByCode(code).then((p) => (canStudentSeePoint(p, academyId) ? p : null))
}

function lastAttemptIds(row: { answersJson: Prisma.JsonValue } | null): string[] {
  return row ? parseGrammarAttemptAnswers(row.answersJson).map((a) => a.questionId) : []
}

/** 이번 차수 연습 문항 id — 연습을 제출할 때마다 practiceTotal이 바뀌어 다음 세트가 된다 */
export function practiceQuestionIds(studentId: string, pointId: string, progress: MasteryProgress | null, poolIds: string[]): string[] {
  const round = progress?.practiceTotal ?? 0
  return pickQuestionIds(poolIds, 'PRACTICE', { seed: questionSetSeed(studentId, pointId, 'PRACTICE', round) })
}

/** 이번 차수 확인 테스트 문항 id — 직전 확인 문항과 직전 연습 문항을 우선 제외 */
export function checkQuestionIds(
  studentId: string,
  pointId: string,
  progress: MasteryProgress | null,
  poolIds: string[],
  lastCheckIds: string[],
  lastPracticeIds: string[],
): string[] {
  const round = progress?.checkAttempts ?? 0
  return pickQuestionIds(poolIds, 'CHECK', {
    seed: questionSetSeed(studentId, pointId, 'CHECK', round),
    avoid: [new Set(lastCheckIds), new Set(lastPracticeIds)],
  })
}

/** 직전 연습·확인 시도의 문항 id */
export function loadLastAttemptIds(studentId: string, pointId: string): Promise<{ lastCheckIds: string[]; lastPracticeIds: string[] }> {
  const latest = (kind: 'CHECK' | 'PRACTICE') =>
    prisma.grammarAttempt.findFirst({
      where: { studentId, grammarPointId: pointId, kind },
      orderBy: { createdAt: 'desc' },
      select: { answersJson: true },
    })
  return Promise.all([latest('CHECK'), latest('PRACTICE')]).then(([c, p]) => ({
    lastCheckIds: lastAttemptIds(c),
    lastPracticeIds: lastAttemptIds(p),
  }))
}

// ─── 페이지 데이터 ───────────────────────────────────────────────────────────

export interface GrammarUnitPoint {
  id: string
  code: string
  title: string
  summary: string | null
  categoryName: string
  parentCategoryName: string | null
  rules: GrammarRule[]
  examples: GrammarExample[]
  commonErrors: GrammarCommonError[]
  prerequisites: { code: string; title: string }[]
}

export interface GrammarUnitProgress {
  state: GrammarMastery
  currentStep: GrammarStep
  conceptDone: boolean
  checkAttempts: number
  bestCheckScore: number | null
  lastCheckScore: number | null
  /** ISO 문자열 (클라이언트 전달용) */
  nextReviewAt: string | null
}

export interface GrammarUnitData {
  point: GrammarUnitPoint
  progress: GrammarUnitProgress
  settings: GrammarLearningSettings
  /** 강의 (2-4에서 플레이어 연결) — 학원 강의 우선, 없으면 본사 강의 */
  lecture: { id: string; title: string; isAcademy: boolean } | null
  practice: PracticeQuestion[]
  check: PracticeQuestion[]
  /** 직전 확인 테스트 결과 (결과 단계 복원용) */
  lastResult: GrammarCheckResult | null
  /** 미통과 선수 포인트 (권장 안내만) */
  unmetPrerequisites: { code: string; title: string }[]
}

export async function getGrammarUnitData(studentId: string, academyId: string, code: string): Promise<GrammarUnitData | null> {
  const [point, progressRow, pool, settings, lectures, lastCheck, lastPractice, prereqProgress] = await Promise.all([
    getGrammarPointByCode(code),
    prisma.grammarPointProgress.findFirst({ where: { studentId, grammarPoint: { code } } }),
    findPool({ code }, academyId),
    loadGrammarSettings(academyId),
    prisma.grammarLecture.findMany({
      where: { grammarPoint: { code }, isActive: true, OR: [{ academyId: null }, { academyId }] },
      select: { id: true, title: true, academyId: true },
      take: 2,
    }),
    prisma.grammarAttempt.findFirst({
      where: { studentId, grammarPoint: { code }, kind: 'CHECK' },
      orderBy: { createdAt: 'desc' },
      select: { answersJson: true, score: true, correctCount: true, totalCount: true },
    }),
    prisma.grammarAttempt.findFirst({
      where: { studentId, grammarPoint: { code }, kind: 'PRACTICE' },
      orderBy: { createdAt: 'desc' },
      select: { answersJson: true },
    }),
    prisma.grammarPointProgress.findMany({
      where: { studentId, grammarPoint: { requiredBy: { some: { point: { code } } } } },
      select: { grammarPointId: true, state: true },
    }),
  ])
  if (!canStudentSeePoint(point, academyId)) return null

  const progress = toMasteryProgress(progressRow)
  const shown = progress ?? initialProgress(new Date())
  const poolIds = pool.map((q) => q.id)
  const byId = new Map(pool.map((q) => [q.id, q]))
  const lastCheckIds = lastAttemptIds(lastCheck)
  const practiceIds = practiceQuestionIds(studentId, point.id, progress, poolIds)
  const checkIds = checkQuestionIds(studentId, point.id, progress, poolIds, lastCheckIds, lastAttemptIds(lastPractice))
  const toClient = (ids: string[]) => ids.flatMap((id) => (byId.has(id) ? [toClientQuestion(byId.get(id)!)] : []))

  let lastResult: GrammarCheckResult | null = null
  if (lastCheck) {
    const graded: GradedAnswer[] = parseGrammarAttemptAnswers(lastCheck.answersJson).flatMap((a) => {
      const q = byId.get(a.questionId)
      return q ? [{ ...gradePoolAnswer(q, a.answer), isCorrect: a.isCorrect }] : []
    })
    lastResult = {
      score: lastCheck.score,
      correctCount: lastCheck.correctCount,
      totalCount: lastCheck.totalCount,
      passed: lastCheck.score >= settings.passScore,
      passScore: settings.passScore,
      state: shown.state,
      xpEarned: 0,
      items: buildResultItems(byId, graded),
    }
  }

  const passedPrereq = new Set(prereqProgress.filter((p) => isPassedMastery(p.state)).map((p) => p.grammarPointId))
  const academyLecture = lectures.find((l) => l.academyId === academyId)
  const lecture = academyLecture ?? lectures.find((l) => l.academyId === null) ?? null

  return {
    point: {
      id: point.id,
      code: point.code,
      title: point.title,
      summary: point.summary,
      categoryName: point.category.name,
      parentCategoryName: point.parentCategory?.name ?? null,
      rules: parseGrammarRules(point.rulesJson),
      examples: parseGrammarExamples(point.examplesJson),
      commonErrors: parseGrammarCommonErrors(point.commonErrorsJson),
      prerequisites: point.prerequisites.map((p) => ({ code: p.code, title: p.title })),
    },
    progress: {
      state: shown.state,
      currentStep: shown.currentStep,
      conceptDone: shown.conceptDoneAt !== null,
      checkAttempts: shown.checkAttempts,
      bestCheckScore: shown.bestCheckScore,
      lastCheckScore: shown.lastCheckScore,
      nextReviewAt: shown.nextReviewAt ? shown.nextReviewAt.toISOString() : null,
    },
    settings,
    lecture: lecture ? { id: lecture.id, title: lecture.title, isAcademy: lecture.academyId !== null } : null,
    practice: toClient(practiceIds),
    check: toClient(checkIds),
    lastResult,
    unmetPrerequisites: point.prerequisites
      .filter((p) => !passedPrereq.has(p.id))
      .map((p) => ({ code: p.code, title: p.title })),
  }
}
