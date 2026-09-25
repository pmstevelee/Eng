import 'server-only'

import { prisma } from '@/lib/prisma/client'
import { leadScopeWhere, type ConsultationActor } from './access'
import {
  DEFAULT_RETENTION_MONTHS,
  PURGED_LEAD_NAME,
  PURGE_NOTICE_DAYS,
  PURGE_TARGET_STATUSES,
  addMonthsToDate,
  readRetentionMonths,
  type LeadStatusValue,
} from './constants'

/**
 * 미등록 문의 개인정보 파기
 * - 대상: LOST·ON_HOLD 상태에서 마지막 활동일(lastActivityAt) + 보관기간이 지난 문의 (ENROLLED 제외)
 * - Lead 행은 남기고 통계용 필드(채널·유입경로·상태·이탈 사유·날짜·담당자)만 유지
 * - 이름·연락처·학교·상담 기록 본문·메모·웹 신청 내용·알림 발송 기록의 연락처와 변수를 삭제
 */

const DAY_MS = 24 * 60 * 60 * 1000
/** 한 번에 파기하는 최대 건수 (트랜잭션 크기 제한) */
const PURGE_BATCH = 200

/** 학원별 보관기간 — 학원 설정 → 본원 설정 → 기본값 */
export async function getRetentionByAcademy(academyIds: string[]): Promise<Map<string, number>> {
  const rows = await prisma.academy.findMany({
    where: { id: { in: academyIds } },
    select: { id: true, settingsJson: true, parentAcademy: { select: { settingsJson: true } } },
  })
  return new Map(
    rows.map((a) => [
      a.id,
      readRetentionMonths(a.settingsJson) ?? readRetentionMonths(a.parentAcademy?.settingsJson) ?? DEFAULT_RETENTION_MONTHS,
    ]),
  )
}

/** 이 시각 이전에 마지막 활동한 문의가 파기 대상 (지금 - 보관기간) */
function purgeCutoff(retentionMonths: number, now: Date): Date {
  return addMonthsToDate(now, -retentionMonths)
}

/**
 * 문의 개인정보 파기 (한 트랜잭션, 일괄 실행).
 * 모든 문장이 "미파기·미등록" 조건을 다시 확인하고 Lead 행을 마지막에 파기 처리하므로,
 * 이미 파기됐거나 그사이 등록 전환된 문의는 건드리지 않는다. (원격 DB 왕복이 길어 대화형 트랜잭션은 사용하지 않음)
 * @returns 파기한 문의 수
 */
export async function purgeLeads(leadIds: string[]): Promise<number> {
  if (leadIds.length === 0) return 0
  const now = new Date()
  const target = { id: { in: leadIds }, purgedAt: null, status: { not: 'ENROLLED' as const } }
  const childOf = { leadId: { in: leadIds }, lead: target }
  // 원시 SQL용 동일 조건 ($1 = 문의 ID 배열)
  const rawTarget = `"lead_id" IN (SELECT "id" FROM "leads" WHERE "id" = ANY($1::text[]) AND "purged_at" IS NULL AND "status" <> 'ENROLLED')`

  const results = await prisma.$transaction([
    // 상담 기록: 유형·일시·상담자만 남김 (JSON null은 번들 환경 차이로 원시 SQL 사용)
    prisma.$executeRawUnsafe(
      `UPDATE "consultations"
          SET "learning_history" = NULL, "prev_academy" = NULL, "goal" = NULL, "parent_needs" = NULL,
              "memo" = NULL, "parent_comment" = NULL, "report_snapshot" = NULL,
              "report_token" = NULL, "report_expires_at" = NULL, "updated_at" = NOW()
        WHERE ${rawTarget}`,
      leadIds,
    ),
    // 비회원 레벨테스트: 레벨 결과는 남기고 응답 내용·결과 공유 링크 삭제
    prisma.$executeRawUnsafe(
      `UPDATE "placement_attempts"
          SET "history" = '[]'::jsonb, "pending" = NULL, "writing_answers" = '[]'::jsonb,
              "result_token" = NULL, "result_expires_at" = NULL, "updated_at" = NOW()
        WHERE ${rawTarget}`,
      leadIds,
    ),
    prisma.placementInvite.updateMany({
      where: { ...childOf, status: { in: ['SENT', 'STARTED'] } },
      data: { status: 'EXPIRED' },
    }),
    prisma.leadActivity.updateMany({ where: childOf, data: { payload: {} } }),
    prisma.notificationLog.updateMany({ where: childOf, data: { phone: '', variables: {}, errorMessage: null } }),
    prisma.followUpTask.updateMany({ where: { ...childOf, completedAt: null }, data: { completedAt: now } }),
    prisma.followUpTask.updateMany({ where: childOf, data: { content: PURGED_LEAD_NAME } }),
    prisma.consultationAppointment.updateMany({
      where: { ...childOf, status: 'SCHEDULED' },
      data: { status: 'CANCELED' },
    }),
    // 마지막: 문의 본문 파기 + 파기 표시
    prisma.lead.updateMany({
      where: target,
      data: {
        studentName: PURGED_LEAD_NAME,
        parentName: null,
        phone: '',
        grade: null,
        school: null,
        preferredSchedule: null,
        lostReasonNote: null,
        webInquiryAt: null,
        purgedAt: now,
      },
    }),
  ])
  const leadResult = results[results.length - 1]
  return typeof leadResult === 'number' ? leadResult : leadResult.count
}

