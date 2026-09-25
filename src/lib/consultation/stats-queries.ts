import 'server-only'

import { prisma } from '@/lib/prisma/client'
import {
  appointmentScopeWhere,
  consultationScopeWhere,
  studentScopeWhere,
  type ConsultationActor,
} from './access'
import {
  LEAD_CHANNEL_LABEL,
  LOST_REASON_LABEL,
  addDaysToDateKey,
  kstDateStart,
  type LeadChannelValue,
  type LostReasonValue,
} from './constants'
import { WITHDRAWAL_REASON_LABEL, type WithdrawalReasonValue } from './risk-constants'
import {
  monthsInRange,
  type AssigneeStatsRow,
  type ConsultationStats,
  type RateRow,
  type StatsRange,
} from './stats-constants'

/*
 * 상담 통계 — 모든 집계는 DB에서 (COUNT/AVG/GROUP BY). 행 단위로 불러와 JS에서 세지 않는다.
 *
 * 원시 SQL은 $queryRawUnsafe + 위치 파라미터 (risk-engine.ts 주석 참고 — Prisma.sql 조각 중첩 금지).
 * 공통 파라미터: $1 학원 ID 배열, $2 교사 ID(학원장은 NULL), $3 기간 시작, $4 기간 끝(미포함) — UTC timestamp
 */

/** 문의 권한 범위 (leadScopeWhere와 동일: 학원 범위 + 교사는 본인 담당) */
const LEAD_SCOPE_SQL = `l.academy_id = ANY($1::text[]) AND ($2::text IS NULL OR l.assignee_id = $2::text)`
const LEAD_PERIOD_SQL = `l.created_at >= $3::timestamp AND l.created_at < $4::timestamp`

/** 학생 권한 범위 (studentScopeWhere와 동일: 학원 범위 + 교사는 담당 반) — students s, users u, classes cl 조인 필요 */
const STUDENT_SCOPE_SQL = `u.academy_id = ANY($1::text[]) AND u.is_deleted = false AND ($2::text IS NULL OR cl.teacher_id = $2::text)`

function kstMonth(col: string): string {
  return `to_char((${col} AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Seoul', 'YYYY-MM')`
}

/** 코호트(기간 내 생성 문의) 요약 + 퍼널 */
const COHORT_SQL = `
  SELECT
    COUNT(*)::int AS total,
    COUNT(*) FILTER (WHERE c.status = 'ENROLLED')::int AS enrolled,
    COUNT(*) FILTER (WHERE c.status = 'ENROLLED' OR c.tested OR c.consulted)::int AS consulted,
    COUNT(*) FILTER (WHERE c.status = 'ENROLLED' OR c.tested)::int AS tested,
    (AVG(EXTRACT(EPOCH FROM (c.enrolled_at - c.created_at)) / 86400.0)
      FILTER (WHERE c.status = 'ENROLLED' AND c.enrolled_at IS NOT NULL))::float8 AS "avgDays"
  FROM (
    SELECT
      l.status,
      l.created_at,
      (SELECT MIN(h.changed_at) FROM lead_status_history h
         WHERE h.lead_id = l.id AND h.to_status = 'ENROLLED') AS enrolled_at,
      (l.status IN ('CONSULTED', 'PENDING')
        OR EXISTS (SELECT 1 FROM consultations cs WHERE cs.lead_id = l.id)
        OR EXISTS (SELECT 1 FROM lead_status_history h
                     WHERE h.lead_id = l.id AND h.to_status IN ('CONSULTED', 'PENDING'))) AS consulted,
      EXISTS (SELECT 1 FROM placement_attempts pa
                WHERE pa.lead_id = l.id AND pa.status = 'COMPLETED') AS tested
    FROM leads l
    WHERE ${LEAD_SCOPE_SQL} AND ${LEAD_PERIOD_SQL}
  ) c
`

