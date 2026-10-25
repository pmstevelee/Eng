// 학생 문법 복습(/student/grammar/review)·오답노트(/student/grammar/wrong-notes) 데이터 — 서버 전용
//
// - 포인트 복습: 통과·숙달 포인트 중 복습 예정일이 지난 것 → 포인트당 5문항, 결과는 mastery-engine REVIEW_DONE
// - 문항 복습: 기존 오답노트(QuestionReview) 중 문법 문항 만기분 → 결과는 기존 recordQuestionAnswers() 규칙 그대로
// - 화면마다 독립 쿼리는 Promise.all 한 번(1웨이브)으로 모은다

import { prisma } from '@/lib/prisma/client'
import { isAnswerMatch } from '@/lib/assessment/answer-checker'
import { endOfTodayKst } from '@/lib/attendance/time'
import type { GrammarMasteryState, Prisma } from '@/generated/prisma'
import type { QuestionContentJson } from '@/components/shared/question-bank-client'
import type { PracticeQuestion } from '@/app/(dashboard)/student/learn/actions'
import { parseGrammarAttemptAnswers } from '@/types/grammar'
import { getGrammarPointByCode, getGrammarTree, type GrammarTreeCategory } from './curriculum'
import { REVIEW_SIZE } from './constants'
import { pickQuestionIds, questionSetSeed } from './question-picker'
import {
  OTHER_GROUP_KEY,
  OTHER_GROUP_TITLE,
  clampPage,
  filterByGroupKey,
  groupByPoint,
  isPointReviewDue,
  latestWrongAnswers,
  reviewRound,
  type PointInfo,
} from './review-logic'
import {
  canStudentSeePoint,
  formatAnswerLabel,
  isGradable,
  lastAttemptIds,
  loadGrammarSettings,
  loadQuestionPoolByCode,
  toClientQuestion,
  toMasteryProgress,
  type GrammarResultItem,
  type PoolQuestion,
} from './unit-queries'
import type { MasteryProgress } from './mastery-engine'

/** 문항 복습 한 번에 푸는 문항 수 */
export const QUESTION_REVIEW_BATCH = 10
/** 오답노트 쪽당 문항 수 */
export const WRONG_NOTES_PAGE_SIZE = 20
/** 오답노트 "내 답"을 찾을 최근 시도 수 */
const RECENT_ATTEMPTS_FOR_ANSWERS = 200

function buildPointIndex(tree: GrammarTreeCategory[]): Map<string, PointInfo> {
  const map = new Map<string, PointInfo>()
  for (const category of tree) {
    for (const sub of category.children) {
      for (const p of sub.points) map.set(p.id, { code: p.code, title: p.title, categoryName: category.name })
    }
  }
  return map
}

/** 만기된 문법 오답노트 문항 조건 */
function dueQuestionReviewWhere(studentId: string, dueBy: Date): Prisma.QuestionReviewWhereInput {
  return {
    studentId,
    isMastered: false,
    nextReviewAt: { lt: dueBy },
    question: { domain: 'GRAMMAR', isActive: true },
  }
}

function toPool(q: { id: string; domain: string; difficulty: number; contentJson: Prisma.JsonValue }): PoolQuestion | null {
  const content = q.contentJson as QuestionContentJson | null
  return isGradable(content) ? { id: q.id, domain: q.domain, difficulty: q.difficulty, content } : null
}

// ─── 복습 목록 ───────────────────────────────────────────────────────────────

export interface PointReviewItem {
  code: string
  title: string
  categoryName: string
  state: GrammarMasteryState
  reviewStreak: number
  /** ISO */
  nextReviewAt: string
}

export interface QuestionReviewGroupSummary {
  key: string
  title: string
  categoryName: string | null
  count: number
}

export interface GrammarReviewData {
  points: PointReviewItem[]
  questionGroups: QuestionReviewGroupSummary[]
  questionTotal: number
  masteryReviewStreak: number
}

