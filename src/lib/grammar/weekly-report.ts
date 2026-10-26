import 'server-only'

// 학생별 주간 문법 리포트 — 최근 7일 학습 단원·통과·숙달·풀이 문항·정답률 + 취약 포인트 상위 3개(틀린 문항 예시)
// 취약 포인트 AI 코멘트는 학생·포인트·주(KST 월요일) 단위로 grammar_weak_comments에 저장해 같은 주에는 다시 부르지 않는다.
// 페이지는 저장된 코멘트만 읽어 빨리 그리고, 빠진 코멘트는 화면이 뜬 뒤 ensureWeakComments로 채운다.

import { prisma } from '@/lib/prisma/client'
import type { Prisma } from '@/generated/prisma'
import type { QuestionContentJson } from '@/components/shared/question-bank-client'
import { dbDate, todayKst } from '@/lib/attendance/time'
import { parseGrammarAttemptAnswers, parseGrammarCommonErrors, parseGrammarRules } from '@/types/grammar'
import { generateWeakComment, type WeakCommentSample } from '@/lib/openai/grammar-weak-comment'
import { formatAnswerLabel } from './unit-queries'
import {
  REPORT_DAYS,
  SAMPLE_MAX,
  SAMPLE_MIN,
  WEAK_TOP,
  collectWrongAnswers,
  rankWeakPoints,
  sumAttempts,
  weekStartKey,
} from './weekly-report-logic'

const DAY_MS = 24 * 60 * 60 * 1000
/** 틀린 문항을 찾을 취약 포인트 시도 수 (최신순) */
const WEAK_ATTEMPT_SCAN = 60

export interface WeeklyWeakPoint {
  pointId: string
  code: string
  title: string
  /** 이번 주 틀린 문항 수 */
  weekWrong: number
  samples: WeakCommentSample[]
  /** 저장된 이번 주 코멘트 */
  comment: string | null
  /** 코멘트를 만들 수 있는지 (틀린 문장이 SAMPLE_MIN개 이상) */
  canComment: boolean
}

export interface GrammarWeeklyReport {
  /** 리포트 기간 (KST, 양 끝 포함) */
  fromKey: string
  toKey: string
  /** 코멘트 캐시 주 (KST 월요일) */
  weekStartKey: string
  studiedUnits: number
  passed: number
  mastered: number
  solved: number
  accuracy: number | null
  weak: WeeklyWeakPoint[]
}

