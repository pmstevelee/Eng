'use client'

// 강의 등록 폼 — YouTube 링크 입력 → "링크 확인"(영상 ID·재생 가능 여부·길이 확인) → 제목·길이·노트 링크 → 저장
// 관리자 포인트 "강의" 탭과 교사·학원장 반 배정 화면(3-1)이 같이 쓴다. 저장 동작은 onSubmit으로 받는다.

import { useEffect, useRef, useState, useTransition } from 'react'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  LECTURE_TITLE_MAX,
  formatLectureDuration,
  parseLectureDuration,
  parseYoutubeUrl,
} from '@/lib/grammar/lecture-input'
import { cn } from '@/lib/utils'
import {
  YOUTUBE_NOCOOKIE_HOST,
  YT_STATE,
  loadYoutubeIframeApi,
  youtubeErrorMessage,
  youtubePlayerVars,
  type YtPlayer,
} from './youtube-iframe-api'

export interface LectureFormValues {
  url: string
  title: string
  durationSec: number | null
  notesUrl: string
}

export type LectureFormResult = { ok: true } | { ok: false; error: string }

interface Props {
  initial?: Partial<LectureFormValues>
  onSubmit: (values: LectureFormValues) => Promise<LectureFormResult>
  onCancel?: () => void
  submitLabel?: string
}

type Check =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'ok'; durationSec: number | null }
  /** 재생 가능 여부를 끝내 확인하지 못함 — 길이는 직접 입력 */
  | { kind: 'unknown' }
  | { kind: 'error' }

const CHECK_TIMEOUT_MS = 12000
const DURATION_WAIT_MS = 6000

/** 숨긴 플레이어로 재생 가능 여부·길이·제목 확인 */
function probeVideo(
  host: HTMLElement,
  videoId: string,
): Promise<{ ok: true; durationSec: number | null; title: string | null } | { ok: false; error: string } | { ok: 'timeout' }> {
  return new Promise((resolve) => {
    let player: YtPlayer | null = null
    let done = false
    const mount = document.createElement('div')
    host.appendChild(mount)

    const finish = (r: Parameters<typeof resolve>[0]) => {
      if (done) return
      done = true
      window.clearTimeout(timeout)
      try {
        player?.destroy()
      } catch {
        // 이미 사라진 플레이어
      }
      mount.remove()
      resolve(r)
    }
    const timeout = window.setTimeout(() => finish({ ok: 'timeout' }), CHECK_TIMEOUT_MS)

    const readTitle = (p: YtPlayer) => {
      try {
        return p.getVideoData?.().title?.trim() || null
      } catch {
        return null
      }
    }

    loadYoutubeIframeApi()
      .then((YT) => {
        if (done) return
        player = new YT.Player(mount, {
          videoId,
          host: YOUTUBE_NOCOOKIE_HOST,
          width: 320,
          height: 180,
          playerVars: { ...youtubePlayerVars(), mute: 1 },
          events: {
            onReady: (e) => {
              const p = e.target
              const d = p.getDuration()
              if (d > 0) {
                finish({ ok: true, durationSec: Math.round(d), title: readTitle(p) })
                return
              }
              // 길이를 바로 안 주는 영상 — 소리 없이 잠깐 재생해 메타데이터를 받는다
              p.mute()
              p.playVideo()
              const started = Date.now()
              const poll = window.setInterval(() => {
                if (done) return window.clearInterval(poll)
                const dd = p.getDuration()
                if (dd > 0 || Date.now() - started > DURATION_WAIT_MS) {
                  window.clearInterval(poll)
                  try {
                    p.stopVideo()
                  } catch {
                    // 무시
                  }
                  finish({ ok: true, durationSec: dd > 0 ? Math.round(dd) : null, title: readTitle(p) })
                }
              }, 300)
            },
            onStateChange: (e) => {
              if (e.data === YT_STATE.PLAYING && e.target.getDuration() > 0) {
                const p = e.target
                try {
                  p.stopVideo()
                } catch {
                  // 무시
                }
                finish({ ok: true, durationSec: Math.round(p.getDuration()), title: readTitle(p) })
              }
            },
            onError: (e) => finish({ ok: false, error: youtubeErrorMessage(e.data) }),
          },
        })
      })
      .catch(() => finish({ ok: 'timeout' }))
  })
}

