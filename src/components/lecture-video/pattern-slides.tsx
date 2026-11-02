// 본 강의 일상영어회화 슬라이드 3종 — PatternSlide(패턴 공식), DialogueSlide(A/B 대화), RepeatSlide(따라하기)
// 모든 등장은 타임라인(음성) 시간 기준. 따라하기 대기 구간은 timeline의 pauseEndMs.

import { spring, useCurrentFrame, useVideoConfig } from 'remotion'
import type { DialogueData, PatternData, RepeatData } from '../../lib/lecture-pipeline/types'
import type { TimelineSegment } from '../../lib/lecture-pipeline/timing'
import { patternForSlide } from '../../lib/lecture-pipeline/patterns'
import { Chip, Header, rise, useNowMs, useSlide, useStep } from './parts'
import { CountdownRing, MeaningText, MicIcon, PatternFormula, RepeatSentence, SpeakerIcon, SpokenLine } from './practice'
import { COLOR, FONT, fitSize } from './theme'

// ── 패턴 ──────────────────────────────────────────────────

export function PatternSlide({ data }: { data: PatternData }) {
  const { script, segments } = useSlide()
  const formula = useStep(1)
  const meaning = useStep(2)
  const examples = data.examples ?? []
  const size = fitSize(data.pattern, 104, 16)
  const textById = new Map(script.segments.map((g) => [g.id, g.text]))
  const wordsFor = (en: string) => segments.find((s) => s.lang === 'en' && s.type !== 'pattern' && key(textById.get(s.id) ?? '') === key(en))?.words ?? null
  return (
    <div>
      <Header label="일상회화 패턴" chipColor={COLOR.indigoDeep} />
      <div style={{ ...rise(formula, 30), marginTop: -16 }}>
        <PatternFormula pattern={data.pattern} slot={data.slot} fontSize={size} progress={formula} />
      </div>
      <div style={{ ...rise(meaning), display: 'flex', alignItems: 'center', gap: 24, marginTop: 30 }}>
        <MeaningText text={data.ko} fontSize={fitSize(data.ko, 64, 20)} style={{ color: COLOR.indigoDeep }} />
        {data.tip ? <Chip color={COLOR.muted} bg="#E8EAF2" style={{ fontSize: 48, padding: '8px 26px' }}>{data.tip}</Chip> : null}
      </div>
      <div style={{ marginTop: 40, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {examples.map((e, i) => (
          <PatternExampleRow key={i} en={e.en} ko={e.ko} k={i + 3} pattern={data.pattern} words={wordsFor(e.en)} />
        ))}
      </div>
    </div>
  )
}

const key = (s: string) => s.toLowerCase().replace(/[^a-z0-9']/g, '')
type Words = TimelineSegment['words'] | null

function PatternExampleRow({ en, ko, k, pattern, words }: { en: string; ko: string; k: number; pattern: string; words: Words }) {
  const p = useStep(k)
  return (
    <div style={{ ...rise(p), display: 'flex', alignItems: 'baseline', gap: 26, flexWrap: 'wrap', paddingLeft: 26, borderLeft: `8px solid ${COLOR.indigoSoft}` }}>
      <SpokenLine text={en} words={words} pattern={pattern} style={{ fontFamily: FONT.english, fontSize: fitSize(en, 58, 34), fontWeight: 700, color: COLOR.text }} />
      <span style={{ fontSize: 48, color: COLOR.muted, fontWeight: 500 }}>{ko}</span>
    </div>
  )
}

// ── 대화 ──────────────────────────────────────────────────

/** 한 화면에 보이는 말풍선 수 — 넘치면 위로 밀려 올라감 */
const MAX_VISIBLE = 3
const BUBBLE_STEP = 196

export function DialogueSlide({ data }: { data: DialogueData }) {
  const { script, segments, stepTimes, startMs } = useSlide()
  const now = useNowMs()
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const slideId = segments[0]?.slideId ?? ''
  const pattern = patternForSlide(script, slideId)?.pattern ?? null
  const lineSegs = segments.filter((s) => s.type === 'dialogue')
  // 지금까지 나온 말풍선 수 → 넘친 만큼 위로 (spring)
  const shown = stepTimes.filter((t) => now >= t).length
  let offset = 0
  stepTimes.forEach((t, i) => {
    if (i < MAX_VISIBLE) return
    const f = (t / 1000) * fps
    if (frame >= f) offset += spring({ frame: frame - f, fps, config: { damping: 200 }, durationInFrames: 14 }) * BUBBLE_STEP
  })
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginBottom: 30 }}>
        <Chip>대화</Chip>
        {data.situation ? <span style={{ fontSize: fitSize(data.situation, 52, 28), fontWeight: 700, color: COLOR.navy, letterSpacing: -1 }}>{data.situation}</span> : null}
      </div>
      <div style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>
        <div style={{ transform: `translateY(${-offset}px)` }}>
          {data.lines.map((l, i) => {
            const seg = lineSegs[i]
            const speaking = !!seg && now >= seg.startMs && now < seg.endMs + 150
            return <Bubble key={i} line={l} k={i + 1} speaking={speaking} words={seg?.words ?? null} pattern={pattern} visible={i < shown || now >= (stepTimes[i] ?? startMs)} />
          })}
        </div>
      </div>
    </div>
  )
}

function Bubble({ line, k, speaking, words, pattern, visible }: { line: DialogueData['lines'][number]; k: number; speaking: boolean; words: Words; pattern: string | null; visible: boolean }) {
  const p = useStep(k)
  const isA = line.speaker === 'A'
  const color = isA ? COLOR.teal : COLOR.indigo
  const soft = isA ? COLOR.tealSoft : COLOR.indigoSoft
  if (!visible && p === 0) return <div style={{ height: BUBBLE_STEP }} />
  return (
    <div style={{ height: BUBBLE_STEP, display: 'flex', flexDirection: isA ? 'row' : 'row-reverse', alignItems: 'flex-start', gap: 24, opacity: p, transform: `translateY(${(1 - p) * 30}px)` }}>
      <div style={{ width: 92, height: 92, borderRadius: 46, background: color, color: '#FFFFFF', fontSize: 50, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {line.speaker}
      </div>
      <div
        style={{
          maxWidth: 1240, padding: '18px 34px', borderRadius: 28, borderTopLeftRadius: isA ? 6 : 28, borderTopRightRadius: isA ? 28 : 6,
          background: speaking ? soft : COLOR.card, border: `4px solid ${speaking ? color : COLOR.line}`,
        }}
      >
        <SpokenLine text={line.en} words={words} pattern={pattern} activeBg={COLOR.goldSoft} style={{ fontFamily: FONT.english, fontSize: fitSize(line.en, 56, 40), fontWeight: 700, color: COLOR.text, lineHeight: 1.25 }} />
        {line.ko ? <div style={{ fontSize: 48, color: COLOR.muted, fontWeight: 500, marginTop: 2, lineHeight: 1.2 }}>{line.ko}</div> : null}
      </div>
    </div>
  )
}

// ── 따라하기 ──────────────────────────────────────────────

export function RepeatSlide({ data }: { data: RepeatData }) {
  const { segments, startMs, endMs } = useSlide()
  const now = useNowMs()
  const rounds = segments.filter((s) => s.type === 'repeat')
  // 지금 회차: 읽는 중이거나 대기 중인 회차, 아니면 가장 최근 회차
  const curIdx = rounds.reduce((acc, r, i) => (now >= r.startMs ? i : acc), -1)
  const cur = curIdx >= 0 ? rounds[curIdx] : null
  const pausing = !!cur?.pauseEndMs && now >= cur.endMs && now < cur.pauseEndMs
  const listening = !!cur && now >= cur.startMs && now < cur.endMs
  const done = rounds.length > 0 && now >= (rounds[rounds.length - 1].pauseEndMs ?? endMs)
  const head = rise(Math.min(1, Math.max(0, (now - startMs) / 300)))
  const speed = cur?.speed ?? rounds[0]?.speed ?? 0.85
  const roundLabel = cur ? `${curIdx + 1}회차 · ${speed < 1 ? '천천히' : '자연스럽게'} ${speed.toFixed(2).replace(/0$/, '')}배` : '잘 듣고 따라 해요'
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ ...head, display: 'flex', alignItems: 'center', gap: 20 }}>
        <Chip color="#FFFFFF" bg={COLOR.indigo}>따라하기</Chip>
        <Chip color={COLOR.navy} bg="#E8EAF2">{roundLabel}</Chip>
        {rounds.map((r, i) => (
          <div key={i} style={{ width: 22, height: 22, borderRadius: 11, background: i <= curIdx ? COLOR.indigo : COLOR.line }} />
        ))}
      </div>
      <div style={{ ...head, marginTop: 56 }}>
        <RepeatSentence data={data} fontSize={fitSize(data.sentence, 92, 26)} hintSize={48} words={listening ? cur?.words ?? null : null} />
        <div style={{ marginTop: data.links?.length ? 44 : 14, fontSize: fitSize(data.ko, 54, 30), color: COLOR.muted, fontWeight: 500 }}>{data.ko}</div>
      </div>
      <div style={{ flex: 1 }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 40, minHeight: 190 }}>
        {pausing && cur?.pauseEndMs ? (
          <>
            <MicIcon size={150} active />
            <div style={{ marginLeft: 30, fontSize: 72, fontWeight: 800, color: COLOR.indigoDeep, letterSpacing: -1.5 }}>따라 해보세요 🎤</div>
            <div style={{ flex: 1 }} />
            <CountdownRing startMs={cur.endMs} endMs={cur.pauseEndMs} size={180} />
          </>
        ) : done ? (
          <div style={{ fontSize: 64, fontWeight: 800, color: COLOR.green }}>잘했어요! 👏</div>
        ) : (
          <>
            <SpeakerIcon size={150} active={listening} />
            <div style={{ fontSize: 60, fontWeight: 700, color: COLOR.navy }}>{listening ? '잘 들어 보세요' : '곧 원어민이 읽어요'}</div>
          </>
        )}
      </div>
    </div>
  )
}
