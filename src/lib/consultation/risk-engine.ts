import 'server-only'

import { Prisma } from '@/generated/prisma'
import { prisma } from '@/lib/prisma/client'
import { addDaysToDateKey, diffDateKeys, kstDateStart, toKstDateKey, todayKst } from './constants'
import {
  RISK_CRITERION_KEYS,
  RISK_MIN_ANSWERS,
  RISK_MIN_BASE_STUDY_DAYS,
  RISK_MIN_COUNT,
  RISK_WINDOW_DAYS,
  readRiskSettings,
  type RiskCriterionKey,
  type RiskLevelValue,
  type RiskReasonItem,
  type RiskReasons,
  type RiskSettings,
  type RiskSkipReason,
} from './risk-constants'

/**
 * 퇴원 위험 신호 계산 (규칙 기반).
 *
 * 학습일 = 아래 활동이 하나라도 있는 KST 날짜
 *   XP 적립(단어·미션·연습 등 대부분의 학습), 연습 기록, 테스트 완료, 데일리 미션 완료, 단어 시험 응시
 * 정답률 = 완료된 테스트 문항 응답 + 연습 기록 합계
 *
 * 학생 수 × 일수만큼 행을 읽지 않도록 DB에서 (학생, 날짜) 단위로 집계해서 가져온다.
 */

const ID_CHUNK = 500

type Tally = { correct: number; total: number }

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

/*
 * 원시 SQL은 $queryRawUnsafe + 위치 파라미터($1, $2 …)로 실행한다.
 * Prisma.sql 조각을 중첩하면 Next의 서버 액션/RSC 번들에 Prisma 런타임이 따로 로드되어
 * instanceof 검사가 실패하고 조각이 값으로 바인딩된다. SQL 문자열에는 상수만 넣고 값은 모두 파라미터로 넘긴다.
 * 날짜 컬럼은 UTC로 저장된 timestamp — 파라미터도 ::timestamp(UTC ISO)로 비교한다.
 */

/** timestamp 컬럼 → KST 날짜 문자열 */
function kstDay(col: string): string {
  return `to_char((${col} AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD')`
}

/** 학습 활동 (student_id, at) 합집합 — ids=$1, from=$2 (withFrom=false면 기간 제한 없음) */
function activityUnionSql(withFrom: boolean): string {
  const since = (col: string) => (withFrom ? `AND ${col} >= $2::timestamp` : '')
  return `
    SELECT student_id, created_at AS at FROM student_xp
      WHERE student_id = ANY($1::text[]) ${since('created_at')}
    UNION ALL
    SELECT student_id, created_at FROM practice_logs
      WHERE student_id = ANY($1::text[]) ${since('created_at')}
    UNION ALL
    SELECT student_id, completed_at FROM test_sessions
      WHERE student_id = ANY($1::text[]) AND status IN ('COMPLETED', 'GRADED') AND completed_at IS NOT NULL ${since('completed_at')}
    UNION ALL
    SELECT student_id, completed_at FROM daily_missions
      WHERE student_id = ANY($1::text[]) AND is_completed = true AND completed_at IS NOT NULL ${since('completed_at')}
    UNION ALL
    SELECT student_id, taken_at FROM word_test_attempts
      WHERE student_id = ANY($1::text[]) ${since('taken_at')}
  `
}

/** 학생별 학습일(KST) 집합 — from 이후 */
async function loadStudyDays(ids: string[], from: Date): Promise<Map<string, Set<string>>> {
  const map = new Map<string, Set<string>>()
  const sql = `
    SELECT student_id AS "studentId", ${kstDay('at')} AS day
    FROM (${activityUnionSql(true)}) a
    GROUP BY 1, 2
  `
  for (const part of chunk(ids, ID_CHUNK)) {
    const rows = await prisma.$queryRawUnsafe<{ studentId: string; day: string }[]>(sql, part, from.toISOString())
    for (const r of rows) {
      const set = map.get(r.studentId) ?? new Set<string>()
      set.add(r.day)
      map.set(r.studentId, set)
    }
  }
  return map
}

/** 학생별 마지막 학습일(KST) — 기간 제한 없음 (최근 기간에 기록이 없는 학생만 조회) */
async function loadLastStudyDay(ids: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  const sql = `
    SELECT student_id AS "studentId", ${kstDay('MAX(at)')} AS day
    FROM (${activityUnionSql(false)}) a
    GROUP BY 1
  `
  for (const part of chunk(ids, ID_CHUNK)) {
    const rows = await prisma.$queryRawUnsafe<{ studentId: string; day: string }[]>(sql, part)
    for (const r of rows) map.set(r.studentId, r.day)
  }
  return map
}

