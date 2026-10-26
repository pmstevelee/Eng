// AI 강의 스크립트 ↔ 본사 기본 강의(YouTube) 연결 — 서버 전용
// 권한 확인(SUPER_ADMIN)은 호출하는 Server Action에서 한다.
//
// - 연결: 그 포인트의 본사 기본 강의(academyId null, 포인트당 1편)를 만들거나 이 영상으로 교체하고 스크립트를 LINKED로
// - 해제: 이 스크립트로 연결된 본사 강의를 내리고(시청 기록 함께 삭제) 스크립트를 AUDIO_READY/APPROVED로 되돌린다
// - 관리자가 강의 칸에서 영상을 직접 바꾸거나 지우면 releaseScriptLink로 스크립트 상태만 되돌린다

import { prisma } from '@/lib/prisma/client'
import { parseVideoScenes } from '@/types/grammar-video'
import { resolveAudioVoices } from '@/lib/grammar/elevenlabs'
import { planScriptAudio, statusAfterUnlink } from '@/lib/grammar/video/audio-plan'
import { buildTimeline } from '@/lib/grammar/video/timeline'
import { LECTURE_TITLE_MAX } from '@/lib/grammar/lecture-input'

type ScriptForLink = {
  id: string
  status: string
  scenesJson: unknown
  koVoiceId: string | null
  enVoiceId: string | null
}

/** 스크립트의 음성이 지금 모두 최신인지 */
function audioReadyNow(script: ScriptForLink): boolean {
  const voices = resolveAudioVoices(script.koVoiceId, script.enVoiceId)
  return voices ? planScriptAudio(parseVideoScenes(script.scenesJson).scenes, voices).ready : false
}

const scriptLinkSelect = { id: true, status: true, scenesJson: true, koVoiceId: true, enVoiceId: true } as const

/** 연결이 풀린 스크립트 상태 되돌리기 (스크립트가 없으면 아무것도 안 함) */
export async function releaseScriptLink(scriptId: string | null): Promise<void> {
  if (!scriptId) return
  const script = await prisma.grammarLectureScript.findUnique({ where: { id: scriptId }, select: scriptLinkSelect })
  if (!script || script.status !== 'LINKED') return
  await prisma.grammarLectureScript.update({
    where: { id: script.id },
    data: { status: statusAfterUnlink(script.status, audioReadyNow(script)), linkedAt: null },
  })
}

/** 교체 확인용 — 지금 그 포인트에 걸린 본사 기본 강의 */
export interface ExistingHqLecture {
  id: string
  title: string
  videoId: string
  completedCount: number
  /** 다른 AI 스크립트로 만든 강의면 그 제목 */
  scriptTitle: string | null
  /** 이 스크립트로 이미 연결한 강의(영상만 바꾸는 경우) */
  sameScript: boolean
}

export type LinkScriptResult =
  | { ok: true; lectureId: string; created: boolean; replacedLectureTitle: string | null; viewsReset: boolean; videoId: string; durationSec: number }
  | { ok: false; error: string }
  /** 다른 본사 강의가 이미 있어 교체 확인이 필요 — 화면에서 확인 후 confirmLectureId로 다시 부른다 */
  | { ok: false; needsConfirm: true; existing: ExistingHqLecture; error: string }

