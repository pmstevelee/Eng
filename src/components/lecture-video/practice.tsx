// 따라하기·패턴 공용 부품 — 본 강의(1920×1080)와 숏폼(1080×1920)이 함께 쓴다
// 마이크 펄스, 원형 카운트다운, 강세(굵게)·연음(밑줄+발음 힌트) 문장, 패턴 공식(빈칸 = 인디고 박스)

import type { CSSProperties, ReactNode } from 'react'
import { interpolate } from 'remotion'
import type { TimedWord } from '../../lib/lecture-pipeline/timing'
import type { RepeatData } from '../../lib/lecture-pipeline/types'
import { patternRanges, repeatPieces } from '../../lib/lecture-pipeline/patterns'
import { splitPattern } from '../../lib/lecture-pipeline/types'
import { useAppear, useNowMs } from './parts'
import { COLOR, FONT } from './theme'

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const

// ── 마이크 아이콘 (펄스) ──────────────────────────────────

export function MicIcon({ size = 120, active, color = COLOR.indigo }: { size?: number; active: boolean; color?: string }) {
  const now = useNowMs()
  // 0.9초 주기로 커졌다 작아짐 + 퍼지는 원 2개
  const phase = (now % 900) / 900
  const pulse = active ? 1 + 0.07 * Math.sin(phase * Math.PI * 2) : 1
  const ring = (offset: number) => {
    const p = ((now / 1400 + offset) % 1 + 1) % 1
    return { scale: 1 + p * 0.9, opacity: active ? (1 - p) * 0.45 : 0 }
  }
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      {[0, 0.5].map((o) => {
        const r = ring(o)
        return <div key={o} style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: color, opacity: r.opacity, transform: `scale(${r.scale})` }} />
      })}
      <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: active ? color : COLOR.line, transform: `scale(${pulse})`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 48 48">
          <rect x="17" y="6" width="14" height="24" rx="7" fill="#FFFFFF" />
          <path d="M11 22 a13 13 0 0 0 26 0" stroke="#FFFFFF" strokeWidth="4" fill="none" strokeLinecap="round" />
          <path d="M24 35 V42 M17 42 H31" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" />
        </svg>
      </div>
    </div>
  )
}

/** 스피커 아이콘 — "잘 들어 보세요" 상태 */
export function SpeakerIcon({ size = 120, active }: { size?: number; active: boolean }) {
  const now = useNowMs()
  const wave = (k: number) => (active ? 0.35 + 0.65 * Math.max(0, Math.sin((now / 260) - k)) : 0.3)
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: COLOR.navy, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <svg width={size * 0.56} height={size * 0.56} viewBox="0 0 48 48">
        <path d="M8 18 H16 L26 9 V39 L16 30 H8 Z" fill="#FFFFFF" />
        <path d="M31 17 a9 9 0 0 1 0 14" stroke="#FFFFFF" strokeWidth="4" fill="none" strokeLinecap="round" opacity={wave(0)} />
        <path d="M36 11 a17 17 0 0 1 0 26" stroke="#FFFFFF" strokeWidth="4" fill="none" strokeLinecap="round" opacity={wave(1)} />
      </svg>
    </div>
  )
}

// ── 원형 카운트다운 ───────────────────────────────────────

export function CountdownRing({ startMs, endMs, size = 200, color = COLOR.indigo, stroke = 16 }: { startMs: number; endMs: number; size?: number; color?: string; stroke?: number }) {
  const now = useNowMs()
  const total = Math.max(1, endMs - startMs)
  const left = Math.max(0, Math.min(total, endMs - now))
  const n = Math.max(1, Math.ceil(left / 1000))
  const r = size / 2 - stroke
  const c = 2 * Math.PI * r
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill={COLOR.card} stroke={COLOR.line} strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - left / total)} transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.42, fontWeight: 800, color: COLOR.navy }}>{n}</div>
    </div>
  )
}

// ── 단어 시간 짝짓기 ──────────────────────────────────────

