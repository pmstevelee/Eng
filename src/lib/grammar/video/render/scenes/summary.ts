// 정리: 남색 배경, 핵심 줄(색 칩) + 노란 구독 안내, 브랜드

import type { SummaryData } from '../../../../../types/grammar-video'
import { VIDEO_COLORS, VIDEO_FONT_SIZES } from '../../constants'
import { CONTENT_BOTTOM, CONTENT_LEFT, CONTENT_WIDTH, drawBrand, drawHeading, type SceneDrawArgs } from '../layout'
import { drawNight, drawTextLayout, drawTokenLayout, font, layoutText, layoutTokens, reveal } from '../primitives'

const LINE_GAP = 34
const LINE = font(VIDEO_FONT_SIZES.summaryLine, 500)
const LINE_CHIP = font(VIDEO_FONT_SIZES.summaryLine, 700)
const CTA = font(VIDEO_FONT_SIZES.cta, 900)

export function drawSummary({ ctx, data, view }: SceneDrawArgs<SummaryData>): void {
  drawNight(ctx)
  let y = drawHeading(ctx, data.title, undefined, VIDEO_COLORS.nightText)

  data.lines.forEach((line, i) => {
    const layout = layoutTokens(ctx, line, { font: LINE, chipFont: LINE_CHIP, color: VIDEO_COLORS.nightText }, CONTENT_WIDTH, 2)
    const top = y
    reveal(ctx, view.step(i + 1), () => drawTokenLayout(ctx, layout, CONTENT_LEFT, top))
    y += layout.height + LINE_GAP
  })

  // 구독 안내: left 140, bottom 200 고정
  const cta = layoutText(ctx, data.cta, CTA, { maxWidth: CONTENT_WIDTH, maxLines: 1 })
  reveal(ctx, view.step(data.ctaStep), () =>
    drawTextLayout(ctx, cta, CONTENT_LEFT, CONTENT_BOTTOM - cta.height, { color: VIDEO_COLORS.subtitleEn }),
  )

  drawBrand(ctx)
}
