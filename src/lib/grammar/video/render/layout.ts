// 장면 공통 배치 — 여백, 장면 제목(.h), 브랜드

import type { SceneView } from '../timeline'
import { VIDEO_BRAND, VIDEO_COLORS, VIDEO_FONT_SIZES, VIDEO_HEIGHT, VIDEO_PADDING, VIDEO_WIDTH } from '../constants'
import {
  baselineOf,
  font,
  fontString,
  layoutText,
  lineHeightOf,
  measure,
  setLetterSpacing,
  withAlpha,
  type Ctx2D,
} from './primitives'

export const CONTENT_LEFT = VIDEO_PADDING.side
export const CONTENT_TOP = VIDEO_PADDING.top
export const CONTENT_WIDTH = VIDEO_WIDTH - VIDEO_PADDING.side * 2
/** 자막 자리 위까지 */
export const CONTENT_BOTTOM = VIDEO_HEIGHT - VIDEO_PADDING.bottom

export interface SceneDrawArgs<D> {
  ctx: Ctx2D
  data: D
  view: SceneView
}

const HEADING = font(VIDEO_FONT_SIZES.heading, 900)
const HEADING_SMALL = font(VIDEO_FONT_SIZES.headingSmall, 500)
const HEADING_MARGIN = 56
/** letter-spacing -.02em */
const HEADING_TRACKING = -0.02

/**
 * 장면 제목 (h2.h): 72px 900, 아래 여백 56. small은 같은 줄 오른쪽에 40px 회색.
 * 제목이 너무 길면 한 줄에 들어가게 줄인다. 반환값은 다음 내용이 시작할 y.
 */
export function drawHeading(ctx: Ctx2D, title: string, small: string | undefined, color: string, top = CONTENT_TOP): number {
  const smallGap = 20
  const smallW = small ? measure(ctx, small, HEADING_SMALL, HEADING_SMALL.size * HEADING_TRACKING) + smallGap : 0
  const layout = layoutText(ctx, title, HEADING, {
    maxWidth: CONTENT_WIDTH - smallW,
    maxLines: 1,
    letterSpacingPx: HEADING.size * HEADING_TRACKING,
  })
  const lh = lineHeightOf(HEADING)
  const baseline = baselineOf(ctx, HEADING, top, lh)
  ctx.save()
  ctx.textBaseline = 'alphabetic'
  ctx.font = fontString(layout.font)
  setLetterSpacing(ctx, layout.letterSpacingPx)
  ctx.fillStyle = color
  const text = layout.lines.join(' ')
  ctx.fillText(text, CONTENT_LEFT, baseline)
  const titleW = ctx.measureText(text).width
  if (small) {
    ctx.font = fontString(HEADING_SMALL)
    setLetterSpacing(ctx, HEADING_SMALL.size * HEADING_TRACKING)
    ctx.fillStyle = VIDEO_COLORS.soft
    ctx.fillText(small, CONTENT_LEFT + titleW + smallGap, baseline)
  }
  ctx.restore()
  return top + lh + HEADING_MARGIN
}

const BRAND = font(VIDEO_FONT_SIZES.brand, 600, 'en')

/** 오프닝·정리 오른쪽 아래 "WeGoUp English" (right 140, bottom 96, 투명도 .7) */
export function drawBrand(ctx: Ctx2D): void {
  withAlpha(ctx, 0.7, () => {
    const lh = lineHeightOf(BRAND)
    const top = VIDEO_HEIGHT - VIDEO_PADDING.top - lh
    ctx.font = fontString(BRAND)
    ctx.fillStyle = VIDEO_COLORS.nightText
    ctx.textBaseline = 'alphabetic'
    ctx.textAlign = 'right'
    ctx.fillText(VIDEO_BRAND, VIDEO_WIDTH - VIDEO_PADDING.side, baselineOf(ctx, BRAND, top, lh))
    ctx.textAlign = 'left'
  })
}
