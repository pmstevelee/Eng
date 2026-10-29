// AI 강의 장면 배경 그림 계산 (순수 함수 — 브라우저·DB 없음)
// 그림은 장면 뒤에 옅게 깔리는 배경이다. 글자는 왼쪽 정렬이라 그림의 주제는 오른쪽에 두도록 프롬프트를 만든다.

import {
  joinTokens,
  type SceneImage,
  type SceneImageStrength,
  type VideoScene,
  type VideoTemplate,
} from '../../../types/grammar-video'

export const SCENE_IMAGE_STRENGTH_LABELS: Record<SceneImageStrength, string> = {
  light: '옅게',
  medium: '보통',
  strong: '진하게',
}

/** 남색 배경 장면 (오프닝·정리) — 흰 글자라 그림을 조금 더 진하게 깔아도 읽힌다 */
const NIGHT_TEMPLATES: readonly VideoTemplate[] = ['opening', 'summary']

export function isNightTemplate(template: VideoTemplate): boolean {
  return NIGHT_TEMPLATES.includes(template)
}

const ALPHA: Record<'paper' | 'night', Record<SceneImageStrength, number>> = {
  paper: { light: 0.12, medium: 0.22, strong: 0.34 },
  night: { light: 0.18, medium: 0.3, strong: 0.45 },
}

/** 배경 그림 불투명도 */
export function sceneImageAlpha(template: VideoTemplate, strength: SceneImageStrength): number {
  return ALPHA[isNightTemplate(template) ? 'night' : 'paper'][strength]
}

/** 그림을 화면에 꽉 차게(잘라서) 놓는 위치 — CSS object-fit: cover */
export function coverRect(
  srcW: number,
  srcH: number,
  boxW: number,
  boxH: number,
): { sx: number; sy: number; sw: number; sh: number } {
  if (srcW <= 0 || srcH <= 0) return { sx: 0, sy: 0, sw: 0, sh: 0 }
  const scale = Math.max(boxW / srcW, boxH / srcH)
  const sw = boxW / scale
  const sh = boxH / scale
  return { sx: (srcW - sw) / 2, sy: (srcH - sh) / 2, sw, sh }
}

/** 장면 내용을 대표하는 영어 문장 (그림 주제) */
export function sceneImageSubject(scene: VideoScene): string {
  switch (scene.template) {
    case 'opening':
      return [scene.data.titleEn, scene.data.hook].filter(Boolean).join(' — ')
    case 'compare':
      return scene.data.rows.map((r) => joinTokens(r.sentence)).join(' / ')
    case 'steps':
      return joinTokens(scene.data.steps[scene.data.steps.length - 1]?.example ?? [])
    case 'variations':
      return joinTokens(scene.data.rows[0]?.sentence ?? [])
    case 'cases':
      return scene.data.cases.map((c) => joinTokens(c.sentence)).join(' / ')
    case 'warning':
      return scene.data.right
    case 'quiz': {
      const q = scene.data.items[0]
      return q ? `${q.before} ${q.answer} ${q.after}`.replace(/\s+/g, ' ').trim() : scene.data.title
    }
    case 'summary':
      return scene.data.title
  }
}

export const SCENE_IMAGE_PROMPT_MAX = 1500

/**
 * 기본 프롬프트 — 관리자가 고쳐 쓸 수 있다.
 * 글자를 그리면 화면 문장과 겹쳐 헷갈리므로 글자·숫자를 넣지 말라고 분명히 적는다.
 */
export function buildSceneImagePrompt(scene: VideoScene, pointTitle: string): string {
  const subject = sceneImageSubject(scene).slice(0, 300)
  const night = isNightTemplate(scene.template)
  return [
    `Background illustration for an English grammar video lesson for Korean middle school students (topic: ${pointTitle}).`,
    subject ? `Show a simple everyday scene that matches this example: "${subject}".` : '',
    'Style: flat vector illustration, simple rounded shapes, friendly characters, soft colors, clean and calm.',
    night
      ? 'Use a dark navy palette so white text on top stays readable.'
      : 'Use a light, airy palette on a white background.',
    'Composition: wide 16:9, main subject on the right third, the left two-thirds mostly empty for text.',
    'Absolutely no text, letters, numbers, words, captions, signs, logos or watermarks anywhere in the image.',
  ]
    .filter(Boolean)
    .join(' ')
}

/** 프롬프트 정리 — 비었으면 null */
export function normalizeImagePrompt(prompt: unknown): string | null {
  if (typeof prompt !== 'string') return null
  const t = prompt.replace(/\s+/g, ' ').trim().slice(0, SCENE_IMAGE_PROMPT_MAX)
  return t || null
}

/** Storage 경로 — 같은 장면을 다시 만들면 새 경로(이전 파일은 지움) */
export function sceneImagePath(scriptId: string, sceneId: string, nonce: string, ext: 'webp' | 'png' = 'webp'): string {
  const safe = (v: string) => v.replace(/[^A-Za-z0-9_-]/g, '_')
  return `scripts/${safe(scriptId)}/images/${safe(sceneId)}-${safe(nonce)}.${ext}`
}

export function referencedImagePaths(scenes: VideoScene[]): Set<string> {
  return new Set(scenes.map((s) => s.image?.path).filter((p): p is string => Boolean(p)))
}

/**
 * 장면 저장 시 그림은 저장돼 있던 값을 장면 id로 이어 붙인다 (화면에서 온 값은 무시).
 * 지운 장면의 그림 파일 경로를 돌려준다.
 */
export function carryOverImages(prev: VideoScene[], next: VideoScene[]): { scenes: VideoScene[]; removedPaths: string[] } {
  const byId = new Map<string, SceneImage>()
  for (const s of prev) if (s.image) byId.set(s.id, s.image)
  const scenes = next.map((scene) => {
    const { image: _ignored, ...rest } = scene
    void _ignored
    const image = byId.get(scene.id)
    return (image ? { ...rest, image } : rest) as VideoScene
  })
  const still = referencedImagePaths(scenes)
  const removedPaths = Array.from(referencedImagePaths(prev)).filter((p) => !still.has(p))
  return { scenes, removedPaths }
}

/** 장면 하나의 그림을 바꾸거나(null이면 지움) — 더 이상 안 쓰는 파일 경로를 돌려준다 */
export function replaceSceneImage(
  scenes: VideoScene[],
  sceneId: string,
  image: SceneImage | null,
): { scenes: VideoScene[]; found: boolean; removedPath: string | null } {
  let found = false
  let removedPath: string | null = null
  const out = scenes.map((scene) => {
    if (scene.id !== sceneId) return scene
    found = true
    if (scene.image && scene.image.path !== image?.path) removedPath = scene.image.path
    const { image: _old, ...rest } = scene
    void _old
    return (image ? { ...rest, image } : rest) as VideoScene
  })
  return { scenes: out, found, removedPath }
}
