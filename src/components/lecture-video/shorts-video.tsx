// 유튜브 숏폼 컴포지션 (1080×1920, 30fps) — 일상회화 패턴 1개
// 훅 → 패턴 → 예문 3개 → 따라하기 1회 → 채널 안내. 자막(단어 하이라이트)은 화면 중앙 상단에 늘 입힌다.
// 안전영역: 아래 20%·오른쪽 버튼 줄에는 글을 두지 않는다 (SHORTS_SAFE).

import { useMemo } from 'react'
import { AbsoluteFill, Html5Audio, interpolate } from 'remotion'
import { buildCaptionChunks, timeWords, type CaptionChunk } from '../../lib/lecture-pipeline/shorts'
import { layoutTimeline, slideStepTimes, sentenceKey, type TimedWord } from '../../lib/lecture-pipeline/timing'
import { WEBSITE, type CtaData, type ExamplesData, type HookData, type PatternData, type RepeatData, type Slide } from '../../lib/lecture-pipeline/types'
import { usePretendard } from './fonts'
import { BrandMark, Chip, SlideContext, rise, useAppear, useNowMs, useSlide, useStep, type SlideCtx } from './parts'
import { CountdownRing, MeaningText, MicIcon, PatternFormula, RepeatSentence, SpeakerIcon, SpokenLine } from './practice'
import type { ShortsVideoProps } from './props'
import { COLOR, FONT, SHORTS, SHORTS_SAFE } from './theme'

const W = SHORTS.width - SHORTS_SAFE.left - SHORTS_SAFE.right
/** 자막 영역 (중앙 상단) */
const CAPTION = { top: 250, height: 270 } as const
/** 화면 내용 영역 — 자막 아래부터 안전영역 위까지 */
const CONTENT = { top: 580, bottom: SHORTS.height - SHORTS_SAFE.bottom - 40 } as const
const FADE_MS = 220
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const

// ── 자막 ──────────────────────────────────────────────────

function Caption({ chunks, hidden }: { chunks: CaptionChunk[]; hidden: Set<string> }) {
  const now = useNowMs()
  const chunk = chunks.find((c) => now >= c.startMs && now < c.endMs && !hidden.has(c.slideId))
  if (!chunk) return null
  const en = chunk.lang === 'en'
  const pop = interpolate(now, [chunk.startMs, chunk.startMs + 120], [0.94, 1], clamp)
  return (
    <div style={{ position: 'absolute', left: SHORTS_SAFE.left, width: W, top: CAPTION.top, height: CAPTION.height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div
        style={{
          transform: `scale(${pop})`, maxWidth: W, padding: '18px 34px', borderRadius: 26, background: 'rgba(14, 22, 56, 0.92)',
          color: '#FFFFFF', textAlign: 'center', fontFamily: en ? FONT.english : FONT.family, fontSize: en ? 70 : 74, fontWeight: 800,
          lineHeight: 1.28, letterSpacing: en ? -0.5 : -1.5, wordBreak: 'keep-all',
        }}
      >
        {chunk.words.map((w, i) => {
          const on = now >= w.startMs - 30 && now < Math.max(w.endMs, (chunk.words[i + 1]?.startMs ?? w.endMs) - 30)
          const said = now >= w.endMs
          return (
            <span key={i} style={{ display: 'inline-block', marginRight: i < chunk.words.length - 1 ? '0.26em' : 0, color: on ? COLOR.gold : said ? '#FFFFFF' : 'rgba(255,255,255,0.72)', transform: on ? 'scale(1.06)' : undefined }}>
              {w.text}
            </span>
          )
        })}
      </div>
    </div>
  )
}

// ── 슬라이드 5종 ──────────────────────────────────────────

/** 훅 질문은 그 자체가 자막 — 읽는 단어를 금색으로 */
export function ShortsHook({ data }: { data: HookData }) {
  const { startMs, segments } = useSlide()
  const now = useNowMs()
  const seg = segments.find((s) => s.lang === 'ko' && !s.wait)
  const words = seg ? timeWords(data.question, seg.startMs, seg.endMs, seg.words) : []
  // 첫 프레임부터 보이게 (시선 잡기) — 살짝 커지며 등장
  const pop = interpolate(now, [startMs, startMs + 200], [0.9, 1], clamp)
  const sub = useAppear(startMs + 500)
  const q = useAppear(startMs + 900, { durationFrames: 10 })
  const wobble = 1 + 0.05 * Math.sin(now / 160) * q
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 70 }}>
      <div style={{ transform: `scale(${pop})`, minHeight: CAPTION.height, display: 'flex', alignItems: 'center', fontSize: fit(data.question, 88, 22), fontWeight: 800, color: COLOR.navyDeep, textAlign: 'center', lineHeight: 1.25, letterSpacing: -2, wordBreak: 'keep-all' }}>
        <div>
          {words.length
            ? words.map((w, i) => {
                const on = now >= w.startMs - 30 && now < Math.max(w.endMs, (words[i + 1]?.startMs ?? w.endMs) - 30)
                return (
                  <span key={i} style={{ position: 'relative', display: 'inline-block', marginRight: i < words.length - 1 ? '0.26em' : 0, color: on ? COLOR.indigo : undefined }}>
                    <span style={{ position: 'absolute', inset: '0.05em -0.08em', borderRadius: 12, background: on ? COLOR.goldSoft : 'transparent' }} />
                    <span style={{ position: 'relative' }}>{w.text}</span>
                  </span>
                )
              })
            : data.question}
        </div>
      </div>
      <div style={{ width: 380, height: 380, borderRadius: 190, background: COLOR.gold, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `scale(${pop * wobble})`, marginTop: 40 }}>
        <span style={{ fontSize: 270, fontWeight: 900, color: COLOR.navyDeep, lineHeight: 1 }}>?</span>
      </div>
      {data.sub ? <div style={{ ...rise(sub), fontSize: 56, fontWeight: 800, color: COLOR.indigo, textAlign: 'center' }}>{data.sub}</div> : null}
    </div>
  )
}

