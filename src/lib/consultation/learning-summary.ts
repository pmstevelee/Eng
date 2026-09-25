import 'server-only'

import { prisma } from '@/lib/prisma/client'
import { addDaysToDateKey, kstDateStart, toKstDateKey, weekStartKst } from './constants'
import type {
  LearningSummary,
  SummaryDomain,
  SummaryMetric,
  WritingErrorTypeKey,
} from './learning-summary-types'
import { WRITING_ERROR_TYPE_LABEL } from './learning-summary-types'

const DAY_MS = 24 * 60 * 60 * 1000
const DOMAINS: SummaryDomain[] = ['GRAMMAR', 'VOCABULARY', 'READING', 'LISTENING', 'WRITING']
const WORD_STUDY_SOURCES = ['WORD_FLASHCARD', 'WORD_RECALL', 'WORD_SPELL']
const WEAK_DOMAIN_MIN_COUNT = 5
/** 기간당 조회 상한 (학생 1명 기준 충분한 값 — 과도한 로딩 방지) */
const ROW_LIMIT = 5000

type Bucket = 'current' | 'previous'

function pct(numerator: number, denominator: number): number | null {
  return denominator > 0 ? Math.round((numerator / denominator) * 1000) / 10 : null
}

function avg(values: number[]): number | null {
  return values.length > 0 ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10 : null
}

function isSummaryDomain(v: unknown): v is SummaryDomain {
  return typeof v === 'string' && (DOMAINS as string[]).includes(v)
}

function isWritingErrorType(v: unknown): v is WritingErrorTypeKey {
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(WRITING_ERROR_TYPE_LABEL, v)
}

/** 쓰기 채점 결과 JSON의 errors[] → 유형별 건수 (반복 오류는 occurrenceCount 반영) */
function addWritingErrors(target: Map<WritingErrorTypeKey, number>, errors: unknown) {
  if (!Array.isArray(errors)) return
  for (const e of errors) {
    if (!e || typeof e !== 'object') continue
    const { type, occurrenceCount } = e as { type?: unknown; occurrenceCount?: unknown }
    if (!isWritingErrorType(type)) continue
    const n = typeof occurrenceCount === 'number' && occurrenceCount > 0 ? occurrenceCount : 1
    target.set(type, (target.get(type) ?? 0) + n)
  }
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null
}

/**
 * 학생 학습 요약 — 상담 기록 작성 화면·학부모 리포트 공용.
 * from/to: KST 날짜(YYYY-MM-DD, 양 끝 포함). 직전 같은 길이 기간과 비교한다.
 * 저장된 데이터만 사용하며 없는 데이터는 null 로 둔다.
 */
