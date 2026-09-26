'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '@/lib/auth'
import { getOwnerAcademyIds } from '@/lib/branch'
import { prisma } from '@/lib/prisma/client'
import {
  LATE_GRACE_MAX,
  LATE_GRACE_MIN,
  validateScheduleRow,
  type AttendanceSettingValues,
  type ClassScheduleRow,
} from './constants'

type ActionResult = { error?: string }

const NO_PERMISSION = '권한이 없습니다.'

/** 학원장이 관리하는 학원 ID (본원 + 소유 지점) */
async function getOwnerScope(): Promise<{ userId: string; academyIds: string[] } | null> {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ACADEMY_OWNER' || !user.academyId) return null
  const ids = await getOwnerAcademyIds(user.id)
  return { userId: user.id, academyIds: ids.length > 0 ? ids : [user.academyId] }
}

// ─── 출결 설정 (학원장 전용) ───────────────────────────────────────────────────

export async function updateAttendanceSetting(
  academyId: string,
  input: AttendanceSettingValues,
): Promise<ActionResult> {
  const scope = await getOwnerScope()
  if (!scope || !scope.academyIds.includes(academyId)) return { error: NO_PERMISSION }

  if (input.mode !== 'CLASS' && input.mode !== 'ACADEMY') return { error: '출결 방식을 선택해주세요.' }
  const grace = Number(input.lateGraceMinutes)
  if (!Number.isInteger(grace) || grace < LATE_GRACE_MIN || grace > LATE_GRACE_MAX) {
    return { error: `지각 허용시간은 ${LATE_GRACE_MIN}~${LATE_GRACE_MAX}분 사이로 입력해주세요.` }
  }

  const data = {
    mode: input.mode,
    lateGraceMinutes: grace,
    autoAbsentOnEnd: !!input.autoAbsentOnEnd,
    notifyCheckIn: !!input.notifyCheckIn,
    notifyCheckOut: !!input.notifyCheckOut,
    notifyAbsent: !!input.notifyAbsent,
    includeStudySummary: !!input.includeStudySummary,
  }
  // 모드는 기록 생성 시점에 AttendanceRecord.mode로 저장되므로 과거 기록에는 영향 없음
  await prisma.attendanceSetting.upsert({
    where: { academyId },
    create: { academyId, ...data },
    update: data,
  })

  revalidatePath('/owner/attendance/settings')
  return {}
}

// ─── 반 시간표 ─────────────────────────────────────────────────────────────────

/** 반 정기 시간표 전체 교체 — 학원장 */
export async function saveClassSchedules(classId: string, rows: ClassScheduleRow[]): Promise<ActionResult> {
  const scope = await getOwnerScope()
  if (!scope) return { error: NO_PERMISSION }

  const cls = await prisma.class.findFirst({
    where: { id: classId, academyId: { in: scope.academyIds } },
    select: { id: true },
  })
  if (!cls) return { error: '반을 찾을 수 없습니다.' }

  if (rows.length > 50) return { error: '시간표는 최대 50개까지 등록할 수 있습니다.' }
  for (const row of rows) {
    const error = validateScheduleRow(row)
    if (error) return { error }
  }

  // 같은 요일 시간대 겹침 방지
  const sorted = [...rows].sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime))
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]
    const cur = sorted[i]
    if (prev.dayOfWeek === cur.dayOfWeek && cur.startTime < prev.endTime) {
      return { error: '같은 요일에 겹치는 시간이 있습니다.' }
    }
  }

  await prisma.$transaction([
    prisma.classSchedule.deleteMany({ where: { classId } }),
    prisma.classSchedule.createMany({
      data: sorted.map((r) => ({ classId, dayOfWeek: r.dayOfWeek, startTime: r.startTime, endTime: r.endTime })),
    }),
  ])

  revalidatePath(`/owner/classes/${classId}`)
  return {}
}
