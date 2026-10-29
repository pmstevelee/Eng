'use client'

// 장면 배경 그림 (OpenAI 이미지 API) — 프롬프트를 고쳐 그림을 만들고, 진하기를 고르거나 뺀다.
// 그림은 장면 저장과 따로 서버에 바로 저장된다. 저장하지 않은 장면 변경이 있으면 먼저 저장해야 한다.

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ImagePlus, Loader2, RefreshCw, RotateCcw, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { VideoCanvas } from '@/components/grammar/video/video-canvas'
import { SCENE_IMAGE_STRENGTHS, type SceneImageStrength, type VideoScene } from '@/types/grammar-video'
import type { SceneImageSources } from '@/lib/grammar/video/render'
import { buildTimeline, sceneSettledTime } from '@/lib/grammar/video/timeline'
import { buildSceneImagePrompt, SCENE_IMAGE_PROMPT_MAX, SCENE_IMAGE_STRENGTH_LABELS } from '@/lib/grammar/video/image-plan'
import { generateSceneImage, removeSceneImage, setSceneImageStrength } from '../../../../lecture-image-actions'
import { Field, NoticeBox, SelectInput, TextArea, type Notice } from './studio-ui'

export function SceneImagePanel({
  scriptId,
  scene,
  pointTitle,
  images,
  blockedReason,
}: {
  scriptId: string
  scene: VideoScene
  pointTitle: string
  images: SceneImageSources
  /** 그림 작업을 막는 이유 (저장 안 한 변경 등) */
  blockedReason: string | null
}) {
  const router = useRouter()
  const defaultPrompt = useMemo(() => buildSceneImagePrompt(scene, pointTitle), [scene, pointTitle])
  const [prompt, setPrompt] = useState(scene.image?.prompt || defaultPrompt)
  const [strength, setStrength] = useState<SceneImageStrength>(scene.image?.strength ?? 'medium')
  const [notice, setNotice] = useState<Notice>(null)
  const [generating, startGenerate] = useTransition()
  const [saving, startSave] = useTransition()

  // 이 장면만 담은 미리보기 (그림이 없어도 진하기·구도 확인용)
  const single = useMemo(() => [{ ...scene, image: scene.image ? { ...scene.image, strength } : undefined }] as VideoScene[], [scene, strength])
  const singleTimeline = useMemo(() => buildTimeline(single), [single])
  const hasImage = Boolean(scene.image)
  const imageLoaded = scene.image ? images.has(scene.image.path) : false
  const busy = generating || saving

  function generate() {
    setNotice(null)
    startGenerate(async () => {
      const res = await generateSceneImage(scriptId, scene.id, { prompt, strength })
      if (res.ok) {
        setNotice({ kind: 'ok', text: '그림을 만들었어요.' })
        router.refresh()
      } else setNotice({ kind: 'error', text: res.error })
    })
  }

  function changeStrength(next: SceneImageStrength) {
    setStrength(next)
    if (!hasImage || blockedReason) return
    setNotice(null)
    startSave(async () => {
      const res = await setSceneImageStrength(scriptId, scene.id, next)
      if (res.ok) router.refresh()
      else setNotice({ kind: 'error', text: res.error })
    })
  }

  function remove() {
    if (!window.confirm('이 장면의 배경 그림을 뺄까요? 그림 파일도 지워져요.')) return
    setNotice(null)
    startSave(async () => {
      const res = await removeSceneImage(scriptId, scene.id)
      if (res.ok) {
        setNotice({ kind: 'ok', text: '그림을 뺐어요.' })
        router.refresh()
      } else setNotice({ kind: 'error', text: res.error })
    })
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-1">
          <VideoCanvas
            scenes={single}
            timeline={singleTimeline}
            t={sceneSettledTime(singleTimeline, 0)}
            subtitles={false}
            images={images}
          />
          <p className="text-xs text-gray-400">
            {hasImage ? (imageLoaded ? '저장된 그림으로 그린 장면 끝 화면' : '그림을 불러오는 중…') : '아직 그림이 없어요'}
          </p>
        </div>
        <div className="space-y-3">
          <Field
            label="그림 설명 (영어 권장)"
            hint="글자 없는 그림을 만들어요. 글자는 왼쪽에 놓이니 그림의 주인공은 오른쪽에 두도록 적어 주세요."
          >
            <TextArea value={prompt} onChange={(v) => setPrompt(v.slice(0, SCENE_IMAGE_PROMPT_MAX))} rows={6} />
          </Field>
          <div className="flex flex-wrap items-end gap-2">
            <Field label="진하기" className="w-28">
              <SelectInput
                ariaLabel="배경 그림 진하기"
                value={strength}
                onChange={changeStrength}
                options={SCENE_IMAGE_STRENGTHS.map((s) => ({ value: s, label: SCENE_IMAGE_STRENGTH_LABELS[s] }))}
              />
            </Field>
            <Button
              type="button"
              variant="ghost"
              className="h-11 text-gray-500"
              onClick={() => setPrompt(defaultPrompt)}
              disabled={busy || prompt === defaultPrompt}
            >
              <RotateCcw className="mr-1 h-4 w-4" />
              기본 설명으로
            </Button>
          </div>
        </div>
      </div>

      <NoticeBox notice={notice} />
      {blockedReason && <p className="text-xs text-[#8A5A00]">{blockedReason}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          className="h-11 bg-[#7854F7] hover:bg-[#6741E0]"
          onClick={generate}
          disabled={busy || Boolean(blockedReason) || !prompt.trim()}
        >
          {generating ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : hasImage ? (
            <RefreshCw className="mr-1.5 h-4 w-4" />
          ) : (
            <ImagePlus className="mr-1.5 h-4 w-4" />
          )}
          {generating ? '그림 만드는 중… (최대 1분)' : hasImage ? '그림 다시 만들기' : 'AI로 그림 만들기'}
        </Button>
        {hasImage && (
          <Button
            type="button"
            variant="ghost"
            className="h-11 text-gray-500 hover:text-[#D92916]"
            onClick={remove}
            disabled={busy || Boolean(blockedReason)}
          >
            <Trash2 className="mr-1 h-4 w-4" />
            그림 빼기
          </Button>
        )}
        <span className="text-xs text-gray-400">1장마다 OpenAI 이미지 요금이 들어요.</span>
      </div>
    </div>
  )
}