export async function linkScriptToYoutube(params: {
  scriptId: string
  videoId: string
  userId: string
  /** 화면에서 교체를 확인한 기존 강의 id */
  confirmLectureId?: string | null
}): Promise<LinkScriptResult & { pointCode?: string }> {
  const { scriptId, videoId, userId, confirmLectureId } = params

  const script = await prisma.grammarLectureScript.findUnique({
    where: { id: scriptId },
    select: {
      ...scriptLinkSelect,
      title: true,
      grammarPointId: true,
      grammarPoint: { select: { code: true, academyId: true } },
    },
  })
  if (!script || script.grammarPoint.academyId !== null) return { ok: false, error: '스크립트를 찾을 수 없습니다.' }
  if (script.status !== 'AUDIO_READY' && script.status !== 'LINKED') {
    return { ok: false, error: '음성까지 모두 만든 스크립트만 연결할 수 있어요.' }
  }
  if (!audioReadyNow(script)) {
    return { ok: false, error: '수정된 장면의 음성이 아직 최신이 아니에요. 음성 단계에서 먼저 만들어 주세요.' }
  }

  const scenes = parseVideoScenes(script.scenesJson).scenes
  const durationSec = Math.max(1, Math.round(buildTimeline(scenes).duration / 1000))
  const title = script.title.trim().slice(0, LECTURE_TITLE_MAX) || '문법 강의'

  const existing = await prisma.grammarLecture.findFirst({
    where: { grammarPointId: script.grammarPointId, academyId: null, isActive: true },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      title: true,
      videoId: true,
      scriptId: true,
      script: { select: { title: true } },
      _count: { select: { views: { where: { completedAt: { not: null } } } } },
    },
  })

  // 같은 스크립트·같은 영상이면 제목·길이만 다시 맞춘다. 그 밖의 교체는 확인을 받는다.
  const sameLink = existing && existing.scriptId === script.id && existing.videoId === videoId
  if (existing && !sameLink && existing.id !== confirmLectureId) {
    return {
      ok: false,
      needsConfirm: true,
      error: '이미 본사 기본 강의가 있어요. 교체할지 확인해 주세요.',
      existing: {
        id: existing.id,
        title: existing.title,
        videoId: existing.videoId,
        completedCount: existing._count.views,
        scriptTitle: existing.scriptId && existing.scriptId !== script.id ? (existing.script?.title ?? null) : null,
        sameScript: existing.scriptId === script.id,
      },
    }
  }

  const previousScriptId = existing?.scriptId && existing.scriptId !== script.id ? existing.scriptId : null
  const viewsReset = Boolean(existing && existing.videoId !== videoId)
  const now = new Date()

  const lectureId = await prisma.$transaction(async (tx) => {
    // 이 스크립트가 다른 강의 행에 걸려 있으면 먼저 푼다 (scriptId unique)
    await tx.grammarLecture.updateMany({
      where: { scriptId: script.id, ...(existing ? { id: { not: existing.id } } : {}) },
      data: { scriptId: null },
    })
    let id: string
    if (existing) {
      if (viewsReset) await tx.grammarLectureView.deleteMany({ where: { lectureId: existing.id } })
      await tx.grammarLecture.update({
        where: { id: existing.id },
        data: {
          title,
          provider: 'youtube',
          videoId,
          durationSec,
          scriptId: script.id,
          ...(viewsReset ? { createdById: userId } : {}),
        },
      })
      id = existing.id
    } else {
      const created = await tx.grammarLecture.create({
        data: {
          grammarPointId: script.grammarPointId,
          academyId: null,
          title,
          provider: 'youtube',
          videoId,
          durationSec,
          scriptId: script.id,
          createdById: userId,
        },
        select: { id: true },
      })
      id = created.id
    }
    await tx.grammarLectureScript.update({ where: { id: script.id }, data: { status: 'LINKED', linkedAt: now } })
    return id
  })
  // 강의를 빼앗긴 이전 스크립트는 연결 전 상태로
  await releaseScriptLink(previousScriptId)

  return {
    ok: true,
    lectureId,
    created: !existing,
    replacedLectureTitle: existing && !sameLink ? existing.title : null,
    viewsReset,
    videoId,
    durationSec,
    pointCode: script.grammarPoint.code,
  }
}

export type UnlinkScriptResult =
  | { ok: true; pointCode: string; lectureId: string | null; removedViews: number }
  | { ok: false; error: string }

/** 연결 해제 — 이 스크립트로 만든 본사 강의를 내리고(학생 화면에서 빠짐) 스크립트 상태를 되돌린다 */
export async function unlinkScriptFromYoutube(scriptId: string): Promise<UnlinkScriptResult> {
  const script = await prisma.grammarLectureScript.findUnique({
    where: { id: scriptId },
    select: {
      ...scriptLinkSelect,
      grammarPoint: { select: { code: true, academyId: true } },
      lecture: { select: { id: true, academyId: true, _count: { select: { views: true } } } },
    },
  })
  if (!script || script.grammarPoint.academyId !== null) return { ok: false, error: '스크립트를 찾을 수 없습니다.' }
  if (script.status !== 'LINKED' && !script.lecture) return { ok: false, error: '연결된 YouTube 강의가 없습니다.' }

  const lecture = script.lecture && script.lecture.academyId === null ? script.lecture : null
  await prisma.$transaction([
    ...(lecture ? [prisma.grammarLecture.delete({ where: { id: lecture.id } })] : []),
    prisma.grammarLectureScript.update({
      where: { id: script.id },
      data: { status: statusAfterUnlink(script.status, audioReadyNow(script)), linkedAt: null },
    }),
  ])
  return { ok: true, pointCode: script.grammarPoint.code, lectureId: lecture?.id ?? null, removedViews: lecture?._count.views ?? 0 }
}