export async function getGrammarReviewData(studentId: string, academyId: string): Promise<GrammarReviewData> {
  const dueBy = endOfTodayKst()
  const [tree, progresses, reviews, settings] = await Promise.all([
    getGrammarTree(academyId),
    prisma.grammarPointProgress.findMany({
      where: { studentId, state: { in: ['PASSED', 'MASTERED'] }, nextReviewAt: { lt: dueBy } },
      orderBy: { nextReviewAt: 'asc' },
      select: { grammarPointId: true, state: true, reviewStreak: true, nextReviewAt: true },
    }),
    prisma.questionReview.findMany({
      where: dueQuestionReviewWhere(studentId, dueBy),
      orderBy: { nextReviewAt: 'asc' },
      select: { questionId: true, question: { select: { grammarPointId: true } } },
    }),
    loadGrammarSettings(academyId),
  ])
  const index = buildPointIndex(tree)

  const points = progresses.flatMap((p): PointReviewItem[] => {
    const info = index.get(p.grammarPointId)
    if (!info || !p.nextReviewAt || !isPointReviewDue(p, dueBy)) return []
    return [
      {
        code: info.code,
        title: info.title,
        categoryName: info.categoryName,
        state: p.state,
        reviewStreak: p.reviewStreak,
        nextReviewAt: p.nextReviewAt.toISOString(),
      },
    ]
  })

  const groups = groupByPoint(
    reviews.map((r) => ({ questionId: r.questionId, grammarPointId: r.question.grammarPointId })),
    index,
  )

  return {
    points,
    questionGroups: groups.map((g) => ({ key: g.key, title: g.title, categoryName: g.categoryName, count: g.items.length })),
    questionTotal: reviews.length,
    masteryReviewStreak: settings.masteryReviewStreak,
  }
}

// ─── 포인트 복습 퀴즈 ────────────────────────────────────────────────────────

/** 이번 차수 복습 문항 id — 직전 복습 문항을 우선 제외 */
export function reviewQuestionIds(
  studentId: string,
  pointId: string,
  progress: MasteryProgress,
  poolIds: string[],
  lastReviewIds: string[],
): string[] {
  return pickQuestionIds(poolIds, 'REVIEW', {
    seed: questionSetSeed(studentId, pointId, 'REVIEW', reviewRound(progress.nextReviewAt)),
    size: REVIEW_SIZE,
    avoid: [new Set(lastReviewIds)],
  })
}

export type PointReviewQuiz =
  | { status: 'NOT_DUE'; code: string; title: string; categoryName: string; nextReviewAt: string | null; state: GrammarMasteryState }
  | {
      status: 'DUE'
      code: string
      title: string
      categoryName: string
      state: GrammarMasteryState
      reviewStreak: number
      passScore: number
      masteryReviewStreak: number
      questions: PracticeQuestion[]
    }

/** 포인트 복습 퀴즈 — 볼 수 없는 포인트면 null */
export async function getPointReviewQuiz(studentId: string, academyId: string, code: string): Promise<PointReviewQuiz | null> {
  const [point, progressRow, pool, lastReview, settings] = await Promise.all([
    getGrammarPointByCode(code),
    prisma.grammarPointProgress.findFirst({ where: { studentId, grammarPoint: { code } } }),
    loadQuestionPoolByCode(code, academyId),
    prisma.grammarAttempt.findFirst({
      where: { studentId, grammarPoint: { code }, kind: 'REVIEW' },
      orderBy: { createdAt: 'desc' },
      select: { answersJson: true },
    }),
    loadGrammarSettings(academyId),
  ])
  if (!canStudentSeePoint(point, academyId)) return null

  const base = { code: point.code, title: point.title, categoryName: point.parentCategory?.name ?? point.category.name }
  const progress = toMasteryProgress(progressRow)
  if (!progress || !isPointReviewDue(progress, endOfTodayKst())) {
    return {
      status: 'NOT_DUE',
      ...base,
      nextReviewAt: progress?.nextReviewAt ? progress.nextReviewAt.toISOString() : null,
      state: progress?.state ?? 'NOT_STARTED',
    }
  }

  const byId = new Map(pool.map((q) => [q.id, q]))
  const ids = reviewQuestionIds(studentId, point.id, progress, Array.from(byId.keys()), lastAttemptIds(lastReview))
  return {
    status: 'DUE',
    ...base,
    state: progress.state,
    reviewStreak: progress.reviewStreak,
    passScore: settings.passScore,
    masteryReviewStreak: settings.masteryReviewStreak,
    questions: ids.flatMap((id) => (byId.has(id) ? [toClientQuestion(byId.get(id)!)] : [])),
  }
}

