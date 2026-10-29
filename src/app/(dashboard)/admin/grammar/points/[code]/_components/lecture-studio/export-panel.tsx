'use client'

// ④ 미리보기·내보내기 — 실제 음성(서명 URL)으로 재생하고, YouTube용 MP4·자막·설명문·썸네일·음성·스크립트를 내려받는다.
// 세그먼트 MP3를 한 번 받아 하나의 트랙으로 합친 뒤(load-audio) 미리보기·MP4·M4A가 같이 쓴다.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Download,
  FileText,
  Film,
  Image as ImageIcon,
  Loader2,
  Music,
  Pause,
  Play,
  RefreshCw,
  SkipBack,
  SkipForward,
  Subtitles,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { VideoCanvas } from '@/components/grammar/video/video-canvas'
import { parseVideoScenes, VIDEO_TEMPLATE_LABELS } from '@/types/grammar-video'
import type { AdminLectureScript } from '@/lib/grammar/lecture-scripts'
import { buildTimeline, sceneSettledTime, toSrt, toYoutubeChapters } from '@/lib/grammar/video/timeline'
import { planAudioPlacements } from '@/lib/grammar/video/export/plan'
import { AudioLoadError, loadMixedAudio, toAudioBuffer, type MixedAudio } from '@/lib/grammar/video/export/load-audio'
import { downloadBlob, renderThumbnailPng, textBlob } from '@/lib/grammar/video/export/files'
import {
  buildScriptText,
  buildYoutubeDescription,
  exportFileBase,
  type ExportPointInfo,
} from '@/lib/grammar/video/export/youtube-text'
import { cn } from '@/lib/utils'
import { getAudioUrls } from '../../../../lecture-audio-actions'
import { NoticeBox, type Notice } from './studio-ui'
import { RemotionPanel } from './remotion-panel'
import { useSceneImages } from './use-scene-images'

type AudioState =
  | { kind: 'loading'; done: number; total: number }
  | { kind: 'ready'; audio: MixedAudio; buffer: AudioBuffer }
  | { kind: 'error'; message: string }

type ExportState =
  | { kind: 'idle' }
  | { kind: 'running'; frame: number; totalFrames: number; startedAt: number }
  | { kind: 'done'; blob: Blob; url: string; elapsedMs: number }

function formatTime(ms: number): string {
  const s = Math.max(0, ms) / 1000
  const m = Math.floor(s / 60)
  return `${m}:${(s % 60).toFixed(1).padStart(4, '0')}`
}

function formatClock(ms: number): string {
  const s = Math.round(ms / 1000)
  return `${Math.floor(s / 60)}분 ${String(s % 60).padStart(2, '0')}초`
}

