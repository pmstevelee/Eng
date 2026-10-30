// 슬라이드 10종 — 모든 등장은 음성 타임스탬프(단계 시간)에 맞춘다. spring/ease만 쓰고 회전·튀는 효과는 쓰지 않는다.

import { interpolate } from 'remotion'
import type {
  CompareData, ConceptData, ExampleData, FormulaData, GoalData, MistakeData, OutroData, QuizData, Slide, SummaryData, TitleData,
} from '../../lib/lecture-pipeline/types'
import { joinTokens } from '../../lib/lecture-pipeline/types'
import { BrandMark, CheckIcon, Chip, Header, MarkedText, Mark, Sentence, rise, useAppear, useNowMs, useSlide, useStep } from './parts'
import { COLOR, FONT, ROLE_COLOR, fitSize } from './theme'

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const

// ── 제목 ──────────────────────────────────────────────────

function TitleSlide({ data }: { data: TitleData }) {
  const { startMs } = useSlide()
  const logo = useAppear(startMs + 100)
  const title = useAppear(startMs + 350)
  const sub = useAppear(startMs + 650)
  const bar = useAppear(startMs + 850, { durationFrames: 24 })
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingBottom: 60 }}>
      <div style={{ ...rise(logo, 16), display: 'flex', alignItems: 'center', gap: 20, marginBottom: 64 }}>
        <BrandMark size={72} />
        <span style={{ fontSize: 52, fontWeight: 800, color: COLOR.navy, letterSpacing: -1 }}>
          WeGoUp <span style={{ color: COLOR.indigo }}>English</span>
        </span>
        {data.series ? <Chip style={{ marginLeft: 16, fontSize: 48 }}>{data.series}</Chip> : null}
      </div>
      <div style={{ ...rise(title, 40), fontSize: fitSize(data.title, 140, 12), fontWeight: 800, color: COLOR.navyDeep, letterSpacing: -3, lineHeight: 1.12 }}>{data.title}</div>
      <div style={{ height: 14, width: 420 * bar, background: COLOR.indigo, borderRadius: 8, margin: '44px 0 36px' }} />
      {data.subtitle ? (
        <div style={{ ...rise(sub, 24), fontFamily: FONT.english, fontSize: 64, fontWeight: 600, color: COLOR.indigo, letterSpacing: -1 }}>{data.subtitle}</div>
      ) : null}
    </div>
  )
}

// ── 학습목표 ──────────────────────────────────────────────

function GoalRow({ text, k }: { text: string; k: number }) {
  const p = useStep(k)
  const check = useStep(k, 350)
  return (
    <div style={{ ...rise(p, 0), transform: `translateX(${(1 - p) * 40}px)`, display: 'flex', alignItems: 'center', gap: 32, marginBottom: 34 }}>
      <div
        style={{
          width: 68, height: 68, borderRadius: 16, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: `4px solid ${COLOR.indigo}`, background: check > 0.05 ? COLOR.indigo : COLOR.card,
        }}
      >
        <CheckIcon progress={check} size={48} />
      </div>
      <div style={{ fontSize: fitSize(text, 60, 26), fontWeight: 600, color: COLOR.text, letterSpacing: -1 }}>{text}</div>
    </div>
  )
}

function GoalSlide({ data }: { data: GoalData }) {
  return (
    <div>
      <Header label="오늘의 학습목표" title={data.heading} />
      {data.goals.map((g, i) => <GoalRow key={i} text={g} k={i + 1} />)}
    </div>
  )
}

// ── 핵심 개념 ─────────────────────────────────────────────

function ConceptLine({ text, k }: { text: string; k: number }) {
  const p = useStep(k)
  return (
    <div style={{ ...rise(p), display: 'flex', gap: 28, alignItems: 'baseline', marginBottom: 40 }}>
      <div style={{ width: 18, height: 18, borderRadius: 9, background: COLOR.indigo, flexShrink: 0, transform: 'translateY(-8px)' }} />
      <MarkedText text={text} progress={p} style={{ fontSize: fitSize(text, 62, 30), fontWeight: 600, color: COLOR.text, lineHeight: 1.4, letterSpacing: -1 }} />
    </div>
  )
}

function ConceptSlide({ data }: { data: ConceptData }) {
  return (
    <div>
      <Header label="핵심 개념" title={data.heading} />
      {data.lines.map((l, i) => <ConceptLine key={i} text={l} k={i + 1} />)}
    </div>
  )
}

// ── 문장 공식 ─────────────────────────────────────────────

