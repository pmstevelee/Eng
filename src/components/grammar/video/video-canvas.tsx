'use client'

// 영상 프레임 캔버스 — 1920×1080 장면을 부모 폭에 맞춰 그린다 (관리자 전용 화면에서만 사용)
// 글꼴을 다 불러온 뒤 그리고, t·자막 설정이 바뀔 때마다 renderFrame 한 번.

import { useEffect, useRef, useState } from 'react'
import type { VideoScene } from '@/types/grammar-video'
import type { Timeline } from '@/lib/grammar/video/timeline'
import { renderFrame, type SceneImageSources } from '@/lib/grammar/video/render'
import { loadVideoFonts } from '@/lib/grammar/video/render/fonts'
import { VIDEO_HEIGHT, VIDEO_WIDTH } from '@/lib/grammar/video/constants'
import { cn } from '@/lib/utils'

interface VideoCanvasProps {
  scenes: VideoScene[]
  timeline: Timeline
  /** ms */
  t: number
  subtitles?: boolean
  /** 장면 배경 그림 (없으면 그림 없이) */
  images?: SceneImageSources
  className?: string
  /** 글꼴 준비 결과 (false면 일부 글꼴을 못 받아 대체 글꼴로 그려짐) */
  onFontsReady?: (loaded: boolean) => void
}

export function VideoCanvas({ scenes, timeline, t, subtitles = true, images, className, onFontsReady }: VideoCanvasProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [width, setWidth] = useState(0)
  const [fontsReady, setFontsReady] = useState(false)
  const onFontsReadyRef = useRef(onFontsReady)
  onFontsReadyRef.current = onFontsReady

  useEffect(() => {
    let alive = true
    loadVideoFonts(scenes).then((r) => {
      if (!alive) return
      setFontsReady(true)
      onFontsReadyRef.current?.(r.loaded)
    })
    return () => {
      alive = false
    }
  }, [scenes])

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setWidth(el.clientWidth))
    ro.observe(el)
    setWidth(el.clientWidth)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !width || !fontsReady) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const pxW = Math.round(width * dpr)
    const pxH = Math.round((width * VIDEO_HEIGHT * dpr) / VIDEO_WIDTH)
    if (canvas.width !== pxW) canvas.width = pxW
    if (canvas.height !== pxH) canvas.height = pxH
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(pxW / VIDEO_WIDTH, 0, 0, pxH / VIDEO_HEIGHT, 0, 0)
    renderFrame(ctx, scenes, timeline, t, { subtitles, images })
  }, [scenes, timeline, t, subtitles, images, width, fontsReady])

  return (
    <div ref={wrapRef} className={cn('relative aspect-video w-full overflow-hidden rounded-xl border border-gray-200 bg-white', className)}>
      <canvas ref={canvasRef} className="block h-full w-full" />
      {!fontsReady && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-gray-500">글꼴을 불러오는 중…</div>
      )}
    </div>
  )
}
