import { cookies } from 'next/headers'
import { cache } from 'react'
import { Plan } from '@/generated/prisma'
import { prisma } from '@/lib/prisma/client'

export const BRANCH_COOKIE = 'ivy-selected-branch'
export const BRANCH_ALL = 'all'

export function canManageBranches(plan: Plan | string): boolean {
  return plan === 'STANDARD' || plan === 'PREMIUM' || plan === 'ENTERPRISE'
}

// Academy.subscriptionPlan(PlanType)을 Plan enum으로 변환
// Subscription 레코드가 없을 때 fallback으로 사용
function academyPlanTypeToPlan(planType: string): Plan {
  if (planType === 'STANDARD') return Plan.STANDARD
  if (planType === 'PREMIUM' || planType === 'ENTERPRISE') return Plan.PREMIUM
  return Plan.FREE
}

export type BranchInfo = {
  id: string
  name: string
  branchName: string | null
  branchOrder: number
}

type OwnerBranchesResult = {
  hq: BranchInfo & { id: string }
  branches: BranchInfo[]
  plan: Plan
  canManage: boolean
  allIds: string[]
}

/**
 * 학원장의 본원/지점/플랜을 한 번의 쿼리로 가져온다.
 * - 지점 추가·변경이 즉시 반영되도록 요청 간 캐시는 두지 않는다.
 * - layout/page에서 모두 호출되므로 React cache()로 같은 요청 내 중복 조회만 막는다.
 */
const fetchOwnerBranchesCached = cache(
  async (ownerId: string): Promise<OwnerBranchesResult | null> => {
    const hq = await prisma.academy.findFirst({
      where: { ownerId, parentAcademyId: null, isDeleted: false },
      select: {
        id: true,
        name: true,
        branchName: true,
        subscriptionPlan: true,
        branches: {
          where: { isDeleted: false },
          select: { id: true, name: true, branchName: true, branchOrder: true },
          orderBy: { branchOrder: 'asc' },
        },
        subscription: { select: { plan: true } },
      },
    })
    if (!hq) return null

    const plan = hq.subscription?.plan ?? academyPlanTypeToPlan(hq.subscriptionPlan)
    const allIds = [hq.id, ...hq.branches.map((b) => b.id)]

    return {
      hq: { id: hq.id, name: hq.name, branchName: hq.branchName, branchOrder: 0 },
      branches: hq.branches,
      plan,
      canManage: canManageBranches(plan),
      allIds,
    }
  },
)

/** 학원장이 소유한 본원 + 모든 지점 ID 배열 반환 */
export async function getOwnerAcademyIds(ownerId: string): Promise<string[]> {
  const data = await fetchOwnerBranchesCached(ownerId)
  return data?.allIds ?? []
}

/** 학원장의 본원 정보 + 지점 목록 반환 */
export async function getOwnerBranches(ownerId: string): Promise<{
  hq: BranchInfo
  branches: BranchInfo[]
  plan: Plan
  canManage: boolean
} | null> {
  const data = await fetchOwnerBranchesCached(ownerId)
  if (!data) return null
  const { allIds: _allIds, ...rest } = data
  return rest
}

/**
 * 현재 선택된 지점에 따라 조회할 academyId 배열 반환
 * - canManage=false: 항상 전체(통합뷰)
 * - canManage=true + selectedBranchId='all': 전체
 * - canManage=true + selectedBranchId=특정ID: 해당 지점만
 */
export async function getViewableAcademyIds(
  ownerId: string,
  selectedBranchId?: string,
): Promise<string[]> {
  const data = await fetchOwnerBranchesCached(ownerId)
  if (!data) return []
  const { allIds, canManage } = data
  if (!canManage) return allIds
  if (!selectedBranchId || selectedBranchId === BRANCH_ALL) return allIds
  if (allIds.includes(selectedBranchId)) return [selectedBranchId]
  return allIds
}

/** 쿠키에서 현재 선택된 지점 ID 읽기 */
export async function getSelectedBranchId(): Promise<string> {
  const cookieStore = await cookies()
  return cookieStore.get(BRANCH_COOKIE)?.value ?? BRANCH_ALL
}
