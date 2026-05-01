import { Plan, BillingCycle } from '@/generated/prisma'

export interface PlanConfig {
  monthlyPrice: number
  yearlyPrice: number
  studentLimit: number       // -1: 무제한
  teacherLimit: number       // -1: 무제한
  aiWritingLimit: number
  aiWritingOveragePrice: number  // 원/회
  aiQuestionLimit: number
  aiQuestionOveragePrice: number // 원/회
  storageLimitMb: number
  storageOveragePrice: number    // 원/10GB
  publicQuestionBank: 'READ_ONLY' | 'FULL' | 'PRIORITY'
  dataRetentionDays: number  // -1: 무제한
}

export const PLANS: Record<Plan, PlanConfig> = {
  FREE: {
    monthlyPrice: 0,
    yearlyPrice: 0,
    studentLimit: 10,
    teacherLimit: 1,
    aiWritingLimit: 5,
    aiWritingOveragePrice: 0,
    aiQuestionLimit: 3,
    aiQuestionOveragePrice: 0,
    storageLimitMb: 1024,           // 1GB
    storageOveragePrice: 0,
    publicQuestionBank: 'READ_ONLY',
    dataRetentionDays: 30,
  },
  STARTER: {
    monthlyPrice: 19900,
    yearlyPrice: 191040,            // 19900 * 12 * 0.8
    studentLimit: 20,
    teacherLimit: 2,
    aiWritingLimit: 50,
    aiWritingOveragePrice: 60,
    aiQuestionLimit: 30,
    aiQuestionOveragePrice: 100,
    storageLimitMb: 10240,          // 10GB
    storageOveragePrice: 0,
    publicQuestionBank: 'READ_ONLY',
    dataRetentionDays: 365,
  },
  STANDARD: {
    monthlyPrice: 49900,
    yearlyPrice: 478080,            // 49900 * 12 * 0.8
    studentLimit: 50,
    teacherLimit: 5,
    aiWritingLimit: 200,
    aiWritingOveragePrice: 50,
    aiQuestionLimit: 100,
    aiQuestionOveragePrice: 80,
    storageLimitMb: 51200,          // 50GB
    storageOveragePrice: 5000,      // 10GB당 5,000원
    publicQuestionBank: 'FULL',
    dataRetentionDays: 1095,        // 3년
  },
  PREMIUM: {
    monthlyPrice: 129000,
    yearlyPrice: 1238400,           // 129000 * 12 * 0.8
    studentLimit: -1,
    teacherLimit: -1,
    aiWritingLimit: 1000,
    aiWritingOveragePrice: 0,
    aiQuestionLimit: 500,
    aiQuestionOveragePrice: 0,
    storageLimitMb: 512000,         // 500GB
    storageOveragePrice: 3000,      // 10GB당 3,000원
    publicQuestionBank: 'PRIORITY',
    dataRetentionDays: -1,
  },
}

export interface StudentOveragePricing {
  perStudent: number  // 원/명
}

export const STUDENT_OVERAGE: Record<Plan, StudentOveragePricing> = {
  FREE: { perStudent: 0 },
  STARTER: { perStudent: 0 },
  STANDARD: { perStudent: 1500 },
  PREMIUM: { perStudent: 0 },
}

export interface CreditPackageConfig {
  price: number
  writingCredits: number
  questionCredits: number
}

export const CREDIT_PACKAGES = {
  SMALL: {
    price: 10000,
    writingCredits: 200,
    questionCredits: 100,
  },
  MEDIUM: {
    price: 30000,
    writingCredits: 700,
    questionCredits: 350,
  },
  LARGE: {
    price: 100000,
    writingCredits: 2500,
    questionCredits: 1250,
  },
} satisfies Record<string, CreditPackageConfig>

export type CreditPackageKey = keyof typeof CREDIT_PACKAGES

export const PLAN_DISPLAY_NAMES: Record<Plan, string> = {
  FREE: '무료',
  STARTER: '스타터',
  STANDARD: '스탠다드',
  PREMIUM: '프리미엄',
}

export const BILLING_CYCLE_DISPLAY_NAMES: Record<BillingCycle, string> = {
  MONTHLY: '월간',
  YEARLY: '연간',
}

export const ANNUAL_DISCOUNT_RATE = 0.2

export function getPlan(plan: Plan): PlanConfig {
  return PLANS[plan]
}

export function calculateAnnualPrice(monthlyPrice: number): number {
  return Math.floor(monthlyPrice * 12 * (1 - ANNUAL_DISCOUNT_RATE))
}

export function isOverLimit(usage: number, limit: number): boolean {
  if (limit === -1) return false
  return usage > limit
}

export function getOverageAmount(usage: number, limit: number): number {
  if (limit === -1) return 0
  return Math.max(0, usage - limit)
}
