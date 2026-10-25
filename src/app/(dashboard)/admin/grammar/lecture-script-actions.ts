'use server'

// AI 강의 스크립트 (만들기·장면 저장·승인·삭제·목소리) — SUPER_ADMIN 전용
// 음성 생성은 lecture-audio-actions.ts

import { revalidatePath } from 'next/cache'
import type { Prisma } from '@/generated/prisma'
import { prisma } from '@/lib/prisma/client'
import { getCurrentUser } from '@/lib/auth'
import { logActivity } from '@/lib/activity-log'
import { ACTIVITY_ACTIONS } from '@/lib/constants/activity-actions'
import { formatVideoSceneErrors, parseVideoScenes, type VideoScene } from '@/types/grammar-video'
import { formatScriptsForPrompt } from '@/lib/grammar/point-editing'
import { GAP_ORIGIN, GAP_STATUS, getScriptsForPoint } from '@/lib/grammar/source-scripts'
import { getScriptPointInfo } from '@/lib/grammar/lecture-scripts'
import { convertPastedScript, generateVideoScript } from '@/lib/grammar/video/script-ai'
import {
  PASTED_SCRIPT_MAX,
  SCRIPT_MINUTES,
  checkScriptStructure,
  type NarrationDiff,
  type ScriptAudience,
  type ScriptGapDraft,
} from '@/lib/grammar/video/script-prompt'
import { carryOverAudio, planScriptAudio, statusAfterEdit } from '@/lib/grammar/video/audio-plan'
import { buildTimeline } from '@/lib/grammar/video/timeline'
import { resolveAudioVoices } from '@/lib/grammar/elevenlabs'
import { removeLectureAudio } from '@/lib/grammar/lecture-audio-storage'

type Fail = { ok: false; error: string }

async function getAdmin() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'SUPER_ADMIN') return null
  return user
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue
}

function durationOf(scenes: VideoScene[]): number {
  return Math.round(buildTimeline(scenes).duration / 1000)
}

async function revalidatePoint(pointId: string) {
  const p = await prisma.grammarPoint.findUnique({ where: { id: pointId }, select: { code: true } })
  if (p) revalidatePath(`/admin/grammar/points/${p.code}`)
  revalidatePath('/admin/grammar')
}

/** 스크립트 생성 때 AI가 낸 보완 요청으로 그 포인트의 열린 LECTURE 요청을 바꾼다 */
async function replaceLectureGaps(pointId: string, gaps: ScriptGapDraft[]) {
  await prisma.$transaction([
    prisma.grammarContentGap.deleteMany({ where: { grammarPointId: pointId, status: GAP_STATUS.OPEN, origin: GAP_ORIGIN.LECTURE } }),
    prisma.grammarContentGap.createMany({
      data: gaps.map((g) => ({ grammarPointId: pointId, message: g.message, request: g.request || null, origin: GAP_ORIGIN.LECTURE })),
    }),
  ])
}

// ── 만들기 ──────────────────────────────────────────────────

export type CreateScriptResult =
  | { ok: true; scriptId: string; warnings: string[]; gapCount: number; diff?: NarrationDiff }
  | Fail

export async function createScriptWithAi(
  pointId: string,
  opts: { minutes: number; audience: string; seriesNo: number | null },
): Promise<CreateScriptResult> {
  const admin = await getAdmin()
  if (!admin) return { ok: false, error: '권한이 없습니다.' }
  const minutes = (SCRIPT_MINUTES as readonly number[]).includes(opts?.minutes) ? opts.minutes : 3
  const audience: ScriptAudience = opts?.audience === 'high' ? 'high' : 'middle'
  const seriesNo = Number.isInteger(opts?.seriesNo) && (opts.seriesNo as number) > 0 && (opts.seriesNo as number) < 10000 ? opts.seriesNo : null

  const [point, scripts] = await Promise.all([getScriptPointInfo(pointId), getScriptsForPoint(pointId)])
  if (!point) return { ok: false, error: '포인트를 찾을 수 없습니다.' }

  const res = await generateVideoScript({ point, minutes, audience, seriesNo, sourceText: formatScriptsForPrompt(scripts.prompt) })
  if (!res.ok) return res

  const created = await prisma.grammarLectureScript.create({
    data: {
      grammarPointId: point.id,
      title: res.title || `${point.title} 강의`,
      seriesNo,
      status: 'DRAFT',
      source: 'AI',
      scenesJson: toJson(res.scenes),
      durationSec: durationOf(res.scenes),
      createdById: admin.id,
    },
    select: { id: true },
  })
  await replaceLectureGaps(point.id, res.gaps)
  await logActivity({
    userId: admin.id,
    role: admin.role,
    action: ACTIVITY_ACTIONS.GRAMMAR_LECTURE_SCRIPT_CREATE,
    metadata: { scriptId: created.id, pointCode: point.code, source: 'AI', minutes, audience, scenes: res.scenes.length, gaps: res.gaps.length },
  })
  await revalidatePoint(point.id)
  return { ok: true, scriptId: created.id, warnings: res.warnings, gapCount: res.gaps.length }
}

