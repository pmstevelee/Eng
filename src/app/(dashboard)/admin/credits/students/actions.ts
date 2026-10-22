'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma/client'
import { CREDIT_INPUT_MAX } from '@/lib/credits/constants'
import { adjustStudentCreditsByAdmin } from '@/lib/student-credits/wallet'
import { writeAuditLog } from '@/lib/webhooks/handler'

type ActionResult = { error?: string; balanceAfter?: number }

/** 시스템 관리자가 학생 개인 크레딧을 지급(+)·차감(-) — 사유는 학생 원장 메모와 감사 로그에 남는다 */
export async function adjustStudentCredits(studentId: string, delta: number, reason: string): Promise<ActionResult> {
  const admin = await getCurrentUser()
  if (!admin || admin.role !== 'SUPER_ADMIN') return { error: '권한이 없습니다.' }

  const memo = reason.trim()
  if (!memo) return { error: '사유를 입력해주세요.' }
  if (memo.length > 200) return { error: '사유는 200자 이내로 입력해주세요.' }
  const amount = Number(delta)
  if (!Number.isInteger(amount) || amount === 0 || Math.abs(amount) > CREDIT_INPUT_MAX) {
    return { error: '크레딧을 0이 아닌 정수로 입력해주세요.' }
  }

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { user: { select: { isDeleted: true, role: true } } },
  })
  if (!student || student.user.isDeleted || student.user.role !== 'STUDENT') return { error: '학생을 찾을 수 없습니다.' }

  const result = await adjustStudentCreditsByAdmin({ studentId, delta: amount, memo })
  if ('error' in result) return { error: result.error }

  await writeAuditLog({
    actorType: 'ADMIN',
    actorId: admin.id,
    action: 'STUDENT_CREDIT_ADMIN_ADJUST',
    target: `Student:${studentId}`,
    metadata: { delta: amount, reason: memo, balanceAfter: result.balanceAfter },
  })
  revalidatePath('/admin/credits/students')
  revalidatePath('/student/credits')
  return { balanceAfter: result.balanceAfter }
}
