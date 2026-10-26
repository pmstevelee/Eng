'use server'

// AI 강의 → YouTube 연결·해제 (2-5-6) — SUPER_ADMIN 전용
// 관리자가 직접 YouTube에 올린 영상 링크를 그 포인트의 본사 기본 강의로 건다.

import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '@/lib/auth'
import { logActivity } from '@/lib/activity-log'
import { ACTIVITY_ACTIONS } from '@/lib/constants/activity-actions'
import { parseYoutubeUrl } from '@/lib/grammar/lecture-input'
import {
  linkScriptToYoutube,
  unlinkScriptFromYoutube,
  type LinkScriptResult,
} from '@/lib/grammar/lecture-script-link'

async function getAdmin() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'SUPER_ADMIN') return null
  return user
}

function revalidateLinked(code: string) {
  revalidatePath(`/admin/grammar/points/${code}`)
  revalidatePath('/admin/grammar')
  revalidatePath('/student/grammar', 'layout')
}

export async function linkYoutubeToScript(
  scriptId: string,
  youtubeUrl: string,
  opts?: { confirmLectureId?: string | null },
): Promise<LinkScriptResult> {
  const admin = await getAdmin()
  if (!admin) return { ok: false, error: '권한이 없습니다.' }
  if (typeof scriptId !== 'string' || !scriptId) return { ok: false, error: '스크립트를 찾을 수 없습니다.' }
  const videoId = parseYoutubeUrl(typeof youtubeUrl === 'string' ? youtubeUrl : '')
  if (!videoId) return { ok: false, error: 'YouTube 영상 링크를 확인해 주세요. (예: https://youtu.be/영상ID)' }
  const confirmLectureId = typeof opts?.confirmLectureId === 'string' ? opts.confirmLectureId : null

  let res: Awaited<ReturnType<typeof linkScriptToYoutube>>
  try {
    res = await linkScriptToYoutube({ scriptId, videoId, userId: admin.id, confirmLectureId })
  } catch (error) {
    console.error('[lecture-link] 연결 실패:', error)
    return { ok: false, error: 'YouTube 강의를 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.' }
  }
  if (!res.ok) return res

  const { pointCode, ...result } = res
  await logActivity({
    userId: admin.id,
    role: admin.role,
    action: ACTIVITY_ACTIONS.GRAMMAR_LECTURE_LINK,
    metadata: {
      scriptId,
      pointCode: pointCode ?? null,
      lectureId: result.lectureId,
      videoId,
      created: result.created,
      replaced: result.replacedLectureTitle,
      viewsReset: result.viewsReset,
    },
  })
  if (pointCode) revalidateLinked(pointCode)
  return result
}

export async function unlinkYoutubeFromScript(scriptId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = await getAdmin()
  if (!admin) return { ok: false, error: '권한이 없습니다.' }
  if (typeof scriptId !== 'string' || !scriptId) return { ok: false, error: '스크립트를 찾을 수 없습니다.' }

  let res: Awaited<ReturnType<typeof unlinkScriptFromYoutube>>
  try {
    res = await unlinkScriptFromYoutube(scriptId)
  } catch (error) {
    console.error('[lecture-link] 연결 해제 실패:', error)
    return { ok: false, error: '연결을 해제하지 못했습니다. 잠시 후 다시 시도해 주세요.' }
  }
  if (!res.ok) return res

  await logActivity({
    userId: admin.id,
    role: admin.role,
    action: ACTIVITY_ACTIONS.GRAMMAR_LECTURE_UNLINK,
    metadata: { scriptId, pointCode: res.pointCode, lectureId: res.lectureId, removedViews: res.removedViews },
  })
  revalidateLinked(res.pointCode)
  return { ok: true }
}