function FormulaBlockView({ block, k, first }: { block: FormulaData['blocks'][number]; k: number; first: boolean }) {
  const p = useStep(k)
  const c = block.role ? ROLE_COLOR[block.role] : { fg: COLOR.navy, bg: '#E8EAF2' }
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', opacity: p }}>
      {!first ? <div style={{ fontSize: 72, fontWeight: 700, color: COLOR.muted, margin: '14px 22px 0' }}>+</div> : null}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', transform: `translateY(${(1 - p) * -70}px)` }}>
        <div style={{ padding: '22px 40px', borderRadius: 22, background: c.bg, border: `4px solid ${c.fg}`, color: c.fg, fontSize: fitSize(block.text, 64, 9), fontWeight: 800, letterSpacing: -1, whiteSpace: 'nowrap' }}>
          {block.text}
        </div>
        {block.note ? <div style={{ marginTop: 16, fontSize: 48, color: COLOR.muted, fontWeight: 600 }}>{block.note}</div> : null}
      </div>
    </div>
  )
}

function FormulaSlide({ data }: { data: FormulaData }) {
  const exampleStep = data.blocks.length + 1
  const ex = useStep(exampleStep)
  return (
    <div>
      <Header label="문장 공식" title={data.heading} />
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', rowGap: 24, marginBottom: 70 }}>
        {data.blocks.map((b, i) => <FormulaBlockView key={i} block={b} k={i + 1} first={i === 0} />)}
      </div>
      {data.example?.length ? (
        <div style={{ ...rise(ex), paddingLeft: 32, borderLeft: `8px solid ${COLOR.indigoSoft}` }}>
          <Sentence tokens={data.example} fontSize={fitSize(joinTokens(data.example), 68, 34)} progress={ex} style={{ opacity: 1, transform: 'none' }} />
          {data.exampleKo ? <div style={{ marginTop: 14, fontSize: 50, color: COLOR.muted, fontWeight: 500 }}>{data.exampleKo}</div> : null}
        </div>
      ) : null}
    </div>
  )
}

// ── 예문 ──────────────────────────────────────────────────

function ExampleSlide({ data }: { data: ExampleData }) {
  const s = useStep(1)
  const ko = useStep(2)
  const note = useStep(2, 500)
  const sentence = joinTokens(data.sentence)
  return (
    <div>
      <Header label="예문" title={data.heading} />
      <div style={{ marginTop: data.heading ? 40 : 130 }}>
        <Sentence tokens={data.sentence} fontSize={fitSize(sentence, 92, 26)} progress={s} />
        <div style={{ ...rise(ko), marginTop: 40, fontSize: fitSize(data.ko, 58, 30), color: COLOR.muted, fontWeight: 500, letterSpacing: -1 }}>{data.ko}</div>
        {data.note ? (
          <div style={{ ...rise(note), marginTop: 48 }}>
            <Chip style={{ fontSize: 48, padding: '14px 32px' }}>{data.note}</Chip>
          </div>
        ) : null}
      </div>
    </div>
  )
}

// ── 맞는 문장 vs 틀린 문장 ────────────────────────────────

function CompareRowView({ row, k }: { row: CompareData['rows'][number]; k: number }) {
  const p = useStep(k)
  const mark = useStep(k, 450)
  const color = row.correct ? COLOR.green : COLOR.red
  const border = interpolate(mark, [0, 1], [0, 1], clamp)
  return (
    <div
      style={{
        ...rise(p), display: 'flex', alignItems: 'center', gap: 40, padding: '30px 44px', marginBottom: 32, borderRadius: 24,
        background: COLOR.card, border: `4px solid ${border > 0.5 ? color : COLOR.line}`,
      }}
    >
      <div style={{ flexShrink: 0 }}><Mark ok={row.correct} progress={mark} size={104} /></div>
      <div>
        <Sentence tokens={row.sentence} fontSize={fitSize(joinTokens(row.sentence), 70, 30)} progress={p} colorRoles style={{ opacity: 1, transform: 'none' }} />
        {row.ko ? <div style={{ marginTop: 8, fontSize: 48, color: row.correct ? COLOR.muted : COLOR.red, fontWeight: 500 }}>{row.ko}</div> : null}
      </div>
    </div>
  )
}

function CompareSlide({ data }: { data: CompareData }) {
  return (
    <div>
      <Header label="맞는 문장 vs 틀린 문장" title={data.heading} />
      {data.rows.map((r, i) => <CompareRowView key={i} row={r} k={i + 1} />)}
    </div>
  )
}

// ── 자주 하는 실수 ────────────────────────────────────────

