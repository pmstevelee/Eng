// 변형표: 왼쪽 항목명(오른쪽 정렬, 회색) | 오른쪽 영어 예문(바뀌는 부분 초록 강조)

import type { VariationsData } from '../../../../../types/grammar-video'
import { VIDEO_COLORS, VIDEO_FONT_SIZES } from '../../constants'
import { CONTENT_LEFT, CONTENT_WIDTH, drawHeading, type SceneDrawArgs } from '../layout'
import { drawTextLayout, drawTokenLayout, font, layoutText, layoutTokens, reveal } from '../primitives'

const LABEL_COL = 200
const COL_GAP = 40
const ROW_GAP = 30
const LABEL = font(VIDEO_FONT_SIZES.variationLabel, 900)
const SENTENCE = font(VIDEO_FONT_SIZES.variationSentence, 600, 'en')

export function drawVariations({ ctx, data, view }: SceneDrawArgs<VariationsData>): void {
  let y = drawHeading(ctx, data.title, data.subtitle, VIDEO_COLORS.ink)
  const sentX = CONTENT_LEFT + LABEL_COL + COL_GAP
  const sentW = CONTENT_WIDTH - LABEL_COL - COL_GAP

  for (const row of data.rows) {
    const label = layoutText(ctx, row.label, LABEL, { maxWidth: LABEL_COL, maxLines: 1 })
    const sentence = layoutTokens(ctx, row.sentence, { font: SENTENCE, color: VIDEO_COLORS.ink }, sentW, 1, 0.65)
    const rowH = Math.max(label.height, sentence.height)
    const top = y
    reveal(ctx, view.step(row.step), () => {
      drawTextLayout(ctx, label, CONTENT_LEFT, top + (rowH - label.height) / 2, {
        color: VIDEO_COLORS.soft,
        align: 'right',
        boxWidth: LABEL_COL,
      })
      drawTokenLayout(ctx, sentence, sentX, top + (rowH - sentence.height) / 2)
    })
    y += rowH + ROW_GAP
  }
}
