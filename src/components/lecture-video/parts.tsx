// 강의 영상 공용 부품 — 시간 문맥, 등장 애니메이션, 단어 하이라이트 문장, 워터마크·진행바·자막

import { createContext, useContext, type CSSProperties, type ReactNode } from 'react'
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import type { LectureScript, Token } from '../../lib/lecture-pipeline/types'
import { sentenceKey, type Cue, type TimedWord, type Timeline, type TimelineSegment } from '../../lib/lecture-pipeline/timing'
import { COLOR, FONT, LAYOUT, ROLE_COLOR, VIDEO } from './theme'

// ── 시간 문맥 ─────────────────────────────────────────────

export interface SlideCtx {
  script: LectureScript
  timeline: Timeline
  /** 이 슬라이드의 시작·끝(절대 ms) */
  startMs: number
  endMs: number
  /** k단계 등장 시간 (index = k-1) */
  stepTimes: number[]
  /** 이 슬라이드 세그먼트 타이밍 */
  segments: TimelineSegment[]
}

export const SlideContext = createContext<SlideCtx | null>(null)

export function useSlide(): SlideCtx {
  const ctx = useContext(SlideContext)
  if (!ctx) throw new Error('SlideContext 없음')
  return ctx
}

/** 현재 시간(절대 ms) */
export function useNowMs(): number {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  return (frame / fps) * 1000
}

/** atMs부터 부드럽게 0→1 (spring, 튀지 않게) */
export function useAppear(atMs: number, opts: { damping?: number; durationFrames?: number; delayMs?: number } = {}): number {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  if (!Number.isFinite(atMs)) return 0
  const startFrame = ((atMs + (opts.delayMs ?? 0)) / 1000) * fps
  if (frame < startFrame) return 0
  return spring({ frame: frame - startFrame, fps, config: { damping: opts.damping ?? 200, mass: 0.8 }, durationInFrames: opts.durationFrames ?? 16 })
}

/** 단계 k(1부터)의 등장 진행도 */
export function useStep(k: number, delayMs = 0): number {
  const { stepTimes, startMs } = useSlide()
  const at = stepTimes[k - 1] ?? startMs
  return useAppear(at, { delayMs })
}

/** 등장 스타일 — 아래에서 살짝 올라오며 나타남 */
export function rise(p: number, distance = 28): CSSProperties {
  return { opacity: p, transform: `translateY(${(1 - p) * distance}px)` }
}

// ── 글자 ──────────────────────────────────────────────────

export function Chip({ children, color = COLOR.indigo, bg = COLOR.indigoSoft, style }: { children: ReactNode; color?: string; bg?: string; style?: CSSProperties }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12, padding: '10px 26px', borderRadius: 999, background: bg, color, fontSize: 36, fontWeight: 700, letterSpacing: -0.5, ...style }}>
      {children}
    </div>
  )
}

/** 슬라이드 머리 — 종류 칩 + 제목 */
export function Header({ label, title, chipColor, chipBg }: { label: string; title?: string; chipColor?: string; chipBg?: string }) {
  const { startMs } = useSlide()
  const p = useAppear(startMs + 120)
  return (
    <div style={{ ...rise(p, 18), display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 22, marginBottom: 56 }}>
      <Chip color={chipColor} bg={chipBg}>{label}</Chip>
      {title ? <div style={{ fontSize: 76, fontWeight: 800, color: COLOR.navy, letterSpacing: -1.5, lineHeight: 1.15 }}>{title}</div> : null}
    </div>
  )
}

/** "**키워드**" → 키워드 하이라이트 (마커가 왼쪽부터 칠해짐) */
export function MarkedText({ text, progress, style }: { text: string; progress: number; style?: CSSProperties }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean)
  return (
    <span style={style}>
      {parts.map((part, i) => {
        const m = part.match(/^\*\*([^*]+)\*\*$/)
        if (!m) return <span key={i}>{part}</span>
        const w = interpolate(progress, [0.35, 1], [0, 100], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
        return (
          <span key={i} style={{ position: 'relative', display: 'inline-block', color: COLOR.indigo, fontWeight: 800 }}>
            <span style={{ position: 'absolute', left: -6, right: -6, bottom: '6%', height: '42%', width: `calc(${w}% + 12px)`, background: COLOR.indigoSoft, borderRadius: 8, zIndex: 0 }} />
            <span style={{ position: 'relative', zIndex: 1 }}>{m[1]}</span>
          </span>
        )
      })}
    </span>
  )
}