export async function createScriptFromText(pointId: string, input: { text: string; seriesNo: number | null }): Promise<CreateScriptResult> {
  const admin = await getAdmin()
  if (!admin) return { ok: false, error: '권한이 없습니다.' }
  const text = typeof input?.text === 'string' ? input.text.trim() : ''
  if (!text) return { ok: false, error: '대본을 붙여넣어 주세요.' }
  if (text.length > PASTED_SCRIPT_MAX) return { ok: false, error: `대본은 ${PASTED_SCRIPT_MAX.toLocaleString()}자까지 넣을 수 있습니다.` }
  const seriesNo = Number.isInteger(input?.seriesNo) && (input.seriesNo as number) > 0 ? input.seriesNo : null

  const point = await getScriptPointInfo(pointId)
  if (!point) return { ok: false, error: '포인트를 찾을 수 없습니다.' }

  const res = await convertPastedScript(text, point)
  if (!res.ok) return res

  const created = await prisma.grammarLectureScript.create({
    data: {
      grammarPointId: point.id,
      title: res.title || `${point.title} 강의`,
      seriesNo,
      status: 'DRAFT',
      source: 'MANUAL',
      sourceText: text,
      scenesJson: toJson(res.scenes),
      durationSec: durationOf(res.scenes),
      createdById: admin.id,
    },
    select: { id: true },
  })
  await logActivity({
    userId: admin.id,
    role: admin.role,
    action: ACTIVITY_ACTIONS.GRAMMAR_LECTURE_SCRIPT_CREATE,
    metadata: {
      scriptId: created.id,
      pointCode: point.code,
      source: 'MANUAL',
      scenes: res.scenes.length,
      missing: res.diff.missing.length,
      added: res.diff.added.length,
    },
  })
  await revalidatePoint(point.id)
  return { ok: true, scriptId: created.id, warnings: res.warnings, gapCount: 0, diff: res.diff }
}

// ── 장면 저장 ───────────────────────────────────────────────

export type UpdateScenesResult = { ok: true; status: string; updatedAt: string } | (Fail & { errors?: string[] })

/**
 * 장면 저장 — 파서 검증 후 저장. 음성 필드는 저장돼 있던 값을 이어 붙이고(화면 값은 무시),
 * 문장이 바뀐 세그먼트는 해시가 달라져 음성 '수정됨'이 된다. 지운 세그먼트의 음성 파일은 삭제.
 * expectedUpdatedAt이 다르면(다른 창에서 저장) 덮어쓰지 않는다.
 */
export async function updateScenes(
  scriptId: string,
  input: { scenes: unknown; title: string; expectedUpdatedAt: string },
): Promise<UpdateScenesResult> {
  const admin = await getAdmin()
  if (!admin) return { ok: false, error: '권한이 없습니다.' }
  const title = typeof input?.title === 'string' ? input.title.trim().slice(0, 120) : ''
  if (!title) return { ok: false, error: '영상 제목을 입력해 주세요.' }

  const parsed = parseVideoScenes(input?.scenes)
  if (!parsed.ok) {
    return { ok: false, error: '장면에 고칠 곳이 있습니다.', errors: formatVideoSceneErrors(parsed.errors).slice(0, 30) }
  }

  const script = await prisma.grammarLectureScript.findUnique({
    where: { id: typeof scriptId === 'string' ? scriptId : '' },
    select: { id: true, status: true, scenesJson: true, updatedAt: true, grammarPointId: true, koVoiceId: true, enVoiceId: true },
  })
  if (!script) return { ok: false, error: '스크립트를 찾을 수 없습니다.' }
  if (input.expectedUpdatedAt && script.updatedAt.toISOString() !== input.expectedUpdatedAt) {
    return { ok: false, error: '다른 곳에서 먼저 저장했습니다. 새로고침한 뒤 다시 고쳐 주세요.' }
  }

  const prev = parseVideoScenes(script.scenesJson).scenes
  const { scenes, removedPaths } = carryOverAudio(prev, parsed.scenes)
  const voices = resolveAudioVoices(script.koVoiceId, script.enVoiceId)
  const ready = voices ? planScriptAudio(scenes, voices).ready : false
  const status = statusAfterEdit(script.status, ready)

  const res = await prisma.grammarLectureScript.updateMany({
    where: { id: script.id, updatedAt: script.updatedAt },
    data: {
      title,
      scenesJson: toJson(scenes),
      durationSec: durationOf(scenes),
      status,
      ...(status === 'AUDIO_READY' && script.status !== 'AUDIO_READY' ? { audioReadyAt: new Date() } : {}),
    },
  })
  if (res.count === 0) return { ok: false, error: '다른 곳에서 먼저 저장했습니다. 새로고침한 뒤 다시 고쳐 주세요.' }
  await removeLectureAudio(removedPaths)

  const saved = await prisma.grammarLectureScript.findUnique({ where: { id: script.id }, select: { updatedAt: true } })
  await logActivity({
    userId: admin.id,
    role: admin.role,
    action: ACTIVITY_ACTIONS.GRAMMAR_LECTURE_SCRIPT_UPDATE,
    metadata: { scriptId: script.id, scenes: scenes.length, removedAudio: removedPaths.length, status },
  })
  await revalidatePoint(script.grammarPointId)
  return { ok: true, status, updatedAt: (saved?.updatedAt ?? new Date()).toISOString() }
}

