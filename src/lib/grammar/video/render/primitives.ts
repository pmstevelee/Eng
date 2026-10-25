// Canvas 2D 그리기 도구 — 샘플 HTML의 CSS 배치(줄 높이 1.55, 칩 패딩, 등장 연출)를 그대로 흉내 낸다.
// 렌더러는 시간 t만 보고 그리므로 여기에는 상태가 없다 (글꼴 측정값 캐시만 있음).

import { needsSpaceBetween, type Token, type TokenRole } from '../../../../types/grammar-video'
import {
  GRID_LINE,
  GRID_SIZE,
  TOKEN_ROLE_COLORS,
  VIDEO_COLORS,
  VIDEO_FONTS,
  VIDEO_HEIGHT,
  VIDEO_TIMING,
  VIDEO_WIDTH,
} from '../constants'

/** 화면 캔버스와 OffscreenCanvas(MP4 내보내기) 모두 지원 */
export type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D

export type FontFamily = 'ko' | 'en'

export interface FontSpec {
  size: number
  weight: number
  family: FontFamily
}

/** CSS 기본 줄 높이 (샘플 body line-height) */
export const LINE_HEIGHT = 1.55

export function font(size: number, weight: number, family: FontFamily = 'ko'): FontSpec {
  return { size, weight, family }
}

export function scaleFont(f: FontSpec, scale: number): FontSpec {
  return { ...f, size: Math.round(f.size * scale * 10) / 10 }
}

export function fontString(f: FontSpec): string {
  return `${f.weight} ${f.size}px ${VIDEO_FONTS[f.family]}`
}

export function lineHeightOf(f: FontSpec, ratio = LINE_HEIGHT): number {
  return f.size * ratio
}

// ── 글꼴 측정 ──────────────────────────────────────────────

const metricsCache = new Map<string, { ascent: number; descent: number }>()

/** 글꼴의 위·아래 높이 (CSS content area와 같은 기준) */
export function fontMetrics(ctx: Ctx2D, f: FontSpec): { ascent: number; descent: number } {
  const key = fontString(f)
  const hit = metricsCache.get(key)
  if (hit) return hit
  ctx.save()
  ctx.font = key
  const m = ctx.measureText('가Hg')
  ctx.restore()
  const ascent = m.fontBoundingBoxAscent || f.size * (f.family === 'ko' ? 1.16 : 1)
  const descent = m.fontBoundingBoxDescent || f.size * (f.family === 'ko' ? 0.29 : 0.25)
  const value = { ascent, descent }
  // 글꼴이 아직 안 불러졌을 때 측정값이 굳지 않게, 불러온 뒤 clearFontMetricsCache()를 부른다
  metricsCache.set(key, value)
  return value
}

export function clearFontMetricsCache(): void {
  metricsCache.clear()
}

/** 줄 상자 위쪽 y → 글자 기준선 y (CSS half-leading 계산) */
export function baselineOf(ctx: Ctx2D, f: FontSpec, lineTop: number, lineHeight = lineHeightOf(f)): number {
  const { ascent, descent } = fontMetrics(ctx, f)
  return lineTop + (lineHeight - (ascent + descent)) / 2 + ascent
}

type LetterSpacingCtx = Ctx2D & { letterSpacing?: string }

/** 자간 (Chrome 99+ letterSpacing, 없으면 무시) */
export function setLetterSpacing(ctx: Ctx2D, px: number): void {
  const c = ctx as LetterSpacingCtx
  if ('letterSpacing' in c) c.letterSpacing = `${px}px`
}

export function measure(ctx: Ctx2D, text: string, f: FontSpec, letterSpacingPx = 0): number {
  ctx.save()
  ctx.font = fontString(f)
  setLetterSpacing(ctx, letterSpacingPx)
  const w = ctx.measureText(text).width
  ctx.restore()
  return w
}

// ── 도형 ──────────────────────────────────────────────────

export function roundRectPath(ctx: Ctx2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2))
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.lineTo(x + w - rr, y)
  ctx.arcTo(x + w, y, x + w, y + rr, rr)
  ctx.lineTo(x + w, y + h - rr)
  ctx.arcTo(x + w, y + h, x + w - rr, y + h, rr)
  ctx.lineTo(x + rr, y + h)
  ctx.arcTo(x, y + h, x, y + h - rr, rr)
  ctx.lineTo(x, y + rr)
  ctx.arcTo(x, y, x + rr, y, rr)
  ctx.closePath()
}

export function fillRoundRect(ctx: Ctx2D, x: number, y: number, w: number, h: number, r: number, color: string): void {
  ctx.fillStyle = color
  roundRectPath(ctx, x, y, w, h, r)
  ctx.fill()
}