/** 학생별 기간(current/previous) 정답 집계 — ids=$1, prevStart=$2, curStart=$3, end=$4 */
const ACCURACY_SQL = `
  SELECT student_id AS "studentId", bucket, SUM(total)::int AS total, SUM(correct)::int AS correct
  FROM (
    SELECT ts.student_id,
           CASE WHEN ts.completed_at >= $3::timestamp THEN 'current' ELSE 'previous' END AS bucket,
           COUNT(*) AS total,
           COUNT(*) FILTER (WHERE qr.is_correct) AS correct
    FROM question_responses qr
    JOIN test_sessions ts ON ts.id = qr.session_id
    WHERE ts.student_id = ANY($1::text[])
      AND ts.status IN ('COMPLETED', 'GRADED')
      AND ts.completed_at >= $2::timestamp AND ts.completed_at < $4::timestamp
      AND qr.is_correct IS NOT NULL
    GROUP BY 1, 2
    UNION ALL
    SELECT student_id,
           CASE WHEN created_at >= $3::timestamp THEN 'current' ELSE 'previous' END,
           SUM(total_count),
           SUM(correct_count)
    FROM practice_logs
    WHERE student_id = ANY($1::text[])
      AND created_at >= $2::timestamp AND created_at < $4::timestamp
      AND total_count > 0
    GROUP BY 1, 2
  ) a
  GROUP BY 1, 2
`

async function loadAccuracy(
  ids: string[],
  prevStart: Date,
  curStart: Date,
  end: Date,
): Promise<Map<string, { current: Tally; previous: Tally }>> {
  const map = new Map<string, { current: Tally; previous: Tally }>()
  for (const part of chunk(ids, ID_CHUNK)) {
    const rows = await prisma.$queryRawUnsafe<{ studentId: string; bucket: 'current' | 'previous'; total: number; correct: number }[]>(
      ACCURACY_SQL,
      part,
      prevStart.toISOString(),
      curStart.toISOString(),
      end.toISOString(),
    )
    for (const r of rows) {
      const entry = map.get(r.studentId) ?? { current: { correct: 0, total: 0 }, previous: { correct: 0, total: 0 } }
      entry[r.bucket] = { correct: r.correct, total: r.total }
      map.set(r.studentId, entry)
    }
  }
  return map
}

export type RiskEvaluation = { level: RiskLevelValue; reasons: RiskReasons }

type StudentInput = {
  enrolledKey: string
  studyDays: Set<string>
  lastStudyKey: string | null
  accuracy: { current: Tally; previous: Tally } | undefined
}

/** 학생 1명 판정 (순수 함수) */
export function evaluateRisk(input: StudentInput, settings: RiskSettings, today: string): RiskEvaluation {
  const curFrom = addDaysToDateKey(today, -(RISK_WINDOW_DAYS - 1))
  const prevFrom = addDaysToDateKey(curFrom, -RISK_WINDOW_DAYS)
  const items: RiskReasonItem[] = []
  const skipped: RiskReasons['skipped'] = []
  const skip = (key: RiskCriterionKey, why: RiskSkipReason) => skipped.push({ key, why })

  for (const key of RISK_CRITERION_KEYS) {
    if (!settings.enabled[key]) {
      skip(key, 'DISABLED')
      continue
    }

    if (key === 'INACTIVE') {
      const never = !input.lastStudyKey
      // 오늘 등록한 학생 등 기준일이 미래로 잡히지 않도록 0 하한
      const days = Math.max(0, diffDateKeys(input.lastStudyKey ?? input.enrolledKey, today))
      if (days >= settings.inactiveDays) items.push({ key, days, never })
      continue
    }

    if (key === 'STUDY_DROP') {
      if (input.enrolledKey > prevFrom) {
        skip(key, 'TOO_NEW')
        continue
      }
      let current = 0
      let previous = 0
      for (const d of Array.from(input.studyDays)) {
        if (d >= curFrom && d <= today) current++
        else if (d >= prevFrom && d < curFrom) previous++
      }
      if (previous < RISK_MIN_BASE_STUDY_DAYS) {
        skip(key, 'LOW_BASE')
        continue
      }
      const dropPct = Math.round(((previous - current) / previous) * 100)
      if (dropPct >= settings.studyDropPct) items.push({ key, current, previous, dropPct })
      continue
    }

    // ACCURACY_DROP
    const acc = input.accuracy
    if (!acc || acc.current.total < RISK_MIN_ANSWERS || acc.previous.total < RISK_MIN_ANSWERS) {
      skip(key, 'LOW_DATA')
      continue
    }
    const current = (acc.current.correct / acc.current.total) * 100
    const previous = (acc.previous.correct / acc.previous.total) * 100
    const dropPp = previous - current
    if (dropPp >= settings.accuracyDropPp) {
      items.push({
        key,
        current: Math.round(current * 10) / 10,
        previous: Math.round(previous * 10) / 10,
        dropPp: Math.round(dropPp * 10) / 10,
      })
    }
  }

  const level: RiskLevelValue = items.length >= RISK_MIN_COUNT ? 'RISK' : items.length === 1 ? 'WATCH' : 'NORMAL'
  return { level, reasons: { version: 1, items, skipped, settings } }
}

