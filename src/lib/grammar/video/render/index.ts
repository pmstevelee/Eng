// 영상 한 프레임 그리기 — 시간 t만 보고 그리므로 같은 t는 항상 같은 화면이다.
// 관리자 미리보기(video-lab, 2-5-4 장면 편집)와 MP4 내보내기(2-5-5)가 이 함수 하나를 쓴다.

import type { VideoScene } from '../../../../types/grammar-video'
import { getFrameState, type FrameState, type SceneView, type Timeline } from '../timeline'
import { VIDEO_COLORS, VIDEO_FONT_SIZES, VIDEO_HEIGHT, VIDEO_WIDTH } from '../constants'
import { drawTextLayout, drawPaper, fillRoundRect, font, layoutText, withAlpha, type Ctx2D } from './primitives'
import { drawOpening } from './scenes/opening'
import { drawCompare } from './scenes/compare'
import { drawSteps } from './scenes/steps'
import { drawVariations } from './scenes/variations'
import { drawCases } from './scenes/cases'
import { drawWarning } from './scenes/warning'
import { drawQuiz } from './scenes/quiz'
import { drawSummary } from './scenes/summary'

export type { Ctx2D } from './primitives'
export { clearFontMetricsCache } from './primitives'

export interface RenderOptions {
  /** 하단 자막 상자 (기본 켜짐 — 샘플과 같음) */
  subtitles: boolean
}

/** 장면 하나를 view 상태로 그린다 (전환 투명도는 호출하는 쪽에서) */
export function drawScene(ctx: Ctx2D, scene: VideoScene, view: SceneView): void {
  switch (scene.template) {
    case 'opening':
      return drawOpening({ ctx, data: scene.data, view })
    case 'compare':
      return drawCompare({ ctx, data: scene.data, view })
    case 'steps':
      return drawSteps({ ctx, data: scene.data, view })
    case 'variations':
      return drawVariations({ ctx, data: scene.data, view })
    case 'cases':
      return drawCases({ ctx, data: scene.data, view })
    case 'warning':
      return drawWarning({ ctx, data: scene.data, view })
    case 'quiz':
      return drawQuiz({ ctx, data: scene.data, view })
    case 'summary':
      return drawSummary({ ctx, data: scene.data, view })
  }
}

// ── 자막 상자: 하단 가운데, 아래 56px, 최대 폭 1560, 반투명 남색 ──

const SUB_KO = font(VIDEO_FONT_SIZES.subtitle, 500)
const SUB_EN = font(VIDEO_FONT_SIZES.subtitle, 600, 'en')
const SUB_MAX_W = 1560
const SUB_PAD = { y: 16, x: 36 }
const SUB_BOTTOM = 56
const SUB_RADIUS = 16

function drawSubtitle(ctx: Ctx2D, sub: NonNullable<FrameState['subtitle']>): void {
  const f = sub.lang === 'en' ? SUB_EN : SUB_KO
  const layout = layoutText(ctx, sub.text, f, { maxWidth: SUB_MAX_W - SUB_PAD.x * 2, maxLines: 3 })
  const w = layout.width + SUB_PAD.x * 2
  const h = layout.height + SUB_PAD.y * 2
  const x = (VIDEO_WIDTH - w) / 2
  const y = VIDEO_HEIGHT - SUB_BOTTOM - h
  withAlpha(ctx, sub.opacity, () => {
    fillRoundRect(ctx, x, y, w, h, SUB_RADIUS, VIDEO_COLORS.subtitleBg)
    drawTextLayout(ctx, layout, x + SUB_PAD.x, y + SUB_PAD.y, {
      color: sub.lang === 'en' ? VIDEO_COLORS.subtitleEn : VIDEO_COLORS.subtitleText,
      align: 'center',
      boxWidth: layout.width,
    })
  })
}

/**
 * ctx는 1920×1080 좌표계여야 한다 (화면 미리보기는 호출 전에 ctx.scale로 맞춘다).
 * 반환값은 그린 프레임의 상태 (미리보기 화면 표시용).
 */
export function renderFrame(
  ctx: Ctx2D,
  scenes: VideoScene[],
  timeline: Timeline,
  t: number,
  options: RenderOptions = { subtitles: true },
): FrameState | null {
  ctx.save()
  ctx.globalAlpha = 1
  drawPaper(ctx)
  const state = getFrameState(timeline, t)
  if (!state) {
    ctx.restore()
    return null
  }
  const draw = (view: SceneView) => {
    const scene = scenes[view.sceneIndex]
    if (!scene) return
    withAlpha(ctx, view.opacity, () => drawScene(ctx, scene, view))
  }
  if (state.previous) draw(state.previous)
  draw(state.current)
  if (options.subtitles && state.subtitle) drawSubtitle(ctx, state.subtitle)
  ctx.restore()
  return state
}