const wordKey = (s: string) => s.toLowerCase().replace(/[’]/g, "'").replace(/[^a-z0-9']/g, '')

/** 화면 단어 목록 ↔ 읽은 단어 순서대로 짝짓기 (못 찾으면 null) */
export function matchTimes(display: string[], spoken: TimedWord[] | null | undefined): (TimedWord | null)[] {
  if (!spoken?.length) return display.map(() => null)
  let j = 0
  return display.map((d) => {
    const key = wordKey(d)
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

export function isActive(times: (TimedWord | null)[], i: number, now: number): boolean {
  const t = times[i]
  if (!t) return false
  const next = times.slice(i + 1).find(Boolean)
  return now >= t.startMs - 40 && now < Math.max(t.endMs, (next?.startMs ?? t.endMs) - 40)
}

// ── 따라 할 문장 (강세 굵게, 연음 밑줄 + 발음 힌트, 읽는 단어 하이라이트) ──

export function RepeatSentence({
  data,
  fontSize,
  words,
  hintSize,
  align = 'left',
  style,
}: {
  data: RepeatData
  fontSize: number
  /** 지금 읽고 있는 회차의 단어 시간 */
  words: TimedWord[] | null
  hintSize: number
  align?: 'left' | 'center'
  style?: CSSProperties
}) {
  const now = useNowMs()
  const pieces = repeatPieces(data)
  // 조각 → 단어 (조각 안 단어를 차례로 번호 매김)
  const flat: { text: string; piece: number }[] = []
  pieces.forEach((p, pi) => p.text.split(/\s+/).filter(Boolean).forEach((w) => flat.push({ text: w, piece: pi })))
  const times = matchTimes(flat.map((f) => f.text), words)
  let wi = 0
  const hasHints = pieces.some((p) => p.link)
  return (
    <div style={{ fontFamily: FONT.english, fontSize, lineHeight: hasHints ? 1.95 : 1.4, color: COLOR.text, letterSpacing: -0.5, textAlign: align, ...style }}>
      {pieces.map((p, pi) => {
        const ws = p.text.split(/(\s+)/)
        const inner = ws.map((w, k) => {
          if (!w.trim()) return <span key={k}>{w}</span>
          const idx = wi++
          const on = isActive(times, idx, now)
          return (
            <span key={k} style={{ position: 'relative', display: 'inline-block' }}>
              <span style={{ position: 'absolute', inset: '-0.02em -0.1em', borderRadius: 12, background: on ? COLOR.goldSoft : 'transparent' }} />
              <span style={{ position: 'relative' }}>{w}</span>
            </span>
          )
        })
        const weight = p.stress ? 800 : 500
        if (p.link) {
          return (
            <span key={pi} style={{ position: 'relative', display: 'inline-block', fontWeight: weight, color: COLOR.indigoDeep }}>
              {inner}
              <span style={{ position: 'absolute', left: 0, right: 0, bottom: '0.42em', height: Math.max(5, fontSize * 0.06), borderRadius: 4, background: COLOR.indigo }} />
              <span style={{ position: 'absolute', left: '50%', top: '78%', transform: 'translateX(-50%)', whiteSpace: 'nowrap', fontFamily: FONT.family, fontSize: hintSize, fontWeight: 700, color: COLOR.indigo, lineHeight: 1 }}>
                {p.link}
              </span>
            </span>
          )
        }
        return (
          <span key={pi} style={{ fontWeight: weight, color: p.stress ? COLOR.navyDeep : COLOR.text }}>
            {inner}
          </span>
        )
      })}
    </div>
  )
}

// ── 패턴 공식 (빈칸 = 인디고 박스) ─────────────────────────

export function PatternFormula({ pattern, slot, fontSize, progress, style }: { pattern: string; slot?: string; fontSize: number; progress: number; style?: CSSProperties }) {
  const parts = splitPattern(pattern)
  const boxP = interpolate(progress, [0.4, 1], [0, 1], clamp)
  const nodes: ReactNode[] = []
  parts.forEach((part, i) => {
    // 빈칸 바로 뒤 문장부호(?.!,)는 박스에 붙여 줄바꿈되지 않게
    const lead = i > 0 ? (part.match(/^\s*[?.!,]+/)?.[0] ?? '') : ''
    const rest = part.slice(lead.length).trim()
    if (i > 0) {
      nodes.push(
        <span key={`b${i}`} style={{ display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap', gap: '0.08em' }}>
          <span
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: fontSize * 2.2, padding: `${fontSize * 0.08}px ${fontSize * 0.3}px`,
              borderRadius: fontSize * 0.2, background: COLOR.indigo, color: '#FFFFFF', fontFamily: FONT.family,
              fontSize: Math.max(fontSize * 0.55, 40), fontWeight: 800, letterSpacing: -0.5, transform: `scale(${0.7 + 0.3 * boxP})`, opacity: boxP,
            }}
          >
            {slot || '~'}
          </span>
          {lead.trim() ? <span>{lead.trim()}</span> : null}
        </span>,
      )
    }
    if (rest) nodes.push(<span key={`t${i}`}>{rest}</span>)
  })
  return (
    <div style={{ fontFamily: FONT.english, fontSize, fontWeight: 800, color: COLOR.navyDeep, letterSpacing: -1.5, lineHeight: 1.3, display: 'flex', flexWrap: 'wrap', alignItems: 'center', columnGap: '0.25em', rowGap: 12, ...style }}>
      {nodes}
    </div>
  )
}

/** 한국어 의미 — "~"를 작은 인디고 박스로 */
export function MeaningText({ text, fontSize, style }: { text: string; fontSize: number; style?: CSSProperties }) {
  const parts = text.split(/(~+)/)
  return (
    <div style={{ fontSize, fontWeight: 700, color: COLOR.text, letterSpacing: -1, lineHeight: 1.35, ...style }}>
      {parts.map((p, i) =>
        /^~+$/.test(p) ? (
          <span key={i} style={{ display: 'inline-block', width: fontSize * 1.3, height: fontSize * 0.8, borderRadius: 10, background: COLOR.indigoSoft, border: `3px solid ${COLOR.indigo}`, verticalAlign: '-0.08em', margin: '0 0.12em' }} />
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </div>
  )
}

/** 문장 속 패턴 고정 부분을 인디고로 */
export function PatternHighlighted({ text, pattern, color = COLOR.indigo }: { text: string; pattern: string | null; color?: string }): ReactNode {
  if (!pattern) return text
  const ranges = patternRanges(text, pattern)
  if (!ranges.length) return text
  const out: ReactNode[] = []
  let pos = 0
  ranges.forEach(([a, b], i) => {
    if (a < pos) return
    if (a > pos) out.push(<span key={`t${i}`}>{text.slice(pos, a)}</span>)
    out.push(<span key={`p${i}`} style={{ color, fontWeight: 800 }}>{text.slice(a, b)}</span>)
    pos = b
  })
  if (pos < text.length) out.push(<span key="end">{text.slice(pos)}</span>)
  return out
}

/** 단계가 올라오는 진행도 — 등장 시간이 NaN이면 0 */
export function useAt(atMs: number | undefined, delayMs = 0): number {
  return useAppear(atMs ?? Number.NaN, { delayMs })
}

/** 영어 문장 — 읽는 단어 하이라이트 + 패턴 고정 부분 인디고 */
export function SpokenLine({
  text,
  words,
  pattern,
  activeBg = COLOR.goldSoft,
  patternColor = COLOR.indigo,
  style,
}: {
  text: string
  words: TimedWord[] | null | undefined
  pattern?: string | null
  activeBg?: string
  patternColor?: string
  style?: CSSProperties
}) {
  const now = useNowMs()
  const ranges = pattern ? patternRanges(text, pattern) : []
  const tokens: { text: string; start: number }[] = []
  const re = /\S+/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) tokens.push({ text: m[0], start: m.index })
  const times = matchTimes(tokens.map((t) => t.text), words)
  return (
    <span style={style}>
      {tokens.map((t, i) => {
        const inPattern = ranges.some(([a, b]) => t.start < b && t.start + t.text.length > a)
        const on = isActive(times, i, now)
        return (
          <span key={i} style={{ position: 'relative', display: 'inline-block', marginRight: i < tokens.length - 1 ? '0.26em' : 0, color: inPattern ? patternColor : undefined, fontWeight: inPattern ? 800 : undefined }}>
            <span style={{ position: 'absolute', inset: '-0.02em -0.1em', borderRadius: 10, background: on ? activeBg : 'transparent' }} />
            <span style={{ position: 'relative' }}>{t.text}</span>
          </span>
        )
      })}
    </span>
  )
}