/** 흰 종이 + 60px 하늘색 모눈 (CSS linear-gradient 2px 선과 같은 위치) */
export function drawPaper(ctx: Ctx2D): void {
  ctx.fillStyle = VIDEO_COLORS.paper
  ctx.fillRect(0, 0, VIDEO_WIDTH, VIDEO_HEIGHT)
  ctx.fillStyle = VIDEO_COLORS.grid
  for (let y = 0; y < VIDEO_HEIGHT; y += GRID_SIZE) ctx.fillRect(0, y, VIDEO_WIDTH, GRID_LINE)
  for (let x = 0; x < VIDEO_WIDTH; x += GRID_SIZE) ctx.fillRect(x, 0, GRID_LINE, VIDEO_HEIGHT)
}

export function drawNight(ctx: Ctx2D): void {
  ctx.fillStyle = VIDEO_COLORS.night
  ctx.fillRect(0, 0, VIDEO_WIDTH, VIDEO_HEIGHT)
}

/** 등장 연출: 진행률 p만큼 페이드 + 18px 아래에서 올라오기. p=0이면 그리지 않는다 */
export function reveal(ctx: Ctx2D, p: number, draw: () => void): void {
  if (p <= 0) return
  ctx.save()
  ctx.globalAlpha *= Math.min(1, p)
  if (p < 1) ctx.translate(0, VIDEO_TIMING.revealOffsetPx * (1 - p))
  draw()
  ctx.restore()
}

export function withAlpha(ctx: Ctx2D, alpha: number, draw: () => void): void {
  if (alpha <= 0) return
  ctx.save()
  ctx.globalAlpha *= Math.min(1, alpha)
  draw()
  ctx.restore()
}

// ── 일반 글자 ───────────────────────────────────────────────

/** 공백 기준 줄바꿈. 한 단어가 너무 길면 글자 단위로 자른다 */
export function wrapText(ctx: Ctx2D, text: string, f: FontSpec, maxWidth: number, letterSpacingPx = 0): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  if (words.length === 0) return ['']
  const lines: string[] = []
  let line = ''
  const fits = (s: string) => measure(ctx, s, f, letterSpacingPx) <= maxWidth
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word
    if (fits(candidate)) {
      line = candidate
      continue
    }
    if (line) lines.push(line)
    if (fits(word)) {
      line = word
      continue
    }
    // 단어 하나가 한 줄보다 길다 → 글자 단위
    let piece = ''
    for (const ch of Array.from(word)) {
      if (piece && !fits(piece + ch)) {
        lines.push(piece)
        piece = ch
      } else piece += ch
    }
    line = piece
  }
  if (line) lines.push(line)
  return lines
}

export interface TextBlockOptions {
  color: string
  align?: 'left' | 'center' | 'right'
  lineHeight?: number
  letterSpacingPx?: number
  maxWidth: number
  /** 최대 줄 수 — 넘치면 글자를 줄인다 (최소 0.6배) */
  maxLines?: number
}

export interface TextBlockLayout {
  lines: string[]
  font: FontSpec
  lineHeight: number
  height: number
  width: number
  letterSpacingPx: number
}

/** 줄바꿈 + 넘치면 글자 크기 줄이기 */
export function layoutText(ctx: Ctx2D, text: string, f: FontSpec, opts: Omit<TextBlockOptions, 'color' | 'align'>): TextBlockLayout {
  const maxLines = opts.maxLines ?? 99
  let scale = 1
  for (;;) {
    const sf = scale === 1 ? f : scaleFont(f, scale)
    const ls = (opts.letterSpacingPx ?? 0) * scale
    const lines = wrapText(ctx, text, sf, opts.maxWidth, ls)
    if (lines.length <= maxLines || scale <= 0.6) {
      const lh = (opts.lineHeight ?? lineHeightOf(f)) * scale
      const width = Math.max(0, ...lines.map((l) => measure(ctx, l, sf, ls)))
      return { lines, font: sf, lineHeight: lh, height: lh * lines.length, width, letterSpacingPx: ls }
    }
    scale = Math.round((scale - 0.05) * 100) / 100
  }
}

export function drawTextLayout(
  ctx: Ctx2D,
  layout: TextBlockLayout,
  x: number,
  top: number,
  opts: { color: string; align?: 'left' | 'center' | 'right'; boxWidth?: number },
): void {
  ctx.save()
  ctx.font = fontString(layout.font)
  setLetterSpacing(ctx, layout.letterSpacingPx)
  ctx.fillStyle = opts.color
  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = 'left'
  layout.lines.forEach((line, i) => {
    const lineTop = top + i * layout.lineHeight
    const w = ctx.measureText(line).width
    const box = opts.boxWidth ?? layout.width
    const lx = opts.align === 'center' ? x + (box - w) / 2 : opts.align === 'right' ? x + box - w : x
    ctx.fillText(line, lx, baselineOf(ctx, layout.font, lineTop, layout.lineHeight))
  })
  ctx.restore()
}

