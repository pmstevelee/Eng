'use client'

// Remotion 컴포지션 — AI 강의 영상 (관리자 화면 Remotion 미리보기 + PC CLI 렌더 공용)
// 화면은 기존 Canvas 렌더러(renderFrame)를 그대로 써서 브라우저 미리보기·MP4와 같은 프레임이 나온다.
// 음성은 세그먼트 MP3를 타임라인 위치에 하나씩 놓는다.
// Remotion 번들러(webpack)가 '@/' 별칭을 모르므로 상대 경로로만 가져온다.

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { AbsoluteFill, Html5Audio, Sequence, continueRender, delayRender, useCurrentFrame, useVideoConfig } from 'remotion'
import type { VideoScene } from '../../../../types/grammar-video'
import { buildTimeline } from '../../../../lib/grammar/video/timeline'
import { VIDEO_FPS, VIDEO_HEIGHT, VIDEO_WIDTH } from '../../../../lib/grammar/video/constants'
import { frameCount, planAudioPlacements } from '../../../../lib/grammar/video/export/plan'
import { renderFrame, type SceneImageSources } from '../../../../lib/grammar/video/render'
import { loadVideoFonts } from '../../../../lib/grammar/video/render/fonts'
import { loadSceneImages } from '../../../../lib/grammar/video/render/images'
import type { LectureCompositionProps } from './composition-props'

export { LECTURE_COMPOSITION_ID, type LectureCompositionProps } from './composition-props'

/** 영상 프레임 수 (컴포지션 길이) */
export function lectureDurationInFrames(scenes: VideoScene[], fps: number = VIDEO_FPS): number {
  return frameCount(buildTimeline(scenes).duration, fps)
}

const EMPTY_IMAGES: SceneImageSources = new Map()

export function LectureComposition({ scenes, audioUrls, imageUrls, subtitles }: LectureCompositionProps) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const timeline = useMemo(() => buildTimeline(scenes), [scenes])
  const placements = useMemo(() => planAudioPlacements(timeline), [timeline])
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [images, setImages] = useState<SceneImageSources | null>(null)
  const imageKey = JSON.stringify(imageUrls)

  // 글꼴·그림을 다 받기 전에는 프레임을 찍지 않는다 (delayRender)
  useEffect(() => {
    const handle = delayRender('강의 글꼴·배경 그림 불러오기', { timeoutInMilliseconds: 60_000 })
    let done = false
    const finish = () => {
      if (done) return
      done = true
      continueRender(handle)
    }
    const urls = JSON.parse(imageKey) as Record<string, string>
    Promise.all([loadVideoFonts(scenes), loadSceneImages(urls)])
      .then(([fonts, loaded]) => {
        if (!fonts.loaded) console.warn('[lecture-remotion] 일부 글꼴을 불러오지 못했어요 (대체 글꼴로 그림)')
        if (loaded.failed > 0) console.warn(`[lecture-remotion] 배경 그림 ${loaded.failed}개를 불러오지 못했어요`)
        setImages(loaded.images)
      })
      .catch((error) => {
        console.error('[lecture-remotion] 불러오기 실패:', error)
        setImages(EMPTY_IMAGES)
      })
      .finally(finish)
    return finish
  }, [scenes, imageKey])

  useLayoutEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !images) return
    const ctx = canvas.getContext('2d', { alpha: false })
    if (!ctx) return
    const t = Math.min((frame * 1000) / fps, timeline.duration)
    renderFrame(ctx, scenes, timeline, t, { subtitles, images })
  }, [frame, fps, scenes, timeline, subtitles, images])

  return (
    <AbsoluteFill style={{ backgroundColor: '#FFFFFF' }}>
      <canvas ref={canvasRef} width={VIDEO_WIDTH} height={VIDEO_HEIGHT} style={{ width: '100%', height: '100%' }} />
      {placements.map((p) => {
        const url = audioUrls[p.segmentId]
        if (!url) return null
        const from = Math.round((p.startMs * fps) / 1000)
        const length = Math.max(1, Math.floor((p.maxMs * fps) / 1000))
        return (
          <Sequence key={p.segmentId} from={from} durationInFrames={length} layout="none">
            <Html5Audio src={url} />
          </Sequence>
        )
      })}
    </AbsoluteFill>
  )
}
