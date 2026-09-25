import 'server-only'

import { createHmac, timingSafeEqual } from 'crypto'
import { cache } from 'react'
import type { Prisma } from '@/generated/prisma'
import { prisma } from '@/lib/prisma/client'
import { sendNotification } from '@/lib/notifications/send'
import { academyDisplayName } from './notify'
import {
  DEFAULT_RETENTION_MONTHS,
  GRADE_OPTIONS,
  isValidPhone,
  normalizePhone,
  readDefaultAssigneeId,
  readConsultationNotifications,
  readRetentionMonths,
  readWebFormSettings,
  sanitizeSource,
  type WebFormSettings,
  type WebInquiryPayload,
} from './constants'

// 외부 상담신청 폼 (/apply/[academySlug]) 서버 로직 — 로그인 없이 호출되므로
// 신청자에게는 기존 문의 존재 여부 등 어떤 내부 정보도 돌려주지 않는다.

const ACADEMY_SELECT = {
  id: true,
  name: true,
  businessName: true,
  branchName: true,
  phone: true,
  parentAcademyId: true,
  ownerId: true,
  settingsJson: true,
  parentAcademy: { select: { name: true, businessName: true, phone: true, ownerId: true, settingsJson: true } },
} satisfies Prisma.AcademySelect

type ApplyAcademy = Prisma.AcademyGetPayload<{ select: typeof ACADEMY_SELECT }>

/** 요청 단위 캐시 — generateMetadata와 페이지가 같은 조회를 공유 */
const findApplyAcademy = cache(async (slug: string): Promise<ApplyAcademy | null> => {
  if (!slug || slug.length > 40) return null
  return prisma.academy.findFirst({ where: { slug, isDeleted: false }, select: ACADEMY_SELECT })
})

function retentionMonthsOf(a: ApplyAcademy): number {
  return readRetentionMonths(a.settingsJson) ?? readRetentionMonths(a.parentAcademy?.settingsJson) ?? DEFAULT_RETENTION_MONTHS
}

// ─── 제출 간격 검사용 폼 토큰 ──────────────────────────────────────────────────

/** 페이지 렌더 후 이 시간 안에 제출되면 봇으로 간주 */
const MIN_FILL_MS = 3_000
/** 페이지를 오래 열어둔 경우 새로고침 요구 */
const MAX_FORM_AGE_MS = 24 * 60 * 60 * 1000

function formSecret(): string {
  const secret = process.env.APPLY_FORM_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!secret) throw new Error('APPLY_FORM_SECRET 환경변수가 설정되지 않았습니다.')
  return secret
}

function sign(value: string): string {
  return createHmac('sha256', formSecret()).update(value).digest('base64url')
}

/** 폼 렌더 시각을 서명한 토큰 ("{ts}.{sig}") */
export function issueFormToken(slug: string): string {
  const ts = Date.now().toString(36)
  return `${ts}.${sign(`apply:${slug}:${ts}`)}`
}

type FormTokenCheck = 'ok' | 'too_fast' | 'expired' | 'invalid'

function checkFormToken(slug: string, token: string): FormTokenCheck {
  const [ts, sig] = token.split('.')
  if (!ts || !sig) return 'invalid'
  const expected = Buffer.from(sign(`apply:${slug}:${ts}`))
  const actual = Buffer.from(sig)
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return 'invalid'
  const elapsed = Date.now() - parseInt(ts, 36)
  if (!Number.isFinite(elapsed) || elapsed < 0) return 'invalid'
  if (elapsed < MIN_FILL_MS) return 'too_fast'
  if (elapsed > MAX_FORM_AGE_MS) return 'expired'
  return 'ok'
}

// ─── 공개 페이지 데이터 ────────────────────────────────────────────────────────

export type ApplyPageData =
  | { kind: 'not_found' }
  | { kind: 'disabled'; academyName: string }
  | {
      kind: 'open'
      academyName: string
      academyPhone: string | null
      intro: string
      fields: WebFormSettings['fields']
      retentionMonths: number
      formToken: string
    }

export async function getApplyPageData(slug: string): Promise<ApplyPageData> {
  const academy = await findApplyAcademy(slug)
  if (!academy) return { kind: 'not_found' }
  const academyName = academyDisplayName(academy)
  const form = readWebFormSettings(academy.settingsJson)
  if (!form.enabled) return { kind: 'disabled', academyName }
  return {
    kind: 'open',
    academyName,
    academyPhone: academy.phone ?? academy.parentAcademy?.phone ?? null,
    intro: form.intro,
    fields: form.fields,
    retentionMonths: retentionMonthsOf(academy),
    formToken: issueFormToken(slug),
  }
}