/** 줄바꿈해서 그리고 높이를 돌려준다 */
export function drawText(ctx: Ctx2D, text: string, f: FontSpec, x: number, top: number, opts: TextBlockOptions): number {
  const layout = layoutText(ctx, text, f, opts)
  drawTextLayout(ctx, layout, x, top, { color: opts.color, align: opts.align, boxWidth: opts.maxWidth })
  return layout.height
}

// ── 색 칩 문장 (Token[]) ──────────────────────────────────────

/** 칩: inline-block, padding 4px 20px, radius 14, 좌우 margin 6 */
const CHIP = { padX: 20, padY: 4, margin: 6, radius: 14 } as const
/** 강조(hl): 인라인 배경, padding 0 14, radius 12 */
const HL = { padX: 14, radius: 12 } as const
/** 생략 취소선 두께 */
const STRIKE_THICKNESS = 6

const CHIP_ROLES: readonly TokenRole[] = ['subj', 'obj', 'verb', 'warn']

function isChip(role: TokenRole | undefined): boolean {
  return role !== undefined && CHIP_ROLES.includes(role)
}

interface Atom {
  text: string
  role?: TokenRole
  /** 글자 폭 */
  textWidth: number
  /** 차지하는 폭 (칩 여백·패딩 포함) */
  advance: number
  /** 앞 조각과의 사이에 공백을 두는지 */
  spaceBefore: boolean
}

export interface TokenStyle {
  font: FontSpec
  /** 칩 글꼴 (없으면 font) — 예: 공식 바는 58px 문장 안에 54px 칩 */
  chipFont?: FontSpec
  color: string
}

export interface TokenLine {
  atoms: { atom: Atom; x: number }[]
  width: number
  /** 이 줄의 줄 상자 높이 (칩이 있으면 위아래로 커진다) */
  height: number
  /** 줄 위쪽에서 기준선까지 */
  baseline: number
}

export interface TokenLayout {
  lines: TokenLine[]
  width: number
  height: number
  style: TokenStyle
  scale: number
}

function toAtoms(ctx: Ctx2D, tokens: Token[], style: TokenStyle): Atom[] {
  const chipFont = style.chipFont ?? style.font
  const atoms: Atom[] = []
  tokens.forEach((tok, ti) => {
    const prev = tokens[ti - 1]
    const between = prev ? needsSpaceBetween(prev.text, tok.text) && !(isChip(prev.role) && isChip(tok.role)) : false
    if (isChip(tok.role)) {
      const tw = measure(ctx, tok.text, chipFont)
      atoms.push({ text: tok.text, role: tok.role, textWidth: tw, advance: tw + CHIP.padX * 2 + CHIP.margin * 2, spaceBefore: between })
      return
    }
    if (tok.role === 'hl' || tok.role === 'strike') {
      const tw = measure(ctx, tok.text.trim(), style.font)
      const pad = tok.role === 'hl' ? HL.padX * 2 : 0
      atoms.push({ text: tok.text.trim(), role: tok.role, textWidth: tw, advance: tw + pad, spaceBefore: between })
      return
    }
    // 색 없는 조각은 단어 단위로 줄바꿈할 수 있다. 앞뒤 공백은 조각 사이 규칙으로 처리
    const words = tok.text.split(/\s+/).filter(Boolean)
    words.forEach((w, wi) => {
      const tw = measure(ctx, w, style.font)
      atoms.push({ text: w, textWidth: tw, advance: tw, spaceBefore: wi === 0 ? between || /^\s/.test(tok.text) : true })
    })
  })
  if (atoms[0]) atoms[0].spaceBefore = false
  return atoms
}

function lineMetrics(ctx: Ctx2D, style: TokenStyle, hasChip: boolean): { height: number; baseline: number } {
  const f = style.font
  const lh = lineHeightOf(f)
  const { ascent, descent } = fontMetrics(ctx, f)
  const strutAbove = (lh - (ascent + descent)) / 2 + ascent
  let above = strutAbove
  let below = lh - strutAbove
  if (hasChip) {
    // 칩(inline-block)은 자기 줄 높이 + 위아래 패딩만큼 줄 상자를 넓힌다
    const cf = style.chipFont ?? f
    const clh = lineHeightOf(cf)
    const cm = fontMetrics(ctx, cf)
    const chipAbove = (clh - (cm.ascent + cm.descent)) / 2 + cm.ascent + CHIP.padY
    const chipBelow = clh + CHIP.padY * 2 - chipAbove
    above = Math.max(above, chipAbove)
    below = Math.max(below, chipBelow)
  }
  return { height: above + below, baseline: above }
}