async function writePurgeLog(academyId: string, trigger: 'AUTO' | 'MANUAL', count: number, actorId?: string) {
  if (trigger === 'MANUAL' && count === 0) return
  await prisma.leadPurgeLog.create({ data: { academyId, trigger, count, actorId: actorId ?? null } })
}

/** 학원장 즉시 파기 — 권한 확인은 호출부에서 */
export async function purgeLeadNow(leadId: string, academyId: string, actorId: string): Promise<boolean> {
  const purged = await purgeLeads([leadId])
  await writePurgeLog(academyId, 'MANUAL', purged, actorId)
  return purged > 0
}

export type PurgeRunResult = { academyId: string; purged: number }

/**
 * 매일 예약 작업: 학원별 보관기간이 지난 문의 자동 파기.
 * 파기 후보(LOST·ON_HOLD 미파기 문의)가 있는 학원마다 처리 건수(0건 포함)를 기록한다.
 */
export async function runDailyLeadPurge(): Promise<PurgeRunResult[]> {
  const now = new Date()
  const candidates = await prisma.lead.groupBy({
    by: ['academyId'],
    where: { status: { in: PURGE_TARGET_STATUSES }, purgedAt: null },
  })
  const academyIds = candidates.map((c) => c.academyId)
  const retention = await getRetentionByAcademy(academyIds)
  const results: PurgeRunResult[] = []

  for (const academyId of academyIds) {
    const cutoff = purgeCutoff(retention.get(academyId) ?? DEFAULT_RETENTION_MONTHS, now)
    let purged = 0
    try {
      for (;;) {
        const targets = await prisma.lead.findMany({
          where: {
            academyId,
            status: { in: PURGE_TARGET_STATUSES },
            purgedAt: null,
            lastActivityAt: { lt: cutoff },
          },
          select: { id: true },
          orderBy: { lastActivityAt: 'asc' },
          take: PURGE_BATCH,
        })
        if (targets.length === 0) break
        const done = await purgeLeads(targets.map((t) => t.id))
        purged += done
        if (targets.length < PURGE_BATCH || done === 0) break
      }
    } catch (err) {
      console.error('[purge] 파기 실패:', academyId, err)
    }
    await writePurgeLog(academyId, 'AUTO', purged)
    results.push({ academyId, purged })
  }
  return results
}

// ─── 파기 예정 목록 (상담관리 설정) ─────────────────────────────────────────────

export type PurgeScheduleItem = {
  id: string
  studentName: string
  status: LeadStatusValue
  academyLabel: string
  assigneeName: string | null
  lastActivityAt: string
  /** 파기 예정일 (이 시각 이후 첫 예약 작업에서 파기) */
  purgeAt: string
  daysLeft: number
}

