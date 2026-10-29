// 썸네일 PNG와 파일 내려받기 — 브라우저 전용

import type { VideoScene } from '../../../../types/grammar-video'
import { sceneSettledTime, type Timeline } from '../timeline'
import { renderFrame, type SceneImageSources } from '../render'
import { VIDEO_HEIGHT, VIDEO_WIDTH } from '../constants'

export const THUMBNAIL_WIDTH = 1280
export const THUMBNAIL_HEIGHT = 720

/** 썸네일: 오프닝 장면(없으면 첫 장면)이 다 보인 화면을 자막 없이 1280×720으로 */
export async function renderThumbnailPng(scenes: VideoScene[], timeline: Timeline, images?: SceneImageSources): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = THUMBNAIL_WIDTH
  canvas.height = THUMBNAIL_HEIGHT
  const ctx = canvas.getContext('2d', { alpha: false })
  if (!ctx) throw new Error('캔버스를 만들지 못했어요.')
  ctx.setTransform(THUMBNAIL_WIDTH / VIDEO_WIDTH, 0, 0, THUMBNAIL_HEIGHT / VIDEO_HEIGHT, 0, 0)
  const index = Math.max(0, scenes.findIndex((s) => s.template === 'opening'))
  renderFrame(ctx, scenes, timeline, sceneSettledTime(timeline, index), { subtitles: false, images })
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('썸네일을 만들지 못했어요.'))), 'image/png'),
  )
}

export function textBlob(text: string): Blob {
  // BOM — Windows 메모장에서 한글이 깨지지 않게
  return new Blob(['﻿', text], { type: 'text/plain;charset=utf-8' })
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  // 내려받기가 시작된 뒤 해제
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
