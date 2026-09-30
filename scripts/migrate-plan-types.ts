/**
 * 과거 요금제(BASIC/ENTERPRISE)를 실제 판매 요금제로 변환
 *
 * - BASIC      → STARTER (정원도 스타터 기준 20명/2명으로 재적용)
 * - ENTERPRISE → PREMIUM (정원 무제한 유지)
 * - planType 컬럼을 subscriptionPlan과 동일하게 맞춤
 *
 * 실행: npx tsx scripts/migrate-plan-types.ts          (변경 내용 미리보기)
 *       npx tsx scripts/migrate-plan-types.ts --apply  (실제 반영)
 */

import 'dotenv/config'
import { PrismaClient } from '../src/generated/prisma'
import type { PlanType } from '../src/generated/prisma'
import { getPlanTypeLimits } from '../src/lib/plan-types'

const prisma = new PrismaClient()
const APPLY = process.argv.includes('--apply')

const LEGACY_TO_CURRENT: Partial<Record<PlanType, PlanType>> = {
  BASIC: 'STARTER',
  ENTERPRISE: 'PREMIUM',
}

async function main() {
  console.log(`요금제 변환 ${APPLY ? '실행' : '미리보기 (--apply 로 실제 반영)'}\n`)

  const academies = await prisma.academy.findMany({
    select: {
      id: true,
      name: true,
      subscriptionPlan: true,
      planType: true,
      maxStudents: true,
      maxTeachers: true,
    },
  })

  let changed = 0
  for (const academy of academies) {
    const legacyTarget = LEGACY_TO_CURRENT[academy.subscriptionPlan]
    const nextPlan = legacyTarget ?? academy.subscriptionPlan
    // 과거 요금제였던 학원만 정원을 새 요금제 기준으로 재적용 (현행 요금제 학원의 개별 정원은 유지)
    const limits = legacyTarget
      ? getPlanTypeLimits(nextPlan)
      : { maxStudents: academy.maxStudents, maxTeachers: academy.maxTeachers }

    const needsUpdate =
      nextPlan !== academy.subscriptionPlan ||
      nextPlan !== academy.planType ||
      limits.maxStudents !== academy.maxStudents ||
      limits.maxTeachers !== academy.maxTeachers
    if (!needsUpdate) continue

    changed++
    console.log(
      `- ${academy.name}: ${academy.subscriptionPlan}(planType ${academy.planType}, ${academy.maxStudents}/${academy.maxTeachers})` +
        ` → ${nextPlan}(${limits.maxStudents}/${limits.maxTeachers})`,
    )

    if (APPLY) {
      await prisma.academy.update({
        where: { id: academy.id },
        data: { subscriptionPlan: nextPlan, planType: nextPlan, ...limits },
      })
    }
  }

  console.log(`\n대상 ${changed}개 학원${APPLY ? ' 변환 완료' : ''}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
