'use server'

// 관리자 문법 강의 — 본사 기본 강의(academyId = null)만 등록·수정·삭제한다

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma/client'
import { getCurrentUser } from '@/lib/auth'
import { logActivity } from '@/lib/activity-log'
import { ACTIVITY_ACTIONS } from '@/lib/constants/activity-actions'
import { validateLectureInput } from '@/lib/grammar/lecture-input'
import { deleteLecture, upsertLecture } from '@/lib/grammar/lectures'

type ActionResult = { ok: true } | { ok: false; error: string }

async function getAdmin() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'SUPER_ADMIN') return null
  return user
}

function revalidateLecturePages(code: string) {
  revalidatePath(`/admin/grammar/points/${code}`)
  revalidatePath('/student/grammar', 'layout')
}

/** 본사 기본 강의 저장 — 포인트당 1편, 이미 있으면 고친다 */
export async function saveHqLecture(pointId: string, input: unknown): Promise<ActionResult> {
  const admin = await getAdmin()
  if (!admin) return { ok: false, error: '권한이 없습니다.' }
  if (typeof pointId !== 'string' || !pointId) return { ok: false, error: '포인트를 찾을 수 없습니다.' }

  const parsed = validateLectureInput(input)
  if (!parsed.ok) return parsed

  const point = await prisma.grammarPoint.findFirst({ where: { id: pointId, academyId: null }, select: { id: true, code: true } })
  if (!point) return { ok: false, error: '포인트를 찾을 수 없습니다.' }

  try {
    const saved = await upsertLecture({ grammarPointId: point.id, academyId: null, input: parsed.value, userId: admin.id })
    await logActivity({
      userId: admin.id,
      role: admin.role,
      action: ACTIVITY_ACTIONS.GRAMMAR_LECTURE_SAVE,
      metadata: { pointCode: point.code, lectureId: saved.id, videoId: parsed.value.videoId, created: saved.created },
    })
  } catch (error) {
    console.error('[grammar-lecture] 저장 실패:', error)
    return { ok: false, error: '강의를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.' }
  }
  revalidateLecturePages(point.code)
  return { ok: true }
}

/** 본사 기본 강의 삭제 (학원 강의는 관리자 화면에서 지우지 않는다) */
export async function deleteHqLecture(lectureId: string): Promise<ActionResult> {
  const admin = await getAdmin()
  if (!admin) return { ok: false, error: '권한이 없습니다.' }
  if (typeof lectureId !== 'string' || !lectureId) return { ok: false, error: '강의를 찾을 수 없습니다.' }

  try {
    const removed = await deleteLecture(lectureId, null)
    if (!removed) return { ok: false, error: '강의를 찾을 수 없습니다.' }
    const point = await prisma.grammarPoint.findUnique({ where: { id: removed.grammarPointId }, select: { code: true } })
    await logActivity({
      userId: admin.id,
      role: admin.role,
      action: ACTIVITY_ACTIONS.GRAMMAR_LECTURE_DELETE,
      metadata: { pointCode: point?.code ?? null, lectureId },
    })
    if (point) revalidateLecturePages(point.code)
  } catch (error) {
    console.error('[grammar-lecture] 삭제 실패:', error)
    return { ok: false, error: '강의를 삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.' }
  }
  return { ok: true }
}