function addDaysKey(key: string, days: number): string {
  return new Date(Date.parse(`${key}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10)
}

function toSample(content: QuestionContentJson | null, myAnswer: string): WeakCommentSample | null {
  const question = content?.question_text?.trim()
  const correct = content?.correct_answer?.trim()
  if (!content || !question || !correct) return null
  return {
    question: question.length > 300 ? `${question.slice(0, 299)}…` : question,
    myAnswer: formatAnswerLabel(content, myAnswer),
    correctAnswer: formatAnswerLabel(content, correct),
  }
}

export async function getGrammarWeeklyReport(studentId: string): Promise<GrammarWeeklyReport> {
  const toKey = todayKst()
  const fromKey = addDaysKey(toKey, -(REPORT_DAYS - 1))
  // KST 자정 = UTC 전날 15시
  const since = new Date(Date.parse(`${fromKey}T00:00:00+09:00`))
  const weekKey = weekStartKey(toKey)

  const [weekAttempts, studiedUnits, passed, mastered, weakProgress, weakAttempts, savedComments] = await Promise.all([
    prisma.grammarAttempt.findMany({
      where: { studentId, createdAt: { gte: since } },
      select: { grammarPointId: true, correctCount: true, totalCount: true },
    }),
    prisma.grammarPointProgress.count({ where: { studentId, lastActivityAt: { gte: since } } }),
    prisma.grammarPointProgress.count({ where: { studentId, passedAt: { gte: since } } }),
    prisma.grammarPointProgress.count({ where: { studentId, masteredAt: { gte: since } } }),
    prisma.grammarPointProgress.findMany({
      where: { studentId, state: 'WEAK' },
      select: { lastActivityAt: true, grammarPoint: { select: { id: true, code: true, title: true } } },
    }),
    // 지금 취약한 포인트의 최근 시도 — 틀린 문항 예시용
    prisma.grammarAttempt.findMany({
      where: { studentId, grammarPoint: { progresses: { some: { studentId, state: 'WEAK' } } } },
      orderBy: { createdAt: 'desc' },
      take: WEAK_ATTEMPT_SCAN,
      select: { grammarPointId: true, answersJson: true },
    }),
    prisma.grammarWeakComment.findMany({
      where: { studentId, weekStart: dbDate(weekKey) },
      select: { grammarPointId: true, comment: true },
    }),
  ])

  const ranked = rankWeakPoints(
    weakProgress.map((p) => ({ pointId: p.grammarPoint.id, lastActivityAt: p.lastActivityAt.toISOString() })),
    weekAttempts.map((a) => ({ ...a, answers: [] })),
    WEAK_TOP,
  )
  const wrongByPoint = collectWrongAnswers(
    weakAttempts.map((a) => ({ grammarPointId: a.grammarPointId, answers: parseGrammarAttemptAnswers(a.answersJson) })),
    ranked.map((r) => r.pointId),
    SAMPLE_MAX,
  )
  const questionIds = Array.from(new Set(Array.from(wrongByPoint.values()).flatMap((list) => list.map((w) => w.questionId))))
  const questions =
    questionIds.length > 0
      ? await prisma.question.findMany({ where: { id: { in: questionIds } }, select: { id: true, contentJson: true } })
      : []
  const contentById = new Map(questions.map((q) => [q.id, (q.contentJson ?? null) as QuestionContentJson | null]))
  const pointById = new Map(weakProgress.map((p) => [p.grammarPoint.id, p.grammarPoint]))
  const commentByPoint = new Map(savedComments.map((c) => [c.grammarPointId, c.comment]))

  const totals = sumAttempts(weekAttempts)
  return {
    fromKey,
    toKey,
    weekStartKey: weekKey,
    studiedUnits,
    passed,
    mastered,
    solved: totals.solved,
    accuracy: totals.accuracy,
    weak: ranked.flatMap((r) => {
      const point = pointById.get(r.pointId)
      if (!point) return []
      const samples = (wrongByPoint.get(r.pointId) ?? []).flatMap((w) => {
        const s = toSample(contentById.get(w.questionId) ?? null, w.answer)
        return s ? [s] : []
      })
      return [
        {
          pointId: point.id,
          code: point.code,
          title: point.title,
          weekWrong: r.weekWrong,
          samples,
          comment: commentByPoint.get(point.id) ?? null,
          canComment: samples.length >= SAMPLE_MIN,
        },
      ]
    }),
  }
}

const commentPointSelect = {
  id: true,
  title: true,
  summary: true,
  rulesJson: true,
  commonErrorsJson: true,
  prerequisites: { select: { requiredPoint: { select: { title: true } } } },
} satisfies Prisma.GrammarPointSelect

/**
 * 이번 주 코멘트가 빠진 취약 포인트에 AI 코멘트를 만들어 저장하고, 포인트별 코멘트를 돌려준다.
 * 이미 저장된 포인트는 OpenAI를 부르지 않는다. 실패한 포인트는 저장하지 않아 다음 방문에 다시 시도한다.
 */
export async function ensureWeakComments(studentId: string): Promise<Record<string, string>> {
  const report = await getGrammarWeeklyReport(studentId)
  const result: Record<string, string> = {}
  for (const w of report.weak) if (w.comment) result[w.pointId] = w.comment
  const missing = report.weak.filter((w) => !w.comment && w.canComment)
  if (missing.length === 0) return result

  const points = await prisma.grammarPoint.findMany({
    where: { id: { in: missing.map((w) => w.pointId) } },
    select: commentPointSelect,
  })
  const pointById = new Map(points.map((p) => [p.id, p]))

  const generated = await Promise.all(
    missing.map(async (w) => {
      const p = pointById.get(w.pointId)
      if (!p) return null
      const res = await generateWeakComment({
        pointTitle: p.title,
        summary: p.summary,
        rules: parseGrammarRules(p.rulesJson),
        commonErrors: parseGrammarCommonErrors(p.commonErrorsJson),
        prerequisiteTitles: p.prerequisites.map((r) => r.requiredPoint.title),
        samples: w.samples,
      })
      if (!res.ok) {
        console.error('[grammar-weekly] 취약 코멘트 생성 실패:', { studentId, pointId: w.pointId, error: res.error })
        return null
      }
      return { pointId: w.pointId, comment: res.comment, model: res.model, samples: w.samples }
    }),
  )
  const rows = generated.filter((g): g is NonNullable<typeof g> => g !== null)
  if (rows.length === 0) return result

  const weekStart = dbDate(report.weekStartKey)
  // 동시에 두 화면에서 불러도 주당 한 행만 (unique) — 먼저 저장된 것을 쓴다
  await prisma.grammarWeakComment.createMany({
    data: rows.map((r) => ({
      studentId,
      grammarPointId: r.pointId,
      weekStart,
      comment: r.comment,
      samplesJson: r.samples as unknown as Prisma.InputJsonValue,
      model: r.model,
    })),
    skipDuplicates: true,
  })
  const saved = await prisma.grammarWeakComment.findMany({
    where: { studentId, weekStart, grammarPointId: { in: rows.map((r) => r.pointId) } },
    select: { grammarPointId: true, comment: true },
  })
  for (const s of saved) result[s.grammarPointId] = s.comment
  return result
}
