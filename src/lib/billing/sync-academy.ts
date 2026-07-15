import 'server-only'
import type { Plan, SubscriptionStatus, Prisma } from '@/generated/prisma'
import { PLANS } from '@/lib/pricing'

// Academy.maxStudents/maxTeachers는 정원 초과 체크에 직접 쓰이는 실제 정수 컬럼이라
// PLANS의 무제한 표시값(-1)을 그대로 넣으면 안 됨(currentCount >= -1이 항상 참이 되어
// 무제한 플랜 학원이 학생/교사를 아예 등록하지 못하게 됨).
const UNLIMITED_STUDENTS = 9999
const UNLIMITED_TEACHERS = 999

/** Subscription(카드결제) 테이블의 plan/status를 Academy 표시/정원 필드에 동기화 */
export function academyPlanSync(
  plan: Plan,
  status: SubscriptionStatus,
  periodEnd: Date,
): Prisma.AcademyUpdateInput {
  const limits = PLANS[plan]
  return {
    subscriptionPlan: plan,
    subscriptionStatus: status,
    subscriptionExpiresAt: periodEnd,
    maxStudents: limits.studentLimit === -1 ? UNLIMITED_STUDENTS : limits.studentLimit,
    maxTeachers: limits.teacherLimit === -1 ? UNLIMITED_TEACHERS : limits.teacherLimit,
  }
}
