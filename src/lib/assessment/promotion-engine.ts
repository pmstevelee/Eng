/**
 * 레벨 승급 판정 엔진
 *
 * 승급 3가지 조건 (모두 충족해야 승급):
 *   1. 레벨 테스트: 4영역 중 3개 이상이 목표 레벨(currentLevel+1) 이상
 *   2. 단원 테스트: 현재 레벨 단원 테스트 70% 이상 이수 + 평균 60점 이상
 *   3. 학습 활동: 최근 30일 학습공간 문제 50개↑ 또는 오늘의 미션 20일↑ 완료
 *
 * 호출 시점:
 *   - 레벨 테스트(적응형) 완료 시
 *   - 단원 테스트 제출 완료 시
 *   - 오늘의 미션 전체 완료 시
 */

import { Prisma } from '@/generated/prisma'
import { prisma } from '@/lib/prisma/client'

// ─── 반환 타입 ────────────────────────────────────────────────────────────────

export type PromotionCheckResult = {
  promoted: boolean
  currentLevel: number
  targetLevel: number
  condition1Met: boolean
  condition2Met: boolean
  condition3Met: boolean
  allConditionsMet: boolean
  error?: string
}

export type PromotionProgressCondition = {
  met: boolean
  label: string
  detail: string
  progress?: number    // 0~100 퍼센트
  remaining?: string   // 미충족 시 남은 조건 설명
}

export type PromotionProgress = {
  currentLevel: number
  targetLevel: number
  conditions: {
    levelTest: PromotionProgressCondition
    unitTests: PromotionProgressCondition
    learningActivity: PromotionProgressCondition
  }
  allMet: boolean
  nextAction: string
  weakAreas: string[]
}

// ─── 승급 판정 ─────────────────────────────────────────────────────────────────

/**
 * 학생의 승급 조건 3가지를 모두 체크하고, 모두 충족 시 자동 승급 처리.
 * 레벨 테스트 완료, 단원 테스트 제출, 미션 완료 시 호출.
 */
