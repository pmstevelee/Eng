'use server'

// AI 강의 장면 배경 그림 (OpenAI 이미지 API) — SUPER_ADMIN 전용
// 장면 1개 = 호출 1번 (Vercel 시간 제한). 그림은 장면 저장과 따로 저장되고, 장면 저장은 이 값을 이어 붙인다.

import { revalidatePath } from 'next/cache'
import type { Prisma } from '@/generated/prisma'
import { prisma } from '@/lib/prisma/client'
import { getCurrentUser } from '@/lib/auth'
import { logActivity } from '@/lib/activity-log'
import { ACTIVITY_ACTIONS } from '@/lib/constants/activity-actions'
import {
  parseVideoScenes,
  SCENE_IMAGE_STRENGTHS,
  type SceneImage,
  type SceneImageStrength,
  type VideoScene,
} from '@/types/grammar-video'
import {
  normalizeImagePrompt,
  referencedImagePaths,
  replaceSceneImage,
  sceneImagePath,
} from '@/lib/grammar/video/image-plan'
import { generateLectureImage } from '@/lib/openai/lecture-image'
import {
  LECTURE_AUDIO_URL_TTL_SEC,
  removeLectureAudio,
  signLectureAudioUrls,
  uploadLectureImage,
} from '@/lib/grammar/lecture-audio-storage'

type Fail = { ok: false; error: string }

async function getAdmin() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'SUPER_ADMIN') return null
  return user
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue
}

function isStrength(v: unknown): v is SceneImageStrength {
  return (SCENE_IMAGE_STRENGTHS as readonly unknown[]).includes(v)
}

async function loadScenes(scriptId: unknown) {
  if (typeof scriptId !== 'string' || !scriptId) return null
  const script = await prisma.grammarLectureScript.findUnique({
    where: { id: scriptId },
    select: { id: true, scenesJson: true, updatedAt: true, grammarPoint: { select: { code: true } } },
  })
  if (!script) return null
  return { script, parsed: parseVideoScenes(script.scenesJson) }
}

/**
 * 장면 하나의 그림을 바꿔 저장 — 그림 생성이 오래 걸려 그사이 장면이 저장됐을 수 있으므로
 * 최신 장면을 다시 읽어 그 장면에만 반영한다 (updatedAt 조건, 3번까지).
 */
async function applyImage(
  scriptId: string,
  sceneId: string,
  image: SceneImage | null,
): Promise<{ ok: true; updatedAt: string; removedPath: string | null; pointCode: string } | Fail> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const loaded = await loadScenes(scriptId)
    if (!loaded) return { ok: false, error: '스크립트를 찾을 수 없습니다.' }
    if (!loaded.parsed.ok) return { ok: false, error: '장면 데이터에 오류가 있습니다. 장면 편집에서 먼저 고쳐 주세요.' }
    const next = replaceSceneImage(loaded.parsed.scenes, sceneId, image)
    if (!next.found) return { ok: false, error: '저장된 장면에 없는 장면입니다. 장면을 먼저 저장해 주세요.' }
    const res = await prisma.grammarLectureScript.updateMany({
      where: { id: loaded.script.id, updatedAt: loaded.script.updatedAt },
      data: { scenesJson: toJson(next.scenes) },
    })
    if (res.count === 1) {
      const saved = await prisma.grammarLectureScript.findUnique({ where: { id: loaded.script.id }, select: { updatedAt: true } })
      return {
        ok: true,
        updatedAt: (saved?.updatedAt ?? new Date()).toISOString(),
        removedPath: next.removedPath,
        pointCode: loaded.script.grammarPoint.code,
      }
    }
  }
  return { ok: false, error: '다른 곳에서 동시에 저장하고 있습니다. 잠시 후 다시 시도해 주세요.' }
}

function revalidatePoint(code: string) {
  revalidatePath(`/admin/grammar/points/${code}`)
}

export type SceneImageResult = { ok: true; image: SceneImage | null; url: string | null; updatedAt: string } | Fail