// ── 승인·삭제·목소리 ────────────────────────────────────────

export async function approveScript(scriptId: string): Promise<{ ok: true; warnings: string[] } | Fail> {
  const admin = await getAdmin()
  if (!admin) return { ok: false, error: '권한이 없습니다.' }
  const script = await prisma.grammarLectureScript.findUnique({
    where: { id: typeof scriptId === 'string' ? scriptId : '' },
    select: { id: true, status: true, scenesJson: true, grammarPointId: true },
  })
  if (!script) return { ok: false, error: '스크립트를 찾을 수 없습니다.' }
  if (script.status !== 'DRAFT') return { ok: false, error: '이미 승인된 스크립트입니다.' }
  const parsed = parseVideoScenes(script.scenesJson)
  if (!parsed.ok) return { ok: false, error: '장면에 오류가 있어 승인할 수 없습니다. 장면 편집에서 고쳐 주세요.' }

  await prisma.grammarLectureScript.update({ where: { id: script.id }, data: { status: 'APPROVED', approvedAt: new Date() } })
  await logActivity({
    userId: admin.id,
    role: admin.role,
    action: ACTIVITY_ACTIONS.GRAMMAR_LECTURE_SCRIPT_APPROVE,
    metadata: { scriptId: script.id },
  })
  await revalidatePoint(script.grammarPointId)
  return { ok: true, warnings: checkScriptStructure(parsed.scenes) }
}

export async function deleteScript(scriptId: string): Promise<{ ok: true } | Fail> {
  const admin = await getAdmin()
  if (!admin) return { ok: false, error: '권한이 없습니다.' }
  const script = await prisma.grammarLectureScript.findUnique({
    where: { id: typeof scriptId === 'string' ? scriptId : '' },
    select: { id: true, title: true, scenesJson: true, grammarPointId: true, lecture: { select: { id: true } } },
  })
  if (!script) return { ok: false, error: '스크립트를 찾을 수 없습니다.' }

  const paths = parseVideoScenes(script.scenesJson)
    .scenes.flatMap((s) => s.segments.map((g) => g.audioPath))
    .filter((p): p is string => Boolean(p))
  // 연결된 YouTube 강의는 남는다 (scriptId만 비워짐)
  await prisma.grammarLectureScript.delete({ where: { id: script.id } })
  await removeLectureAudio(paths)
  await logActivity({
    userId: admin.id,
    role: admin.role,
    action: ACTIVITY_ACTIONS.GRAMMAR_LECTURE_SCRIPT_DELETE,
    metadata: { scriptId: script.id, title: script.title, audioFiles: paths.length, hadLecture: Boolean(script.lecture) },
  })
  await revalidatePoint(script.grammarPointId)
  return { ok: true }
}

/** 목소리 선택 저장 — 바꾸면 해시가 달라져 모든 음성이 다시 생성 대상이 된다 */
export async function setScriptVoices(
  scriptId: string,
  voices: { ko: string; en: string },
): Promise<{ ok: true; status: string } | Fail> {
  const admin = await getAdmin()
  if (!admin) return { ok: false, error: '권한이 없습니다.' }
  const valid = (v: unknown) => typeof v === 'string' && /^[A-Za-z0-9_-]{4,64}$/.test(v)
  if (!valid(voices?.ko) || !valid(voices?.en)) return { ok: false, error: '목소리를 골라 주세요.' }

  const script = await prisma.grammarLectureScript.findUnique({
    where: { id: typeof scriptId === 'string' ? scriptId : '' },
    select: { id: true, status: true, scenesJson: true, grammarPointId: true },
  })
  if (!script) return { ok: false, error: '스크립트를 찾을 수 없습니다.' }
  const resolved = resolveAudioVoices(voices.ko, voices.en)
  const ready = resolved ? planScriptAudio(parseVideoScenes(script.scenesJson).scenes, resolved).ready : false
  const status = statusAfterEdit(script.status, ready)
  await prisma.grammarLectureScript.update({
    where: { id: script.id },
    data: { koVoiceId: voices.ko, enVoiceId: voices.en, status },
  })
  await revalidatePoint(script.grammarPointId)
  return { ok: true, status }
}