export function ShortsPattern({ data }: { data: PatternData }) {
  const { startMs } = useSlide()
  const chip = useAppear(startMs + 80)
  const formula = useStep(1)
  const meaning = useStep(2)
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 56 }}>
      <div style={rise(chip, 16)}><Chip style={{ fontSize: 46, padding: '12px 32px' }}>오늘의 패턴</Chip></div>
      <div style={{ ...rise(formula, 30), padding: '44px 40px', borderRadius: 32, background: COLOR.card, border: `5px solid ${COLOR.indigo}` }}>
        <PatternFormula pattern={data.pattern} slot={data.slot} fontSize={fit(data.pattern, 104, 12)} progress={formula} />
      </div>
      <div style={rise(meaning)}>
        <MeaningText text={data.ko} fontSize={fit(data.ko, 76, 11)} style={{ color: COLOR.indigoDeep }} />
      </div>
    </div>
  )
}

export function ShortsExamples({ data }: { data: ExamplesData }) {
  const { script, segments } = useSlide()
  const now = useNowMs()
  const pattern = script.slides.find((s): s is Extract<Slide, { type: 'pattern' }> => s.type === 'pattern')?.data.pattern ?? null
  const textById = new Map(script.segments.map((g) => [g.id, g.text]))
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 34 }}>
      {data.examples.map((e, i) => {
        const seg = segments.find((s) => s.lang === 'en' && sentenceKey(textById.get(s.id) ?? '') === sentenceKey(e.en))
        const next = segments.find((s) => seg && s.lang === 'en' && s.startMs > seg.startMs)
        const current = !!seg && now >= seg.startMs && now < (next?.startMs ?? Infinity)
        return <ExampleCard key={i} k={i + 1} en={e.en} ko={e.ko} pattern={pattern} current={current} words={seg?.words ?? null} />
      })}
    </div>
  )
}

