'use server'

import { randomUUID } from 'crypto'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma/client'
import { findStudentCreditPackage } from './constants'
import { isStudentAiFlashcardEnabled } from './wallet'

export type StudentCheckoutResult =
  | { ok: true; orderId: string; amount: number; orderName: string; customerKey: string }
  | { ok: false; error: string }

/**
 * 학생 크레딧 충전 결제 준비 — PENDING StudentPayment 생성 (금액·크레딧은 서버 상품 정보로 확정).
 * 실제 충전은 /student/credits/toss-success 또는 토스 웹훅에서 서버가 처리한다.
 */
export async function startStudentCreditCheckout(packageKey: string): Promise<StudentCheckoutResult> {
  const user = await getCurrentUser()
  if (!user || user.role !== 'STUDENT' || !user.student || !user.academyId) {
    return { ok: false, error: '학생 계정으로 로그인해주세요.' }
  }
  if (!(await isStudentAiFlashcardEnabled(user.academyId))) {
    return { ok: false, error: '우리 학원에서는 학생 결제를 사용할 수 없습니다.' }
  }
  const pkg = findStudentCreditPackage(packageKey)
  if (!pkg) return { ok: false, error: '판매 중인 충전 상품이 아닙니다. 새로고침 후 다시 선택해주세요.' }

  const orderId = randomUUID()
  await prisma.studentPayment.create({
    data: {
      studentId: user.student.id,
      academyId: user.academyId,
      orderId,
      packageKey: pkg.key,
      credits: pkg.credits,
      amount: pkg.priceKrw,
    },
  })

  return {
    ok: true,
    orderId,
    amount: pkg.priceKrw,
    orderName: `위고업잉글리시 학습 크레딧 ${pkg.credits.toLocaleString('ko-KR')} (${pkg.name})`,
    customerKey: user.student.id,
  }
}
