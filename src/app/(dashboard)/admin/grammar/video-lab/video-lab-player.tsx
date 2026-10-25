'use client'

// 렌더러 확인용 플레이어 — 픽스처를 재생·장면 이동·시간 슬라이더로 본다.
// 음성은 브라우저 내장 TTS(샘플과 같은 방식). 시간표는 예상 길이로 계산하므로,
// 재생 중에는 TTS가 끝날 때까지 세그먼트 끝에서 시계를 멈추고, 일찍 끝나면 다음 문장으로 넘어간다.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Pause, Play, SkipBack, SkipForward, Subtitles, Volume2, VolumeX } from 'lucide-react'
import type { VideoScene } from '@/types/grammar-video'
import { VIDEO_TEMPLATE_LABELS } from '@/types/grammar-video'
import { buildTimeline, sceneSettledTime, type TimelineSegment } from '@/lib/grammar/video/timeline'
import { EN_SPEECH_RATE } from '@/lib/grammar/video/constants'
import { VideoCanvas } from '@/components/grammar/video/video-canvas'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

function formatTime(ms: number): string {
  const s = Math.max(0, ms) / 1000
  const m = Math.floor(s / 60)
  return `${m}:${(s % 60).toFixed(1).padStart(4, '0')}`
}

function pickVoice(voices: SpeechSynthesisVoice[], prefix: string): SpeechSynthesisVoice | undefined {
  const m = voices.filter((v) => v.lang.replace('_', '-').toLowerCase().startsWith(prefix))
  return m.find((v) => /google|natural|samantha|yuna/i.test(v.name)) ?? m[0]
}

