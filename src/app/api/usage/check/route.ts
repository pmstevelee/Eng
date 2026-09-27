import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma/client'
import { PLANS } from '@/lib/pricing'
import { Plan } from '@/generated/prisma'
import { getCreditPricing, getWallet, walletAcademyIdOf } from '@/lib/credits/wallet'
import { estimateSendable } from '@/lib/credits/constants'
import { getCurrentUser } from '@/lib/auth'

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    // 사용자의 학원 정보 조회 (User.academyId는 모든 역할에 공통)

    const academyId = user?.academyId

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

    // 통합 크레딧 잔액 (본원 지갑) → 기능별 사용 가능 횟수로 환산
    const [wallet, pricing] = await Promise.all([
      walletAcademyIdOf(academyId).then(getWallet),
      getCreditPricing(),
    ])
    const writingCreditBalance = estimateSendable(wallet.balance, pricing.AI_WRITING)
    const questionCreditBalance = estimateSendable(wallet.balance, pricing.AI_QUESTION)

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
      credits: {
        balance: wallet.balance,
        aiWritingPerUse: pricing.AI_WRITING,
        aiQuestionPerUse: pricing.AI_QUESTION,
      },
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
    })
  } catch (error) {
    console.error('[usage/check] error:', error)
    return NextResponse.json({ error: '사용량 조회 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
