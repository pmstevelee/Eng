'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { Prisma } from '@/generated/prisma'
import { prisma } from '@/lib/prisma/client'
import { getConsultationActor } from './access'
import {
  RETENTION_MONTH_OPTIONS,
  SLUG_RULE_TEXT,
  STALE_DAY_OPTIONS,
  WEB_FORM_FIELD_KEYS,
  WEB_FORM_INTRO_MAX,
  isValidSlug,
  type WebFormSettings,
} from './constants'

type ActionResult = { error: string } | { error?: undefined }

const NO_PERMISSION = '권한이 없습니다.'

function asJsonObject(v: unknown): Prisma.JsonObject {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Prisma.JsonObject) : {}
}

/** settingsJson.consultation 일부 항목만 덮어쓰기 (다른 설정은 유지) */
function mergeConsultation(settingsJson: unknown, patch: Prisma.JsonObject): Prisma.InputJsonObject {
  const settings = asJsonObject(settingsJson)
  return { ...settings, consultation: { ...asJsonObject(settings.consultation), ...patch } }
}

function revalidateSettings(academyIds: string[]) {
  revalidatePath('/owner/settings/consultation')
  revalidatePath('/owner/consultations', 'layout')
  revalidatePath('/teacher/consultations', 'layout')
  for (const id of academyIds) revalidateTag(`academy-${id}`)
}

/** 공통 설정 (방치 기준·보관기간) — 학원장, 본원·지점 전체에 적용 */
export async function updateConsultationGeneralSettings(input: {
  staleDays: number
  retentionMonths: number
}): Promise<ActionResult> {
  const actor = await getConsultationActor()
  if (!actor || actor.role !== 'ACADEMY_OWNER') return { error: NO_PERMISSION }
  if (!STALE_DAY_OPTIONS.includes(input.staleDays)) return { error: '방치 기준 일수를 선택해주세요.' }
  if (!RETENTION_MONTH_OPTIONS.includes(input.retentionMonths)) return { error: '보관 기간을 선택해주세요.' }

  const academies = await prisma.academy.findMany({
    where: { id: { in: actor.academyIds } },
    select: { id: true, settingsJson: true },
  })
  await prisma.$transaction(
    academies.map((a) =>
      prisma.academy.update({
        where: { id: a.id },
        data: {
          settingsJson: mergeConsultation(a.settingsJson, {
            staleDays: input.staleDays,
            retentionMonths: input.retentionMonths,
          }),
        },
      }),
    ),
  )

  revalidateSettings(actor.academyIds)
  return {}
}

export type AcademyConsultationSettingsInput = {
  slug: string
  defaultAssigneeId: string
  webForm: WebFormSettings
}

/** 학원별 설정 (신청 폼 주소·기본 담당자·웹 신청 폼) */
export async function updateAcademyConsultationSettings(
  academyId: string,
  input: AcademyConsultationSettingsInput,
): Promise<ActionResult> {
  const actor = await getConsultationActor()
  if (!actor || actor.role !== 'ACADEMY_OWNER' || !actor.academyIds.includes(academyId)) {
    return { error: NO_PERMISSION }
  }

  const slug = input.slug.trim().toLowerCase()
  if (slug && !isValidSlug(slug)) return { error: `신청 폼 주소는 ${SLUG_RULE_TEXT}로 입력해주세요.` }
  if (input.webForm.enabled && !slug) return { error: '신청 폼을 사용하려면 주소를 입력해주세요.' }

  const intro = input.webForm.intro.trim()
  if (intro.length > WEB_FORM_INTRO_MAX) return { error: `안내 문구는 ${WEB_FORM_INTRO_MAX}자 이내로 입력해주세요.` }

  // 기본 담당자: 해당 학원 교사 또는 학원장 본인
  const defaultAssigneeId = input.defaultAssigneeId || null
  if (defaultAssigneeId && defaultAssigneeId !== actor.userId) {
    const teacher = await prisma.user.findFirst({
      where: { id: defaultAssigneeId, academyId, role: 'TEACHER', isDeleted: false, isActive: true },
      select: { id: true },
    })
    if (!teacher) return { error: '기본 담당자를 찾을 수 없습니다.' }
  }

  const academy = await prisma.academy.findUnique({ where: { id: academyId }, select: { settingsJson: true } })
  if (!academy) return { error: '학원을 찾을 수 없습니다.' }

  const fields = Object.fromEntries(WEB_FORM_FIELD_KEYS.map((k) => [k, input.webForm.fields[k] === true]))
  try {
    await prisma.academy.update({
      where: { id: academyId },
      data: {
        slug: slug || null,
        settingsJson: mergeConsultation(academy.settingsJson, {
          defaultAssigneeId,
          webForm: {
            enabled: input.webForm.enabled === true,
            intro,
            fields,
            sendReceipt: input.webForm.sendReceipt === true,
          },
        }),
      },
    })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return { error: '이미 다른 학원이 사용 중인 주소입니다. 다른 주소를 입력해주세요.' }
    }
    throw err
  }

  revalidateSettings([academyId])
  return {}
}