// ── 영어 문장 (성분 색 + 포인트 밑줄 + 읽는 단어 하이라이트) ──

interface DisplayWord {
  text: string
  token: Token
  /** 같은 토큰의 마지막 단어인지 (밑줄을 이어 그리기 위함) */
  tokenEnd: boolean
  /** 문장부호 앞이라 띄어 쓰지 않는지 */
  noSpace: boolean
}

function toWords(tokens: Token[]): DisplayWord[] {
  const out: DisplayWord[] = []
  tokens.forEach((t) => {
    const parts = t.text.split(/\s+/).filter(Boolean)
    parts.forEach((w, i) => out.push({ text: w, token: t, tokenEnd: i === parts.length - 1, noSpace: false }))
  })
  out.forEach((w, i) => {
    const next = out[i + 1]
    w.noSpace = !!next && /^[.,!?;:)'’]/.test(next.text)
  })
  return out
}

const wordKey = (s: string) => s.toLowerCase().replace(/[^a-z0-9']/g, '')

/** 화면 단어 ↔ 읽은 단어 순서대로 짝짓기 → 화면 단어별 시간 */
function matchWordTimes(display: DisplayWord[], spoken: TimedWord[]): (TimedWord | null)[] {
  let j = 0
  return display.map((d) => {
    const key = wordKey(d.text)
    if (!key) return null
    for (let k = j; k < Math.min(spoken.length, j + 4); k++) {
      if (wordKey(spoken[k].text) === key) {
        j = k + 1
        return spoken[k]
      }
    }
    return null
  })
}

/** 이 슬라이드에서 화면 문장을 읽는 영어 세그먼트의 단어 시간 */
export function useSpokenWords(tokens: Token[]): TimedWord[] | null {
  const { script, segments } = useSlide()
  const key = sentenceKey(tokens.map((t) => t.text).join(' '))
  const textById = new Map(script.segments.map((s) => [s.id, s.text]))
  const hit = segments.find((s) => s.lang === 'en' && s.words?.length && sentenceKey(textById.get(s.id) ?? '') === key)
  return hit?.words ?? null
}

export function Sentence({
  tokens,
  fontSize,
  progress,
  strike = 0,
  colorRoles = true,
  style,
}: {
  tokens: Token[]
  fontSize: number
  progress: number
  /** 0~1 — 틀린 문장 취소선 */
  strike?: number
  colorRoles?: boolean
  style?: CSSProperties
}) {
  const now = useNowMs()
  const words = toWords(tokens)
  const spoken = useSpokenWords(tokens)
  const times = spoken ? matchWordTimes(words, spoken) : []
  const underline = interpolate(progress, [0.5, 1], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  return (
    <div style={{ position: 'relative', fontFamily: FONT.english, fontSize, fontWeight: 700, lineHeight: 1.35, color: COLOR.text, letterSpacing: -0.5, ...rise(progress), ...style }}>
      {words.map((w, i) => {
        const role = colorRoles ? w.token.role : undefined
        const color = role ? ROLE_COLOR[role].fg : COLOR.text
        const t = times[i]
        const active = !!t && now >= t.startMs - 40 && now < Math.max(t.endMs, (times[i + 1]?.startMs ?? t.endMs) - 40)
        const point = w.token.point
        return (
          <span key={i} style={{ position: 'relative', display: 'inline-block', marginRight: w.noSpace ? 0 : '0.28em', color }}>
            <span
              style={{
                position: 'absolute', inset: '-0.04em -0.14em', borderRadius: 14,
                background: active ? COLOR.indigoSoft : 'transparent', transition: 'none', zIndex: 0,
              }}
            />
            <span style={{ position: 'relative', zIndex: 1 }}>{w.text}</span>
            {point ? (
              <span
                style={{
                  position: 'absolute', left: 0, bottom: '-0.02em', height: Math.max(6, fontSize * 0.09), borderRadius: 6,
                  width: `${underline * 100}%`, background: role ? ROLE_COLOR[role].fg : COLOR.indigo,
                  // 같은 덩어리이거나 다음 단어도 포인트면 밑줄을 잇는다
                  ...(w.noSpace || (w.tokenEnd && !words[i + 1]?.token.point) ? {} : { width: `calc(${underline * 100}% + 0.28em)` }),
                }}
              />
            ) : null}
          </span>
        )
      })}
      {strike > 0 ? (
        <span style={{ position: 'absolute', left: 0, top: '52%', height: Math.max(5, fontSize * 0.07), width: `${strike * 100}%`, background: COLOR.red, borderRadius: 4 }} />
      ) : null}
    </div>
  )
}

// ── 화면 공통: 워터마크·진행바·자막 ─────────────────────────

export function BrandMark({ size = 56, color = COLOR.indigo, fg = '#FFFFFF' }: { size?: number; color?: string; fg?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64">
      <rect width="64" height="64" rx="16" fill={color} />
      <path d="M16 40 L28 28 L36 36 L48 22" stroke={fg} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M40 22 H48 V30" stroke={fg} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  )
}

export function Watermark() {
  return (
    <div style={{ position: 'absolute', top: 44, right: 56, display: 'flex', alignItems: 'center', gap: 12, opacity: 0.75 }}>
      <BrandMark size={34} />
      <span style={{ fontSize: 28, fontWeight: 700, color: COLOR.navy, letterSpacing: -0.3 }}>
        WeGoUp <span style={{ color: COLOR.indigo }}>English</span>
      </span>
    </div>
  )
}

export function ProgressBar({ totalMs }: { totalMs: number }) {
  const now = useNowMs()
  const p = Math.min(1, now / Math.max(1, totalMs))
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 12, background: COLOR.line }}>
      <div style={{ width: `${p * 100}%`, height: '100%', background: COLOR.indigo }} />
    </div>
  )
}

export function SubtitleBar({ cues }: { cues: Cue[] }) {
  const now = useNowMs()
  const cue = cues.find((c) => now >= c.startMs && now < c.endMs)
  if (!cue) return null
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 44, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
      <div
        style={{
          maxWidth: VIDEO.width - LAYOUT.padX * 2, padding: '12px 32px', borderRadius: 16, background: 'rgba(14, 22, 56, 0.86)',
          color: '#FFFFFF', fontSize: 48, fontWeight: 600, lineHeight: 1.3, textAlign: 'center', letterSpacing: -0.5,
        }}
      >
        {cue.text}
      </div>
    </div>
  )
}

