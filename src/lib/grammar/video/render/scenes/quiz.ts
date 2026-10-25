// 퀴즈: 빈칸 문장 + (힌트), 5초 타이머 막대 후 정답이 하나씩 나타남

import type { QuizData } from '../../../../../types/grammar-video'
import { VIDEO_COLORS, VIDEO_FONT_SIZES } from '../../constants'
import { CONTENT_LEFT, CONTENT_WIDTH, drawHeading, type SceneDrawArgs } from '../layout'
import { baselineOf, fillRoundRect, font, fontString, lineHeightOf, measure, reveal, scaleFont, withAlpha, type Ctx2D, type FontSpec } from '../primitives'

const ITEM_GAP = 44
const SENTENCE = font(VIDEO_FONT_SIZES.quizSentence, 600, 'en')
const HINT = font(VIDEO_FONT_SIZES.quizHint, 600, 'en')
const HINT_MARGIN = 16
const BLANK_MIN = 330
const BLANK_BORDER = 6
const TIMER_GAP = 40
const TIMER_H = 16

interface ItemLayout {
  sentence: FontSpec
  hint: FontSpec
  space: number
  beforeW: number
  blankW: number
  afterW: number
  height: number
}

function layoutItem(ctx: Ctx2D, item: QuizData['items'][number]): ItemLayout {
  let scale = 1
  for (;;) {
    const sentence = scale === 1 ? SENTENCE : scaleFont(SENTENCE, scale)
    const hint = scale === 1 ? HINT : scaleFont(HINT, scale)
    const space = measure(ctx, ' ', sentence)
    const beforeW = item.before ? measure(ctx, item.before, sentence) + space : 0
    const blankW = Math.max(BLANK_MIN * scale, measure(ctx, item.answer, sentence))
    const afterW = item.after ? space + measure(ctx, item.after, sentence) : 0
    const hintW = item.hint ? HINT_MARGIN + space + measure(ctx, `(${item.hint})`, hint) : 0
    if (beforeW + blankW + afterW + hintW <= CONTENT_WIDTH || scale <= 0.6) {
      return { sentence, hint, space, beforeW, blankW, afterW, height: lineHeightOf(sentence) + BLANK_BORDER }
    }
    scale = Math.round((scale - 0.05) * 100) / 100
  }
}

export function drawQuiz({ ctx, data, view }: SceneDrawArgs<QuizData>): void {
  let y = drawHeading(ctx, data.title, data.subtitle || undefined, VIDEO_COLORS.ink)
  const itemsP = view.step(data.itemsStep)

  data.items.forEach((item, i) => {
    const l = layoutItem(ctx, item)
    const top = y
    reveal(ctx, itemsP, () => {
      const lh = lineHeightOf(l.sentence)
      const baseline = baselineOf(ctx, l.sentence, top, lh)
      ctx.save()
      ctx.textBaseline = 'alphabetic'
      ctx.font = fontString(l.sentence)
      ctx.fillStyle = VIDEO_COLORS.ink
      let x = CONTENT_LEFT
      if (item.before) ctx.fillText(item.before, x, baseline)
      x += l.beforeW
      // 빈칸: 아래 6px 선, 정답은 가운데에 초록으로 페이드
      ctx.fillRect(x, top + lh, l.blankW, BLANK_BORDER)
      const blankX = x
      withAlpha(ctx, view.answer(i + 1), () => {
        ctx.fillStyle = VIDEO_COLORS.verb
        const aw = measure(ctx, item.answer, l.sentence)
        ctx.fillText(item.answer, blankX + (l.blankW - aw) / 2, baseline)
      })
      x += l.blankW
      ctx.fillStyle = VIDEO_COLORS.ink
      if (item.after) ctx.fillText(item.after, x + l.space, baseline)
      x += l.afterW
      if (item.hint) {
        ctx.font = fontString(l.hint)
        ctx.fillStyle = VIDEO_COLORS.soft
        ctx.fillText(`(${item.hint})`, x + l.space + HINT_MARGIN, baseline)
      }
      ctx.restore()
    })
    y += l.height + ITEM_GAP
  })

  const timerTop = y - ITEM_GAP + TIMER_GAP
  reveal(ctx, itemsP, () => {
    fillRoundRect(ctx, CONTENT_LEFT, timerTop, CONTENT_WIDTH, TIMER_H, TIMER_H / 2, VIDEO_COLORS.grid)
    if (view.timer > 0) {
      ctx.save()
      ctx.beginPath()
      ctx.rect(CONTENT_LEFT, timerTop, CONTENT_WIDTH * view.timer, TIMER_H)
      ctx.clip()
      fillRoundRect(ctx, CONTENT_LEFT, timerTop, CONTENT_WIDTH, TIMER_H, TIMER_H / 2, VIDEO_COLORS.obj)
      ctx.restore()
    }
  })
}