export function VideoLabPlayer({ scenes }: { scenes: VideoScene[] }) {
  const timeline = useMemo(() => buildTimeline(scenes), [scenes])
  const speechSegments = useMemo(
    () => timeline.scenes.flatMap((s) => s.segments).filter((s) => !s.segment.waitMs),
    [timeline],
  )

  const [t, setT] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [voiceOn, setVoiceOn] = useState(true)
  const [subtitles, setSubtitles] = useState(true)
  const [fontsLoaded, setFontsLoaded] = useState<boolean | null>(null)

  const tRef = useRef(0)
  const voiceOnRef = useRef(voiceOn)
  voiceOnRef.current = voiceOn
  /** 이미 말하기 시작한 세그먼트 id */
  const spokenRef = useRef<string | null>(null)
  const speakingRef = useRef(false)
  /** 말하기가 끝난 세그먼트 id */
  const doneRef = useRef<string | null>(null)
  const rafRef = useRef<number | null>(null)
  const voicesRef = useRef<{ ko?: SpeechSynthesisVoice; en?: SpeechSynthesisVoice }>({})

  // 서버 렌더와 맞추기 위해 마운트 후에 판단한다
  const [hasTts, setHasTts] = useState<boolean | null>(null)
  useEffect(() => setHasTts('speechSynthesis' in window), [])

  useEffect(() => {
    if (!hasTts) return
    const pick = () => {
      const vs = window.speechSynthesis.getVoices()
      voicesRef.current = { en: pickVoice(vs, 'en-us') ?? pickVoice(vs, 'en'), ko: pickVoice(vs, 'ko') }
    }
    pick()
    window.speechSynthesis.onvoiceschanged = pick
    return () => {
      window.speechSynthesis.onvoiceschanged = null
      window.speechSynthesis.cancel()
    }
  }, [hasTts])

  const segmentAt = useCallback(
    (time: number): TimelineSegment | undefined => speechSegments.find((s) => time >= s.start && time < s.end),
    [speechSegments],
  )

  const cancelSpeech = useCallback(() => {
    if (hasTts) window.speechSynthesis.cancel()
    speakingRef.current = false
  }, [hasTts])

  const speak = useCallback(
    (seg: TimelineSegment) => {
      spokenRef.current = seg.segment.id
      if (!hasTts || !voiceOnRef.current) return
      const u = new SpeechSynthesisUtterance(seg.segment.text)
      const lang = seg.segment.lang
      u.lang = lang === 'en' ? 'en-US' : 'ko-KR'
      const voice = voicesRef.current[lang]
      if (voice) u.voice = voice
      u.rate = lang === 'en' ? EN_SPEECH_RATE : 1.02
      speakingRef.current = true
      const id = seg.segment.id
      const finish = () => {
        if (spokenRef.current !== id) return
        speakingRef.current = false
        doneRef.current = id
      }
      // 끝 이벤트가 오지 않는 브라우저 대비 (샘플과 같은 안전 시간)
      window.setTimeout(finish, (seg.end - seg.start) * 2.5 + 2000)
      u.onend = finish
      u.onerror = finish
      window.speechSynthesis.speak(u)
    },
    [hasTts],
  )

  const stopLoop = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
  }, [])

  const seek = useCallback(
    (time: number) => {
      const next = Math.max(0, Math.min(time, timeline.duration))
      cancelSpeech()
      // 문장 중간으로 옮기면 그 문장은 읽지 않고 다음 문장부터 읽는다
      spokenRef.current = segmentAt(next)?.segment.id ?? null
      doneRef.current = spokenRef.current
      tRef.current = next
      setT(next)
    },
    [cancelSpeech, segmentAt, timeline.duration],
  )

  const pause = useCallback(() => {
    stopLoop()
    cancelSpeech()
    setPlaying(false)
  }, [cancelSpeech, stopLoop])

  const play = useCallback(() => {
    if (tRef.current >= timeline.duration) seek(0)
    setPlaying(true)
    let last = performance.now()
    const tick = (now: number) => {
      // 탭이 가려져 프레임이 멈췄다가 돌아오면 한꺼번에 건너뛰지 않도록 한 프레임 최대 0.1초
      const dt = Math.min(100, Math.max(0, now - last))
      last = now
      let next = tRef.current + dt
      const seg = segmentAt(tRef.current) ?? segmentAt(next)
      if (seg && voiceOnRef.current && hasTts) {
        if (spokenRef.current !== seg.segment.id && next >= seg.start) {
          next = Math.max(next, seg.start)
          speak(seg)
        }
        if (spokenRef.current === seg.segment.id) {
          // 아직 말하는 중이면 세그먼트 끝에서 기다리고, 일찍 끝났으면 끝으로 건너뛴다
          if (speakingRef.current && next >= seg.end) next = seg.end - 1
          else if (!speakingRef.current && doneRef.current === seg.segment.id && next < seg.end) next = seg.end
        }
      }
      if (next >= timeline.duration) {
        tRef.current = timeline.duration
        setT(timeline.duration)
        rafRef.current = null
        setPlaying(false)
        return
      }
      tRef.current = next
      setT(next)
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
  }, [hasTts, seek, segmentAt, speak, timeline.duration])

  useEffect(() => () => stopLoop(), [stopLoop])

  const currentScene = Math.max(
    0,
    timeline.scenes.findIndex((s) => t < s.end),
  )
  const sceneIndex = currentScene === -1 ? timeline.scenes.length - 1 : currentScene

  /** 장면 이동: 재생 중이면 그 장면 처음부터, 멈춰 있으면 장면 끝 화면(모두 보이는 상태) — 샘플과 같음 */
  const goScene = (i: number) => {
    const idx = Math.max(0, Math.min(timeline.scenes.length - 1, i))
    if (playing) {
      seek(timeline.scenes[idx].start)
    } else {
      seek(sceneSettledTime(timeline, idx))
    }
  }

  const toggleVoice = () => {
    const next = !voiceOn
    setVoiceOn(next)
    if (!next) cancelSpeech()
  }

  return (
    <div className="space-y-4">
      <VideoCanvas scenes={scenes} timeline={timeline} t={t} subtitles={subtitles} onFontsReady={setFontsLoaded} />

      <div className="flex flex-wrap items-center gap-2">
        <Button className="min-h-[44px] bg-[#1865F2] hover:bg-[#1865F2]/90" onClick={playing ? pause : play}>
          {playing ? <Pause className="mr-1.5 h-4 w-4" /> : <Play className="mr-1.5 h-4 w-4" />}
          {playing ? '정지' : '재생'}
        </Button>
        <Button variant="outline" className="min-h-[44px]" onClick={() => goScene(sceneIndex - 1)}>
          <SkipBack className="mr-1.5 h-4 w-4" />
          이전 장면
        </Button>
        <Button variant="outline" className="min-h-[44px]" onClick={() => goScene(sceneIndex + 1)}>
          <SkipForward className="mr-1.5 h-4 w-4" />
          다음 장면
        </Button>
        <span className="ml-auto" />
        <Button variant="outline" className="min-h-[44px]" aria-pressed={voiceOn} onClick={toggleVoice} disabled={!hasTts}>
          {voiceOn ? <Volume2 className="mr-1.5 h-4 w-4" /> : <VolumeX className="mr-1.5 h-4 w-4" />}
          {voiceOn ? '음성 켜짐' : '음성 꺼짐'}
        </Button>
        <Button variant="outline" className="min-h-[44px]" aria-pressed={subtitles} onClick={() => setSubtitles((v) => !v)}>
          <Subtitles className="mr-1.5 h-4 w-4" />
          {subtitles ? '자막 켜짐' : '자막 꺼짐'}
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <span className="w-16 text-right font-mono text-sm tabular-nums text-gray-700">{formatTime(t)}</span>
        <input
          type="range"
          aria-label="재생 위치"
          min={0}
          max={timeline.duration}
          step={10}
          value={Math.round(t)}
          onChange={(e) => {
            if (playing) pause()
            seek(Number(e.target.value))
          }}
          className="h-11 flex-1 accent-[#1865F2]"
        />
        <span className="w-16 font-mono text-sm tabular-nums text-gray-500">{formatTime(timeline.duration)}</span>
      </div>

      <div className="flex flex-wrap gap-2">
        {timeline.scenes.map((s, i) => (
          <button
            key={s.id}
            type="button"
            onClick={() => goScene(i)}
            className={cn(
              'min-h-[44px] rounded-full border px-4 text-sm',
              i === sceneIndex ? 'border-[#1865F2] bg-[#1865F2] text-white' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50',
            )}
          >
            {i + 1}. {s.name}
            <span className={cn('ml-1.5 text-xs', i === sceneIndex ? 'text-white/80' : 'text-gray-400')}>
              {VIDEO_TEMPLATE_LABELS[scenes[i].template]}
            </span>
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
        <p>
          음성 파일이 아직 없어 시간표는 예상 길이(한국어 글자당 0.12초, 영어 0.08초, 최소 1.2초)로 계산했습니다 —
          예상치 세그먼트 {timeline.estimatedCount}개. 재생 중에는 브라우저 음성이 끝날 때까지 기다립니다.
        </p>
        {hasTts === false && <p className="mt-1 text-[#D92916]">이 브라우저는 내장 음성을 지원하지 않아 소리 없이 재생됩니다.</p>}
        {fontsLoaded === false && (
          <p className="mt-1 text-[#D92916]">글꼴 일부를 불러오지 못해 대체 글꼴로 그려졌습니다. 네트워크를 확인해 주세요.</p>
        )}
      </div>
    </div>
  )
}