/** 코호트 분해 — 채널 / 유입경로 / 담당자 / 이탈 사유 (한 번의 스캔으로 GROUPING SETS) */
const BREAKDOWN_SQL = `
  SELECT
    CASE WHEN GROUPING(t.channel) = 0 THEN 'channel'
         WHEN GROUPING(t.src) = 0 THEN 'source'
         WHEN GROUPING(t.assignee_id) = 0 THEN 'assignee'
         ELSE 'lost' END AS dim,
    CASE WHEN GROUPING(t.channel) = 0 THEN t.channel
         WHEN GROUPING(t.src) = 0 THEN t.src
         WHEN GROUPING(t.assignee_id) = 0 THEN t.assignee_id
         ELSE t.lost_reason END AS key,
    COUNT(*)::int AS total,
    COUNT(*) FILTER (WHERE t.status = 'ENROLLED')::int AS enrolled,
    COUNT(*) FILTER (WHERE t.status = 'LOST')::int AS lost
  FROM (
    SELECT l.channel::text AS channel,
           NULLIF(BTRIM(l.source), '') AS src,
           l.assignee_id,
           l.lost_reason::text AS lost_reason,
           l.status
    FROM leads l
    WHERE ${LEAD_SCOPE_SQL} AND ${LEAD_PERIOD_SQL}
  ) t
  GROUP BY GROUPING SETS ((t.channel), (t.src), (t.assignee_id), (t.lost_reason))
`

/** 월별 시계열 + 퇴원 사유 (UNION ALL 한 번에) */
const SERIES_SQL = `
  SELECT 'lead' AS kind, ${kstMonth('l.created_at')} AS key, COUNT(*)::int AS n
  FROM leads l
  WHERE ${LEAD_SCOPE_SQL} AND ${LEAD_PERIOD_SQL}
  GROUP BY 2
  UNION ALL
  SELECT 'enroll', ${kstMonth('h.changed_at')}, COUNT(DISTINCT l.id)::int
  FROM lead_status_history h
  JOIN leads l ON l.id = h.lead_id
  WHERE h.to_status = 'ENROLLED' AND h.changed_at >= $3::timestamp AND h.changed_at < $4::timestamp
    AND l.status = 'ENROLLED' AND ${LEAD_SCOPE_SQL}
  GROUP BY 2
  UNION ALL
  SELECT 'withdraw', ${kstMonth('c.withdrawn_on')}, COUNT(*)::int
  FROM consultations c
  JOIN students s ON s.id = c.student_id
  JOIN users u ON u.id = s.user_id
  LEFT JOIN classes cl ON cl.id = s.class_id
  WHERE c.type = 'WITHDRAWAL' AND c.withdrawn_on >= $3::timestamp AND c.withdrawn_on < $4::timestamp
    AND ${STUDENT_SCOPE_SQL}
  GROUP BY 2
  UNION ALL
  SELECT 'withdraw_reason', COALESCE(c.withdrawal_reason::text, 'NONE'), COUNT(*)::int
  FROM consultations c
  JOIN students s ON s.id = c.student_id
  JOIN users u ON u.id = s.user_id
  LEFT JOIN classes cl ON cl.id = s.class_id
  WHERE c.type = 'WITHDRAWAL' AND c.withdrawn_on >= $3::timestamp AND c.withdrawn_on < $4::timestamp
    AND ${STUDENT_SCOPE_SQL}
  GROUP BY 2
`

type CohortRow = { total: number; enrolled: number; consulted: number; tested: number; avgDays: number | null }
type BreakdownRow = { dim: 'channel' | 'source' | 'assignee' | 'lost'; key: string | null; total: number; enrolled: number; lost: number }
type SeriesRow = { kind: 'lead' | 'enroll' | 'withdraw' | 'withdraw_reason'; key: string; n: number }

const UNASSIGNED_LABEL = '미지정'

/**
 * 상담 통계 대시보드 데이터.
 * 학원장: 선택한 학원(본원/지점) 전체 / 교사: 본인 담당 문의·담당 반 학생만 (담당자별 표는 학원장만)
 */
