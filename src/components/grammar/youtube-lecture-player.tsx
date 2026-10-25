'use client'

// 문법 강의 YouTube 플레이어 — 실제로 본 구간만 모아 시청률을 계산한다.
//
// - 재생 중 1초마다 재생 위치를 샘플링해 본 구간을 합친다 (건너뛴 구간은 제외, watch-intervals.ts)
// - 서버 저장은 일시정지·종료·페이지 숨김·언마운트 때만 (onSave)
// - 본 구간은 localStorage에도 백업해 다시 들어오면 이어서 계산한다

import { useEffect, useRef, useState } from 'react'
import { AlertCircle, Loader2 } from 'lucide-react'
import { applySample, compactIntervals, parseIntervals, watchedPercent, type WatchInterval } from '@/lib/grammar/watch-intervals'
import {
  YOUTUBE_NOCOOKIE_HOST,
  YT_STATE,
  loadYoutubeIframeApi,
  youtubeErrorMessage,
  youtubePlayerVars,
  type YtPlayer,
} from './youtube-iframe-api'

interface Props {
  videoId: string
  title: string
  /** 등록된 길이(초) — 플레이어가 길이를 알려 주지 않을 때 사용 */
  durationSec: number | null
  /** localStorage 키 (학생·강의별) */
  storageKey: string
  /** 시청률이 바뀔 때마다 (화면 막대용) */
  onPercentChange?: (percent: number) => void
  /** 서버 저장 — 일시정지·종료·페이지 이탈 때, 마지막 저장값보다 클 때만 */
  onSave?: (percent: number) => void
}

const SAMPLE_MS = 1000

function readBackup(key: string): WatchInterval[] {
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? parseIntervals(JSON.parse(raw)) : []
  } catch {
    return []
  }
}

function writeBackup(key: string, intervals: WatchInterval[]) {
  try {
    window.localStorage.setItem(key, JSON.stringify(compactIntervals(intervals)))
  } catch {
    // 저장 공간이 없거나 막혀 있어도 재생은 계속
  }
}

export function YoutubeLecturePlayer({ videoId, title, durationSec, storageKey, onPercentChange, onSave }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [errorText, setErrorText] = useState('')

  // 콜백은 ref로 들고 있어 플레이어를 다시 만들지 않는다
  const onPercentRef = useRef(onPercentChange)
  const onSaveRef = useRef(onSave)
  onPercentRef.current = onPercentChange
  onSaveRef.current = onSave

  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    let cancelled = false
    let player: YtPlayer | null = null
    let timer: number | null = null

    let intervals = readBackup(storageKey)
    let lastSample: number | null = null
    let duration = durationSec ?? 0
    let lastReported = -1
    // 0%는 저장하지 않는다 (서버는 큰 값만 유지하므로 중복 저장은 무해)
    let lastSaved = 0

    const percent = () => watchedPercent(intervals, duration)

    function report() {
      const p = percent()
      if (p !== lastReported) {
        lastReported = p
        onPercentRef.current?.(p)
      }
    }

    function sample() {
      if (!player) return
      let t: number
      try {
        t = player.getCurrentTime()
      } catch {
        return
      }
      const next = applySample(intervals, lastSample, t)
      if (next.intervals !== intervals) {
        intervals = next.intervals
        writeBackup(storageKey, intervals)
        report()
      }
      lastSample = next.lastSample
    }

    function save() {
      const p = percent()
      if (p > lastSaved) {
        lastSaved = p
        onSaveRef.current?.(p)
      }
    }

    function stopTimer() {
      if (timer !== null) {
        window.clearInterval(timer)
        timer = null
      }
    }

    function startTimer() {
      if (timer === null) timer = window.setInterval(sample, SAMPLE_MS)
    }

    function onVisibility() {
      if (document.visibilityState === 'hidden') {
        sample()
        save()
      }
    }

    // React가 관리하지 않는 노드에 iframe을 붙인다 (플레이어가 노드를 iframe으로 바꾸기 때문)
    const mount = document.createElement('div')
    mount.className = 'h-full w-full'
    wrap.appendChild(mount)

    loadYoutubeIframeApi()
      .then((YT) => {
        if (cancelled) return
        player = new YT.Player(mount, {
          videoId,
          host: YOUTUBE_NOCOOKIE_HOST,
          width: '100%',
          height: '100%',
          playerVars: youtubePlayerVars(),
          events: {
            onReady: (e) => {
              if (cancelled) return
              const d = e.target.getDuration()
              if (d > 0) duration = d
              setStatus('ready')
              report()
            },
            onStateChange: (e) => {
              if (e.data === YT_STATE.PLAYING) {
                const d = e.target.getDuration()
                if (d > 0) duration = d
                sample()
                startTimer()
              } else if (e.data === YT_STATE.PAUSED) {
                sample()
                stopTimer()
                save()
              } else if (e.data === YT_STATE.ENDED) {
                sample()
                stopTimer()
                lastSample = null
                save()
              } else if (e.data === YT_STATE.BUFFERING) {
                sample()
              }
            },
            onError: (e) => {
              if (cancelled) return
              stopTimer()
              setErrorText(youtubeErrorMessage(e.data))
              setStatus('error')
            },
          },
        })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setErrorText(err instanceof Error ? err.message : 'YouTube 플레이어를 불러오지 못했어요.')
        setStatus('error')
      })

    document.addEventListener('visibilitychange', onVisibility)
    report()

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisibility)
      sample()
      stopTimer()
      save()
      try {
        player?.destroy()
      } catch {
        // 이미 사라진 플레이어
      }
      mount.remove()
    }
  }, [videoId, durationSec, storageKey])

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-gray-200 bg-gray-900">
      <div ref={wrapRef} className="absolute inset-0" aria-label={`강의 영상: ${title}`} />
      {status === 'loading' && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-gray-300">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          강의 영상을 불러오는 중...
        </div>
      )}
      {status === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 px-6 text-center">
          <AlertCircle className="h-8 w-8 text-[#FFB100]" />
          <p className="mt-3 text-sm font-medium text-white">{errorText}</p>
          <p className="mt-1 text-xs text-gray-400">선생님께 알려 주시고, 연습 문제로 넘어가도 괜찮아요.</p>
        </div>
      )}
    </div>
  )
}