/** O / X 표시 — 선이 그려지듯 등장 */
export function Mark({ ok, progress, size = 96 }: { ok: boolean; progress: number; size?: number }) {
  const color = ok ? COLOR.green : COLOR.red
  if (ok) {
    const c = 2 * Math.PI * 26
    return (
      <svg width={size} height={size} viewBox="0 0 64 64">
        <circle cx="32" cy="32" r="26" fill="none" stroke={color} strokeWidth="8" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - progress)} transform="rotate(-90 32 32)" />
      </svg>
    )
  }
  const a = Math.min(1, progress * 2)
  const b = Math.max(0, progress * 2 - 1)
  const len = 45.3
  return (
    <svg width={size} height={size} viewBox="0 0 64 64">
      <line x1="16" y1="16" x2="48" y2="48" stroke={color} strokeWidth="8" strokeLinecap="round" strokeDasharray={len} strokeDashoffset={len * (1 - a)} />
      <line x1="48" y1="16" x2="16" y2="48" stroke={color} strokeWidth="8" strokeLinecap="round" strokeDasharray={len} strokeDashoffset={len * (1 - b)} />
    </svg>
  )
}

export function CheckIcon({ progress, size = 40, color = '#FFFFFF' }: { progress: number; size?: number; color?: string }) {
  const len = 34
  return (
    <svg width={size} height={size} viewBox="0 0 40 40">
      <path d="M9 21 L17 29 L31 12" fill="none" stroke={color} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray={len} strokeDashoffset={len * (1 - progress)} />
    </svg>
  )
}