function breakAtoms(ctx: Ctx2D, atoms: Atom[], style: TokenStyle, maxWidth: number): TokenLine[] {
  const spaceW = measure(ctx, ' ', style.font)
  const lines: { atom: Atom; x: number }[][] = []
  let cur: { atom: Atom; x: number }[] = []
  let x = 0
  for (const atom of atoms) {
    if (cur.length && x + (atom.spaceBefore ? spaceW : 0) + atom.advance > maxWidth) {
      lines.push(cur)
      cur = []
      x = 0
    }
    const gap = cur.length && atom.spaceBefore ? spaceW : 0
    cur.push({ atom, x: x + gap })
    x += gap + atom.advance
  }
  if (cur.length) lines.push(cur)
  return lines.map((items) => {
    const last = items[items.length - 1]
    const width = last ? last.x + last.atom.advance : 0
    const m = lineMetrics(
      ctx,
      style,
      items.some((it) => isChip(it.atom.role)),
    )
    return { atoms: items, width, height: m.height, baseline: m.baseline }
  })
}

/** 색 칩 문장 배치. maxLines를 넘으면 글자를 줄인다 (최소 minScale배) */
export function layoutTokens(
  ctx: Ctx2D,
  tokens: Token[],
  style: TokenStyle,
  maxWidth: number,
  maxLines = 99,
  minScale = 0.6,
): TokenLayout {
  let scale = 1
  for (;;) {
    const s: TokenStyle =
      scale === 1
        ? style
        : { ...style, font: scaleFont(style.font, scale), chipFont: style.chipFont ? scaleFont(style.chipFont, scale) : undefined }
    const lines = breakAtoms(ctx, toAtoms(ctx, tokens, s), s, maxWidth)
    const tooWide = lines.some((l) => l.width > maxWidth + 0.5)
    if ((lines.length <= maxLines && !tooWide) || scale <= minScale) {
      return {
        lines,
        width: Math.max(0, ...lines.map((l) => l.width)),
        height: lines.reduce((h, l) => h + l.height, 0),
        style: s,
        scale,
      }
    }
    scale = Math.round((scale - 0.05) * 100) / 100
  }
}

/** 배치된 칩 문장 그리기. align은 줄마다 적용 */
export function drawTokenLayout(
  ctx: Ctx2D,
  layout: TokenLayout,
  x: number,
  top: number,
  opts: { align?: 'left' | 'center'; boxWidth?: number } = {},
): void {
  const { style } = layout
  const chipFont = style.chipFont ?? style.font
  let lineTop = top
  ctx.save()
  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = 'left'
  for (const line of layout.lines) {
    const baseline = lineTop + line.baseline
    const offsetX = opts.align === 'center' && opts.boxWidth ? (opts.boxWidth - line.width) / 2 : 0
    for (const { atom, x: ax } of line.atoms) {
      const left = x + offsetX + ax
      const role = atom.role
      if (role && isChip(role)) {
        const colors = TOKEN_ROLE_COLORS[role]
        const clh = lineHeightOf(chipFont)
        const cm = fontMetrics(ctx, chipFont)
        const chipTop = baseline - ((clh - (cm.ascent + cm.descent)) / 2 + cm.ascent) - CHIP.padY
        if (colors.bg) {
          fillRoundRect(ctx, left + CHIP.margin, chipTop, atom.textWidth + CHIP.padX * 2, clh + CHIP.padY * 2, CHIP.radius, colors.bg)
        }
        ctx.font = fontString(chipFont)
        ctx.fillStyle = colors.fg
        ctx.fillText(atom.text, left + CHIP.margin + CHIP.padX, baseline)
        continue
      }
      ctx.font = fontString(style.font)
      if (role === 'hl') {
        const colors = TOKEN_ROLE_COLORS.hl
        const m = fontMetrics(ctx, style.font)
        if (colors.bg) fillRoundRect(ctx, left, baseline - m.ascent, atom.textWidth + HL.padX * 2, m.ascent + m.descent, HL.radius, colors.bg)
        ctx.fillStyle = colors.fg
        ctx.fillText(atom.text, left + HL.padX, baseline)
        continue
      }
      if (role === 'strike') {
        ctx.fillStyle = TOKEN_ROLE_COLORS.strike.fg
        ctx.fillText(atom.text, left, baseline)
        ctx.fillStyle = VIDEO_COLORS.warn
        ctx.fillRect(left, baseline - style.font.size * 0.32 - STRIKE_THICKNESS / 2, atom.textWidth, STRIKE_THICKNESS)
        continue
      }
      ctx.fillStyle = style.color
      ctx.fillText(atom.text, left, baseline)
    }
    lineTop += line.height
  }
  ctx.restore()
}