// ─── 문항 복습 퀴즈 ──────────────────────────────────────────────────────────

export interface QuestionReviewQuiz {
  key: string
  title: string
  questions: PracticeQuestion[]
  /** 이번 세트 뒤에 남는 만기 문항 수 */
  remaining: number
}

/** 만기된 문법 오답노트 문항 중 묶음 key에 맞는 것 (오래 기다린 순) */
async function loadDueReviewQuestions(studentId: string, academyId: string, key: string) {
  const dueBy = endOfTodayKst()
  const [tree, reviews] = await Promise.all([
    getGrammarTree(academyId),
    prisma.questionReview.findMany({
      where: dueQuestionReviewWhere(studentId, dueBy),
      orderBy: { nextReviewAt: 'asc' },
      select: {
        questionId: true,
        question: { select: { id: true, domain: true, difficulty: true, contentJson: true, grammarPointId: true } },
      },
    }),
  ])
  const index = buildPointIndex(tree)
  const matched = filterByGroupKey(
    reviews.map((r) => r.question),
    key,
    index,
  )
  const title = key === OTHER_GROUP_KEY ? OTHER_GROUP_TITLE : (Array.from(index.values()).find((p) => p.code === key)?.title ?? '')
  const pool = matched.flatMap((q) => {
    const p = toPool(q)
    return p ? [p] : []
  })
  return { title, pool }
}

export async function getQuestionReviewQuiz(studentId: string, academyId: string, key: string): Promise<QuestionReviewQuiz> {
  const { title, pool } = await loadDueReviewQuestions(studentId, academyId, key)
  const batch = pool.slice(0, QUESTION_REVIEW_BATCH)
  return { key, title, questions: batch.map(toClientQuestion), remaining: Math.max(0, pool.length - batch.length) }
}

/** 제출된 문항 중 지금 복습할 수 있는(만기·문법·활성) 문항만 채점용으로 읽는다 */
export async function loadDueReviewPool(studentId: string, questionIds: string[]): Promise<Map<string, PoolQuestion>> {
  if (questionIds.length === 0) return new Map()
  const rows = await prisma.questionReview.findMany({
    where: { ...dueQuestionReviewWhere(studentId, endOfTodayKst()), questionId: { in: questionIds } },
    select: { question: { select: { id: true, domain: true, difficulty: true, contentJson: true } } },
  })
  const out = new Map<string, PoolQuestion>()
  for (const r of rows) {
    const p = toPool(r.question)
    if (p) out.set(p.id, p)
  }
  return out
}

// ─── 복습 결과 ───────────────────────────────────────────────────────────────

export interface GrammarReviewResult {
  score: number
  correctCount: number
  totalCount: number
  items: GrammarResultItem[]
  /** 포인트 복습일 때만 */
  point: {
    passed: boolean
    passScore: number
    state: GrammarMasteryState
    reviewStreak: number
    masteryReviewStreak: number
    /** ISO */
    nextReviewAt: string | null
    xpEarned: number
  } | null
}

// ─── 오답노트 ────────────────────────────────────────────────────────────────

export interface WrongNoteItem {
  questionId: string
  /** 다시 풀기용 (정답·해설 없음) — 채점할 수 없는 형식이면 null */
  question: PracticeQuestion | null
  questionText: string
  passage: string | null
  myAnswer: string | null
  correctAnswer: string | null
  explanation: string | null
  wrongCount: number
  isMastered: boolean
  /** ISO */
  lastAnsweredAt: string
}

export interface WrongNoteGroup {
  key: string
  title: string
  categoryName: string | null
  items: WrongNoteItem[]
}

