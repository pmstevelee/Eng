// 비교: 왼쪽 라벨(굵은 이름 + 한 줄 설명) | 오른쪽 영어 문장(색 칩) + 한글 해석, 아래 안내 문장

import type { CompareData } from '../../../../../types/grammar-video'
import { VIDEO_COLORS, VIDEO_FONT_SIZES } from '../../constants'
import { CONTENT_LEFT, CONTENT_WIDTH, drawHeading, type SceneDrawArgs } from '../layout'
import { drawTextLayout, drawTokenLayout, font, layoutText, layoutTokens, reveal } from '../primitives'

const LABEL_COL = 330
const ROW_GAP = 70
const LABEL = font(VIDEO_FONT_SIZES.compareLabel, 900)
const LABEL_SUB = font(VIDEO_FONT_SIZES.compareSub, 400)
const SENTENCE = font(VIDEO_FONT_SIZES.compareSentence, 700, 'en')
const KO = font(VIDEO_FONT_SIZES.translation, 500)
const KO_GAP = 10
const NOTE = font(VIDEO_FONT_SIZES.note, 500)
const NOTE_GAP = 64

export function drawCompare({ ctx, data, view }: SceneDrawArgs<CompareData>): void {
  let y = drawHeading(ctx, data.title, undefined, VIDEO_COLORS.ink)
  const sentX = CONTENT_LEFT + LABEL_COL
  const sentW = CONTENT_WIDTH - LABEL_COL

  for (const row of data.rows) {
    const label = layoutText(ctx, row.label, LABEL, { maxWidth: LABEL_COL - 20, maxLines: 1 })
    const sub = row.sub ? layoutText(ctx, row.sub, LABEL_SUB, { maxWidth: LABEL_COL - 20, maxLines: 2 }) : null
    const sentence = layoutTokens(ctx, row.sentence, { font: SENTENCE, color: VIDEO_COLORS.ink }, sentW, 2)
    const ko = layoutText(ctx, row.ko, KO, { maxWidth: sentW, maxLines: 2 })
    const labelH = label.height + (sub?.height ?? 0)
    const sentH = sentence.height + KO_GAP + ko.height
    const rowH = Math.max(labelH, sentH)
    const top = y
    // grid align-items: center
    reveal(ctx, view.step(row.step), () => {
      const ly = top + (rowH - labelH) / 2
      drawTextLayout(ctx, label, CONTENT_LEFT, ly, { color: VIDEO_COLORS.ink })
      if (sub) drawTextLayout(ctx, sub, CONTENT_LEFT, ly + label.height, { color: VIDEO_COLORS.soft })
      const sy = top + (rowH - sentH) / 2
      drawTokenLayout(ctx, sentence, sentX, sy)
      drawTextLayout(ctx, ko, sentX, sy + sentence.height + KO_GAP, { color: VIDEO_COLORS.soft })
    })
    y += rowH + ROW_GAP
  }

  if (data.note) {
    const note = data.note
    const top = y - ROW_GAP + NOTE_GAP
    const layout = layoutText(ctx, note.text, NOTE, { maxWidth: CONTENT_WIDTH, maxLines: 2 })
    reveal(ctx, view.step(note.step), () => drawTextLayout(ctx, layout, CONTENT_LEFT, top, { color: VIDEO_COLORS.ink }))
  }
}
