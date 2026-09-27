'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma/client'
import { CREDIT_INPUT_MAX, CREDIT_ITEMS, type CreditItemValue } from '@/lib/credits/constants'
import { adjustCreditsByAdmin } from '@/lib/credits/wallet'
import { writeAuditLog } from '@/lib/webhooks/handler'

type ActionResult = { error?: string }

async function requireSuperAdmin() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'SUPER_ADMIN') return null
  return user
}

const NO_PERMISSION = '권한이 없습니다.'

function isCount(value: number, min: number): boolean {
  return Number.isInteger(value) && value >= min && value <= CREDIT_INPUT_MAX
}

// ─── 항목별 단가 (알림 채널 + AI 기능) ───────────────────────────────────────────────────────────────

export async function updateCreditPricing(input: Record<CreditItemValue, number>): Promise<ActionResult> {
  const admin = await requireSuperAdmin()
  if (!admin) return { error: NO_PERMISSION }
  for (const channel of CREDIT_ITEMS) {
    if (!isCount(Number(input[channel]), 1)) return { error: '단가는 1 이상의 정수로 입력해주세요.' }
  }
  await prisma.$transaction(
    CREDIT_ITEMS.map((channel) =>
      prisma.creditPricing.upsert({
        where: { channel },
        create: { channel, creditPerMessage: Number(input[channel]) },
        update: { creditPerMessage: Number(input[channel]) },
      }),
    ),
  )
  await writeAuditLog({
    actorType: 'ADMIN',
    actorId: admin.id,
    action: 'CREDIT_PRICING_UPDATED',
    target: 'CreditPricing',
    metadata: { ...input },
  })
  revalidatePath('/admin/credits')
  return {}
}

// ─── 충전 상품 ─────────────────────────────────────────────────────────────────

export type CreditPackageInput = {
  name: string
  credits: number
  priceKrw: number
  active: boolean
  sortOrder: number
}

function validatePackage(input: CreditPackageInput): string | null {
  const name = input.name.trim()
  if (!name || name.length > 30) return '상품명은 1~30자로 입력해주세요.'
  if (!isCount(Number(input.credits), 1)) return '크레딧은 1 이상의 정수로 입력해주세요.'
  if (!isCount(Number(input.priceKrw), 100)) return '가격은 100원 이상의 정수로 입력해주세요.'
  if (!Number.isInteger(Number(input.sortOrder))) return '정렬 순서는 정수로 입력해주세요.'
  return null
}

export async function saveCreditPackage(id: string | null, input: CreditPackageInput): Promise<ActionResult> {
  const admin = await requireSuperAdmin()
  if (!admin) return { error: NO_PERMISSION }
  const invalid = validatePackage(input)
  if (invalid) return { error: invalid }

  // 이미 결제 중인 건은 결제 시점 스냅샷(Payment.metadata)으로 충전되므로 수정해도 영향 없음
  const data = {
    name: input.name.trim(),
    credits: Number(input.credits),
    priceKrw: Number(input.priceKrw),
    active: !!input.active,
    sortOrder: Number(input.sortOrder),
  }
  if (id) await prisma.creditPackage.update({ where: { id }, data })
  else await prisma.creditPackage.create({ data })

  await writeAuditLog({
    actorType: 'ADMIN',
    actorId: admin.id,
    action: id ? 'CREDIT_PACKAGE_UPDATED' : 'CREDIT_PACKAGE_CREATED',
    target: `CreditPackage:${id ?? 'new'}`,
    metadata: data,
  })
  revalidatePath('/admin/credits')
  return {}
}

// ─── 학원 잔액 수동 조정 ───────────────────────────────────────────────────────

export async function adjustAcademyCredits(
  academyId: string,
  delta: number,
  reason: string,
): Promise<ActionResult & { balanceAfter?: number }> {
  const admin = await requireSuperAdmin()
  if (!admin) return { error: NO_PERMISSION }

  const memo = reason.trim()
  if (!memo) return { error: '조정 사유를 입력해주세요.' }
  if (memo.length > 200) return { error: '조정 사유는 200자 이내로 입력해주세요.' }
  const amount = Number(delta)
  if (!Number.isInteger(amount) || amount === 0 || Math.abs(amount) > CREDIT_INPUT_MAX) {
    return { error: '조정할 크레딧을 0이 아닌 정수로 입력해주세요.' }
  }

  // 지갑은 본원 단위 — 지점 ID가 오면 거부
  const academy = await prisma.academy.findUnique({ where: { id: academyId }, select: { parentAcademyId: true } })
  if (!academy || academy.parentAcademyId) return { error: '학원을 찾을 수 없습니다.' }

  const result = await adjustCreditsByAdmin({ walletAcademyId: academyId, delta: amount, memo, actorId: admin.id })
  if ('error' in result) return { error: result.error }

  await writeAuditLog({
    actorType: 'ADMIN',
    actorId: admin.id,
    action: 'CREDIT_ADMIN_ADJUST',
    target: `Academy:${academyId}`,
    metadata: { delta: amount, reason: memo, balanceAfter: result.balanceAfter },
  })
  revalidatePath('/admin/credits')
  return { balanceAfter: result.balanceAfter }
}