function MistakeSlide({ data }: { data: MistakeData }) {
  const wrong = useStep(1)
  const strike = useStep(1, 700)
  const right = useStep(2)
  const why = useStep(3)
  const rightMark = useStep(2, 300)
  return (
    <div>
      <Header label="자주 하는 실수" title={data.heading} chipColor={COLOR.red} chipBg={COLOR.redSoft} />
      <div style={{ ...rise(wrong), display: 'flex', alignItems: 'center', gap: 28 }}>
        <Mark ok={false} progress={strike} size={84} />
        <Sentence tokens={[{ text: data.wrong }]} fontSize={fitSize(data.wrong, 70, 30)} progress={1} strike={strike} style={{ color: COLOR.muted }} />
      </div>
      <div style={{ opacity: right, margin: '18px 0 18px 26px' }}>
        <svg width="40" height="64" viewBox="0 0 40 64"><path d="M20 4 V54 M6 40 L20 56 L34 40" stroke={COLOR.muted} strokeWidth="6" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </div>
      <div style={{ ...rise(right), display: 'flex', alignItems: 'center', gap: 28 }}>
        <Mark ok progress={rightMark} size={84} />
        <Sentence tokens={data.right} fontSize={fitSize(joinTokens(data.right), 70, 30)} progress={right} style={{ opacity: 1, transform: 'none' }} />
      </div>
      <div style={{ ...rise(why), marginTop: 48, padding: '22px 34px', borderRadius: 20, background: COLOR.goldSoft, fontSize: fitSize(data.why, 54, 32), fontWeight: 600, color: COLOR.text, display: 'inline-block' }}>
        {data.why}
      </div>
    </div>
  )
}

// ── 퀴즈 ──────────────────────────────────────────────────

function Countdown({ startMs, endMs }: { startMs: number; endMs: number }) {
  const now = useNowMs()
  const p = useAppear(startMs, { durationFrames: 10 })
  if (now < startMs || now > endMs + 300) return null
  const total = Math.max(1, endMs - startMs)
  const left = Math.max(0, endMs - now)
  const n = Math.ceil(left / 1000)
  const r = 92
  const c = 2 * Math.PI * r
  return (
    <div style={{ position: 'absolute', right: 0, top: 0, width: 240, height: 240, opacity: p }}>
      <svg width="240" height="240" viewBox="0 0 240 240">
        <circle cx="120" cy="120" r={r} fill={COLOR.card} stroke={COLOR.line} strokeWidth="16" />
        <circle cx="120" cy="120" r={r} fill="none" stroke={COLOR.gold} strokeWidth="16" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - left / total)} transform="rotate(-90 120 120)" />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 110, fontWeight: 800, color: COLOR.navy }}>{n}</div>
    </div>
  )
}

function QuizSlide({ data }: { data: QuizData }) {
  const { startMs, segments } = useSlide()
  const q = useAppear(startMs + 150)
  const choicesIn = useAppear(startMs + 600)
  const answer = useStep(1)
  const explain = useStep(1, 400)
  const wait = segments.find((s) => s.wait)
  const blank = data.sentence?.split(/_{2,}/) ?? null
  return (
    <div style={{ position: 'relative' }}>
      <Header label="QUIZ" chipColor="#8A5A00" chipBg={COLOR.goldSoft} />
      {wait ? <Countdown startMs={wait.startMs} endMs={wait.endMs} /> : null}
      <div style={{ ...rise(q), fontSize: fitSize(data.question, 62, 26), fontWeight: 700, color: COLOR.navy, letterSpacing: -1, maxWidth: 1340, lineHeight: 1.3 }}>{data.question}</div>
      {blank ? (
        <div style={{ ...rise(q), marginTop: 34, fontFamily: FONT.english, fontSize: fitSize(data.sentence ?? '', 76, 30), fontWeight: 700, color: COLOR.text }}>
          {blank.map((part, i) => (
            <span key={i}>
              {part}
              {i < blank.length - 1 ? (
                <span style={{ display: 'inline-block', minWidth: 200, margin: '0 10px', borderBottom: `6px solid ${answer > 0.5 ? COLOR.green : COLOR.navy}`, textAlign: 'center', color: COLOR.green }}>
                  {answer > 0.05 ? <span style={{ opacity: answer }}>{data.choices[data.answer]}</span> : ' '}
                </span>
              ) : null}
            </span>
          ))}
        </div>
      ) : null}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 28, marginTop: 52 }}>
        {data.choices.map((c, i) => {
          const ok = i === data.answer
          const on = answer > 0.05
          return (
            <div
              key={i}
              style={{
                ...rise(interpolate(choicesIn, [i * 0.12, Math.min(1, i * 0.12 + 0.7)], [0, 1], clamp)),
                display: 'flex', alignItems: 'center', gap: 18, padding: '18px 36px', borderRadius: 999,
                background: on && ok ? COLOR.green : COLOR.card, border: `4px solid ${on && ok ? COLOR.green : COLOR.line}`,
                color: on && ok ? '#FFFFFF' : COLOR.text, opacity: on && !ok ? 1 - answer * 0.55 : undefined,
                fontFamily: FONT.english, fontSize: fitSize(c, 56, 16), fontWeight: 700,
              }}
            >
              <span style={{ fontFamily: FONT.family, color: on && ok ? '#FFFFFF' : COLOR.indigo }}>{String.fromCharCode(65 + i)}</span>
              {c}
              {on && ok ? <CheckIcon progress={answer} size={44} /> : null}
            </div>
          )
        })}
      </div>
      {data.explanation ? (
        <div style={{ ...rise(explain), marginTop: 48, fontSize: fitSize(data.explanation, 52, 32), color: COLOR.text, fontWeight: 600 }}>
          <span style={{ color: COLOR.green, fontWeight: 800 }}>정답 </span>
          {data.explanation}
        </div>
      ) : null}
    </div>
  )
}