export interface WrongNotesData {
  resolved: boolean
  page: number
  totalPages: number
  counts: { open: number; resolved: number }
  groups: WrongNoteGroup[]
}

export async function getWrongNotesData(
  studentId: string,
  academyId: string,
  opts: { resolved: boolean; page?: string },
): Promise<WrongNotesData> {
  const base: Prisma.QuestionReviewWhereInput = { studentId, question: { domain: 'GRAMMAR' } }
  // 전체 개수를 모르는 상태에서 쪽 번호를 정리한다 (범위 밖이면 빈 쪽 → 화면에서 첫 쪽 안내)
  const page = clampPage(opts.page, Number.MAX_SAFE_INTEGER, WRONG_NOTES_PAGE_SIZE)

  const [tree, openCount, resolvedCount, rows, attempts] = await Promise.all([
    getGrammarTree(academyId),
    prisma.questionReview.count({ where: { ...base, isMastered: false } }),
    prisma.questionReview.count({ where: { ...base, isMastered: true } }),
    prisma.questionReview.findMany({
      where: { ...base, isMastered: opts.resolved },
      orderBy: [{ lastAnsweredAt: 'desc' }, { id: 'asc' }],
      skip: (page - 1) * WRONG_NOTES_PAGE_SIZE,
      take: WRONG_NOTES_PAGE_SIZE,
      select: {
        wrongCount: true,
        isMastered: true,
        lastAnsweredAt: true,
        question: { select: { id: true, domain: true, difficulty: true, contentJson: true, grammarPointId: true } },
      },
    }),
    prisma.grammarAttempt.findMany({
      where: { studentId },
      orderBy: { createdAt: 'desc' },
      take: RECENT_ATTEMPTS_FOR_ANSWERS,
      select: { answersJson: true },
    }),
  ])

  const index = buildPointIndex(tree)
  const myAnswers = latestWrongAnswers(attempts.map((a) => parseGrammarAttemptAnswers(a.answersJson)))

  const items = rows.map((r) => {
    const content = (r.question.contentJson ?? null) as QuestionContentJson | null
    const pool = toPool(r.question)
    const mine = myAnswers.get(r.question.id)
    const item: WrongNoteItem = {
      questionId: r.question.id,
      question: pool ? toClientQuestion(pool) : null,
      questionText: content?.question_text ?? '(문제 내용을 불러오지 못했어요)',
      passage: content?.passage ?? null,
      myAnswer: mine && content ? formatAnswerLabel(content, mine) : null,
      correctAnswer: content?.correct_answer ? formatAnswerLabel(content, content.correct_answer) : null,
      explanation: content?.explanation ?? null,
      wrongCount: r.wrongCount,
      isMastered: r.isMastered,
      lastAnsweredAt: r.lastAnsweredAt.toISOString(),
    }
    return { grammarPointId: r.question.grammarPointId, note: item }
  })

  const total = opts.resolved ? resolvedCount : openCount
  return {
    resolved: opts.resolved,
    page,
    totalPages: Math.max(1, Math.ceil(total / WRONG_NOTES_PAGE_SIZE)),
    counts: { open: openCount, resolved: resolvedCount },
    groups: groupByPoint(items, index).map((g) => ({
      key: g.key,
      title: g.title,
      categoryName: g.categoryName,
      items: g.items.map((x) => x.note),
    })),
  }
}

/** 오답노트 "다시 풀기" 채점 — 내 오답노트에 있는 문법 문항만 (기록·복습 일정은 바꾸지 않음) */
export async function gradeWrongNoteAnswer(studentId: string, questionId: string, answer: string) {
  const row = await prisma.questionReview.findFirst({
    where: { studentId, questionId, question: { domain: 'GRAMMAR' } },
    select: { question: { select: { id: true, domain: true, difficulty: true, contentJson: true } } },
  })
  const pool = row ? toPool(row.question) : null
  if (!pool) return null
  const correct = pool.content.correct_answer ?? ''
  return {
    isCorrect: isAnswerMatch(answer, correct, pool.content.options),
    correctAnswer: formatAnswerLabel(pool.content, correct),
    explanation: pool.content.explanation ?? null,
  }
}
