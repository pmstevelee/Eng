import type { PlanType } from '@/generated/prisma'
import { PLANS, PLAN_DISPLAY_NAMES } from '@/lib/pricing'

/**
 * Academy.subscriptionPlan(PlanType) 표시/정원 기준.
 * 실제 판매 요금제는 pricing.ts의 4개(무료/스타터/스탠다드/프리미엄)뿐이다.
 * BASIC·ENTERPRISE는 과거 요금제로 enum에만 남아 있으며 신규 선택지에서는 제외한다.
 */
export const SELECTABLE_PLAN_TYPES = ['FREE', 'STARTER', 'STANDARD', 'PREMIUM'] as const
export type SelectablePlanType = (typeof SELECTABLE_PLAN_TYPES)[number]

export function isSelectablePlanType(value: string): value is SelectablePlanType {
  return (SELECTABLE_PLAN_TYPES as readonly string[]).includes(value)
}

export const PLAN_TYPE_LABEL: Record<PlanType, string> = {
  ...PLAN_DISPLAY_NAMES,
  BASIC: '(구) 기본',
  ENTERPRISE: '(구) 엔터프라이즈',
}

// DB 정원 컬럼은 정수이므로 '무제한'은 충분히 큰 값으로 저장한다.
const UNLIMITED_STUDENTS = 9999
const UNLIMITED_TEACHERS = 999

/** 과거 요금제를 현재 요금제로 대응시킨다 */
function toCurrentPlan(planType: PlanType): SelectablePlanType {
  if (planType === 'BASIC') return 'STARTER'
  if (planType === 'ENTERPRISE') return 'PREMIUM'
  return planType
}

/** 요금제별 학생/교사 정원 (pricing.ts 기준) */
export function getPlanTypeLimits(planType: PlanType): { maxStudents: number; maxTeachers: number } {
  const plan = PLANS[toCurrentPlan(planType)]
  return {
    maxStudents: plan.studentLimit === -1 ? UNLIMITED_STUDENTS : plan.studentLimit,
    maxTeachers: plan.teacherLimit === -1 ? UNLIMITED_TEACHERS : plan.teacherLimit,
  }
}