export async function getConsultationStats(
  actor: ConsultationActor,
  range: StatsRange,
  viewAcademyIds?: string[],
): Promise<ConsultationStats> {
  const isOwner = actor.role === 'ACADEMY_OWNER'
  const academyIds = isOwner
    ? (viewAcademyIds ?? actor.academyIds).filter((id) => actor.academyIds.includes(id))
    : [actor.academyId]
  // Prisma 권한 헬퍼를 조회 범위 학원으로 좁혀 재사용
  const scoped: ConsultationActor = { ...actor, academyIds }

  const start = kstDateStart(range.from)
  const end = kstDateStart(addDaysToDateKey(range.to, 1))
  const params = [academyIds, isOwner ? null : actor.userId, start.toISOString(), end.toISOString()] as const

  const [cohortRows, breakdown, series, appointmentGroups, riskGroups, leadCounselGroups, studentCounselGroups] =
    await Promise.all([
      prisma.$queryRawUnsafe<CohortRow[]>(COHORT_SQL, ...params),
      prisma.$queryRawUnsafe<BreakdownRow[]>(BREAKDOWN_SQL, ...params),
      prisma.$queryRawUnsafe<SeriesRow[]>(SERIES_SQL, ...params),
      prisma.consultationAppointment.groupBy({
        by: ['status'],
        where: {
          AND: [
            appointmentScopeWhere(scoped),
            { scheduledAt: { gte: start, lt: end }, status: { in: ['COMPLETED', 'NO_SHOW'] } },
          ],
        },
        _count: { _all: true },
      }),
      prisma.studentRiskSnapshot.groupBy({
        by: ['level'],
        where: {
          academyId: { in: academyIds },
          student: { AND: [studentScopeWhere(scoped), { status: 'ACTIVE' }] },
        },
        _count: { _all: true },
      }),
      isOwner
        ? prisma.consultation.groupBy({
            by: ['counselorId'],
            where: {
              AND: [consultationScopeWhere(scoped), { leadId: { not: null }, consultedAt: { gte: start, lt: end } }],
            },
            _count: { _all: true },
          })
        : Promise.resolve([]),
      isOwner
        ? prisma.consultation.groupBy({
            by: ['counselorId'],
            where: {
              AND: [consultationScopeWhere(scoped), { studentId: { not: null }, consultedAt: { gte: start, lt: end } }],
            },
            _count: { _all: true },
          })
        : Promise.resolve([]),
    ])

  const cohort = cohortRows[0] ?? { total: 0, enrolled: 0, consulted: 0, tested: 0, avgDays: null }

  // ── 시계열 ──
  const monthly = monthsInRange(range).map((month) => ({ month, leads: 0, enrolled: 0, withdrawals: 0 }))
  const byMonth = new Map(monthly.map((m) => [m.month, m]))
  const withdrawalReasonCounts = new Map<string, number>()
  for (const r of series) {
    if (r.kind === 'withdraw_reason') {
      withdrawalReasonCounts.set(r.key, r.n)
      continue
    }
    const m = byMonth.get(r.key)
    if (!m) continue
    if (r.kind === 'lead') m.leads = r.n
    else if (r.kind === 'enroll') m.enrolled = r.n
    else m.withdrawals = r.n
  }

  // ── 분해 ──
  const channels: RateRow[] = (Object.keys(LEAD_CHANNEL_LABEL) as LeadChannelValue[]).map((key) => {
    const row = breakdown.find((b) => b.dim === 'channel' && b.key === key)
    return { key, label: LEAD_CHANNEL_LABEL[key], total: row?.total ?? 0, enrolled: row?.enrolled ?? 0 }
  })

  const sources: RateRow[] = breakdown
    .filter((b) => b.dim === 'source')
    .map((b) => ({ key: b.key ?? '', label: b.key ?? '미입력', total: b.total, enrolled: b.enrolled }))
    .sort((a, b) => b.total - a.total || (a.key === '' ? 1 : b.key === '' ? -1 : a.label.localeCompare(b.label, 'ko')))

  const lostByKey = new Map(breakdown.filter((b) => b.dim === 'lost').map((b) => [b.key ?? 'NONE', b.lost]))
  const lostReasons: ConsultationStats['lostReasons'] = [
    ...(Object.keys(LOST_REASON_LABEL) as LostReasonValue[]).map((key) => ({
      key,
      label: LOST_REASON_LABEL[key],
      count: lostByKey.get(key) ?? 0,
    })),
    { key: 'NONE' as const, label: '사유 미입력', count: lostByKey.get('NONE') ?? 0 },
  ].filter((r) => r.key !== 'NONE' || r.count > 0)

  const withdrawalReasons: ConsultationStats['withdrawalReasons'] = [
    ...(Object.keys(WITHDRAWAL_REASON_LABEL) as WithdrawalReasonValue[]).map((key) => ({
      key,
      label: WITHDRAWAL_REASON_LABEL[key],
      count: withdrawalReasonCounts.get(key) ?? 0,
    })),
    { key: 'NONE' as const, label: '사유 미입력', count: withdrawalReasonCounts.get('NONE') ?? 0 },
  ].filter((r) => r.key !== 'NONE' || r.count > 0)

  // ── 담당자 (학원장만) ──
  let assignees: AssigneeStatsRow[] | null = null
  if (isOwner) {
    const rows = new Map<string, AssigneeStatsRow>()
    const rowFor = (userId: string | null) => {
      const k = userId ?? ''
      let row = rows.get(k)
      if (!row) {
        row = { userId, name: UNASSIGNED_LABEL, leads: 0, leadConsultations: 0, studentConsultations: 0, enrolled: 0 }
        rows.set(k, row)
      }
      return row
    }
    for (const b of breakdown) {
      if (b.dim !== 'assignee') continue
      const row = rowFor(b.key)
      row.leads = b.total
      row.enrolled = b.enrolled
    }
    for (const g of leadCounselGroups) rowFor(g.counselorId).leadConsultations = g._count._all
    for (const g of studentCounselGroups) rowFor(g.counselorId).studentConsultations = g._count._all

    const userIds = Array.from(rows.values()).flatMap((r) => (r.userId ? [r.userId] : []))
    const users =
      userIds.length > 0
        ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } })
        : []
    const nameById = new Map(users.map((u) => [u.id, u.name]))
    assignees = Array.from(rows.values())
      .map((r) => ({ ...r, name: r.userId ? (nameById.get(r.userId) ?? '(알 수 없음)') : UNASSIGNED_LABEL }))
      .sort(
        (a, b) =>
          (a.userId === null ? 1 : 0) - (b.userId === null ? 1 : 0) ||
          b.leads - a.leads ||
          b.leadConsultations + b.studentConsultations - (a.leadConsultations + a.studentConsultations) ||
          a.name.localeCompare(b.name, 'ko'),
      )
  }

  const apptCount = (status: string) => appointmentGroups.find((g) => g.status === status)?._count._all ?? 0
  const noShows = apptCount('NO_SHOW')
  const riskCount = (level: string) => riskGroups.find((g) => g.level === level)?._count._all ?? 0

  return {
    range,
    kpi: {
      newLeads: cohort.total,
      enrolled: cohort.enrolled,
      avgDaysToEnroll: cohort.avgDays === null ? null : Number(cohort.avgDays),
      appointmentsDecided: apptCount('COMPLETED') + noShows,
      noShows,
    },
    monthly,
    funnel: [
      { key: 'lead', label: '문의', count: cohort.total },
      { key: 'consulted', label: '상담완료', count: cohort.consulted },
      { key: 'tested', label: '레벨테스트 완료', count: cohort.tested },
      { key: 'enrolled', label: '등록', count: cohort.enrolled },
    ],
    channels,
    sources,
    assignees,
    lostReasons,
    withdrawalReasons,
    risk: {
      watch: riskCount('WATCH'),
      risk: riskCount('RISK'),
      calculated: riskGroups.length > 0,
    },
  }
}
