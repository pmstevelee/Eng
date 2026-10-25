// 장면 데이터 → 시간표. 렌더러·미리보기·MP4·SRT·YouTube 챕터가 모두 이 시간표 하나를 쓴다.
// 순수 함수 (DB·브라우저 없음). 시간 단위는 ms.
//
// 샘플 재생 규칙과 같다:
//   장면 시작 → 350ms → 세그먼트(읽기 → 260ms) 반복 → 장면 끝 600ms
//   대기 세그먼트는 waitMs만큼 기다리고 문장 사이 간격을 두지 않는다.
//   등장 단계·정답 공개는 그 세그먼트가 시작될 때 일어난다.

// vitest 설정이 없어 @/ 경로를 못 읽으므로 상대 경로로 가져온다
import { sceneSteps, type Segment, type VideoLang, type VideoScene } from '../../../types/grammar-video'
import { SPEECH_ESTIMATE, VIDEO_TIMING } from './constants'

export interface TimelineSegment {
  segment: Segment
  /** 장면 순서 */
  sceneIndex: number
  start: number
  /** 읽기(또는 대기)가 끝나는 시각 */
  end: number
  /** 실제 음성 길이를 썼는지 (false면 예상치) */
  measured: boolean
}

export interface TimelineScene {
  index: number
  id: string
  name: string
  start: number
  end: number
  segments: TimelineSegment[]
  /** 등장 단계 → 처음 공개되는 시각 (공개되지 않는 단계는 없음) */
  stepTimes: Map<number, number>
  /** 퀴즈 정답 번호 → 공개 시각 */
  answerTimes: Map<number, number>
  /** 타이머 대기 구간 (없으면 null) */
  timer: { start: number; end: number } | null
}

/** 자막 1줄 = 세그먼트 1개. 다음 문장 전까지(문장 사이 간격 포함) 화면에 남는다 */
export interface SubtitleCue {
  index: number
  sceneIndex: number
  start: number
  end: number
  text: string
  lang: VideoLang
}

export interface Timeline {
  scenes: TimelineScene[]
  cues: SubtitleCue[]
  duration: number
  /** 예상치로 계산한 세그먼트 수 (0이면 모두 실제 음성 길이) */
  estimatedCount: number
}

/** 음성이 없을 때 세그먼트 길이 예상치 */
export function estimateSpeechMs(text: string, lang: VideoLang): number {
  const per = lang === 'en' ? SPEECH_ESTIMATE.enMsPerChar : SPEECH_ESTIMATE.koMsPerChar
  return Math.max(SPEECH_ESTIMATE.minMs, text.length * per)
}

/** 세그먼트가 차지하는 시간 (실제 음성 길이 → 없으면 예상치) */
export function segmentDurationMs(segment: Segment): { ms: number; measured: boolean } {
  if (segment.waitMs) return { ms: segment.waitMs, measured: true }
  if (segment.durationSec && segment.durationSec > 0) {
    return { ms: Math.round(segment.durationSec * 1000), measured: true }
  }
  return { ms: estimateSpeechMs(segment.text, segment.lang), measured: false }
}

export function buildTimeline(scenes: VideoScene[]): Timeline {
  const out: TimelineScene[] = []
  const cues: SubtitleCue[] = []
  let cursor = 0
  let estimatedCount = 0

  scenes.forEach((scene, sceneIndex) => {
    const start = cursor
    cursor += VIDEO_TIMING.sceneStartMs
    const segs: TimelineSegment[] = []
    const stepTimes = new Map<number, number>()
    const answerTimes = new Map<number, number>()
    let timer: TimelineScene['timer'] = null
    const steps = Array.from(new Set(sceneSteps(scene))).sort((a, b) => a - b)
    const quizCount = scene.template === 'quiz' ? scene.data.items.length : 0

    for (const segment of scene.segments) {
      const segStart = cursor
      if (segment.reveal !== undefined) {
        for (const st of steps) if (st <= segment.reveal && !stepTimes.has(st)) stepTimes.set(st, segStart)
      }
      if (segment.answer !== undefined) {
        for (let n = 1; n <= Math.min(segment.answer, quizCount); n++) {
          if (!answerTimes.has(n)) answerTimes.set(n, segStart)
        }
      }
      const { ms, measured } = segmentDurationMs(segment)
      if (!measured) estimatedCount += 1
      const segEnd = segStart + ms
      segs.push({ segment, sceneIndex, start: segStart, end: segEnd, measured })

      if (segment.waitMs) {
        if (segment.timer && !timer) timer = { start: segStart, end: segEnd }
        cursor = segEnd
        continue
      }
      cursor = segEnd + VIDEO_TIMING.segmentGapMs
      cues.push({
        index: cues.length,
        sceneIndex,
        start: segStart,
        end: cursor,
        text: segment.text,
        lang: segment.lang,
      })
    }
    cursor += VIDEO_TIMING.sceneEndMs
    out.push({ index: sceneIndex, id: scene.id, name: scene.name, start, end: cursor, segments: segs, stepTimes, answerTimes, timer })
  })

  return { scenes: out, cues, duration: cursor, estimatedCount }
}

