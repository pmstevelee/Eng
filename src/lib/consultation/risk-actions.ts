'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { updateStudentStatus } from '@/app/(dashboard)/owner/students/actions'
import { prisma } from '@/lib/prisma/client'
import { findScopedStudent, getConsultationActor } from './access'
import { addDaysToDateKey, isDateKey, kstDateStart, todayKst } from './constants'
import { computeAcademyRisk } from './risk-engine'
import { isWithdrawalReason } from './risk-constants'

type ActionResult = { error: string } | { error?: undefined }

const NO_PERMISSION = '권한이 없습니다.'

function revalidateRisk(academyIds: string[]) {
  revalidatePath('/owner/consultations', 'layout')
  revalidatePath('/teacher/consultations', 'layout')
  revalidatePath('/owner/students', 'layout')
  revalidatePath('/teacher/students', 'layout')
  for (const id of academyIds) revalidateTag(`academy-${id}-students`)
}

/** 퇴원 위험 신호 지금 다시 계산 — 학원장, 소유 학원 전체 (평소에는 매일 cron) */
export async function recalculateRisk(): Promise<ActionResult & { watch?: number; risk?: number }> {
  const actor = await getConsultationActor()
  if (!actor || actor.role !== 'ACADEMY_OWNER') return { error: NO_PERMISSION }

  const academies = await prisma.academy.findMany({
    where: { id: { in: actor.academyIds } },
    select: { id: true, settingsJson: true },
  })
  let watch = 0
  let risk = 0
  for (const a of academies) {
    const r = await computeAcademyRisk(a.id, a.settingsJson)
    watch += r.watch
    risk += r.risk
  }
  revalidateRisk(actor.academyIds)
  return { watch, risk }
}

export type WithdrawalInput = {
  /** 퇴원일 (KST YYYY-MM-DD) */
  withdrawnOn: string
  reason: string
  memo?: string
}

/** 미리 처리하는 경우를 고려해 퇴원일은 오늘 + 이 일수까지 허용 */
const WITHDRAWAL_MAX_FUTURE_DAYS = 31

/**
 * 퇴원 처리 — 학원장만.
 * 1) 퇴원 상담(WITHDRAWAL) 기록 저장 (퇴원일·사유·메모)
 * 2) 학생 상태 변경은 기존 학생 관리 로직(updateStudentStatus → WITHDRAWN)을 그대로 사용
 */
export async function withdrawStudent(studentId: string, input: WithdrawalInput): Promise<ActionResult> {
  const actor = await getConsultationActor()
  if (!actor || actor.role !== 'ACADEMY_OWNER') return { error: NO_PERMISSION }
  const student = await findScopedStudent(actor, studentId)
  if (!student) return { error: '학생을 찾을 수 없거나 접근 권한이 없습니다.' }
  if (student.status === 'WITHDRAWN') return { error: '이미 퇴원 처리된 학생입니다.' }
  // 기존 상태 변경 로직은 본원 소속 학생만 처리한다 — 기록만 남고 상태가 안 바뀌는 일이 없도록 먼저 확인
  if (student.academyId !== actor.academyId) {
    return { error: '지점 소속 학생은 아직 퇴원 처리를 할 수 없습니다. 본원 학생만 가능합니다.' }
  }

  const today = todayKst()
  if (!isDateKey(input.withdrawnOn)) return { error: '퇴원일을 선택해주세요.' }
  if (input.withdrawnOn > addDaysToDateKey(today, WITHDRAWAL_MAX_FUTURE_DAYS)) {
    return { error: `퇴원일은 오늘부터 ${WITHDRAWAL_MAX_FUTURE_DAYS}일 이내로 선택해주세요.` }
  }
  if (!isWithdrawalReason(input.reason)) return { error: '퇴원 사유를 선택해주세요.' }
  const memo = (input.memo ?? '').trim().slice(0, 5000) || null

  await prisma.consultation.create({
    data: {
      studentId: student.id,
      counselorId: actor.userId,
      consultedAt: new Date(),
      type: 'WITHDRAWAL',
      withdrawnOn: kstDateStart(input.withdrawnOn),
      withdrawalReason: input.reason,
      memo,
    },
  })

  const statusResult = await updateStudentStatus(student.id, 'WITHDRAWN')
  if (statusResult.error) {
    return { error: `퇴원 기록은 저장했지만 학생 상태를 바꾸지 못했습니다. (${statusResult.error})` }
  }

  // 재원생이 아니므로 위험 신호에서 즉시 제외
  await prisma.studentRiskSnapshot.deleteMany({ where: { studentId: student.id } })

  revalidatePath(`/owner/students/${student.id}`)
  revalidatePath(`/teacher/students/${student.id}`)
  revalidateRisk([student.academyId])
  return {}
}
