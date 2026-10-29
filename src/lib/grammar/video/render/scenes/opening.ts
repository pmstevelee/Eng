// 오프닝: 남색 배경, 시리즈명 · 큰 한글 제목 + 영어 이름(노랑) · 한 줄 훅, 세로 가운데 정렬

import type { OpeningData } from '../../../../../types/grammar-video'
import { VIDEO_COLORS, VIDEO_FONT_SIZES } from '../../constants'
import { CONTENT_BOTTOM, CONTENT_LEFT, CONTENT_TOP, CONTENT_WIDTH, drawBrand, type SceneDrawArgs } from '../layout'
import {
  baselineOf,
  drawTextLayout,
  font,
  fontString,
  layoutText,
  measure,
  reveal,
  scaleFont,
  setLetterSpacing,
  withAlpha,
} from '../primitives'

const SERIES = font(VIDEO_FONT_SIZES.openingSeries, 400)
const SERIES_GAP = 18
const TITLE = font(VIDEO_FONT_SIZES.openingTitle, 900)
/** letter-spacing -.04em */
const TITLE_TRACKING = -0.04
const TITLE_EN = font(VIDEO_FONT_SIZES.openingTitleEn, 600, 'en')
const TITLE_EN_GAP = 34
const HOOK = font(VIDEO_FONT_SIZES.openingHook, 500)
const HOOK_GAP = 48

export function drawOpening({ ctx, data, view }: SceneDrawArgs<OpeningData>): void {
  // 남색 배경·배경 그림은 drawScene이 먼저 그린다

  // 제목 줄: 한글 + 영어가 한 줄에 들어가도록 함께 줄인다
  const koW = measure(ctx, data.titleKo, TITLE, TITLE.size * TITLE_TRACKING)
  const enW = data.titleEn ? measure(ctx, data.titleEn, TITLE_EN) + TITLE_EN_GAP : 0
  const scale = Math.max(0.35, Math.min(1, CONTENT_WIDTH / (koW + enW)))
  const title = scaleFont(TITLE, scale)
  const titleEn = scaleFont(TITLE_EN, scale)
  /** .big은 line-height 1 */
  const titleLh = title.size

  const series = layoutText(ctx, data.seriesLabel, SERIES, { maxWidth: CONTENT_WIDTH, maxLines: 1 })
  const hook = layoutText(ctx, data.hook, HOOK, { maxWidth: CONTENT_WIDTH, maxLines: 2 })
  const total = series.height + SERIES_GAP + titleLh + HOOK_GAP + hook.height
  let y = CONTENT_TOP + (CONTENT_BOTTOM - CONTENT_TOP - total) / 2

  withAlpha(ctx, 0.75, () => drawTextLayout(ctx, series, CONTENT_LEFT, y, { color: VIDEO_COLORS.nightText }))
  y += series.height + SERIES_GAP

  const baseline = baselineOf(ctx, title, y, titleLh)
  ctx.save()
  ctx.textBaseline = 'alphabetic'
  ctx.font = fontString(title)
  setLetterSpacing(ctx, title.size * TITLE_TRACKING)
  ctx.fillStyle = VIDEO_COLORS.nightText
  ctx.fillText(data.titleKo, CONTENT_LEFT, baseline)
  const drawnKoW = ctx.measureText(data.titleKo).width
  if (data.titleEn) {
    ctx.font = fontString(titleEn)
    setLetterSpacing(ctx, 0)
    ctx.fillStyle = VIDEO_COLORS.subtitleEn
    ctx.fillText(data.titleEn, CONTENT_LEFT + drawnKoW + TITLE_EN_GAP * scale, baseline)
  }
  ctx.restore()
  y += titleLh + HOOK_GAP

  const hookTop = y
  reveal(ctx, view.step(data.hookStep), () => drawTextLayout(ctx, hook, CONTENT_LEFT, hookTop, { color: VIDEO_COLORS.nightText }))

  drawBrand(ctx)
}
