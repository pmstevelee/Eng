'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { prisma } from '@/lib/prisma/client'
import { sendNotification } from '@/lib/notifications/send'
import { INVITE_VALID_DAYS, generateToken } from '@/lib/placement/runner'
import { findScopedLead, getConsultationActor } from './access'
import { academyDisplayName } from './notify'

type ActionResult<T = object> = ({ error: string } & Partial<T>) | ({ error?: undefined } & T)

const NO_PERMISSION = '권한이 없습니다.'
const NOT_FOUND = '문의를 찾을 수 없거나 접근 권한이 없습니다.'

const ACADEMY_SELECT = {
  name: true,
  businessName: true,
  branchName: true,
  phone: true,
  parentAcademyId: true,
  parentAcademy: { select: { name: true, businessName: true, phone: true } },
} as const

function revalidateConsultation() {
  revalidatePath('/owner/consultations', 'layout')
  revalidatePath('/teacher/consultations', 'layout')
}

/** 알림 링크용 절대 URL 기준 (APP_BASE_URL 우선, 없으면 현재 요청 호스트) */
function appBaseUrl(): string {
  const configured = process.env.APP_BASE_URL?.replace(/\/$/, '')
  if (configured) return configured
  const h = headers()
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'login.wegoupenglish.com'
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')
  return `${proto}://${host}`
}

const KST_DATE_LABEL = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul',
  month: 'long',
  day: 'numeric',
  weekday: 'short',
})

/** 10월 2일 (금) */
function formatDueDate(date: Date): string {
  const p = Object.fromEntries(KST_DATE_LABEL.formatToParts(date).map((x) => [x.type, x.value]))
  return `${p.month} ${p.day}일 (${p.weekday})`
}

/**
 * 레벨테스트 응시 링크 발급 (+ 선택 시 학부모 알림).
 * 아직 응시하지 않은 기존 링크는 만료 처리하고 새 링크를 만든다. (응시 중인 링크는 유지 불가 → 새로 발급 시 만료)
 */
export async function createPlacementInvite(
  leadId: string,
  options: { notify: boolean },
): Promise<ActionResult<{ token: string; expiresAt: string; notifyError?: string }>> {
  const actor = await getConsultationActor()
  if (!actor) return { error: NO_PERMISSION }

  const lead = await findScopedLead(actor, leadId)
  if (!lead) return { error: NOT_FOUND }
  if (lead.studentId || lead.status === 'ENROLLED') return { error: '이미 학생으로 등록된 문의입니다.' }

  const token = generateToken()
  const expiresAt = new Date(Date.now() + INVITE_VALID_DAYS * 24 * 60 * 60 * 1000)

  const [, invite] = await prisma.$transaction([
    prisma.placementInvite.updateMany({
      where: { leadId: lead.id, status: { in: ['SENT', 'STARTED'] } },
      data: { status: 'EXPIRED' },
    }),
    prisma.placementInvite.create({
      data: { academyId: lead.academyId, leadId: lead.id, token, expiresAt, createdById: actor.userId },
      select: { id: true },
    }),
    prisma.lead.update({ where: { id: lead.id }, data: { lastActivityAt: new Date() } }),
  ])

  let notifyError: string | undefined
  if (options.notify) {
    const detail = await prisma.lead.findUnique({
      where: { id: lead.id },
      select: { phone: true, academy: { select: ACADEMY_SELECT } },
    })
    if (detail) {
      const result = await sendNotification({
        academyId: lead.academyId,
        leadId: lead.id,
        phone: detail.phone,
        templateKey: 'PLACEMENT_TEST_LINK',
        variables: {
          학원명: academyDisplayName(detail.academy),
          학생명: lead.studentName,
          응시링크: `${appBaseUrl()}/placement/invite/${token}`,
          마감일: formatDueDate(expiresAt),
        },
        dedupeKey: `placement-link:${invite.id}`,
      })
      if (result.status === 'FAILED') notifyError = `링크는 만들었지만 알림 발송에 실패했습니다. (${result.error})`
    }
  }

  revalidateConsultation()
  return { token, expiresAt: expiresAt.toISOString(), notifyError }
}

/** 레벨테스트 결과 리포트 발송 — 담당자가 결과 확인 후 수동으로 */
export async function sendPlacementResult(leadId: string): Promise<ActionResult<{ status: string }>> {
  const actor = await getConsultationActor()
  if (!actor) return { error: NO_PERMISSION }

  const lead = await findScopedLead(actor, leadId)
  if (!lead) return { error: NOT_FOUND }

  const attempt = await prisma.placementAttempt.findFirst({
    where: { leadId: lead.id, status: 'COMPLETED', resultToken: { not: null } },
    orderBy: { completedAt: 'desc' },
    select: {
      id: true,
      resultToken: true,
      resultExpiresAt: true,
      lead: { select: { phone: true, academy: { select: ACADEMY_SELECT } } },
    },
  })
  if (!attempt?.resultToken) return { error: '완료된 레벨테스트 결과가 없습니다.' }
  if (attempt.resultExpiresAt && attempt.resultExpiresAt.getTime() < Date.now()) {
    return { error: '결과 페이지 공개 기간(30일)이 지났습니다.' }
  }

  const result = await sendNotification({
    academyId: lead.academyId,
    leadId: lead.id,
    phone: attempt.lead.phone,
    templateKey: 'PLACEMENT_TEST_RESULT',
    variables: {
      학원명: academyDisplayName(attempt.lead.academy),
      학생명: lead.studentName,
      결과링크: `${appBaseUrl()}/placement/result/${attempt.resultToken}`,
    },
    dedupeKey: `placement-result:${attempt.id}`,
  })

  revalidateConsultation()
  if (result.status === 'DUPLICATE') return { error: '이미 결과 리포트를 발송했습니다.' }
  if (result.status === 'FAILED') return { error: `발송에 실패했습니다. (${result.error})` }
  return { status: result.status }
}