// ── 시간 t의 화면 상태 ─────────────────────────────────────────

/** CSS transition 기본 'ease' = cubic-bezier(0.25, 0.1, 0.25, 1) */
export function cssEase(x: number): number {
  if (x <= 0) return 0
  if (x >= 1) return 1
  // x(s) = 3(1-s)^2 s x1 + 3(1-s) s^2 x2 + s^3 를 이분법으로 풀어 s를 찾는다
  const x1 = 0.25
  const y1 = 0.1
  const x2 = 0.25
  const y2 = 1
  let lo = 0
  let hi = 1
  let s = x
  for (let i = 0; i < 24; i++) {
    s = (lo + hi) / 2
    const bx = 3 * (1 - s) * (1 - s) * s * x1 + 3 * (1 - s) * s * s * x2 + s * s * s
    if (bx < x) lo = s
    else hi = s
  }
  return 3 * (1 - s) * (1 - s) * s * y1 + 3 * (1 - s) * s * s * y2 + s * s * s
}

function progressSince(t: number, at: number | undefined, durationMs: number): number {
  if (at === undefined || t < at) return 0
  return cssEase((t - at) / durationMs)
}

export interface SceneView {
  sceneIndex: number
  /** 이 장면의 불투명도 (장면 전환 페이드) */
  opacity: number
  /** 등장 단계 → 연출 진행률 0~1 (0 = 안 보임) */
  step: (step: number) => number
  /** 퀴즈 정답 번호 → 페이드 진행률 0~1 */
  answer: (n: number) => number
  /** 퀴즈 타이머 막대 0~1 */
  timer: number
}

export interface FrameState {
  t: number
  sceneIndex: number
  /** 장면 전환 중이면 이전 장면(끝 화면 그대로)을 먼저 그린다 */
  previous: SceneView | null
  current: SceneView
  /** 장면 전환 진행률 0~1 (전환이 없으면 1) */
  transition: number
  subtitle: { text: string; lang: VideoLang; opacity: number } | null
  /** 현재 장면에서 지금까지 공개된 가장 큰 등장 단계 (-1 = 없음) */
  revealedStep: number
}

/** 장면이 다 보인 상태 (전환 중 이전 장면) */
function finalView(sceneIndex: number, opacity: number): SceneView {
  return { sceneIndex, opacity, step: () => 1, answer: () => 1, timer: 1 }
}

function sceneAt(timeline: Timeline, t: number): number {
  const { scenes } = timeline
  if (scenes.length === 0) return -1
  if (t <= 0) return 0
  for (let i = 0; i < scenes.length; i++) if (t < scenes[i].end) return i
  return scenes.length - 1
}

export function getFrameState(timeline: Timeline, t: number): FrameState | null {
  const index = sceneAt(timeline, t)
  if (index < 0) return null
  const ts = timeline.scenes[index]
  const clamped = Math.min(t, timeline.duration)

  const transition = index === 0 ? 1 : cssEase((clamped - ts.start) / VIDEO_TIMING.revealMs)
  const current: SceneView = {
    sceneIndex: index,
    opacity: transition,
    step: (st) => progressSince(clamped, ts.stepTimes.get(st), VIDEO_TIMING.revealMs),
    answer: (n) => progressSince(clamped, ts.answerTimes.get(n), VIDEO_TIMING.answerFadeMs),
    timer: ts.timer ? Math.max(0, Math.min(1, (clamped - ts.timer.start) / (ts.timer.end - ts.timer.start))) : 0,
  }
  const previous = transition < 1 && index > 0 ? finalView(index - 1, 1 - transition) : null

  let revealedStep = -1
  ts.stepTimes.forEach((at, st) => {
    if (at <= clamped && st > revealedStep) revealedStep = st
  })

  return { t: clamped, sceneIndex: index, previous, current, transition, subtitle: subtitleAt(timeline, clamped), revealedStep }
}