export async function checkPromotionStatus(studentId: string): Promise<PromotionCheckResult> {
  // 학생 정보
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: {
      id: true,
      currentLevel: true,
      userId: true,
      user: { select: { academyId: true } },
    },
  })
  if (!student) return { promoted: false, currentLevel: 0, targetLevel: 0, condition1Met: false, condition2Met: false, condition3Met: false, allConditionsMet: false, error: '학생을 찾을 수 없습니다.' }

  const currentLevel = student.currentLevel
  const targetLevel = currentLevel + 1
  const academyId = student.user.academyId

  if (targetLevel > 10) {
    return { promoted: false, currentLevel, targetLevel: 10, condition1Met: true, condition2Met: true, condition3Met: true, allConditionsMet: false }
  }

  // ── 조건 1: 레벨 테스트 ─────────────────────────────────────────────────────
  const latestAssessment = await prisma.levelAssessment.findFirst({
    where: { studentId, isCurrent: true },
    orderBy: { assessedAt: 'desc' },
    select: {
      grammarLevel: true,
      vocabularyLevel: true,
      readingLevel: true,
      listeningLevel: true,
      writingLevel: true,
      overallLevel: true,
    },
  })

  let condition1Met = false
  let condition1Detail: Prisma.InputJsonObject = {}

  if (latestAssessment) {
    // 4영역은 필수, 듣기는 측정된 경우만 포함 (null이면 제외 후 4영역으로 판정)
    const coreDomainLevels = [
      latestAssessment.grammarLevel,
      latestAssessment.vocabularyLevel,
      latestAssessment.readingLevel,
      latestAssessment.writingLevel,
    ]
    const listeningLevel = latestAssessment.listeningLevel
    const allDomainLevels = listeningLevel !== null
      ? [...coreDomainLevels, listeningLevel]
      : coreDomainLevels
    const domainsAboveTarget = allDomainLevels.filter((l) => l >= targetLevel).length
    // 5영역이면 3/5 이상, 4영역이면 3/4 이상
    condition1Met = domainsAboveTarget >= 3
    condition1Detail = {
      grammarLevel: latestAssessment.grammarLevel,
      vocabularyLevel: latestAssessment.vocabularyLevel,
      readingLevel: latestAssessment.readingLevel,
      listeningLevel: listeningLevel ?? null,
      writingLevel: latestAssessment.writingLevel,
      domainsAboveTarget,
      requiredDomains: 3,
      totalDomainsMeasured: allDomainLevels.length,
    }
  } else {
    condition1Detail = { reason: '레벨 테스트 이력 없음' }
  }

  // ── 조건 2: 단원 테스트 ─────────────────────────────────────────────────────
  let condition2Met = false
  let condition2Detail: Prisma.InputJsonObject = {}

  if (!academyId) {
    // 학원 미소속 → 조건 자동 통과
    condition2Met = true
    condition2Detail = { note: '학원 미소속으로 단원 테스트 조건 자동 통과' }
  } else {
    const unitTests = await prisma.test.findMany({
      where: {
        academyId,
        type: 'UNIT_TEST',
        isActive: true,
        targetLevel: currentLevel,
      },
      select: { id: true },
    })

    if (unitTests.length === 0) {
      // 현재 레벨에 해당하는 단원 테스트 없음 → 조건 자동 통과
      condition2Met = true
      condition2Detail = { totalTests: 0, note: '이 레벨의 단원 테스트가 없습니다.' }
    } else {
      const unitTestIds = unitTests.map((t) => t.id)

      const completedSessions = await prisma.testSession.findMany({
        where: {
          studentId,
          testId: { in: unitTestIds },
          status: { in: ['COMPLETED', 'GRADED'] },
        },
        select: { testId: true, score: true },
      })

      // 테스트별 최고 점수로 집계
      const bestByTest = new Map<string, number>()
      for (const s of completedSessions) {
        if (s.score !== null) {
          const existing = bestByTest.get(s.testId)
          if (existing === undefined || s.score > existing) {
            bestByTest.set(s.testId, s.score)
          }
        } else {
          // 점수 없는 완료 세션도 이수로 인정 (서술형 채점 대기 등)
          if (!bestByTest.has(s.testId)) {
            bestByTest.set(s.testId, 0)
          }
        }
      }

      const uniqueCompleted = bestByTest.size
      const completionRate = uniqueCompleted / unitTestIds.length
      const scores = Array.from(bestByTest.values()).filter((s) => s > 0)
      const avgScore = scores.length > 0
        ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
        : 0

      const completionOk = completionRate >= 0.7
      const avgOk = avgScore >= 60

      condition2Met = completionOk && avgOk
      condition2Detail = {
        totalTests: unitTestIds.length,
        completedTests: uniqueCompleted,
        completionRate: Math.round(completionRate * 100),
        avgScore,
        completionRequired: 70,
        avgScoreRequired: 60,
        completionOk,
        avgOk,
      }
    }
  }

  // ── 조건 3: 학습 활동량 ──────────────────────────────────────────────────────
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const [practiceCount, missionDays] = await Promise.all([
    prisma.questionResponse.count({
      where: {
        session: {
          studentId,
          test: { type: 'PRACTICE' },
        },
        createdAt: { gte: thirtyDaysAgo },
      },
    }),
    prisma.dailyMission.count({
      where: {
        studentId,
        isCompleted: true,
        completedAt: { gte: thirtyDaysAgo },
      },
    }),
  ])

  const condition3Met = practiceCount >= 50 || missionDays >= 20
  const condition3Detail: Prisma.InputJsonObject = {
    practiceCount,
    missionDays,
    practiceRequired: 50,
    missionDaysRequired: 20,
    practiceOk: practiceCount >= 50,
    missionOk: missionDays >= 20,
  }

  // ── 전체 판정 + 자동 승급 ───────────────────────────────────────────────────
  const allConditionsMet = condition1Met && condition2Met && condition3Met
  let promoted = false

  if (allConditionsMet && student.currentLevel < targetLevel) {
    await prisma.$transaction(async (tx) => {
      // 학생 레벨 업데이트
      await tx.student.update({
        where: { id: studentId },
        data: { currentLevel: targetLevel },
      })

      // XP +100 지급
      await tx.studentXp.create({
        data: { studentId, amount: 100, source: 'LEVEL_UP', sourceId: studentId },
      })
      await tx.student.update({
        where: { id: studentId },
        data: { totalXp: { increment: 100 } },
      })

      // LEVEL_UP 배지 수여
      const levelUpBadge = await tx.badge.findFirst({
        where: { code: 'LEVEL_UP' },
        select: { id: true },
      })
      if (levelUpBadge) {
        try {
          await tx.badgeEarning.create({
            data: { studentId, badgeId: levelUpBadge.id },
          })
        } catch {
          // 이미 획득한 배지 → 무시
        }
      }

      // 학생 알림
      await tx.notification.create({
        data: {
          userId: student.userId,
          academyId,
          type: 'SUCCESS',
          title: '레벨 승급!',
          message: `축하합니다! Level ${targetLevel}로 승급했습니다!`,
          link: '/student',
        },
      })
    })

    promoted = true
  }

  // ── 승급 상태 저장 (항상 upsert) ────────────────────────────────────────────
  const statusCurrentLevel = promoted ? targetLevel : currentLevel
  const statusTargetLevel = promoted ? targetLevel + 1 : targetLevel

  await prisma.levelPromotionStatus.upsert({
    where: { studentId },
    update: {
      currentLevel: statusCurrentLevel,
      targetLevel: statusTargetLevel,
      condition1Met: promoted ? false : condition1Met,
      condition1Detail: promoted ? {} : condition1Detail,
      condition2Met: promoted ? false : condition2Met,
      condition2Detail: promoted ? {} : condition2Detail,
      condition3Met: promoted ? false : condition3Met,
      condition3Detail: promoted ? {} : condition3Detail,
      allConditionsMet: promoted ? false : allConditionsMet,
      promotedAt: promoted ? new Date() : undefined,
    },
    create: {
      studentId,
      currentLevel: statusCurrentLevel,
      targetLevel: statusTargetLevel,
      condition1Met: promoted ? false : condition1Met,
      condition1Detail: promoted ? {} : condition1Detail,
      condition2Met: promoted ? false : condition2Met,
      condition2Detail: promoted ? {} : condition2Detail,
      condition3Met: promoted ? false : condition3Met,
      condition3Detail: promoted ? {} : condition3Detail,
      allConditionsMet: false,
      promotedAt: promoted ? new Date() : null,
    },
  })

  return {
    promoted,
    currentLevel: promoted ? targetLevel : currentLevel,
    targetLevel: promoted ? targetLevel + 1 : targetLevel,
    condition1Met,
    condition2Met,
    condition3Met,
    allConditionsMet,
  }
}

