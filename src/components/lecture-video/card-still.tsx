// 카드뉴스 한 장 (1080×1350, 4:5 PNG) — 인스타그램·쓰레드 공용. 영상과 같은 색·글꼴·부품을 쓴다.
// 규칙: 한 장 최대 5줄, 글자 최소 40px, 오른쪽 아래 페이지 번호(1/10).

import type { CSSProperties, ReactNode } from 'react'
import { AbsoluteFill } from 'remotion'
import { CARD, CARD_MIN_FONT, CARD_TEXT_WIDTH, type Card } from '../../lib/lecture-pipeline/cardnews'
import { textUnits } from '../../lib/lecture-pipeline/shorts'
import { WEBSITE } from '../../lib/lecture-pipeline/types'
import { usePretendard } from './fonts'
import { BrandMark, Chip, CheckIcon, MarkedText } from './parts'
import { MeaningText, PatternFormula } from './practice'
import type { CardStillProps } from './props'
import { COLOR, FONT } from './theme'

const PAD = (CARD.width - CARD_TEXT_WIDTH) / 2

/** 글이 maxLines 줄을 넘으면 글자를 줄이되 40px 아래로는 줄이지 않는다 */
function fit(text: string, base: number, maxLines = 2, width = CARD_TEXT_WIDTH): number {
  const units = textUnits(text.replace(/\*\*/g, ''))
  const need = (units * base) / (width * maxLines)
  return need <= 1 ? base : Math.max(CARD_MIN_FONT, Math.floor(base / need))
}

function Brand({ dark }: { dark: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      <BrandMark size={52} color={dark ? '#FFFFFF' : COLOR.indigo} fg={dark ? COLOR.indigo : '#FFFFFF'} />
      <span style={{ fontSize: 40, fontWeight: 800, color: dark ? '#FFFFFF' : COLOR.navy, letterSpacing: -0.5 }}>
        WeGoUp <span style={{ color: dark ? COLOR.gold : COLOR.indigo }}>English</span>
      </span>
    </div>
  )
}

function Shell({ dark, bg, page, total, children }: { dark?: boolean; bg?: string; page: number; total: number; children: ReactNode }) {
  return (
    <AbsoluteFill style={{ background: bg ?? COLOR.bg, fontFamily: FONT.family, color: dark ? '#FFFFFF' : COLOR.text, padding: `84px ${PAD}px 90px` }}>
      <Brand dark={!!dark} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingBottom: 30 }}>{children}</div>
      <div style={{ position: 'absolute', right: PAD - 10, bottom: 62, fontSize: 40, fontWeight: 700, color: dark ? 'rgba(255,255,255,0.85)' : COLOR.muted, letterSpacing: 1 }}>
        {page}/{total}
      </div>
    </AbsoluteFill>
  )
}

const card: CSSProperties = { background: COLOR.card, border: `4px solid ${COLOR.line}`, borderRadius: 28, padding: '34px 40px' }
const en: CSSProperties = { fontFamily: FONT.english, fontWeight: 700, letterSpacing: -0.5 }