export type AcademyRiskResult = {
  academyId: string
  students: number
  watch: number
  risk: number
  /** 기준별 판정 가능 학생 수 — 0이면 데이터가 없어 사실상 비활성 */
  evaluable: Record<RiskCriterionKey, number>
}

/**
 * 학원 1곳의 재원(ACTIVE) 학생 전체를 계산해 스냅샷을 교체한다.
 * 휴원·퇴원·다른 학원으로 옮긴 학생의 이전 스냅샷도 함께 정리된다.
 */
export async function computeAcademyRisk(academyId: string, settingsJson: unknown, today = todayKst()): Promise<AcademyRiskResult> {
  const settings = readRiskSettings(settingsJson)
  const students = await prisma.student.findMany({
    where: { status: 'ACTIVE', user: { academyId, isDeleted: false } },
    select: { id: true, createdAt: true },
  })
  const ids = students.map((s) => s.id)
  const evaluable: Record<RiskCriterionKey, number> = { INACTIVE: 0, STUDY_DROP: 0, ACCURACY_DROP: 0 }

  const curFrom = addDaysToDateKey(today, -(RISK_WINDOW_DAYS - 1))
  const prevFrom = addDaysToDateKey(curFrom, -RISK_WINDOW_DAYS)
  const prevStart = kstDateStart(prevFrom)
  const curStart = kstDateStart(curFrom)
  const end = kstDateStart(addDaysToDateKey(today, 1))

  const [studyDays, accuracy] =
    ids.length > 0
      ? await Promise.all([loadStudyDays(ids, prevStart), loadAccuracy(ids, prevStart, curStart, end)])
      : [new Map<string, Set<string>>(), new Map<string, { current: Tally; previous: Tally }>()]

  // 최근 28일 기록이 없는 학생만 전체 기간에서 마지막 학습일 조회
  const noRecent = ids.filter((id) => !studyDays.get(id)?.size)
  const lastOlder = noRecent.length > 0 ? await loadLastStudyDay(noRecent) : new Map<string, string>()

  const calculatedAt = new Date()
  let watch = 0
  let risk = 0
  const data: Prisma.StudentRiskSnapshotCreateManyInput[] = students.map((s) => {
    const days = studyDays.get(s.id) ?? new Set<string>()
    const recentLast = Array.from(days).sort().pop() ?? null
    const result = evaluateRisk(
      {
        enrolledKey: toKstDateKey(s.createdAt),
        studyDays: days,
        lastStudyKey: recentLast ?? lastOlder.get(s.id) ?? null,
        accuracy: accuracy.get(s.id),
      },
      settings,
      today,
    )
    if (result.level === 'WATCH') watch++
    else if (result.level === 'RISK') risk++
    const skippedKeys = new Set(result.reasons.skipped.map((k) => k.key))
    for (const key of RISK_CRITERION_KEYS) if (!skippedKeys.has(key)) evaluable[key]++
    return {
      academyId,
      studentId: s.id,
      level: result.level,
      reasons: result.reasons as unknown as Prisma.InputJsonValue,
      calculatedAt,
    }
  })

  await prisma.$transaction([
    prisma.studentRiskSnapshot.deleteMany({
      where: ids.length > 0 ? { OR: [{ academyId }, { studentId: { in: ids } }] } : { academyId },
    }),
    ...chunk(data, 1000).map((part) => prisma.studentRiskSnapshot.createMany({ data: part })),
  ])

  return { academyId, students: students.length, watch, risk, evaluable }
}

/** 전체 학원 일일 계산 (cron) — 학원별 설정을 각각 적용 */
export async function runDailyRiskCalculation(): Promise<AcademyRiskResult[]> {
  const academies = await prisma.academy.findMany({ select: { id: true, settingsJson: true } })
  const today = todayKst()
  const results: AcademyRiskResult[] = []
  for (const a of academies) {
    try {
      results.push(await computeAcademyRisk(a.id, a.settingsJson, today))
    } catch (err) {
      console.error(`[risk] ${a.id} 계산 실패`, err)
    }
  }
  return results
}