function formatSize(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)}MB` : `${Math.round(bytes / 1024)}KB`
}

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

export function ExportPanel({ script, point }: { script: AdminLectureScript; point: ExportPointInfo }) {
  const scenes = useMemo(() => parseVideoScenes(script.scenesJson).scenes, [script.scenesJson])
  const timeline = useMemo(() => buildTimeline(scenes), [scenes])
  const fileBase = useMemo(() => exportFileBase(point.code, script.title), [point.code, script.title])
  const chapters = useMemo(() => toYoutubeChapters(timeline), [timeline])

  const [audioState, setAudioState] = useState<AudioState>({ kind: 'loading', done: 0, total: 0 })
  const [loadKey, setLoadKey] = useState(0)
  const [t, setT] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [subtitles, setSubtitles] = useState(true)
  const [burnSubtitles, setBurnSubtitles] = useState(true)
  const [fontsLoaded, setFontsLoaded] = useState<boolean | null>(null)
  const [exportState, setExportState] = useState<ExportState>({ kind: 'idle' })
  const [notice, setNotice] = useState<Notice>(null)
  const [busyFile, setBusyFile] = useState<string | null>(null)
  const [support, setSupport] = useState<{ video: boolean; audio: boolean } | null>(null)
  const [audioUrls, setAudioUrls] = useState<Record<string, string>>({})
  const sceneImages = useSceneImages(script.id, scenes)

  const tRef = useRef(0)
  const rafRef = useRef<number | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const sourceRef = useRef<AudioBufferSourceNode | null>(null)
  const clockRef = useRef<{ base: number; t0: number; audio: boolean } | null>(null)
  const exportAbortRef = useRef<AbortController | null>(null)

  // ── 음성 불러오기 ──────────────────────────────────────────
  useEffect(() => {
    const abort = new AbortController()
    setAudioState({ kind: 'loading', done: 0, total: 0 })
    ;(async () => {
      const res = await getAudioUrls(script.id)
      if (abort.signal.aborted) return
      if (!res.ok) return setAudioState({ kind: 'error', message: res.error })
      const needed = planAudioPlacements(timeline)
      const notReady = needed.filter((p) => res.urls[p.segmentId]?.state !== 'ready' || !res.urls[p.segmentId]?.url)
      if (notReady.length > 0) {
        return setAudioState({
          kind: 'error',
          message: `음성이 없거나 문장이 바뀐 세그먼트가 ${notReady.length}개 있어요. 음성 단계에서 먼저 만들어 주세요.`,
        })
      }
      const urls: Record<string, string> = {}
      for (const [id, u] of Object.entries(res.urls)) if (u.url) urls[id] = u.url
      setAudioUrls(urls)
      try {
        const audio = await loadMixedAudio(timeline, urls, {
          signal: abort.signal,
          onProgress: (done, total) => setAudioState({ kind: 'loading', done, total }),
        })
        if (!abort.signal.aborted) setAudioState({ kind: 'ready', audio, buffer: toAudioBuffer(audio) })
      } catch (error) {
        if (isAbort(error)) return
        console.error('[lecture-export] 음성 불러오기 실패:', error)
        setAudioState({ kind: 'error', message: error instanceof AudioLoadError ? error.message : '음성을 불러오지 못했어요.' })
      }
    })()
    return () => abort.abort()
  }, [script.id, timeline, loadKey])

  useEffect(() => {
    let alive = true
    import('@/lib/grammar/video/export/encode')
      .then((m) => m.checkEncoderSupport())
      .then((s) => alive && setSupport(s))
      .catch(() => alive && setSupport({ video: false, audio: false }))
    return () => {
      alive = false
    }
  }, [])

  // ── 재생 (음성이 있으면 AudioContext 시계, 없으면 소리 없이) ─────────
  const stopAudio = useCallback(() => {
    try {
      sourceRef.current?.stop()
    } catch {
      // 이미 멈춘 경우
    }
    sourceRef.current?.disconnect()
    sourceRef.current = null
  }, [])

  const pause = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    stopAudio()
    clockRef.current = null
    setPlaying(false)
  }, [stopAudio])

  const now = useCallback(() => {
    const c = clockRef.current
    if (!c) return tRef.current
    const current = c.audio && audioCtxRef.current ? audioCtxRef.current.currentTime * 1000 : performance.now()
    return c.t0 + (current - c.base)
  }, [])

  const play = useCallback(async () => {
    if (tRef.current >= timeline.duration) tRef.current = 0
    const start = tRef.current
    const buffer = audioState.kind === 'ready' ? audioState.buffer : null
    if (buffer) {
      const ctx = audioCtxRef.current ?? new AudioContext()
      audioCtxRef.current = ctx
      await ctx.resume()
      const src = ctx.createBufferSource()
      src.buffer = buffer
      src.connect(ctx.destination)
      src.start(0, start / 1000)
      sourceRef.current = src
      clockRef.current = { base: ctx.currentTime * 1000, t0: start, audio: true }
    } else {
      clockRef.current = { base: performance.now(), t0: start, audio: false }
    }
    setPlaying(true)
    const tick = () => {
      const next = now()
      if (next >= timeline.duration) {
        tRef.current = timeline.duration
        setT(timeline.duration)
        pause()
        return
      }
      tRef.current = next
      setT(next)
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
  }, [audioState, now, pause, timeline.duration])

  const seek = useCallback(
    (time: number, keepPlaying: boolean) => {
      const next = Math.max(0, Math.min(time, timeline.duration))
      const wasPlaying = playing
      pause()
      tRef.current = next
      setT(next)
      if (wasPlaying && keepPlaying) void play()
    },
    [pause, play, playing, timeline.duration],
  )

  useEffect(
    () => () => {
      pause()
      void audioCtxRef.current?.close()
      exportAbortRef.current?.abort()
    },
    [pause],
  )

  const sceneIndex = (() => {
    const i = timeline.scenes.findIndex((s) => t < s.end)
    return i === -1 ? timeline.scenes.length - 1 : i
  })()

  /** 재생 중이면 그 장면 처음부터, 멈춰 있으면 장면 끝 화면 */
  const goScene = (i: number) => {
    const idx = Math.max(0, Math.min(timeline.scenes.length - 1, i))
    seek(playing ? timeline.scenes[idx].start : sceneSettledTime(timeline, idx), true)
  }

  // ── 내보내기 ─────────────────────────────────────────────
  const exporting = exportState.kind === 'running'
  const audio = audioState.kind === 'ready' ? audioState.audio : null
  const encoderOk = support ? support.video && support.audio : null

  useEffect(() => {
    if (!exporting) return
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [exporting])

  useEffect(() => {
    if (exportState.kind !== 'done') return
    const url = exportState.url
    return () => URL.revokeObjectURL(url)
  }, [exportState])

  async function handleExport() {
    if (!audio) return
    pause()
    setNotice(null)
    const abort = new AbortController()
    exportAbortRef.current = abort
    const startedAt = performance.now()
    setExportState({ kind: 'running', frame: 0, totalFrames: 0, startedAt })
    try {
      const { exportLectureMp4, checkEncoderSupport, UNSUPPORTED_ENCODER_MESSAGE } = await import('@/lib/grammar/video/export/encode')
      const s = await checkEncoderSupport()
      if (!s.video || !s.audio) {
        setExportState({ kind: 'idle' })
        return setNotice({ kind: 'error', text: UNSUPPORTED_ENCODER_MESSAGE })
      }
      const blob = await exportLectureMp4({
        scenes,
        timeline,
        audio,
        subtitles: burnSubtitles,
        images: sceneImages.images,
        signal: abort.signal,
        onProgress: (p) => setExportState({ kind: 'running', frame: p.frame, totalFrames: p.totalFrames, startedAt }),
      })
      const elapsedMs = performance.now() - startedAt
      downloadBlob(blob, `${fileBase}.mp4`)
      setExportState({ kind: 'done', blob, url: URL.createObjectURL(blob), elapsedMs })
      setNotice({ kind: 'ok', text: `MP4를 만들었어요 (${formatSize(blob.size)}, ${formatClock(elapsedMs)} 걸림). 내려받기가 시작됩니다.` })
    } catch (error) {
      setExportState({ kind: 'idle' })
      if (isAbort(error)) return setNotice({ kind: 'warn', text: 'MP4 만들기를 취소했어요.' })
      console.error('[lecture-export] MP4 실패:', error)
      setNotice({ kind: 'error', text: `MP4를 만들지 못했어요. ${error instanceof Error ? error.message : ''}`.trim() })
    } finally {
      exportAbortRef.current = null
    }
  }

  async function downloadExtra(kind: 'srt' | 'description' | 'thumbnail' | 'm4a' | 'script') {
    setNotice(null)
    setBusyFile(kind)
    try {
      if (kind === 'srt') downloadBlob(textBlob(toSrt(timeline)), `${fileBase}.srt`)
      else if (kind === 'description') downloadBlob(textBlob(buildYoutubeDescription(scenes, timeline, point)), `${fileBase}-설명문.txt`)
      else if (kind === 'script') downloadBlob(textBlob(buildScriptText(scenes, timeline, script.title, point)), `${fileBase}-스크립트.txt`)
      else if (kind === 'thumbnail') downloadBlob(await renderThumbnailPng(scenes, timeline, sceneImages.images), `${fileBase}-썸네일.png`)
      else if (kind === 'm4a') {
        if (!audio) return
        const { exportNarrationM4a, checkEncoderSupport, UNSUPPORTED_ENCODER_MESSAGE } = await import('@/lib/grammar/video/export/encode')
        const s = await checkEncoderSupport()
        if (!s.audio) return setNotice({ kind: 'error', text: UNSUPPORTED_ENCODER_MESSAGE })
        downloadBlob(await exportNarrationM4a(audio), `${fileBase}-음성.m4a`)
      }
    } catch (error) {
      console.error('[lecture-export] 파일 실패:', error)
      setNotice({ kind: 'error', text: '파일을 만들지 못했어요. 잠시 후 다시 시도해 주세요.' })
    } finally {
      setBusyFile(null)
    }
  }

  if (scenes.length === 0) {
    return <p className="rounded-xl border border-dashed border-gray-200 p-8 text-center text-sm text-gray-500">장면이 없어요.</p>
  }

  const pct = exportState.kind === 'running' && exportState.totalFrames ? Math.round((exportState.frame / exportState.totalFrames) * 100) : 0
  const loadPct = audioState.kind === 'loading' && audioState.total ? Math.round((audioState.done / audioState.total) * 100) : 0

  return (
    <div className="space-y-5">
      <NoticeBox notice={notice} />

      {/* 미리보기 */}
      <div className="space-y-3">
        <VideoCanvas
          scenes={scenes}
          timeline={timeline}
          t={t}
          subtitles={subtitles}
          images={sceneImages.images}
          onFontsReady={setFontsLoaded}
        />
        {sceneImages.loading && <p className="text-xs text-gray-500">배경 그림 불러오는 중…</p>}
        {sceneImages.error && <p className="text-xs text-[#D92916]">{sceneImages.error}</p>}

        {audioState.kind === 'loading' && (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            음성 불러오는 중 {audioState.total ? `${audioState.done}/${audioState.total} (${loadPct}%)` : ''}
          </div>
        )}
        {audioState.kind === 'error' && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#D92916]/30 bg-[#FDECEA] px-4 py-3 text-sm text-[#B42318]">
            <span className="flex-1">{audioState.message}</span>
            <Button type="button" variant="outline" className="h-11 bg-white" onClick={() => setLoadKey((k) => k + 1)}>
              <RefreshCw className="mr-1 h-4 w-4" />
              음성 다시 불러오기
            </Button>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            className="h-11 bg-[#1865F2] hover:bg-[#1554C9]"
            onClick={playing ? pause : () => void play()}
            disabled={exporting || audioState.kind === 'loading'}
          >
            {playing ? <Pause className="mr-1.5 h-4 w-4" /> : <Play className="mr-1.5 h-4 w-4" />}
            {playing ? '정지' : audio ? '재생' : '소리 없이 재생'}
          </Button>
          <Button type="button" variant="outline" className="h-11" onClick={() => goScene(sceneIndex - 1)} disabled={exporting}>
            <SkipBack className="mr-1.5 h-4 w-4" />
            이전 장면
          </Button>
          <Button type="button" variant="outline" className="h-11" onClick={() => goScene(sceneIndex + 1)} disabled={exporting}>
            <SkipForward className="mr-1.5 h-4 w-4" />
            다음 장면
          </Button>
          <span className="ml-auto" />
          <Button type="button" variant="outline" className="h-11" aria-pressed={subtitles} onClick={() => setSubtitles((v) => !v)}>
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
            disabled={exporting}
            onChange={(e) => seek(Number(e.target.value), false)}
            className="h-11 flex-1 accent-[#1865F2]"
          />
          <span className="w-16 font-mono text-sm tabular-nums text-gray-500">{formatTime(timeline.duration)}</span>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {timeline.scenes.map((s, i) => (
            <button
              key={s.id}
              type="button"
              disabled={exporting}
              onClick={() => goScene(i)}
              className={cn(
                'min-h-[44px] shrink-0 rounded-full border px-4 text-sm',
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
        {fontsLoaded === false && (
          <p className="text-sm text-[#D92916]">글꼴 일부를 불러오지 못해 대체 글꼴로 그려졌어요. 네트워크를 확인한 뒤 새로고침해 주세요.</p>
        )}
      </div>

      {/* MP4 */}
      <div className="space-y-3 rounded-xl border border-gray-200 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h4 className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
              <Film className="h-4 w-4 text-[#1865F2]" />
              YouTube용 MP4
            </h4>
            <p className="mt-0.5 text-xs text-gray-500">
              1920×1080 · 30fps · H.264/AAC · 길이 {formatTime(timeline.duration)} · {fileBase}.mp4
            </p>
            <p className="mt-0.5 text-xs text-gray-400">
              만드는 동안 이 탭을 닫지 마세요. 3분 영상 기준 수 분 걸릴 수 있어요.
            </p>
          </div>
          <label className="flex min-h-[44px] items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={burnSubtitles}
              disabled={exporting}
              onChange={(e) => setBurnSubtitles(e.target.checked)}
              className="h-4 w-4 accent-[#1865F2]"
            />
            영상에 자막 넣기
          </label>
        </div>

        {encoderOk === false && (
          <p className="rounded-lg bg-[#FFF4D6] px-3 py-2 text-sm text-[#8A5A00]">
            이 브라우저는 영상 인코딩을 지원하지 않아요. Chrome 또는 Edge 데스크톱에서 만들어 주세요.
          </p>
        )}

        {exportState.kind === 'running' ? (
          <div className="space-y-2">
            <div className="h-2 overflow-hidden rounded-full bg-gray-100" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full bg-[#1865F2] transition-all" style={{ width: `${pct}%` }} />
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
              <Loader2 className="h-4 w-4 animate-spin" />
              {exportState.totalFrames ? `${exportState.frame}/${exportState.totalFrames} 프레임 (${pct}%)` : '준비 중…'}
              <Button type="button" variant="outline" className="ml-auto h-11" onClick={() => exportAbortRef.current?.abort()}>
                <X className="mr-1 h-4 w-4" />
                취소
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              className="h-11 bg-[#1865F2] hover:bg-[#1554C9]"
              onClick={handleExport}
              disabled={!audio || encoderOk === false || sceneImages.loading}
            >
              <Film className="mr-1.5 h-4 w-4" />
              {exportState.kind === 'done' ? 'MP4 다시 만들기' : 'MP4 만들기'}
            </Button>
            {exportState.kind === 'done' && (
              <Button type="button" variant="outline" className="h-11" onClick={() => downloadBlob(exportState.blob, `${fileBase}.mp4`)}>
                <Download className="mr-1.5 h-4 w-4" />
                다시 받기 ({formatSize(exportState.blob.size)})
              </Button>
            )}
            {!audio && <span className="text-xs text-gray-500">음성을 다 불러와야 만들 수 있어요.</span>}
          </div>
        )}

        {exportState.kind === 'done' && (
          <div className="space-y-1">
            <p className="text-xs text-gray-500">만든 영상 확인 — 만드는 데 {formatClock(exportState.elapsedMs)} 걸림</p>
            <video src={exportState.url} controls className="aspect-video w-full rounded-xl border border-gray-200 bg-black" />
          </div>
        )}
      </div>

      <RemotionPanel
        scriptId={script.id}
        scenes={scenes}
        audioUrls={audioUrls}
        imageUrls={sceneImages.urls}
        subtitles={burnSubtitles}
      />

      {/* 함께 내려받기 */}
      <div className="space-y-3 rounded-xl border border-gray-200 p-4">
        <div>
          <h4 className="text-sm font-semibold text-gray-900">함께 내려받기</h4>
          <p className="mt-0.5 text-xs text-gray-500">
            자막(SRT)은 YouTube 스튜디오 자막에, 설명문은 설명란에 붙여 넣으세요.
            {chapters.length > 0 ? ` 챕터 ${chapters.length}개 포함.` : ' 영상이 짧아 챕터는 들어가지 않아요(3개 이상·각 10초 이상 필요).'}
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {(
            [
              { kind: 'srt', label: '자막 SRT', icon: Subtitles },
              { kind: 'description', label: 'YouTube 설명문 .txt', icon: FileText },
              { kind: 'thumbnail', label: '썸네일 PNG (1280×720)', icon: ImageIcon },
              { kind: 'm4a', label: '전체 나레이션 .m4a', icon: Music, needsAudio: true },
              { kind: 'script', label: '스크립트 .txt', icon: FileText },
            ] as const
          ).map((item) => {
            const Icon = item.icon
            const disabled = Boolean(busyFile) || exporting || ('needsAudio' in item && !audio)
            return (
              <Button
                key={item.kind}
                type="button"
                variant="outline"
                className="h-11 justify-start"
                disabled={disabled}
                onClick={() => downloadExtra(item.kind)}
              >
                {busyFile === item.kind ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Icon className="mr-1.5 h-4 w-4" />}
                {item.label}
              </Button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