export function LectureForm({ initial, onSubmit, onCancel, submitLabel = '강의 저장' }: Props) {
  const [url, setUrl] = useState(initial?.url ?? '')
  const [title, setTitle] = useState(initial?.title ?? '')
  const [duration, setDuration] = useState(initial?.durationSec ? formatLectureDuration(initial.durationSec) : '')
  const [notesUrl, setNotesUrl] = useState(initial?.notesUrl ?? '')
  // 수정 화면은 이미 저장된 링크라 확인된 것으로 시작
  const [check, setCheck] = useState<Check>(
    initial?.url && parseYoutubeUrl(initial.url) ? { kind: 'ok', durationSec: initial.durationSec ?? null } : { kind: 'idle' },
  )
  const [urlError, setUrlError] = useState('')
  const [formError, setFormError] = useState('')
  const [saving, startSaving] = useTransition()
  const probeHost = useRef<HTMLDivElement>(null)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  async function handleCheck() {
    setFormError('')
    const trimmed = url.trim()
    if (!trimmed) {
      setUrlError('YouTube 링크를 입력해 주세요.')
      return
    }
    const videoId = parseYoutubeUrl(trimmed)
    if (!videoId) {
      setUrlError('YouTube 영상 링크 형식이 아니에요. 예: https://youtu.be/영상ID')
      return
    }
    if (!probeHost.current) return
    setUrlError('')
    setCheck({ kind: 'checking' })
    const r = await probeVideo(probeHost.current, videoId)
    if (!mounted.current) return
    if (r.ok === true) {
      setCheck({ kind: 'ok', durationSec: r.durationSec })
      if (r.durationSec) setDuration(formatLectureDuration(r.durationSec))
      if (!title.trim() && r.title) setTitle(r.title.slice(0, LECTURE_TITLE_MAX))
    } else if (r.ok === 'timeout') {
      setCheck({ kind: 'unknown' })
    } else {
      setCheck({ kind: 'error' })
      setUrlError(r.error)
    }
  }

  function handleUrlChange(value: string) {
    setUrl(value)
    setUrlError('')
    setFormError('')
    if (check.kind !== 'idle') setCheck({ kind: 'idle' })
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError('')
    if (check.kind !== 'ok' && check.kind !== 'unknown') {
      setUrlError(check.kind === 'error' ? urlError || '재생할 수 없는 영상이에요.' : '먼저 "링크 확인"을 눌러 주세요.')
      return
    }
    if (!title.trim()) {
      setFormError('강의 제목을 입력해 주세요.')
      return
    }
    let durationSec: number | null = null
    if (duration.trim()) {
      durationSec = parseLectureDuration(duration)
      if (durationSec === null || durationSec <= 0) {
        setFormError('강의 길이는 "12:05"처럼 분:초로 입력해 주세요.')
        return
      }
    }
    startSaving(async () => {
      const res = await onSubmit({ url: url.trim(), title: title.trim(), durationSec, notesUrl: notesUrl.trim() }).catch(
        (): LectureFormResult => ({ ok: false, error: '저장하지 못했어요. 잠시 후 다시 시도해 주세요.' }),
      )
      if (!res.ok && mounted.current) setFormError(res.error)
    })
  }

  const checked = check.kind === 'ok' || check.kind === 'unknown'

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div className="space-y-1.5">
        <Label htmlFor="lecture-url">YouTube 링크</Label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            id="lecture-url"
            value={url}
            onChange={(e) => handleUrlChange(e.target.value)}
            placeholder="https://youtu.be/..."
            inputMode="url"
            autoComplete="off"
            aria-invalid={urlError ? true : undefined}
            aria-describedby="lecture-url-help"
            className={cn('h-11 flex-1', urlError && 'border-[#D92916] focus-visible:ring-[#D92916]')}
          />
          <Button
            type="button"
            variant="outline"
            onClick={handleCheck}
            disabled={check.kind === 'checking'}
            className="h-11 shrink-0"
          >
            {check.kind === 'checking' ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
            링크 확인
          </Button>
        </div>
        <div id="lecture-url-help" className="min-h-[20px] text-sm" aria-live="polite">
          {urlError ? (
            <p className="text-[#D92916]">{urlError}</p>
          ) : check.kind === 'checking' ? (
            <p className="text-gray-500">영상을 확인하고 있어요...</p>
          ) : check.kind === 'ok' ? (
            <p className="flex items-center gap-1 text-[#1FAF54]">
              <CheckCircle2 className="h-4 w-4" />
              재생할 수 있는 영상이에요{check.durationSec ? ` · 길이 ${formatLectureDuration(check.durationSec)}` : ''}
            </p>
          ) : check.kind === 'unknown' ? (
            <p className="text-[#8A5A00]">재생 여부를 확인하지 못했어요. 길이를 직접 입력하고 저장할 수 있어요.</p>
          ) : (
            <p className="text-gray-500">일부공개(링크가 있는 사용자만) 영상도 됩니다. 퍼가기 허용이 켜져 있어야 해요.</p>
          )}
        </div>
      </div>

      {/* 링크 확인용 숨긴 플레이어 (화면 밖) */}
      <div ref={probeHost} aria-hidden className="pointer-events-none fixed -left-[9999px] top-0 h-[180px] w-[320px] opacity-0" />

      <fieldset disabled={!checked || saving} className="space-y-4 disabled:opacity-60">
        <div className="space-y-1.5">
          <Label htmlFor="lecture-title">강의 제목</Label>
          <Input
            id="lecture-title"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value)
              setFormError('')
            }}
            maxLength={LECTURE_TITLE_MAX}
            placeholder="예: 현재완료 한 번에 정리"
            className="h-11"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
          <div className="space-y-1.5">
            <Label htmlFor="lecture-duration">길이 (분:초)</Label>
            <Input
              id="lecture-duration"
              value={duration}
              onChange={(e) => {
                setDuration(e.target.value)
                setFormError('')
              }}
              placeholder="12:05"
              inputMode="numeric"
              className="h-11"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lecture-notes">강의 노트 링크 (선택)</Label>
            <Input
              id="lecture-notes"
              value={notesUrl}
              onChange={(e) => {
                setNotesUrl(e.target.value)
                setFormError('')
              }}
              placeholder="https://..."
              inputMode="url"
              className="h-11"
            />
          </div>
        </div>
      </fieldset>

      {formError && <p className="rounded-lg bg-[#FDECEA] px-3 py-2 text-sm text-[#B42318]">{formError}</p>}

      <div className="flex flex-wrap justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={saving} className="h-11">
            취소
          </Button>
        )}
        <Button type="submit" disabled={!checked || saving} className="h-11 bg-[#1865F2] hover:bg-[#1558d6]">
          {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}