// ── 핵심 정리 ─────────────────────────────────────────────

function SummaryCard({ text, k }: { text: string; k: number }) {
  const p = useStep(k)
  return (
    <div style={{ ...rise(p, 36), display: 'flex', alignItems: 'center', gap: 28, padding: '34px 40px', borderRadius: 24, background: COLOR.card, border: `3px solid ${COLOR.line}` }}>
      <div style={{ width: 72, height: 72, borderRadius: 36, background: COLOR.indigo, color: '#FFFFFF', fontSize: 44, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{k}</div>
      <MarkedText text={text} progress={p} style={{ fontSize: fitSize(text, 52, 15), fontWeight: 600, color: COLOR.text, lineHeight: 1.3, letterSpacing: -1 }} />
    </div>
  )
}

function SummarySlide({ data }: { data: SummaryData }) {
  const two = data.points.length > 2
  return (
    <div>
      <Header label="핵심 정리" title={data.heading} />
      <div style={{ display: 'grid', gridTemplateColumns: two ? '1fr 1fr' : '1fr', gap: 32 }}>
        {data.points.map((p, i) => <SummaryCard key={i} text={p} k={i + 1} />)}
      </div>
    </div>
  )
}

// ── 마무리 ────────────────────────────────────────────────

function OutroSlide({ data }: { data: OutroData }) {
  const { startMs } = useSlide()
  const msg = useAppear(startMs + 150)
  const btn = useAppear(startMs + 600)
  const pressed = useAppear(startMs + 1800, { durationFrames: 8 })
  const next = useStep(1)
  const subscribed = pressed > 0.5
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingBottom: 40 }}>
      <div style={{ ...rise(msg), fontSize: fitSize(data.message ?? '', 96, 16), fontWeight: 800, color: COLOR.navyDeep, letterSpacing: -2 }}>
        {data.message || '오늘도 수고했어요!'}
      </div>
      <div style={{ ...rise(btn), display: 'flex', alignItems: 'center', gap: 28, marginTop: 56 }}>
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 16, padding: '22px 48px', borderRadius: 999, fontSize: 56, fontWeight: 800,
            background: subscribed ? '#E8EAF2' : COLOR.red, color: subscribed ? COLOR.navy : '#FFFFFF',
            transform: `scale(${1 - interpolate(pressed, [0, 0.5, 1], [0, 0.06, 0], clamp)})`,
          }}
        >
          {subscribed ? <CheckIcon progress={1} size={52} color={COLOR.navy} /> : null}
          {subscribed ? '구독 중' : '구독'}
        </div>
        <div style={{ fontSize: 52, fontWeight: 600, color: COLOR.muted }}>좋아요와 알림 설정도 부탁해요</div>
      </div>
      {data.next ? (
        <div style={{ ...rise(next), marginTop: 80, padding: '32px 44px', borderRadius: 24, background: COLOR.card, border: `3px solid ${COLOR.line}`, display: 'inline-flex', flexDirection: 'column', gap: 12, alignSelf: 'flex-start' }}>
          <span style={{ fontSize: 48, fontWeight: 700, color: COLOR.indigo }}>다음 강의</span>
          <span style={{ fontSize: fitSize(data.next, 64, 22), fontWeight: 800, color: COLOR.navy, letterSpacing: -1 }}>{data.next}</span>
        </div>
      ) : null}
    </div>
  )
}

export function SlideView({ slide }: { slide: Slide }) {
  switch (slide.type) {
    case 'title': return <TitleSlide data={slide.data} />
    case 'goal': return <GoalSlide data={slide.data} />
    case 'concept': return <ConceptSlide data={slide.data} />
    case 'formula': return <FormulaSlide data={slide.data} />
    case 'example': return <ExampleSlide data={slide.data} />
    case 'compare': return <CompareSlide data={slide.data} />
    case 'mistake': return <MistakeSlide data={slide.data} />
    case 'quiz': return <QuizSlide data={slide.data} />
    case 'summary': return <SummarySlide data={slide.data} />
    case 'outro': return <OutroSlide data={slide.data} />
  }
}
