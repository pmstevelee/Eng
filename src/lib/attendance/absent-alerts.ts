import 'server-only'

import { prisma } from '@/lib/prisma/client'
import { academyDisplayName } from '@/lib/consultation/notify'
import { absentDedupeKey, createNotificationJob, formatNotifyClock } from './notify'
import { ensureSessionsForDate } from './sessions'
import { dbDate, todayKst } from './time'

export type AbsentScanSummary = { academies: number; sessions: number; queued: number; noCredit: number }

/**
 * 미등원 안내 등록 (크론, notifyAbsent가 켜진 학원만).
 * "수업 시작 + 지각 허용시간"이 지났고 아직 끝나지 않은 수업의 미체크 재원생에게 ABSENT_ALERT를 등록한다.
 * 반 출결은 수업 회차당 1회, 원 출결은 하루 1회 (dedupeKey) — 이미 등록된 학생은 조용히 건너뛴다.
 */
export async function scanAbsentAlerts(now: Date = new Date()): Promise<AbsentScanSummary> {
  const summary: AbsentScanSummary = { academies: 0, sessions: 0, queued: 0, noCredit: 0 }
  const settings = await prisma.attendanceSetting.findMany({
    where: { notifyAbsent: true, academy: { isDeleted: false } },
    select: {
      academyId: true,
      mode: true,
      lateGraceMinutes: true,
      academy: {
        select: {
          name: true,
          businessName: true,
          branchName: true,
          phone: true,
          parentAcademyId: true,
          parentAcademy: { select: { name: true, businessName: true, phone: true } },
        },
      },
    },
  })
  if (settings.length === 0) return summary
  summary.academies = settings.length

  const dateKey = todayKst(now.getTime())
  // 오늘 출결 화면을 아무도 열지 않았어도 회차가 있도록
  await Promise.all(settings.map((s) => ensureSessionsForDate(s.academyId, dateKey)))

  for (const setting of settings) {
    const graceMs = setting.lateGraceMinutes * 60_000
    const sessions = await prisma.classSession.findMany({
      where: {
        date: dbDate(dateKey),
        cancelled: false,
        endedAt: null,
        startAt: { lte: new Date(now.getTime() - graceMs) },
        endAt: { gt: now },
        class: { academyId: setting.academyId, isActive: true },
      },
      orderBy: { startAt: 'asc' },
      select: { id: true, classId: true, startAt: true },
    })
    if (sessions.length === 0) continue
    summary.sessions += sessions.length

    const classIds = Array.from(new Set(sessions.map((s) => s.classId)))
    const students = await prisma.student.findMany({
      where: {
        classId: { in: classIds },
        status: 'ACTIVE',
        parentPhone: { not: null },
        user: { isDeleted: false },
      },
      select: { id: true, classId: true, parentPhone: true, user: { select: { name: true } } },
    })
    if (students.length === 0) continue

    const isClassMode = setting.mode === 'CLASS'
    const candidates = sessions.flatMap((session) =>
      students
        .filter((st) => st.classId === session.classId)
        .map((st) => ({
          session,
          student: st,
          key: absentDedupeKey(st.id, isClassMode ? session.id : null, dateKey),
        })),
    )

    const studentIds = students.map((s) => s.id)
    const [records, existingJobs] = await Promise.all([
      prisma.attendanceRecord.findMany({
        where: isClassMode
          ? { sessionId: { in: sessions.map((s) => s.id) }, studentId: { in: studentIds } }
          : { studentId: { in: studentIds }, date: dbDate(dateKey), sessionId: null, mode: 'ACADEMY' },
        select: { id: true, studentId: true, sessionId: true, status: true },
      }),
      prisma.notificationJob.findMany({
        where: { dedupeKey: { in: candidates.map((c) => c.key) } },
        select: { dedupeKey: true },
      }),
    ])
    const recordOf = (studentId: string, sessionId: string) =>
      records.find((r) => r.studentId === studentId && (isClassMode ? r.sessionId === sessionId : true))
    const done = new Set(existingJobs.map((j) => j.dedupeKey))

    for (const { session, student, key } of candidates) {
      if (done.has(key)) continue
      const record = recordOf(student.id, session.id)
      // 출석·결석 등 이미 체크된 학생은 제외 (미체크 = 기록 없음 또는 UNCHECKED)
      if (record && record.status !== 'UNCHECKED') continue
      done.add(key) // 원 출결에서 같은 날 두 번째 수업은 건너뜀

      const result = await createNotificationJob({
        academyId: setting.academyId,
        walletAcademyId: setting.academy.parentAcademyId ?? setting.academyId,
        studentId: student.id,
        recordId: record?.id ?? null,
        sessionId: session.id,
        type: 'ABSENT_ALERT',
        phone: (student.parentPhone ?? '').replace(/\D/g, ''),
        variables: {
          학원명: academyDisplayName(setting.academy),
          학생명: student.user.name,
          수업시작: formatNotifyClock(session.startAt),
        },
        dedupeKey: key,
      })
      if (result === 'PENDING') summary.queued++
      else if (result === 'SKIPPED_NO_CREDIT') summary.noCredit++
    }
  }
  return summary
}
