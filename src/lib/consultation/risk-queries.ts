import 'server-only'

import type { Prisma } from '@/generated/prisma'
import { prisma } from '@/lib/prisma/client'
import { studentScopeWhere, type ConsultationActor } from './access'
import {
  RISK_CRITERION_KEYS,
  parseRiskReasons,
  readRiskSettings,
  riskReasonText,
  type RiskCriterionKey,
  type RiskLevelValue,
  type RiskSettings,
} from './risk-constants'

export type RiskListItem = {
  studentId: string
  name: string
  grade: string | null
  className: string | null
  teacherName: string | null
  academyId: string
  academyLabel: string
  level: Exclude<RiskLevelValue, 'NORMAL'>
  /** 사유 문장 ("7일째 학습하지 않음" 등) */
  reasons: string[]
  calculatedAt: string
  /** 가장 최근 퇴원방지 상담일 */
  lastRetentionAt: string | null
  hasParentPhone: boolean
  upcomingAppointment: { id: string; scheduledAt: string } | null
}

export type RiskCriterionStatus = {
  key: RiskCriterionKey
  enabled: boolean
  /** 판정 가능했던 학생 수 (0이면 데이터가 없어 자동 제외된 상태) */
  evaluable: number
}

export type RiskListResult = {
  items: RiskListItem[]
  /** 조회 범위 재원생 중 계산된 학생 수 (0이면 아직 계산 전) */
  calculatedStudents: number
  lastCalculatedAt: string | null
  criteria: RiskCriterionStatus[]
  settings: RiskSettings
}

/**
 * 퇴원 위험군 (주의·위험) — 재원생 상담 탭.
 * 교사는 담당 반 학생만, 학원장은 선택한 학원(본원/지점) 범위.
 */
export async function getRiskStudents(actor: ConsultationActor, viewAcademyIds?: string[]): Promise<RiskListResult> {
  const academyIds =
    actor.role === 'TEACHER'
      ? [actor.academyId]
      : (viewAcademyIds ?? actor.academyIds).filter((id) => actor.academyIds.includes(id))

  const studentWhere: Prisma.StudentWhereInput = {
    AND: [studentScopeWhere(actor), { status: 'ACTIVE', user: { academyId: { in: academyIds } } }],
  }

  const [academies, snapshots] = await Promise.all([
    prisma.academy.findMany({
      where: { id: { in: academyIds } },
      select: { id: true, name: true, branchName: true, parentAcademyId: true, settingsJson: true },
    }),
    // 판정 제외 현황 집계를 위해 NORMAL 포함 전체 (재원생 수 수준 — 행이 작음)
    prisma.studentRiskSnapshot.findMany({
      where: { academyId: { in: academyIds }, student: studentWhere },
      select: { studentId: true, level: true, reasons: true, calculatedAt: true },
    }),
  ])

  const labelByAcademy = new Map(
    academies.map((a) => [a.id, a.parentAcademyId ? (a.branchName ?? a.name) : '본원'] as const),
  )
  // 공통 설정이라 본원(없으면 첫 학원) 값을 대표로 표시
  const hq = academies.find((a) => !a.parentAcademyId) ?? academies[0]
  const settings = readRiskSettings(hq?.settingsJson)

  const evaluable: Record<RiskCriterionKey, number> = { INACTIVE: 0, STUDY_DROP: 0, ACCURACY_DROP: 0 }
  let lastCalculatedAt: Date | null = null
  for (const s of snapshots) {
    if (!lastCalculatedAt || s.calculatedAt > lastCalculatedAt) lastCalculatedAt = s.calculatedAt
    const reasons = parseRiskReasons(s.reasons)
    const skipped = new Set(reasons?.skipped.map((k) => k.key) ?? [])
    for (const key of RISK_CRITERION_KEYS) if (!skipped.has(key)) evaluable[key]++
  }

  const flagged = snapshots.filter((s) => s.level !== 'NORMAL')
  const now = new Date()
  const students =
    flagged.length > 0
      ? await prisma.student.findMany({
          where: { id: { in: flagged.map((s) => s.studentId) } },
          select: {
            id: true,
            grade: true,
            parentPhone: true,
            user: { select: { name: true, academyId: true } },
            class: { select: { name: true, teacher: { select: { name: true } } } },
            consultations: {
              where: { type: 'RETENTION' },
              orderBy: { consultedAt: 'desc' },
              take: 1,
              select: { consultedAt: true },
            },
            consultationAppointments: {
              where: { status: 'SCHEDULED', scheduledAt: { gte: now } },
              orderBy: { scheduledAt: 'asc' },
              take: 1,
              select: { id: true, scheduledAt: true },
            },
          },
        })
      : []
  const studentById = new Map(students.map((s) => [s.id, s]))

  const items: RiskListItem[] = []
  for (const snap of flagged) {
    const s = studentById.get(snap.studentId)
    const academyId = s?.user.academyId
    if (!s || !academyId) continue
    const reasons = parseRiskReasons(snap.reasons)
    const appt = s.consultationAppointments[0]
    items.push({
      studentId: s.id,
      name: s.user.name,
      grade: s.grade,
      className: s.class?.name ?? null,
      teacherName: s.class?.teacher?.name ?? null,
      academyId,
      academyLabel: labelByAcademy.get(academyId) ?? '',
      level: snap.level as Exclude<RiskLevelValue, 'NORMAL'>,
      reasons: reasons?.items.map(riskReasonText) ?? [],
      calculatedAt: snap.calculatedAt.toISOString(),
      lastRetentionAt: s.consultations[0]?.consultedAt.toISOString() ?? null,
      hasParentPhone: !!s.parentPhone,
      upcomingAppointment: appt ? { id: appt.id, scheduledAt: appt.scheduledAt.toISOString() } : null,
    })
  }
  // 위험 먼저, 그 안에서 사유 많은 순 → 이름순
  items.sort(
    (a, b) =>
      (a.level === b.level ? 0 : a.level === 'RISK' ? -1 : 1) ||
      b.reasons.length - a.reasons.length ||
      a.name.localeCompare(b.name, 'ko'),
  )

  return {
    items,
    calculatedStudents: snapshots.length,
    lastCalculatedAt: lastCalculatedAt?.toISOString() ?? null,
    criteria: RISK_CRITERION_KEYS.map((key) => ({ key, enabled: settings.enabled[key], evaluable: evaluable[key] })),
    settings,
  }
}

export type StudentRiskBadge = { level: Exclude<RiskLevelValue, 'NORMAL'>; reasons: string[] }

/** 스냅샷 → 배지 데이터 (정상·재원생 아님이면 null) */
export function toRiskBadge(
  snapshot: { level: RiskLevelValue; reasons: Prisma.JsonValue } | null | undefined,
  status: string,
): StudentRiskBadge | null {
  if (!snapshot || snapshot.level === 'NORMAL' || status !== 'ACTIVE') return null
  return { level: snapshot.level, reasons: parseRiskReasons(snapshot.reasons)?.items.map(riskReasonText) ?? [] }
}

/** 학생 1명 위험 배지 (학생 상세용 — 교사·학원장 화면에서만 호출) */
export async function getStudentRiskBadge(studentId: string): Promise<StudentRiskBadge | null> {
  const s = await prisma.student.findUnique({
    where: { id: studentId },
    select: { status: true, riskSnapshot: { select: { level: true, reasons: true } } },
  })
  return s ? toRiskBadge(s.riskSnapshot, s.status) : null
}