// ─── 승급 진행 상태 조회 (UI 표시용) ─────────────────────────────────────────

const DOMAIN_LABEL_KO: Record<string, string> = {
  GRAMMAR: '문법',
  VOCABULARY: '어휘',
  READING: '읽기',
  LISTENING: '듣기',
  WRITING: '쓰기',
}

/**
 * 학생/교사에게 보여줄 승급 진행 상태를 반환.
 * DB에 저장된 promotion_status를 읽어 포맷팅.
 * 없으면 기본 진행 상태 반환.
 */
export async function getPromotionProgress(studentId: string): Promise<PromotionProgress> {
  const [student, status] = await Promise.all([
    prisma.student.findUnique({
      where: { id: studentId },
      select: { currentLevel: true },
    }),
    prisma.levelPromotionStatus.findUnique({
      where: { studentId },
    }),
  ])

  const currentLevel = student?.currentLevel ?? 1
  const targetLevel = Math.min(currentLevel + 1, 10)

  // status가 없거나 레벨이 달라진 경우 → 기본 상태
  if (!status || status.currentLevel !== currentLevel) {
    return buildDefaultProgress(currentLevel, targetLevel)
  }

  const c1 = (status.condition1Detail ?? {}) as Record<string, unknown>
  const c2 = (status.condition2Detail ?? {}) as Record<string, unknown>
  const c3 = (status.condition3Detail ?? {}) as Record<string, unknown>

  // ── 조건 1 포맷팅 ────────────────────────────────────────────────────────
  let levelTestDetail = '레벨 테스트를 먼저 응시하세요.'
  const weakAreas: string[] = []

  if (c1.grammarLevel !== undefined) {
    const domainLevels: Record<string, number | null> = {
      GRAMMAR: c1.grammarLevel as number,
      VOCABULARY: c1.vocabularyLevel as number,
      READING: c1.readingLevel as number,
      LISTENING: (c1.listeningLevel as number | null) ?? null,
      WRITING: c1.writingLevel as number,
    }
    const totalMeasured = (c1.totalDomainsMeasured as number) ?? 4
    const parts = Object.entries(domainLevels)
      .filter(([, lv]) => lv !== null)
      .map(([d, lv]) => {
        const ok = (lv as number) >= targetLevel
        const label = DOMAIN_LABEL_KO[d] ?? d
        if (!ok) weakAreas.push(`${label} Lv${lv} → Lv${targetLevel} 필요`)
        return `${label} Lv${lv}${ok ? ' ✓' : ' ✗'}`
      })
    if (domainLevels.LISTENING === null) parts.push('듣기 미측정')
    const met = (c1.domainsAboveTarget as number) ?? 0
    levelTestDetail = `${parts.join(', ')} (${met}/${totalMeasured} 영역 충족)`
  }

  // ── 조건 2 포맷팅 ────────────────────────────────────────────────────────
  let unitTestDetail = '단원 테스트를 응시하세요.'
  let unitTestProgress = 0
  let unitTestRemaining: string | undefined

  if (c2.totalTests !== undefined) {
    const total = c2.totalTests as number
    if (total === 0) {
      unitTestDetail = '이 레벨의 단원 테스트가 없습니다.'
      unitTestProgress = 100
    } else {
      const completed = c2.completedTests as number
      const rate = c2.completionRate as number
      const avg = c2.avgScore as number
      const rateOk = rate >= 70
      const avgOk = avg >= 60

      unitTestDetail = `${completed}/${total} 이수 (70% 필요)${rateOk ? ' ✓' : ' ✗'} · 평균 ${avg}점 (60점 이상)${avgOk ? ' ✓' : ' ✗'}`
      unitTestProgress = rate

      if (!rateOk) {
        const needed = Math.ceil(total * 0.7) - completed
        unitTestRemaining = `단원 테스트 ${needed}개를 더 응시하면 조건 충족`
      } else if (!avgOk) {
        unitTestRemaining = `단원 테스트 평균 점수를 60점 이상으로 높이세요`
      }
    }
  }

  // ── 조건 3 포맷팅 ────────────────────────────────────────────────────────
  let learningDetail = '최근 30일 학습 활동을 시작하세요.'
  let learningRemaining: string | undefined

  if (c3.practiceCount !== undefined) {
    const pc = c3.practiceCount as number
    const md = c3.missionDays as number
    const pcOk = c3.practiceOk as boolean
    const mdOk = c3.missionOk as boolean

    if (pcOk) {
      learningDetail = `최근 30일: 문제 ${pc}개 풀이 (50개 이상 ✓)`
    } else if (mdOk) {
      learningDetail = `최근 30일: 미션 ${md}일 완료 (20일 이상 ✓)`
    } else {
      learningDetail = `최근 30일: 문제 ${pc}개 풀이, 미션 ${md}일 완료`
      const practiceNeeded = 50 - pc
      const missionNeeded = 20 - md
      learningRemaining =
        practiceNeeded <= missionNeeded
          ? `학습공간에서 ${practiceNeeded}개 더 풀거나`
          : `오늘의 미션 ${missionNeeded}일 더 완료하면 조건 충족`
    }
  }

  // ── 다음 액션 메시지 ─────────────────────────────────────────────────────
  let nextAction = '승급 조건을 확인하세요.'
  if (!status.condition1Met) {
    nextAction = '적응형 레벨 테스트를 응시하여 조건 1을 충족하세요.'
  } else if (!status.condition2Met) {
    nextAction = unitTestRemaining ?? '단원 테스트를 더 응시하면 승급에 가까워집니다.'
  } else if (!status.condition3Met) {
    nextAction = learningRemaining ?? '학습공간에서 문제를 풀거나 미션을 완료하세요.'
  } else {
    nextAction = `Level ${targetLevel} 승급 조건을 모두 충족했습니다! 🎉`
  }

  if (targetLevel > 10) {
    nextAction = '최고 레벨에 도달했습니다!'
  }

  return {
    currentLevel,
    targetLevel,
    conditions: {
      levelTest: {
        met: status.condition1Met,
        label: '레벨 테스트',
        detail: levelTestDetail,
      },
      unitTests: {
        met: status.condition2Met,
        label: '단원 테스트',
        detail: unitTestDetail,
        progress: unitTestProgress,
        remaining: unitTestRemaining,
      },
      learningActivity: {
        met: status.condition3Met,
        label: '학습 활동',
        detail: learningDetail,
        remaining: learningRemaining,
      },
    },
    allMet: status.allConditionsMet,
    nextAction,
    weakAreas,
  }
}

function buildDefaultProgress(currentLevel: number, targetLevel: number): PromotionProgress {
  return {
    currentLevel,
    targetLevel,
    conditions: {
      levelTest: {
        met: false,
        label: '레벨 테스트',
        detail: '레벨 테스트를 먼저 응시하세요.',
      },
      unitTests: {
        met: false,
        label: '단원 테스트',
        detail: '단원 테스트 이수 현황을 불러오는 중...',
        progress: 0,
      },
      learningActivity: {
        met: false,
        label: '학습 활동',
        detail: '최근 30일 학습 활동 내역을 불러오는 중...',
      },
    },
    allMet: false,
    nextAction: `Level ${targetLevel} 승급을 위해 3가지 조건을 모두 충족하세요.`,
    weakAreas: [],
  }
}