// ─── 제출 처리 ────────────────────────────────────────────────────────────────

export type WebInquiryInput = {
  formToken: string
  /** honeypot — 사람에게는 보이지 않는 필드. 값이 있으면 봇 */
  website: string
  parentName: string
  phone: string
  studentName: string
  grade?: string
  school?: string
  preferredSchedule?: string
  message?: string
  source?: string
  privacyConsent: boolean
  guardianConfirm: boolean
}

export type WebInquiryResult = { ok: true } | { ok: false; error: string }

const GENERIC_ERROR = '신청을 처리하지 못했습니다. 잠시 후 다시 시도해주세요.'

function text(v: string | undefined, max: number): string | undefined {
  const t = (v ?? '').trim().replace(/\s+/g, ' ')
  return t ? t.slice(0, max) : undefined
}

function multiline(v: string | undefined, max: number): string | undefined {
  const t = (v ?? '').trim()
  return t ? t.slice(0, max) : undefined
}

type ParsedInquiry = { phone: string; payload: WebInquiryPayload }

function parseInput(input: WebInquiryInput, form: WebFormSettings): { error: string } | ParsedInquiry {
  const parentName = text(input.parentName, 30)
  if (!parentName) return { error: '보호자 이름을 입력해주세요.' }
  const phone = normalizePhone(input.phone ?? '')
  if (!isValidPhone(phone)) return { error: '보호자 연락처를 정확히 입력해주세요. (예: 010-1234-5678)' }
  const studentName = text(input.studentName, 30)
  if (!studentName) return { error: '학생 이름을 입력해주세요.' }
  if (!input.privacyConsent) return { error: '개인정보 수집·이용에 동의해주세요.' }
  if (!input.guardianConfirm) return { error: '보호자 확인에 체크해주세요.' }

  const grade = form.fields.grade ? text(input.grade, 10) : undefined
  if (grade && !GRADE_OPTIONS.includes(grade)) return { error: '학년을 다시 선택해주세요.' }

  const payload: WebInquiryPayload = {
    parentName,
    studentName,
    ...(grade ? { grade } : {}),
    ...(form.fields.school && text(input.school, 50) ? { school: text(input.school, 50) } : {}),
    ...(form.fields.schedule && text(input.preferredSchedule, 100)
      ? { preferredSchedule: text(input.preferredSchedule, 100) }
      : {}),
    ...(form.fields.message && multiline(input.message, 1000) ? { message: multiline(input.message, 1000) } : {}),
  }
  const source = sanitizeSource(input.source)
  if (source) payload.source = source
  return { phone, payload }
}

/** 기본 담당자가 여전히 유효한지 (해당 학원 교사 또는 학원장, 활성 계정) */
async function resolveDefaultAssignee(academy: ApplyAcademy): Promise<string | null> {
  const id = readDefaultAssigneeId(academy.settingsJson)
  if (!id) return null
  const ownerIds = [academy.ownerId, academy.parentAcademy?.ownerId].filter(Boolean)
  const user = await prisma.user.findFirst({
    where: {
      id,
      isDeleted: false,
      isActive: true,
      OR: [{ academyId: academy.id, role: { in: ['TEACHER', 'ACADEMY_OWNER'] } }, ...(ownerIds.includes(id) ? [{ id }] : [])],
    },
    select: { id: true },
  })
  return user?.id ?? null
}

/**
 * 웹 상담신청 처리.
 * - 같은 학원에 동일 연락처 문의가 있으면 새 문의를 만들지 않고 기존 문의에 '웹 재문의' 활동 추가
 * - 신청자에게는 신규/재문의 구분 없이 같은 결과를 돌려준다
 * rate limit·honeypot은 호출부(서버 액션)에서 먼저 처리한다.
 */
