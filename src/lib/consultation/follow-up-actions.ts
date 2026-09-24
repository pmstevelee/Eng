'use server'

import { revalidatePath } from 'next/cache'
import type { Prisma } from '@/generated/prisma'
import { prisma } from '@/lib/prisma/client'
import { findScopedLead, getConsultationActor, isValidAssignee, leadScopeWhere, type ConsultationActor } from './access'
import { STALE_DAY_OPTIONS, addDaysToDateKey, isDateKey, kstDateStart, todayKst } from './constants'

type ActionResult<T = object> = ({ error: string } & Partial<T>) | ({ error?: undefined } & T)

const NO_PERMISSION = '권한이 없습니다.'
const TASK_NOT_FOUND = '할 일을 찾을 수 없거나 접근 권한이 없습니다.'

function revalidateConsultation() {
  revalidatePath('/owner/consultations', 'layout')
  revalidatePath('/teacher/consultations', 'layout')
}

/**
 * 할 일 접근 범위: 권한 범위 안의 문의에 달린 할 일 + 본인에게 배정된 할 일.
 * (학원장이 타 교사 담당 문의의 할 일을 교사에게 배정할 수 있음)
 */
function taskScopeWhere(actor: ConsultationActor): Prisma.FollowUpTaskWhereInput {
  return {
    academyId: { in: actor.academyIds },
    OR: [{ lead: leadScopeWhere(actor) }, { assigneeId: actor.userId }],
  }
}

export type FollowUpTaskInput = {
  /** 마감일 YYYY-MM-DD (KST) */
  dueDate: string
  content: string
  /** 학원장만 지정 가능 — 교사는 항상 본인 */
  assigneeId?: string
}

export async function createFollowUpTask(leadId: string, input: FollowUpTaskInput): Promise<ActionResult> {
  const actor = await getConsultationActor()
  if (!actor) return { error: NO_PERMISSION }

  const lead = await findScopedLead(actor, leadId)
  if (!lead) return { error: '문의를 찾을 수 없거나 접근 권한이 없습니다.' }

  const content = input.content.trim().slice(0, 500)
  if (!content) return { error: '할 일 내용을 입력해주세요.' }
  if (!isDateKey(input.dueDate)) return { error: '마감일을 선택해주세요.' }
  // 과거 날짜 입력 방지 (1년 이내만 허용)
  const today = todayKst()
  if (input.dueDate < today || input.dueDate > addDaysToDateKey(today, 365)) {
    return { error: '마감일은 오늘부터 1년 이내로 선택해주세요.' }
  }

  let assigneeId = actor.userId
  if (actor.role === 'ACADEMY_OWNER' && input.assigneeId && input.assigneeId !== actor.userId) {
    if (!(await isValidAssignee(actor, lead.academyId, input.assigneeId))) return { error: '담당자를 찾을 수 없습니다.' }
    assigneeId = input.assigneeId
  }

  await prisma.$transaction([
    prisma.followUpTask.create({
      data: {
        academyId: lead.academyId,
        leadId: lead.id,
        assigneeId,
        dueAt: kstDateStart(input.dueDate),
        content,
        createdById: actor.userId,
      },
    }),
    prisma.lead.update({ where: { id: lead.id }, data: { lastActivityAt: new Date() } }),
  ])

  revalidateConsultation()
  return {}
}

/** 완료 체크 / 해제 */
export async function setFollowUpTaskDone(taskId: string, done: boolean): Promise<ActionResult> {
  const actor = await getConsultationActor()
  if (!actor) return { error: NO_PERMISSION }

  const task = await prisma.followUpTask.findFirst({
    where: { id: taskId, ...taskScopeWhere(actor) },
    select: { id: true, leadId: true },
  })
  if (!task) return { error: TASK_NOT_FOUND }

  await prisma.$transaction([
    prisma.followUpTask.update({ where: { id: task.id }, data: { completedAt: done ? new Date() : null } }),
    ...(done ? [prisma.lead.update({ where: { id: task.leadId }, data: { lastActivityAt: new Date() } })] : []),
  ])

  revalidateConsultation()
  return {}
}

/** 삭제 — 학원장 또는 작성자 본인 */
export async function deleteFollowUpTask(taskId: string): Promise<ActionResult> {
  const actor = await getConsultationActor()
  if (!actor) return { error: NO_PERMISSION }

  const task = await prisma.followUpTask.findFirst({
    where: {
      id: taskId,
      ...taskScopeWhere(actor),
      ...(actor.role === 'TEACHER' ? { createdById: actor.userId } : {}),
    },
    select: { id: true },
  })
  if (!task) return { error: TASK_NOT_FOUND }

  await prisma.followUpTask.delete({ where: { id: task.id } })
  revalidateConsultation()
  return {}
}

/** 사이드바 배지: 기한이 지난 미완료 할 일 수 (교사=본인 배정, 학원장=소유 학원 전체) */
export async function getOverdueFollowUpCount(): Promise<number> {
  const actor = await getConsultationActor()
  if (!actor) return 0
  return prisma.followUpTask.count({
    where: {
      academyId: { in: actor.academyIds },
      ...(actor.role === 'TEACHER' ? { assigneeId: actor.userId } : {}),
      completedAt: null,
      dueAt: { lt: kstDateStart(todayKst()) },
    },
  })
}

/** 방치 기준 일수 변경 — 학원장, 본원·지점 전체에 적용 */
export async function updateStaleDays(days: number): Promise<ActionResult> {
  const actor = await getConsultationActor()
  if (!actor || actor.role !== 'ACADEMY_OWNER') return { error: NO_PERMISSION }
  if (!STALE_DAY_OPTIONS.includes(days)) return { error: '기준 일수를 선택해주세요.' }

  const academies = await prisma.academy.findMany({
    where: { id: { in: actor.academyIds } },
    select: { id: true, settingsJson: true },
  })

  await prisma.$transaction(
    academies.map((a) => {
      const settings =
        a.settingsJson && typeof a.settingsJson === 'object' && !Array.isArray(a.settingsJson)
          ? (a.settingsJson as Prisma.JsonObject)
          : {}
      const consultation =
        settings.consultation && typeof settings.consultation === 'object' && !Array.isArray(settings.consultation)
          ? (settings.consultation as Prisma.JsonObject)
          : {}
      return prisma.academy.update({
        where: { id: a.id },
        data: { settingsJson: { ...settings, consultation: { ...consultation, staleDays: days } } },
      })
    }),
  )

  revalidateConsultation()
  return {}
}
