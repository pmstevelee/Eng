import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma/client'
import { PLANS } from '@/lib/pricing'
import { Plan, CreditType } from '@/generated/prisma'

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    // 사용자의 학원 정보 조회 (User.academyId는 모든 역할에 공통)
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id, isDeleted: false },
      select: { academyId: true },
    })

    const academyId = dbUser?.academyId

    if (!academyId) {
      return NextResponse.json({ error: '학원 정보를 찾을 수 없습니다.' }, { status: 404 })
    }

    const sub = await prisma.subscription.findUnique({
      where: { academyId },
      select: { id: true, plan: true, currentPeriodStart: true, currentPeriodEnd: true },
    })

    if (!sub) {
      return NextResponse.json({ error: '구독 정보를 찾을 수 없습니다.' }, { status: 404 })
    }

    const plan = sub.plan as Plan
    const planConfig = PLANS[plan]

    const now = new Date()
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1)

    // 이번 달 사용량 조회
    const usageRecord = await prisma.usageRecord.findUnique({
      where: { subscriptionId_periodStart: { subscriptionId: sub.id, periodStart } },
    })

    const aiWritingUsed = usageRecord?.aiWritingCount ?? 0
    const aiQuestionUsed = usageRecord?.aiQuestionCount ?? 0
    const storageUsedMb = usageRecord?.storageUsedMb ?? 0
    const studentCount = usageRecord?.studentCount ?? 0

    // 크레딧 잔액 조회
    const [writingCreditSum, questionCreditSum] = await Promise.all([
      prisma.aiCredit.aggregate({
        where: {
          academyId,
          type: CreditType.WRITING,
          amount: { gt: 0 },
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
        _sum: { amount: true },
      }),
      prisma.aiCredit.aggregate({
        where: {
          academyId,
          type: CreditType.QUESTION,
          amount: { gt: 0 },
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
        _sum: { amount: true },
      }),
    ])

    const writingCreditBalance = writingCreditSum._sum.amount ?? 0
    const questionCreditBalance = questionCreditSum._sum.amount ?? 0

    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)

    return NextResponse.json({
      aiWriting: {
        used: aiWritingUsed,
        limit: planConfig.aiWritingLimit,
        remainingFree: Math.max(0, planConfig.aiWritingLimit - aiWritingUsed),
        creditBalance: writingCreditBalance,
        isOverLimit:
          planConfig.aiWritingLimit !== -1 && aiWritingUsed > planConfig.aiWritingLimit,
      },
      aiQuestion: {
        used: aiQuestionUsed,
        limit: planConfig.aiQuestionLimit,
        remainingFree: Math.max(0, planConfig.aiQuestionLimit - aiQuestionUsed),
        creditBalance: questionCreditBalance,
        isOverLimit:
          planConfig.aiQuestionLimit !== -1 && aiQuestionUsed > planConfig.aiQuestionLimit,
      },
      storage: {
        usedMb: storageUsedMb,
        limitMb: planConfig.storageLimitMb,
        percent:
          planConfig.storageLimitMb > 0
            ? Math.round((storageUsedMb / planConfig.storageLimitMb) * 100)
            : 0,
      },
      students: {
        count: studentCount,
        limit: planConfig.studentLimit,
      },
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
    })
  } catch (error) {
    console.error('[usage/check] error:', error)
    return NextResponse.json({ error: '사용량 조회 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