function ExampleCard({ k, en, ko, pattern, current, words }: { k: number; en: string; ko: string; pattern: string | null; current: boolean; words: TimedWord[] | null }) {
  const p = useStep(k)
  return (
    <div style={{ ...rise(p, 40), display: 'flex', gap: 24, padding: '28px 32px', borderRadius: 28, background: COLOR.card, border: `5px solid ${current ? COLOR.indigo : COLOR.line}`, opacity: p * (current || p < 1 ? 1 : 0.92) }}>
      <div style={{ width: 64, height: 64, borderRadius: 32, background: current ? COLOR.indigo : COLOR.indigoSoft, color: current ? '#FFFFFF' : COLOR.indigo, fontSize: 38, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{k}</div>
      <div>
        <SpokenLine text={en} words={words} pattern={pattern} style={{ fontFamily: FONT.english, fontSize: fit(en, 64, 24), fontWeight: 700, color: COLOR.text, lineHeight: 1.25 }} />
        <div style={{ marginTop: 8, fontSize: 50, fontWeight: 600, color: COLOR.muted }}>{ko}</div>
      </div>
    </div>
  )
}

export function ShortsRepeat({ data }: { data: RepeatData }) {
  const { segments, startMs } = useSlide()
  const now = useNowMs()
  const round = segments.find((s) => s.type === 'repeat')
  const listening = !!round && now >= round.startMs && now < round.endMs
  const pausing = !!round?.pauseEndMs && now >= round.endMs && now < round.pauseEndMs
  const done = !!round?.pauseEndMs && now >= round.pauseEndMs
  const head = useAppear(startMs + 80)
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 50 }}>
      <div style={rise(head, 16)}><Chip color="#FFFFFF" bg={COLOR.indigo} style={{ fontSize: 46, padding: '12px 32px' }}>따라하기</Chip></div>
      <div style={{ ...rise(head), padding: '40px 36px', borderRadius: 32, background: COLOR.card, border: `5px solid ${pausing ? COLOR.indigo : COLOR.line}` }}>
        <RepeatSentence data={data} fontSize={fit(data.sentence, 84, 18)} hintSize={46} words={listening ? round?.words ?? null : null} />
        <div style={{ marginTop: data.links?.length ? 40 : 10, fontSize: 48, fontWeight: 600, color: COLOR.muted }}>{data.ko}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 30, minHeight: 190 }}>
        {pausing && round?.pauseEndMs ? (
          <>
            <MicIcon size={150} active />
            <div style={{ flex: 1, fontSize: 64, fontWeight: 800, color: COLOR.indigoDeep, letterSpacing: -1.5, lineHeight: 1.2 }}>따라 해보세요 🎤</div>
            <CountdownRing startMs={round.endMs} endMs={round.pauseEndMs} size={170} />
          </>
        ) : done ? (
          <div style={{ fontSize: 66, fontWeight: 800, color: COLOR.green }}>잘했어요! 👏</div>
        ) : (
          <>
            <SpeakerIcon size={150} active={listening} />
            <div style={{ fontSize: 60, fontWeight: 700, color: COLOR.navy }}>잘 들어 보세요</div>
          </>
        )}
      </div>
    </div>
  )
}

export function ShortsCTA({ data }: { data: CtaData }) {
  const { startMs } = useSlide()
  const msg = useAppear(startMs + 80)
  const card = useAppear(startMs + 400)
  const btn = useAppear(startMs + 800)
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 46 }}>
      <div style={{ ...rise(msg), fontSize: 84, fontWeight: 800, color: COLOR.navyDeep, letterSpacing: -2, lineHeight: 1.2, wordBreak: 'keep-all' }}>{data.message || WEBSITE.cta}</div>
      <div style={{ ...rise(card), padding: '36px 38px', borderRadius: 30, background: COLOR.indigo, color: '#FFFFFF' }}>
        <div style={{ fontSize: 42, fontWeight: 700, opacity: 0.85 }}>본 강의</div>
        <div style={{ fontSize: fit(data.lectureTitle, 72, 11), fontWeight: 800, letterSpacing: -1.5, marginTop: 6 }}>{data.lectureTitle}</div>
        <div style={{ fontSize: 50, fontWeight: 800, color: COLOR.goldSoft, marginTop: 18, letterSpacing: -0.5 }}>{WEBSITE.host}</div>
      </div>
      <div style={{ ...rise(btn), display: 'flex', alignItems: 'center', gap: 24 }}>
        <BrandMark size={84} />
        <div style={{ fontSize: 52, fontWeight: 800, color: COLOR.navy }}>WeGoUp <span style={{ color: COLOR.indigo }}>English</span></div>
      </div>
    </div>
  )
}