export type PurgeSchedule = {
  items: PurgeScheduleItem[]
  total: number
  lastRun: { at: string; count: number } | null
}

const SCHEDULE_LIMIT = 100

/** 학원장: 앞으로 30일 안에 파기될 문의 (파기일 가까운 순) */
export async function getPurgeSchedule(actor: ConsultationActor): Promise<PurgeSchedule> {
  const now = new Date()
  const retention = await getRetentionByAcademy(actor.academyIds)
  const horizon = new Date(now.getTime() + PURGE_NOTICE_DAYS * DAY_MS)

  // 학원마다 보관기간이 다를 수 있어 학원별 조건을 OR로 묶음
  const where = {
    purgedAt: null,
    status: { in: PURGE_TARGET_STATUSES },
    OR: actor.academyIds.map((academyId) => ({
      academyId,
      lastActivityAt: { lt: purgeCutoff(retention.get(academyId) ?? DEFAULT_RETENTION_MONTHS, horizon) },
    })),
  }

  const [rows, total, lastRun] = await Promise.all([
    prisma.lead.findMany({
      where,
      orderBy: { lastActivityAt: 'asc' },
      take: SCHEDULE_LIMIT,
      select: {
        id: true,
        academyId: true,
        studentName: true,
        status: true,
        lastActivityAt: true,
        assignee: { select: { name: true } },
        academy: { select: { name: true, branchName: true, parentAcademyId: true } },
      },
    }),
    prisma.lead.count({ where }),
    getLastAutoRun(actor.academyIds),
  ])

  const items = rows
    .map((r) => {
      const purgeAt = addMonthsToDate(r.lastActivityAt, retention.get(r.academyId) ?? DEFAULT_RETENTION_MONTHS)
      return {
        id: r.id,
        studentName: r.studentName,
        status: r.status as LeadStatusValue,
        academyLabel: r.academy.parentAcademyId ? (r.academy.branchName ?? r.academy.name) : '본원',
        assigneeName: r.assignee?.name ?? null,
        lastActivityAt: r.lastActivityAt.toISOString(),
        purgeAt: purgeAt.toISOString(),
        daysLeft: Math.max(0, Math.ceil((purgeAt.getTime() - now.getTime()) / DAY_MS)),
      }
    })
    .sort((a, b) => a.purgeAt.localeCompare(b.purgeAt))

  return {
    items,
    total,
    lastRun,
  }
}

/** 가장 최근 자동 파기 실행 (본원·지점 기록을 한 번의 실행으로 합산) */
async function getLastAutoRun(academyIds: string[]): Promise<PurgeSchedule['lastRun']> {
  const latest = await prisma.leadPurgeLog.findFirst({
    where: { academyId: { in: academyIds }, trigger: 'AUTO' },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  })
  if (!latest) return null
  // 한 번의 예약 작업은 수 분 안에 끝나므로 1시간 이내 기록을 같은 실행으로 봄
  const sum = await prisma.leadPurgeLog.aggregate({
    where: {
      academyId: { in: academyIds },
      trigger: 'AUTO',
      createdAt: { gte: new Date(latest.createdAt.getTime() - 60 * 60 * 1000) },
    },
    _sum: { count: true },
  })
  return { at: latest.createdAt.toISOString(), count: sum._sum.count ?? 0 }
}

/** 파기된 문의 요약 (상세 화면 대체 — 통계용 필드만, 권한 범위 안에서만) */
export async function getPurgedLeadSummary(actor: ConsultationActor, leadId: string) {
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, purgedAt: { not: null }, ...leadScopeWhere(actor) },
    select: {
      id: true,
      status: true,
      channel: true,
      source: true,
      lostReason: true,
      createdAt: true,
      purgedAt: true,
      assignee: { select: { name: true } },
    },
  })
  if (!lead || !lead.purgedAt) return null
  return {
    id: lead.id,
    status: lead.status as LeadStatusValue,
    channel: lead.channel,
    source: lead.source,
    lostReason: lead.lostReason,
    assigneeName: lead.assignee?.name ?? null,
    createdAt: lead.createdAt.toISOString(),
    purgedAt: lead.purgedAt.toISOString(),
  }
}
