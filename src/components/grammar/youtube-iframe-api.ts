'use client'

// YouTube IFrame API — npm 패키지 없이 script 태그로 한 번만 불러온다.
// 쓰는 기능만 최소한으로 타입을 정의한다.

export const YT_STATE = {
  UNSTARTED: -1,
  ENDED: 0,
  PLAYING: 1,
  PAUSED: 2,
  BUFFERING: 3,
  CUED: 5,
} as const

export interface YtPlayer {
  playVideo(): void
  pauseVideo(): void
  stopVideo(): void
  mute(): void
  getCurrentTime(): number
  getDuration(): number
  getPlayerState(): number
  /** 공식 문서에는 없지만 대부분 제공 — 없을 수 있어 선택으로 둔다 */
  getVideoData?: () => { title?: string; video_id?: string }
  destroy(): void
}

export interface YtPlayerEvent {
  target: YtPlayer
  data: number
}

export interface YtPlayerOptions {
  videoId: string
  host?: string
  width?: string | number
  height?: string | number
  playerVars?: Record<string, string | number>
  events?: {
    onReady?: (e: YtPlayerEvent) => void
    onStateChange?: (e: YtPlayerEvent) => void
    onError?: (e: YtPlayerEvent) => void
  }
}

export interface YtNamespace {
  Player: new (element: HTMLElement | string, options: YtPlayerOptions) => YtPlayer
}

declare global {
  interface Window {
    YT?: YtNamespace & { loaded?: number }
    onYouTubeIframeAPIReady?: () => void
  }
}

const SCRIPT_SRC = 'https://www.youtube.com/iframe_api'
const LOAD_TIMEOUT_MS = 15000

let loading: Promise<YtNamespace> | null = null

/** IFrame API 불러오기 — 여러 컴포넌트가 불러도 script는 한 번만 붙는다 */
export function loadYoutubeIframeApi(): Promise<YtNamespace> {
  if (typeof window === 'undefined') return Promise.reject(new Error('브라우저에서만 쓸 수 있어요.'))
  if (window.YT?.Player) return Promise.resolve(window.YT)
  if (loading) return loading

  loading = new Promise<YtNamespace>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      loading = null
      reject(new Error('YouTube 플레이어를 불러오지 못했어요.'))
    }, LOAD_TIMEOUT_MS)

    const prev = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      prev?.()
      window.clearTimeout(timer)
      if (window.YT?.Player) resolve(window.YT)
      else {
        loading = null
        reject(new Error('YouTube 플레이어를 불러오지 못했어요.'))
      }
    }

    if (!document.querySelector(`script[src="${SCRIPT_SRC}"]`)) {
      const script = document.createElement('script')
      script.src = SCRIPT_SRC
      script.async = true
      script.onerror = () => {
        window.clearTimeout(timer)
        loading = null
        script.remove()
        reject(new Error('YouTube 플레이어를 불러오지 못했어요.'))
      }
      document.head.appendChild(script)
    }
  })
  return loading
}

/** 플레이어 오류 코드 → 안내 문구 */
export function youtubeErrorMessage(code: number): string {
  switch (code) {
    case 2:
      return '영상 링크가 올바르지 않아요.'
    case 5:
      return '이 브라우저에서 재생할 수 없는 영상이에요.'
    case 100:
      return '영상을 찾을 수 없어요. 삭제됐거나 비공개 영상인지 확인해 주세요.'
    case 101:
    case 150:
      return '퍼가기(다른 사이트에서 재생)가 허용되지 않은 영상이에요. YouTube 설정에서 퍼가기를 허용해 주세요.'
    default:
      return '영상을 재생할 수 없어요.'
  }
}

/** 공통 플레이어 옵션 — 쿠키 없는 도메인, 관련 영상은 같은 채널만 */
export function youtubePlayerVars(): Record<string, string | number> {
  return {
    rel: 0,
    playsinline: 1,
    modestbranding: 1,
    enablejsapi: 1,
    origin: window.location.origin,
  }
}

export const YOUTUBE_NOCOOKIE_HOST = 'https://www.youtube-nocookie.com'
