'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma/client'
import { getConsultationActor } from './access'
import { purgeLeadNow } from './purge'

type ActionResult = { error: string } | { error?: undefined }

const NO_PERMISSION = '권한이 없습니다.'
const NOT_FOUND = '문의를 찾을 수 없거나 이미 파기되었습니다.'

function revalidatePurge(leadId: string) {
  revalidatePath('/owner/settings/consultation')
  revalidatePath('/owner/consultations', 'layout')
  revalidatePath('/teacher/consultations', 'layout')
  revalidatePath(`/owner/consultations/${leadId}`)
}

/** 학원장 권한 범위 안의 미파기 문의 */
async function findOwnerLead(leadId: string) {
  const actor = await getConsultationActor()
  if (!actor || actor.role !== 'ACADEMY_OWNER') return { error: NO_PERMISSION } as const
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, academyId: { in: actor.academyIds }, purgedAt: null },
    select: { id: true, academyId: true, status: true },
  })
  if (!lead) return { error: NOT_FOUND } as const
  return { actor, lead } as const
}

/** 보관 연장 — 활동 기록을 추가해 마지막 활동일을 오늘로 (학원장만) */
export async function extendLeadRetention(leadId: string): Promise<ActionResult> {
  const found = await findOwnerLead(leadId)
  if ('error' in found) return { error: found.error }

  const now = new Date()
  await prisma.$transaction([
    prisma.leadActivity.create({
      data: { leadId: found.lead.id, type: 'RETENTION_EXTENDED', payload: { byUserId: found.actor.userId } },
    }),
    prisma.lead.update({ where: { id: found.lead.id }, data: { lastActivityAt: now } }),
  ])

  revalidatePurge(found.lead.id)
  return {}
}

/** 개별 문의 즉시 파기 (학원장만, 등록 전환된 문의 제외) — 되돌릴 수 없음 */
export async function purgeLeadImmediately(leadId: string): Promise<ActionResult> {
  const found = await findOwnerLead(leadId)
  if ('error' in found) return { error: found.error }
  if (found.lead.status === 'ENROLLED') {
    return { error: '등록 전환된 문의는 파기할 수 없습니다. 학생 정보에서 관리해주세요.' }
  }

  const purged = await purgeLeadNow(found.lead.id, found.lead.academyId, found.actor.userId)
  if (!purged) return { error: NOT_FOUND }

  console.log(`[purge] 즉시 파기 academy=${found.lead.academyId} count=1`)
  revalidatePurge(found.lead.id)
  return {}
}