/** 그림 생성(또는 다시 생성) — 이전 그림 파일은 지운다 */
export async function generateSceneImage(
  scriptId: string,
  sceneId: string,
  input: { prompt: string; strength: SceneImageStrength },
): Promise<SceneImageResult> {
  const admin = await getAdmin()
  if (!admin) return { ok: false, error: '권한이 없습니다.' }
  const prompt = normalizeImagePrompt(input?.prompt)
  if (!prompt) return { ok: false, error: '그림 설명(프롬프트)을 입력해 주세요.' }
  const strength = isStrength(input?.strength) ? input.strength : 'medium'

  const loaded = await loadScenes(scriptId)
  if (!loaded) return { ok: false, error: '스크립트를 찾을 수 없습니다.' }
  if (!loaded.parsed.scenes.some((s) => s.id === sceneId)) {
    return { ok: false, error: '저장된 장면에 없는 장면입니다. 장면을 먼저 저장해 주세요.' }
  }

  const generated = await generateLectureImage(prompt)
  if (!generated.ok) return generated

  const path = sceneImagePath(loaded.script.id, sceneId, Date.now().toString(36), generated.ext)
  try {
    await uploadLectureImage(path, generated.bytes, generated.contentType)
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : '그림 파일을 저장하지 못했습니다.' }
  }

  const image: SceneImage = { path, prompt, strength }
  const applied = await applyImage(loaded.script.id, sceneId, image)
  if (!applied.ok) {
    await removeLectureAudio([path])
    return applied
  }
  if (applied.removedPath) await removeLectureAudio([applied.removedPath])

  await logActivity({
    userId: admin.id,
    role: admin.role,
    action: ACTIVITY_ACTIONS.GRAMMAR_LECTURE_IMAGE_GENERATE,
    metadata: { scriptId: loaded.script.id, sceneId, model: generated.model, bytes: generated.bytes.length },
  })
  revalidatePoint(applied.pointCode)
  const signed = await signLectureAudioUrls([path]).catch(() => new Map<string, string>())
  return { ok: true, image, url: signed.get(path) ?? null, updatedAt: applied.updatedAt }
}

/** 진하기만 바꾸기 (그림은 그대로) */
export async function setSceneImageStrength(scriptId: string, sceneId: string, strength: SceneImageStrength): Promise<SceneImageResult> {
  const admin = await getAdmin()
  if (!admin) return { ok: false, error: '권한이 없습니다.' }
  if (!isStrength(strength)) return { ok: false, error: '진하기를 골라 주세요.' }
  const loaded = await loadScenes(scriptId)
  const current = loaded?.parsed.scenes.find((s) => s.id === sceneId)?.image
  if (!loaded || !current) return { ok: false, error: '그림이 없는 장면입니다.' }
  const image: SceneImage = { ...current, strength }
  const applied = await applyImage(loaded.script.id, sceneId, image)
  if (!applied.ok) return applied
  revalidatePoint(applied.pointCode)
  return { ok: true, image, url: null, updatedAt: applied.updatedAt }
}

/** 그림 빼기 (파일도 지움) */
export async function removeSceneImage(scriptId: string, sceneId: string): Promise<SceneImageResult> {
  const admin = await getAdmin()
  if (!admin) return { ok: false, error: '권한이 없습니다.' }
  const loaded = await loadScenes(scriptId)
  if (!loaded) return { ok: false, error: '스크립트를 찾을 수 없습니다.' }
  const applied = await applyImage(loaded.script.id, sceneId, null)
  if (!applied.ok) return applied
  if (applied.removedPath) await removeLectureAudio([applied.removedPath])
  revalidatePoint(applied.pointCode)
  return { ok: true, image: null, url: null, updatedAt: applied.updatedAt }
}

/** 장면 그림 서명 URL (그림 경로 → URL) */
export async function getImageUrls(scriptId: string): Promise<{ ok: true; urls: Record<string, string>; expiresInSec: number } | Fail> {
  const admin = await getAdmin()
  if (!admin) return { ok: false, error: '권한이 없습니다.' }
  const loaded = await loadScenes(scriptId)
  if (!loaded) return { ok: false, error: '스크립트를 찾을 수 없습니다.' }
  return signImages(loaded.parsed.scenes)
}

async function signImages(scenes: VideoScene[]): Promise<{ ok: true; urls: Record<string, string>; expiresInSec: number } | Fail> {
  try {
    const signed = await signLectureAudioUrls(Array.from(referencedImagePaths(scenes)))
    return { ok: true, urls: Object.fromEntries(Array.from(signed.entries())), expiresInSec: LECTURE_AUDIO_URL_TTL_SEC }
  } catch {
    return { ok: false, error: '그림 주소를 만들지 못했습니다. 잠시 후 다시 시도해 주세요.' }
  }
}