export async function processWebInquiry(slug: string, input: WebInquiryInput): Promise<WebInquiryResult> {
  const academy = await findApplyAcademy(slug)
  if (!academy) return { ok: false, error: '신청 페이지를 찾을 수 없습니다.' }
  const form = readWebFormSettings(academy.settingsJson)
  if (!form.enabled) return { ok: false, error: '현재 온라인 상담 신청을 받고 있지 않습니다.' }

  const tokenCheck = checkFormToken(slug, input.formToken ?? '')
  if (tokenCheck === 'too_fast') return { ok: false, error: '입력 내용을 확인한 후 다시 제출해주세요.' }
  if (tokenCheck !== 'ok') return { ok: false, error: '페이지가 만료되었습니다. 새로고침 후 다시 작성해주세요.' }

  const parsed = parseInput(input, form)
  if ('error' in parsed) return { ok: false, error: parsed.error }
  const { phone, payload } = parsed
  const now = new Date()

  // 같은 번호의 기존 문의 — 학생 이름이 같은 문의 우선, 없으면 가장 최근 문의
  const existing = await prisma.lead.findMany({
    where: { academyId: academy.id, phone },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: { id: true, studentName: true, assigneeId: true, parentName: true, grade: true, school: true, preferredSchedule: true },
  })
  const target = existing.find((l) => l.studentName === payload.studentName) ?? existing[0]

  let leadId: string
  let assigneeId: string | null
  let isReinquiry: boolean
  try {
    if (target) {
      isReinquiry = true
      leadId = target.id
      assigneeId = target.assigneeId
      await prisma.$transaction([
        prisma.leadActivity.create({
          data: { leadId, type: 'WEB_REINQUIRY', payload: payload as Prisma.InputJsonObject },
        }),
        prisma.lead.update({
          where: { id: leadId },
          data: {
            lastActivityAt: now,
            webInquiryAt: now,
            privacyConsentAt: now,
            // 비어 있던 항목만 채움 (기존 기록은 덮어쓰지 않음)
            ...(!target.parentName ? { parentName: payload.parentName } : {}),
            ...(!target.grade && payload.grade ? { grade: payload.grade } : {}),
            ...(!target.school && payload.school ? { school: payload.school } : {}),
            ...(!target.preferredSchedule && payload.preferredSchedule
              ? { preferredSchedule: payload.preferredSchedule }
              : {}),
          },
        }),
      ])
    } else {
      isReinquiry = false
      assigneeId = await resolveDefaultAssignee(academy)
      const lead = await prisma.lead.create({
        data: {
          academyId: academy.id,
          studentName: payload.studentName,
          parentName: payload.parentName,
          phone,
          grade: payload.grade ?? null,
          school: payload.school ?? null,
          preferredSchedule: payload.preferredSchedule ?? null,
          channel: 'WEB',
          source: payload.source ?? null,
          status: 'NEW',
          assigneeId,
          privacyConsentAt: now,
          lastActivityAt: now,
          webInquiryAt: now,
          statusHistory: { create: { fromStatus: null, toStatus: 'NEW', changedById: null } },
          activities: { create: { type: 'WEB_INQUIRY', payload: payload as Prisma.InputJsonObject } },
        },
        select: { id: true },
      })
      leadId = lead.id
    }
  } catch (err) {
    console.error('[web-inquiry] 저장 실패:', err)
    return { ok: false, error: GENERIC_ERROR }
  }

  await Promise.all([
    notifyStaff(academy, leadId, assigneeId, payload.studentName, isReinquiry),
    form.sendReceipt
      ? sendNotification({
          academyId: academy.id,
          leadId,
          phone,
          templateKey: 'INQUIRY_RECEIVED',
          variables: { 학원명: academyDisplayName(academy), 학생명: payload.studentName },
          dedupeKey: `inquiry:${leadId}:${now.getTime()}`,
        })
      : null,
  ])

  return { ok: true }
}

/** 학원장·담당자 앱 알림 (실패해도 신청 처리에는 영향 없음) */
async function notifyStaff(
  academy: ApplyAcademy,
  leadId: string,
  assigneeId: string | null,
  studentName: string,
  isReinquiry: boolean,
): Promise<void> {
  if (!readConsultationNotifications(academy.settingsJson).staffWebInquiry) return
  const ownerId = academy.ownerId ?? academy.parentAcademy?.ownerId ?? null
  const recipientIds = Array.from(new Set([ownerId, assigneeId].filter((id): id is string => !!id)))
  if (recipientIds.length === 0) return

  try {
    const users = await prisma.user.findMany({
      where: { id: { in: recipientIds }, isDeleted: false },
      select: { id: true, role: true },
    })
    await prisma.notification.createMany({
      data: users.map((u) => ({
        userId: u.id,
        academyId: academy.id,
        type: 'INFO' as const,
        title: isReinquiry ? '웹 재문의 접수' : '새 웹 상담신청',
        message: isReinquiry
          ? `${studentName} 학생 보호자가 상담신청 폼으로 다시 문의했습니다.`
          : `${studentName} 학생의 상담신청이 접수되었습니다.`,
        link: `${u.role === 'TEACHER' ? '/teacher/consultations' : '/owner/consultations'}/${leadId}`,
        relatedId: leadId,
      })),
    })
  } catch (err) {
    console.error('[web-inquiry] 앱 알림 생성 실패:', err)
  }
}
