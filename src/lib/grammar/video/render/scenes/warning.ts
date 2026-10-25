// 주의: 규칙 한 줄 + ✗ 틀린 문장(빨강 상자) / ✓ 바른 문장(초록 상자) + 자주 틀리는 단어

import type { WarningData } from '../../../../../types/grammar-video'
import { VIDEO_COLORS, VIDEO_FONT_SIZES } from '../../constants'
import { CONTENT_LEFT, CONTENT_WIDTH, drawHeading, type SceneDrawArgs } from '../layout'
import {
  baselineOf,
  drawTextLayout,
  fillRoundRect,
  font,
  fontString,
  layoutText,
  lineHeightOf,
  measure,
  reveal,
} from '../primitives'

const RULE = font(VIDEO_FONT_SIZES.warningRule, 700)
const RULE_GAP = 56
const BOX_GAP = 30
const BOX = font(VIDEO_FONT_SIZES.warningSentence, 600, 'en')
const BOX_PAD = { y: 22, x: 40 }
const BOX_RADIUS = 24
const WORDS_GAP = 52
const WORDS_LABEL = font(VIDEO_FONT_SIZES.warningWords, 400)
const WORD = font(VIDEO_FONT_SIZES.warningWords, 600, 'en')
const WORD_MARGIN = 26

export function drawWarning({ ctx, data, view }: SceneDrawArgs<WarningData>): void {
  let y = drawHeading(ctx, data.title, undefined, VIDEO_COLORS.ink)

  const rule = layoutText(ctx, data.rule, RULE, { maxWidth: CONTENT_WIDTH, maxLines: 2 })
  const ruleTop = y
  reveal(ctx, view.step(data.ruleStep), () => drawTextLayout(ctx, rule, CONTENT_LEFT, ruleTop, { color: VIDEO_COLORS.ink }))
  y += rule.height + RULE_GAP

  const boxes = [
    { text: `✗ ${data.wrong}`, fg: VIDEO_COLORS.warn, bg: VIDEO_COLORS.warnBg, step: data.wrongStep },
    { text: `✓ ${data.right}`, fg: VIDEO_COLORS.verb, bg: VIDEO_COLORS.verbBg, step: data.rightStep },
  ]
  boxes.forEach((b, i) => {
    const layout = layoutText(ctx, b.text, BOX, { maxWidth: CONTENT_WIDTH - BOX_PAD.x * 2, maxLines: 1 })
    const h = layout.height + BOX_PAD.y * 2
    const top = y
    reveal(ctx, view.step(b.step), () => {
      fillRoundRect(ctx, CONTENT_LEFT, top, CONTENT_WIDTH, h, BOX_RADIUS, b.bg)
      drawTextLayout(ctx, layout, CONTENT_LEFT + BOX_PAD.x, top + BOX_PAD.y, { color: b.fg })
    })
    y += h + (i === 0 ? BOX_GAP : 0)
  })

  if (data.words.length === 0) return
  y += WORDS_GAP
  const top = y
  reveal(ctx, view.step(data.wordsStep), () => {
    const lh = lineHeightOf(WORDS_LABEL)
    const label = '자주 틀리는 단어: '
    ctx.save()
    ctx.textBaseline = 'alphabetic'
    ctx.font = fontString(WORDS_LABEL)
    ctx.fillStyle = VIDEO_COLORS.ink
    const baseline = baselineOf(ctx, WORDS_LABEL, top, lh)
    ctx.fillText(label, CONTENT_LEFT, baseline)
    let x = CONTENT_LEFT + measure(ctx, label, WORDS_LABEL)
    ctx.font = fontString(WORD)
    for (const w of data.words) {
      ctx.fillText(w, x, baseline)
      x += measure(ctx, w, WORD) + WORD_MARGIN
    }
    ctx.restore()
  })
}
