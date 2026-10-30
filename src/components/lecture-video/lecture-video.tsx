// 위고업잉글리시 문법 강의 영상 — Remotion 컴포지션 (1920×1080, 30fps)
// 음성은 narration.wav 하나(쉼·음량 정리 끝난 트랙), 화면은 timeline.json 시간에 맞춰 슬라이드를 바꾼다.
// 슬라이드 부품은 모두 절대 시간(타임라인 ms)으로 계산하므로 Sequence 대신 현재 시간에 맞는 슬라이드만 그린다.

import { useMemo } from 'react'
import { AbsoluteFill, Html5Audio, interpolate } from 'remotion'
import type { Slide } from '../../lib/lecture-pipeline/types'
import { buildCues, layoutTimeline, slideStepTimes } from '../../lib/lecture-pipeline/timing'
import { usePretendard } from './fonts'
import { ProgressBar, SlideContext, SubtitleBar, Watermark, useNowMs, type SlideCtx } from './parts'
import type { LectureVideoProps } from './props'
import { SlideView } from './slides'
import { COLOR, FONT, LAYOUT } from './theme'

/** 슬라이드 전환 페이드(ms) */
const FADE_MS = 280

function SlideFrame({ slide, ctx, last }: { slide: Slide; ctx: SlideCtx; last: boolean }) {
  const now = useNowMs()
  const fadeIn = interpolate(now, [ctx.startMs, ctx.startMs + FADE_MS], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const fadeOut = last ? 1 : interpolate(now, [ctx.endMs - FADE_MS / 2, ctx.endMs], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  return (
    <SlideContext.Provider value={ctx}>
      <AbsoluteFill style={{ opacity: Math.min(fadeIn, fadeOut), padding: `${LAYOUT.top}px ${LAYOUT.padX}px ${LAYOUT.bottomReserve}px` }}>
        <SlideView slide={slide} />
      </AbsoluteFill>
    </SlideContext.Provider>
  )
}

export function LectureVideo({ script, timeline: given, audioUrl, subtitles }: LectureVideoProps) {
  usePretendard()
  const now = useNowMs()
  const timeline = useMemo(() => given ?? layoutTimeline(script), [given, script])
  const cues = useMemo(() => buildCues(script, timeline), [script, timeline])
  const slides = useMemo(
    () =>
      timeline.slides.flatMap((r) => {
        const slide = script.slides.find((s) => s.id === r.id)
        if (!slide) return []
        const ctx: SlideCtx = {
          script,
          timeline,
          startMs: r.startMs,
          endMs: r.endMs,
          stepTimes: slideStepTimes(slide, script, timeline),
          segments: timeline.segments.filter((s) => s.slideId === r.id),
        }
        return [{ slide, ctx }]
      }),
    [script, timeline],
  )

  return (
    <AbsoluteFill style={{ backgroundColor: COLOR.bg, fontFamily: FONT.family, color: COLOR.text }}>
      {slides.map(({ slide, ctx }, i) =>
        now >= ctx.startMs && now < ctx.endMs + 1 ? <SlideFrame key={slide.id} slide={slide} ctx={ctx} last={i === slides.length - 1} /> : null,
      )}
      <Watermark />
      {subtitles ? <SubtitleBar cues={cues} /> : null}
      <ProgressBar totalMs={timeline.totalMs} />
      {audioUrl ? <Html5Audio src={audioUrl} /> : null}
    </AbsoluteFill>
  )
}
