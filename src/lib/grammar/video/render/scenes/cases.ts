// 사례: 사례 제목 + 영어 예문(생략 부분은 빨간 취소선) + 해석

import type { CasesData } from '../../../../../types/grammar-video'
import { VIDEO_COLORS, VIDEO_FONT_SIZES } from '../../constants'
import { CONTENT_LEFT, CONTENT_WIDTH, drawHeading, type SceneDrawArgs } from '../layout'
import { drawTextLayout, drawTokenLayout, font, layoutText, layoutTokens, reveal } from '../primitives'

const CASE_GAP = 52
const TITLE = font(VIDEO_FONT_SIZES.caseTitle, 900)
const TITLE_GAP = 16
const SENTENCE = font(VIDEO_FONT_SIZES.caseSentence, 600, 'en')
const KO = font(VIDEO_FONT_SIZES.translation, 400)
const KO_GAP = 10

export function drawCases({ ctx, data, view }: SceneDrawArgs<CasesData>): void {
  let y = drawHeading(ctx, data.title, undefined, VIDEO_COLORS.ink)
  for (const c of data.cases) {
    const title = layoutText(ctx, c.title, TITLE, { maxWidth: CONTENT_WIDTH, maxLines: 1 })
    const sentence = layoutTokens(ctx, c.sentence, { font: SENTENCE, color: VIDEO_COLORS.ink }, CONTENT_WIDTH, 2)
    const ko = layoutText(ctx, c.ko, KO, { maxWidth: CONTENT_WIDTH, maxLines: 2 })
    const top = y
    reveal(ctx, view.step(c.step), () => {
      let cy = top
      drawTextLayout(ctx, title, CONTENT_LEFT, cy, { color: VIDEO_COLORS.ink })
      cy += title.height + TITLE_GAP
      drawTokenLayout(ctx, sentence, CONTENT_LEFT, cy)
      cy += sentence.height + KO_GAP
      drawTextLayout(ctx, ko, CONTENT_LEFT, cy, { color: VIDEO_COLORS.soft })
    })
    y += title.height + TITLE_GAP + sentence.height + KO_GAP + ko.height + CASE_GAP
  }
}
