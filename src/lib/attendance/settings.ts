import 'server-only'
import { prisma } from '@/lib/prisma/client'
import type { AttendanceSettingValues } from './constants'

/** 학원 출결 설정 조회 — 레코드가 없으면 기본값으로 생성 */
export async function getOrCreateAttendanceSetting(academyId: string): Promise<AttendanceSettingValues> {
  const s = await prisma.attendanceSetting.upsert({
    where: { academyId },
    create: { academyId },
    update: {},
    select: {
      mode: true,
      lateGraceMinutes: true,
      autoAbsentOnEnd: true,
      notifyCheckIn: true,
      notifyCheckOut: true,
      notifyAbsent: true,
      includeStudySummary: true,
    },
  })
  return s
}