/** 자막: 켜질 때·꺼질 때만 0.2초 페이드, 문장이 바로 이어지면 글자만 바뀐다 */
function subtitleAt(timeline: Timeline, t: number): FrameState['subtitle'] {
  const { cues } = timeline
  const fade = VIDEO_TIMING.subtitleFadeMs
  for (let i = 0; i < cues.length; i++) {
    const cue = cues[i]
    if (t >= cue.start && t < cue.end) {
      // 같은 시각에 끝난 앞 자막이 있으면 이어지는 것 — 페이드 없이 바로
      let runStart = cue.start
      for (let k = i - 1; k >= 0 && cues[k].end === runStart; k--) runStart = cues[k].start
      return { text: cue.text, lang: cue.lang, opacity: cssEase((t - runStart) / fade) }
    }
    if (t >= cue.end && t < cue.end + fade && !(cues[i + 1] && cues[i + 1].start === cue.end)) {
      if (cues[i + 1] && t >= cues[i + 1].start) continue
      return { text: cue.text, lang: cue.lang, opacity: 1 - cssEase((t - cue.end) / fade) }
    }
  }
  return null
}

/** 장면의 모든 항목이 보이는 시각 (미리보기 "장면 끝 화면", 편집 화면 썸네일) */
export function sceneSettledTime(timeline: Timeline, sceneIndex: number): number {
  const ts = timeline.scenes[sceneIndex]
  if (!ts) return 0
  return Math.max(ts.start, ts.end - Math.floor(VIDEO_TIMING.sceneEndMs / 2))
}

// ── SRT ─────────────────────────────────────────────────────

function pad(n: number, width: number): string {
  return String(n).padStart(width, '0')
}

/** 00:01:02,345 */
export function formatSrtTime(ms: number): string {
  const total = Math.max(0, Math.round(ms))
  const h = Math.floor(total / 3600000)
  const m = Math.floor((total % 3600000) / 60000)
  const s = Math.floor((total % 60000) / 1000)
  return `${pad(h, 2)}:${pad(m, 2)}:${pad(s, 2)},${pad(total % 1000, 3)}`
}

/** 세그먼트 1개 = 자막 1줄 */
export function toSrt(timeline: Timeline): string {
  return timeline.cues
    .map((cue, i) => `${i + 1}\n${formatSrtTime(cue.start)} --> ${formatSrtTime(cue.end)}\n${cue.text}\n`)
    .join('\n')
}

// ── YouTube 챕터 ────────────────────────────────────────────

/** YouTube 챕터 최소 길이·개수 */
export const YOUTUBE_CHAPTER_MIN_SEC = 10
export const YOUTUBE_CHAPTER_MIN_COUNT = 3

export interface YoutubeChapter {
  startSec: number
  name: string
  /** "0:00 오프닝" 형식 한 줄 */
  line: string
}

/** 0:00 / 1:05 / 1:02:03 — 첫 챕터는 반드시 0:00 */
export function formatChapterTime(sec: number): string {
  const total = Math.max(0, Math.floor(sec))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return h > 0 ? `${h}:${pad(m, 2)}:${pad(s, 2)}` : `${m}:${pad(s, 2)}`
}

/**
 * 장면 이름으로 YouTube 챕터를 만든다. 첫 챕터는 0:00, 각 챕터는 10초 이상.
 * 10초가 안 되는 장면(또는 앞 챕터가 아직 10초가 안 될 때)은 앞 챕터에 합친다.
 * YouTube는 챕터가 3개 미만이면 표시하지 않으므로 그때는 빈 배열을 돌려준다.
 */
export function toYoutubeChapters(timeline: Timeline): YoutubeChapter[] {
  const chapters: { startSec: number; name: string }[] = []
  const totalSec = Math.floor(timeline.duration / 1000)
  for (const scene of timeline.scenes) {
    const startSec = Math.floor(scene.start / 1000)
    if (chapters.length === 0) {
      chapters.push({ startSec: 0, name: scene.name })
      continue
    }
    const prev = chapters[chapters.length - 1]
    const sceneSec = Math.floor(scene.end / 1000) - startSec
    if (startSec - prev.startSec < YOUTUBE_CHAPTER_MIN_SEC || sceneSec < YOUTUBE_CHAPTER_MIN_SEC) continue
    chapters.push({ startSec, name: scene.name })
  }
  // 마지막 챕터가 짧으면 앞에 합친다
  while (chapters.length > 1 && totalSec - chapters[chapters.length - 1].startSec < YOUTUBE_CHAPTER_MIN_SEC) {
    chapters.pop()
  }
  if (chapters.length < YOUTUBE_CHAPTER_MIN_COUNT) return []
  return chapters.map((c) => ({ ...c, line: `${formatChapterTime(c.startSec)} ${c.name}` }))
}
