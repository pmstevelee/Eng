// 단계: 번호 카드(번호 · 단계명 · 예시 칩)가 나란히, 아래 남색 공식 바

import type { StepsData } from '../../../../../types/grammar-video'
import { VIDEO_COLORS, VIDEO_FONT_SIZES } from '../../constants'
import { CONTENT_LEFT, CONTENT_WIDTH, drawHeading, type SceneDrawArgs } from '../layout'
import {
  baselineOf,
  drawTextLayout,
  drawTokenLayout,
  fillRoundRect,
  font,
  fontString,
  layoutText,
  layoutTokens,
  reveal,
  roundRectPath,
} from '../primitives'

const CARD_GAP = 44
const CARD_BORDER = 4
const CARD_RADIUS = 28
const CARD_PAD = { top: 40, x: 40, bottom: 44 }
const NUMBER = font(VIDEO_FONT_SIZES.stepNumber, 700, 'en')
const TITLE = font(VIDEO_FONT_SIZES.stepTitle, 900)
const TITLE_MARGIN = { top: 18, bottom: 26 }
const EXAMPLE = font(VIDEO_FONT_SIZES.stepExample, 600, 'en')
const FORMULA = font(VIDEO_FONT_SIZES.formula, 700)
const FORMULA_CHIP = font(54, 700)
const FORMULA_GAP = 56
const FORMULA_PAD = { y: 34, x: 48 }
const FORMULA_RADIUS = 28

export function drawSteps({ ctx, data, view }: SceneDrawArgs<StepsData>): void {
  let y = drawHeading(ctx, data.title, undefined, VIDEO_COLORS.ink)
  const n = Math.max(1, data.steps.length)
  const cardW = (CONTENT_WIDTH - CARD_GAP * (n - 1)) / n
  const innerW = cardW - CARD_BORDER * 2 - CARD_PAD.x * 2

  const cards = data.steps.map((st) => ({
    st,
    title: layoutText(ctx, st.title, TITLE, { maxWidth: innerW, maxLines: 2 }),
    example: layoutTokens(ctx, st.example, { font: EXAMPLE, color: VIDEO_COLORS.ink }, innerW, 2),
  }))
  /** 번호는 line-height 1 */
  const numberH = NUMBER.size
  // grid 행 높이 = 가장 큰 카드
  const cardH = Math.max(
    0,
    ...cards.map(
      (c) =>
        CARD_BORDER * 2 + CARD_PAD.top + numberH + TITLE_MARGIN.top + c.title.height + TITLE_MARGIN.bottom + c.example.height + CARD_PAD.bottom,
    ),
  )

  cards.forEach((c, i) => {
    const x = CONTENT_LEFT + i * (cardW + CARD_GAP)
    const top = y
    reveal(ctx, view.step(c.st.step), () => {
      fillRoundRect(ctx, x, top, cardW, cardH, CARD_RADIUS, VIDEO_COLORS.paper)
      ctx.save()
      ctx.strokeStyle = VIDEO_COLORS.ink
      ctx.lineWidth = CARD_BORDER
      roundRectPath(ctx, x + CARD_BORDER / 2, top + CARD_BORDER / 2, cardW - CARD_BORDER, cardH - CARD_BORDER, CARD_RADIUS - CARD_BORDER / 2)
      ctx.stroke()
      ctx.restore()

      const ix = x + CARD_BORDER + CARD_PAD.x
      let cy = top + CARD_BORDER + CARD_PAD.top
      ctx.save()
      ctx.font = fontString(NUMBER)
      ctx.fillStyle = VIDEO_COLORS.ink
      ctx.textBaseline = 'alphabetic'
      ctx.fillText(String(i + 1), ix, baselineOf(ctx, NUMBER, cy, numberH))
      ctx.restore()
      cy += numberH + TITLE_MARGIN.top
      drawTextLayout(ctx, c.title, ix, cy, { color: VIDEO_COLORS.ink })
      cy += c.title.height + TITLE_MARGIN.bottom
      drawTokenLayout(ctx, c.example, ix, cy)
    })
  })
  y += cardH + FORMULA_GAP

  const formula = layoutTokens(
    ctx,
    data.formula,
    { font: FORMULA, chipFont: FORMULA_CHIP, color: VIDEO_COLORS.nightText },
    CONTENT_WIDTH - FORMULA_PAD.x * 2,
    2,
  )
  const top = y
  reveal(ctx, view.step(data.formulaStep), () => {
    fillRoundRect(ctx, CONTENT_LEFT, top, CONTENT_WIDTH, formula.height + FORMULA_PAD.y * 2, FORMULA_RADIUS, VIDEO_COLORS.ink)
    drawTokenLayout(ctx, formula, CONTENT_LEFT + FORMULA_PAD.x, top + FORMULA_PAD.y, {
      align: 'center',
      boxWidth: CONTENT_WIDTH - FORMULA_PAD.x * 2,
    })
  })
}