function ShortsSlideView({ slide }: { slide: Slide }) {
  switch (slide.type) {
    case 'hook': return <ShortsHook data={slide.data} />
    case 'pattern': return <ShortsPattern data={slide.data} />
    case 'examples': return <ShortsExamples data={slide.data} />
    case 'repeat': return <ShortsRepeat data={slide.data} />
    case 'cta': return <ShortsCTA data={slide.data} />
    default: return null
  }
}

/** 글이 길면 줄이기 (숏폼은 최소 44px) */
function fit(text: string, base: number, fitChars: number): number {
  const len = Array.from(text).length
  return len <= fitChars ? base : Math.max(44, Math.round((base * fitChars) / len))
}

// ── 컴포지션 ──────────────────────────────────────────────

function Frame({ slide, ctx, last, first }: { slide: Slide; ctx: SlideCtx; last: boolean; first: boolean }) {
  const now = useNowMs()
  const fadeIn = first ? 1 : interpolate(now, [ctx.startMs, ctx.startMs + FADE_MS], [0, 1], clamp)
  const fadeOut = last ? 1 : interpolate(now, [ctx.endMs - FADE_MS / 2, ctx.endMs], [1, 0], clamp)
  return (
    <SlideContext.Provider value={ctx}>
      <div style={{ position: 'absolute', left: SHORTS_SAFE.left, width: W, top: slide.type === 'hook' ? CAPTION.top : CONTENT.top, height: CONTENT.bottom - (slide.type === 'hook' ? CAPTION.top : CONTENT.top), opacity: Math.min(fadeIn, fadeOut) }}>
        <ShortsSlideView slide={slide} />
      </div>
    </SlideContext.Provider>
  )
}

export function ShortsVideo({ script, timeline: given, audioUrl }: ShortsVideoProps) {
  usePretendard()
  const now = useNowMs()
  const timeline = useMemo(() => given ?? layoutTimeline(script), [given, script])
  const chunks = useMemo(() => buildCaptionChunks(script, timeline), [script, timeline])
  const slides = useMemo(
    () =>
      timeline.slides.flatMap((r) => {
        const slide = script.slides.find((s) => s.id === r.id)
        if (!slide) return []
        const ctx: SlideCtx = { script, timeline, startMs: r.startMs, endMs: r.endMs, stepTimes: slideStepTimes(slide, script, timeline), segments: timeline.segments.filter((s) => s.slideId === r.id) }
        return [{ slide, ctx }]
      }),
    [script, timeline],
  )
  const progress = Math.min(1, now / Math.max(1, timeline.totalMs))
  const hookIds = useMemo(() => new Set(script.slides.filter((s) => s.type === 'hook').map((s) => s.id)), [script])
  return (
    <AbsoluteFill style={{ backgroundColor: COLOR.bg, fontFamily: FONT.family, color: COLOR.text }}>
      {/* 위쪽 진행 막대 + 브랜드 (글이 아닌 표시라 안전영역 밖도 괜찮지만 아이콘 줄은 피함) */}
      <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 10, background: COLOR.line }}>
        <div style={{ width: `${progress * 100}%`, height: '100%', background: COLOR.indigo }} />
      </div>
      <div style={{ position: 'absolute', left: SHORTS_SAFE.left, top: SHORTS_SAFE.top, display: 'flex', alignItems: 'center', gap: 14 }}>
        <BrandMark size={52} />
        <span style={{ fontSize: 38, fontWeight: 800, color: COLOR.navy, letterSpacing: -0.5 }}>
          WeGoUp <span style={{ color: COLOR.indigo }}>English</span>
        </span>
      </div>
      {slides.map(({ slide, ctx }, i) =>
        now >= ctx.startMs && now < ctx.endMs + 1 ? <Frame key={slide.id} slide={slide} ctx={ctx} first={i === 0} last={i === slides.length - 1} /> : null,
      )}
      <Caption chunks={chunks} hidden={hookIds} />
      {audioUrl ? <Html5Audio src={audioUrl} /> : null}
    </AbsoluteFill>
  )
}