function Body({ c, page, total }: { c: Card; page: number; total: number }) {
  switch (c.type) {
    case 'cover':
      return (
        <Shell dark bg={COLOR.indigo} page={page} total={total}>
          <Chip color={COLOR.navyDeep} bg={COLOR.gold} style={{ fontSize: 40, alignSelf: 'flex-start' }}>{c.label || '중학 영문법'}</Chip>
          <div style={{ fontSize: fit(c.topic, 104, 2), fontWeight: 800, lineHeight: 1.12, letterSpacing: -3, marginTop: 40, wordBreak: 'keep-all' }}>{c.topic}</div>
          <div style={{ width: 220, height: 16, borderRadius: 8, background: COLOR.gold, margin: '40px 0 34px' }} />
          <div style={{ fontSize: fit(c.hook, 54, 2), fontWeight: 700, lineHeight: 1.35, color: COLOR.indigoSoft, wordBreak: 'keep-all' }}>{c.hook}</div>
        </Shell>
      )
    case 'question':
      return (
        <Shell page={page} total={total}>
          <div style={{ fontSize: 64, fontWeight: 800, color: COLOR.navyDeep, letterSpacing: -1.5 }}>{c.prompt || '이거 맞을까요?'}</div>
          <div style={{ ...card, marginTop: 44, display: 'flex', alignItems: 'center', gap: 30 }}>
            <div style={{ ...en, flex: 1, fontSize: fit(c.sentence, 72, 2, CARD_TEXT_WIDTH - 220), color: COLOR.text, lineHeight: 1.25 }}>{c.sentence}</div>
            <div style={{ width: 120, height: 120, borderRadius: 60, background: COLOR.gold, color: COLOR.navyDeep, fontSize: 84, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>?</div>
          </div>
          {c.hint ? <div style={{ marginTop: 34, fontSize: fit(c.hint, 44, 1), color: COLOR.muted, fontWeight: 600 }}>{c.hint}</div> : null}
        </Shell>
      )
    case 'rule':
      return (
        <Shell page={page} total={total}>
          <Chip style={{ fontSize: 40, alignSelf: 'flex-start' }}>핵심 문법</Chip>
          <div style={{ fontSize: fit(c.heading, 60, 1), fontWeight: 800, color: COLOR.navyDeep, letterSpacing: -1.5, marginTop: 26 }}>{c.heading}</div>
          {c.formula?.length ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginTop: 30 }}>
              {c.formula.map((f, i) => (
                <span key={i} style={{ display: 'contents' }}>
                  {i > 0 ? <span style={{ fontSize: 48, fontWeight: 700, color: COLOR.muted }}>+</span> : null}
                  <span style={{ padding: '10px 24px', borderRadius: 16, background: i === 0 ? COLOR.tealSoft : COLOR.indigoSoft, color: i === 0 ? COLOR.teal : COLOR.indigo, border: `3px solid ${i === 0 ? COLOR.teal : COLOR.indigo}`, fontSize: 48, fontWeight: 800 }}>{f}</span>
                </span>
              ))}
            </div>
          ) : null}
          <div style={{ marginTop: 30, display: 'flex', flexDirection: 'column', gap: 14 }}>
            {c.lines.map((l, i) => (
              <MarkedText key={i} text={l} progress={1} style={{ fontSize: fit(l, 46, 1), fontWeight: 600, color: COLOR.text, lineHeight: 1.35 }} />
            ))}
          </div>
          {c.example ? (
            <div style={{ ...card, marginTop: 34, padding: '26px 34px' }}>
              <div style={{ ...en, fontSize: fit(c.example.en, 48, 1, CARD_TEXT_WIDTH - 80), color: COLOR.indigoDeep }}>{c.example.en}</div>
              <div style={{ fontSize: fit(c.example.ko, 42, 1, CARD_TEXT_WIDTH - 80), color: COLOR.muted, fontWeight: 500, marginTop: 6 }}>{c.example.ko}</div>
            </div>
          ) : null}
        </Shell>
      )
    case 'mistakes':
      return (
        <Shell page={page} total={total}>
          <Chip color={COLOR.red} bg={COLOR.redSoft} style={{ fontSize: 40, alignSelf: 'flex-start' }}>자주 틀려요</Chip>
          <div style={{ fontSize: 60, fontWeight: 800, color: COLOR.navyDeep, letterSpacing: -1.5, marginTop: 26, marginBottom: 34 }}>{c.heading || '흔한 실수 TOP 3'}</div>
          {c.items.map((m, i) => (
            <div key={i} style={{ ...card, display: 'flex', alignItems: 'center', gap: 22, padding: '24px 30px', marginBottom: 20 }}>
              <div style={{ width: 62, height: 62, borderRadius: 31, background: COLOR.navy, color: '#FFFFFF', fontSize: 40, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</div>
              <div style={{ ...en, fontSize: fit(`${m.wrong} → ${m.right}`, 46, 1, CARD_TEXT_WIDTH - 160), display: 'flex', flexWrap: 'wrap', alignItems: 'center', columnGap: 16 }}>
                <span style={{ color: COLOR.red, textDecoration: 'line-through', textDecorationThickness: 4, opacity: 0.85 }}>{m.wrong}</span>
                <span style={{ color: COLOR.muted }}>→</span>
                <span style={{ color: COLOR.green, fontWeight: 800 }}>{m.right}</span>
              </div>
            </div>
          ))}
        </Shell>
      )
    case 'quiz': {
      const blank = c.sentence?.split(/_{2,}/) ?? null
      return (
        <Shell page={page} total={total}>
          <Chip color="#8A5A00" bg={COLOR.goldSoft} style={{ fontSize: 40, alignSelf: 'flex-start' }}>QUIZ</Chip>
          <div style={{ fontSize: fit(c.question, 52, 1), fontWeight: 800, color: COLOR.navyDeep, letterSpacing: -1, marginTop: 26 }}>{c.question}</div>
          {blank ? (
            <div style={{ ...en, fontSize: fit(c.sentence ?? '', 58, 1), marginTop: 30, color: COLOR.text }}>
              {blank.map((part, i) => (
                <span key={i}>
                  {part}
                  {i < blank.length - 1 ? <span style={{ display: 'inline-block', width: 170, borderBottom: `6px solid ${COLOR.navy}`, margin: '0 10px' }}>&nbsp;</span> : null}
                </span>
              ))}
            </div>
          ) : null}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginTop: 40 }}>
            {c.choices.map((ch, i) => (
              <div key={i} style={{ ...card, padding: '20px 28px', display: 'flex', alignItems: 'center', gap: 16, borderRadius: 999 }}>
                <span style={{ fontSize: 48, fontWeight: 800, color: COLOR.indigo }}>{String.fromCharCode(65 + i)}</span>
                <span style={{ ...en, fontSize: fit(ch, 48, 1, CARD_TEXT_WIDTH / 2 - 120) }}>{ch}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 34, fontSize: 40, fontWeight: 700, color: COLOR.muted }}>정답은 다음 장에서 👉</div>
        </Shell>
      )
    }
    case 'answer':
      return (
        <Shell page={page} total={total}>
          <Chip color="#FFFFFF" bg={COLOR.green} style={{ fontSize: 40, alignSelf: 'flex-start' }}>정답</Chip>
          <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginTop: 30 }}>
            <div style={{ width: 96, height: 96, borderRadius: 48, background: COLOR.green, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <CheckIcon progress={1} size={64} />
            </div>
            <div style={{ ...en, fontSize: fit(c.answer, 80, 1, CARD_TEXT_WIDTH - 130), fontWeight: 800, color: COLOR.green }}>{c.answer}</div>
          </div>
          {c.sentence ? <div style={{ ...en, fontSize: fit(c.sentence, 52, 1), marginTop: 34, color: COLOR.text }}>{c.sentence}</div> : null}
          <div style={{ marginTop: 34, padding: '24px 32px', borderRadius: 22, background: COLOR.goldSoft, fontSize: fit(c.explanation, 44, 2, CARD_TEXT_WIDTH - 64), fontWeight: 600, lineHeight: 1.4 }}>{c.explanation}</div>
        </Shell>
      )
    case 'pattern':
      return (
        <Shell page={page} total={total}>
          <Chip style={{ fontSize: 40, alignSelf: 'flex-start' }}>오늘의 일상회화 패턴</Chip>
          <div style={{ ...card, marginTop: 34, border: `5px solid ${COLOR.indigo}` }}>
            <PatternFormula pattern={c.pattern} slot={c.slot} fontSize={fit(c.pattern, 76, 1, CARD_TEXT_WIDTH - 200)} progress={1} />
          </div>
          <MeaningText text={c.ko} fontSize={fit(c.ko, 52, 1)} style={{ marginTop: 30, color: COLOR.indigoDeep }} />
          {c.example ? (
            <div style={{ marginTop: 34, paddingLeft: 26, borderLeft: `8px solid ${COLOR.indigoSoft}` }}>
              <div style={{ ...en, fontSize: fit(c.example.en, 48, 1) }}>{c.example.en}</div>
              <div style={{ fontSize: fit(c.example.ko, 42, 1), color: COLOR.muted, fontWeight: 500, marginTop: 6 }}>{c.example.ko}</div>
            </div>
          ) : null}
        </Shell>
      )
    case 'cta':
      return (
        <Shell dark bg={COLOR.navyDeep} page={page} total={total}>
          <div style={{ fontSize: fit(c.message || '저장하고 복습하세요', 64, 1), fontWeight: 800, letterSpacing: -1.5 }}>{c.message || '저장하고 복습하세요'} 🔖</div>
          <div style={{ fontSize: 46, fontWeight: 600, color: COLOR.indigoSoft, marginTop: 24 }}>팔로우하면 매일 영어 한 장</div>
          <div style={{ marginTop: 56, padding: '34px 38px', borderRadius: 28, background: COLOR.indigo }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: fit(WEBSITE.cta, 46, 1, CARD_TEXT_WIDTH - 150), fontWeight: 800 }}>
              <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20" /></svg>
              {WEBSITE.cta}
            </div>
            <div style={{ fontSize: 56, fontWeight: 800, color: COLOR.goldSoft, marginTop: 14, letterSpacing: -0.5 }}>{WEBSITE.host}</div>
            <div style={{ fontSize: fit(c.lectureTitle, 40, 1, CARD_TEXT_WIDTH - 80), fontWeight: 600, color: '#FFFFFF', opacity: 0.85, marginTop: 8 }}>{c.lectureTitle}</div>
          </div>
        </Shell>
      )
  }
}

export function CardStill({ card: c, page, total }: CardStillProps) {
  usePretendard()
  return <Body c={c} page={page} total={total} />
}