export async function buildLearningSummary(studentId: string, from: string, to: string): Promise<LearningSummary> {
  const days = Math.round((kstDateStart(to).getTime() - kstDateStart(from).getTime()) / DAY_MS) + 1
  const prevTo = addDaysToDateKey(from, -1)
  const prevFrom = addDaysToDateKey(from, -days)

  const start = kstDateStart(from)
  const end = kstDateStart(addDaysToDateKey(to, 1))
  const prevStart = kstDateStart(prevFrom)
  const range = { gte: prevStart, lt: end }
  const bucketOf = (d: Date): Bucket | null => (d >= start && d < end ? 'current' : d >= prevStart && d < start ? 'previous' : null)

  const [
    student,
    xpRows,
    practiceRows,
    responseRows,
    writingResponses,
    missionRows,
    attendanceRows,
    wordTestRows,
    assessmentRows,
    writingReports,
    overdueNow,
  ] = await Promise.all([
    prisma.student.findUnique({
      where: { id: studentId },
      select: { streak: { select: { currentStreak: true, longestStreak: true } } },
    }),
    prisma.studentXp.findMany({
      where: { studentId, createdAt: range },
      select: { amount: true, source: true, sourceId: true, createdAt: true },
      take: ROW_LIMIT,
    }),
    prisma.practiceLog.findMany({
      where: { studentId, createdAt: range },
      select: { createdAt: true, domain: true, totalCount: true, correctCount: true, resultsJson: true },
      take: ROW_LIMIT,
    }),
    prisma.questionResponse.findMany({
      where: {
        isCorrect: { not: null },
        session: { studentId, status: 'COMPLETED', completedAt: range },
      },
      select: { isCorrect: true, question: { select: { domain: true } }, session: { select: { completedAt: true } } },
      take: ROW_LIMIT,
    }),
    // 테스트 쓰기 문항의 AI 채점 결과 (교사 채점 시 answerJson.aiReport 에 저장)
    prisma.questionResponse.findMany({
      where: {
        question: { domain: 'WRITING' },
        session: { studentId, status: 'COMPLETED', completedAt: range },
      },
      select: { answerJson: true, session: { select: { completedAt: true } } },
      take: 200,
    }),
    prisma.dailyMission.findMany({
      where: { studentId, isCompleted: true, completedAt: range },
      select: { completedAt: true },
    }),
    prisma.attendance.findMany({
      where: { studentId, date: range },
      select: { date: true, status: true },
    }),
    prisma.wordTestAttempt.findMany({
      where: { studentId, takenAt: range },
      select: { score: true, takenAt: true },
    }),
    prisma.levelAssessment.findMany({
      where: { studentId, assessedAt: { lt: end } },
      orderBy: { assessedAt: 'asc' },
      select: { overallLevel: true, assessedAt: true, assessmentType: true },
    }),
    prisma.report.findMany({
      where: { studentId, type: 'WRITING_PRACTICE', createdAt: range },
      select: { createdAt: true, dataJson: true },
      take: 200,
    }),
    prisma.wordProgress.count({
      where: { studentId, stage: { not: 'MASTERED' }, nextReviewAt: { lte: new Date() } },
    }),
  ])

  // ── 학습일 ────────────────────────────────────────────────────────────────
  const studyDates: Record<Bucket, Set<string>> = { current: new Set(), previous: new Set() }
  const markStudy = (d: Date | null | undefined) => {
    if (!d) return
    const b = bucketOf(d)
    if (b) studyDates[b].add(toKstDateKey(d))
  }

  // ── XP · 단어 ─────────────────────────────────────────────────────────────
  const xp = { current: 0, previous: 0 }
  const studiedWords: Record<Bucket, Set<string>> = { current: new Set(), previous: new Set() }
  const mastered = { current: 0, previous: 0 }
  const reviewDates: Record<Bucket, Set<string>> = { current: new Set(), previous: new Set() }
  for (const r of xpRows) {
    const b = bucketOf(r.createdAt)
    if (!b) continue
    xp[b] += r.amount
    markStudy(r.createdAt)
    if (WORD_STUDY_SOURCES.includes(r.source)) studiedWords[b].add(r.sourceId ?? `${r.source}:${r.createdAt.getTime()}`)
    else if (r.source === 'WORD_MASTERED') mastered[b]++
    else if (r.source === 'WORD_DAILY_REVIEW') reviewDates[b].add(toKstDateKey(r.createdAt))
  }

  const wordTests: Record<Bucket, number[]> = { current: [], previous: [] }
  for (const w of wordTestRows) {
    const b = bucketOf(w.takenAt)
    if (!b) continue
    wordTests[b].push(w.score)
    markStudy(w.takenAt)
  }

  for (const m of missionRows) markStudy(m.completedAt)

  // ── 정답률 ────────────────────────────────────────────────────────────────
  type Tally = { correct: number; total: number }
  const newTally = (): Tally => ({ correct: 0, total: 0 })
  const overall: Record<Bucket, Tally> = { current: newTally(), previous: newTally() }
  const byDomain: Record<Bucket, Map<SummaryDomain, Tally>> = { current: new Map(), previous: new Map() }
  const weekly = new Map<string, Tally>()

  const addAnswer = (b: Bucket, at: Date, domain: SummaryDomain | null, correct: boolean, count = 1, correctCount = correct ? count : 0) => {
    overall[b].total += count
    overall[b].correct += correctCount
    if (domain) {
      const t = byDomain[b].get(domain) ?? newTally()
      t.total += count
      t.correct += correctCount
      byDomain[b].set(domain, t)
    }
    if (b === 'current') {
      const week = weekStartKst(toKstDateKey(at))
      const t = weekly.get(week) ?? newTally()
      t.total += count
      t.correct += correctCount
      weekly.set(week, t)
    }
  }

  for (const r of responseRows) {
    const at = r.session.completedAt
    if (!at) continue
    const b = bucketOf(at)
    if (!b) continue
    markStudy(at)
    addAnswer(b, at, isSummaryDomain(r.question.domain) ? r.question.domain : null, r.isCorrect === true)
  }

  for (const p of practiceRows) {
    const b = bucketOf(p.createdAt)
    if (!b) continue
    markStudy(p.createdAt)
    // 문항별 결과(영역 포함)가 있으면 그것으로, 없으면 로그 합계로 집계
    const items = Array.isArray(p.resultsJson) ? p.resultsJson : null
    if (items && items.length > 0) {
      for (const item of items) {
        const rec = asRecord(item)
        if (!rec) continue
        addAnswer(b, p.createdAt, isSummaryDomain(rec.domain) ? rec.domain : null, rec.isCorrect === true)
      }
    } else if (p.totalCount > 0) {
      addAnswer(b, p.createdAt, isSummaryDomain(p.domain) ? p.domain : null, false, p.totalCount, p.correctCount)
    }
  }

  // ── 쓰기 오류 유형 ────────────────────────────────────────────────────────
  const writingErrors: Record<Bucket, Map<WritingErrorTypeKey, number>> = { current: new Map(), previous: new Map() }
  const writingGraded = { current: 0, previous: 0 }
  for (const r of writingReports) {
    const b = bucketOf(r.createdAt)
    if (!b) continue
    markStudy(r.createdAt)
    writingGraded[b]++
    addWritingErrors(writingErrors[b], asRecord(r.dataJson)?.errors)
  }
  for (const r of writingResponses) {
    const at = r.session.completedAt
    const report = asRecord(asRecord(r.answerJson)?.aiReport)
    if (!at || !report) continue
    const b = bucketOf(at)
    if (!b) continue
    writingGraded[b]++
    addWritingErrors(writingErrors[b], report.errors)
  }

  // ── 출석 ──────────────────────────────────────────────────────────────────
  const att = {
    current: { present: 0, late: 0, absent: 0, total: 0 },
    previous: { present: 0, late: 0, absent: 0, total: 0 },
  }
  for (const a of attendanceRows) {
    const b = bucketOf(a.date)
    if (!b) continue
    att[b].total++
    if (a.status === 'PRESENT') att[b].present++
    else if (a.status === 'LATE') att[b].late++
    else if (a.status === 'ABSENT') att[b].absent++
  }

  // ── 레벨 ──────────────────────────────────────────────────────────────────
  const before = assessmentRows.filter((a) => a.assessedAt < start)
  const within = assessmentRows.filter((a) => a.assessedAt >= start)
  const startLevel = before.length > 0 ? before[before.length - 1].overallLevel : null
  const endLevel = assessmentRows.length > 0 ? assessmentRows[assessmentRows.length - 1].overallLevel : null

  // ── 조립 ──────────────────────────────────────────────────────────────────
  const metric = (current: number | null, previous: number | null): SummaryMetric => ({ current, previous })

  const domainRows = DOMAINS.map((domain) => {
    const cur = byDomain.current.get(domain)
    const prev = byDomain.previous.get(domain)
    return {
      domain,
      rate: metric(cur ? pct(cur.correct, cur.total) : null, prev ? pct(prev.correct, prev.total) : null),
      count: cur?.total ?? 0,
    }
  }).filter((d) => d.count > 0)

  const weakDomains = domainRows
    .filter((d) => d.count >= WEAK_DOMAIN_MIN_COUNT && d.rate.current !== null && d.rate.current < 80)
    .sort((a, b) => (a.rate.current ?? 0) - (b.rate.current ?? 0))
    .slice(0, 2)
    .map((d) => d.domain)

  const errorTypes = (Object.keys(WRITING_ERROR_TYPE_LABEL) as WritingErrorTypeKey[])
    .map((type) => ({
      type,
      current: writingErrors.current.get(type) ?? 0,
      previous: writingErrors.previous.get(type) ?? 0,
    }))
    .filter((e) => e.current > 0 || e.previous > 0)
    .sort((a, b) => b.current - a.current)

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    period: { from, to, days },
    previousPeriod: { from: prevFrom, to: prevTo },
    studyDays: metric(studyDates.current.size, studyDates.previous.size),
    attendance: {
      rate: metric(
        pct(att.current.present + att.current.late, att.current.total),
        pct(att.previous.present + att.previous.late, att.previous.total),
      ),
      ...att.current,
    },
    streak: { current: student?.streak?.currentStreak ?? 0, longest: student?.streak?.longestStreak ?? 0 },
    xp: metric(xp.current, xp.previous),
    words: {
      studied: metric(studiedWords.current.size, studiedWords.previous.size),
      mastered: metric(mastered.current, mastered.previous),
      reviewDays: metric(reviewDates.current.size, reviewDates.previous.size),
      reviewRate: metric(pct(reviewDates.current.size, days), pct(reviewDates.previous.size, days)),
      testAvg: metric(avg(wordTests.current), avg(wordTests.previous)),
      overdueNow,
    },
    accuracy: {
      overall: metric(pct(overall.current.correct, overall.current.total), pct(overall.previous.correct, overall.previous.total)),
      solved: metric(overall.current.total, overall.previous.total),
      weekly: Array.from(weekly.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([weekStart, t]) => ({ weekStart, rate: pct(t.correct, t.total) ?? 0, count: t.total })),
      byDomain: domainRows,
    },
    weakDomains,
    level: {
      start: startLevel,
      end: endLevel,
      changes: within.map((a) => ({
        date: toKstDateKey(a.assessedAt),
        level: a.overallLevel,
        type: a.assessmentType,
      })),
    },
    writing: {
      graded: metric(writingGraded.current, writingGraded.previous),
      errorTypes,
    },
  }
}
