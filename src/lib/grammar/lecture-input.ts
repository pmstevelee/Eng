// 문법 강의(YouTube 링크) 입력 처리 — 순수 함수 (DB·@/ 의존 없음, vitest 대상)

/** 이 시청률(%) 이상이면 강의 완료 */
export const LECTURE_COMPLETE_PERCENT = 80

export const LECTURE_TITLE_MAX = 100
/** 강의 길이 상한(초) — 3시간 */
export const LECTURE_DURATION_MAX = 3 * 60 * 60

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/
const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
])

/**
 * YouTube 링크에서 11자 영상 ID를 꺼낸다.
 * youtu.be/ID, youtube.com/watch?v=ID, /embed/ID, /shorts/ID, /live/ID, /v/ID 형식. 아니면 null.
 */
export function parseYoutubeUrl(input: string): string | null {
  const raw = (input ?? '').trim()
  if (!raw) return null
  let url: URL
  try {
    url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`)
  } catch {
    return null
  }
  const host = url.hostname.toLowerCase()
  const segments = url.pathname.split('/').filter(Boolean)

  let id: string | null = null
  if (host === 'youtu.be' || host === 'www.youtu.be') {
    id = segments[0] ?? null
  } else if (YOUTUBE_HOSTS.has(host)) {
    if (segments[0] === 'watch') id = url.searchParams.get('v')
    else if (['embed', 'shorts', 'live', 'v'].includes(segments[0] ?? '')) id = segments[1] ?? null
  }
  return id && VIDEO_ID.test(id) ? id : null
}

/** 초 → "12:05" / "1:02:03" */
export function formatLectureDuration(sec: number | null | undefined): string {
  if (sec == null || !Number.isFinite(sec) || sec <= 0) return '-'
  const s = Math.round(sec)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = s % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(r)}` : `${m}:${pad(r)}`
}

/** "12:05", "1:02:03", "725" → 초. 형식이 틀리면 null */
export function parseLectureDuration(input: string): number | null {
  const raw = (input ?? '').trim()
  if (!raw) return null
  if (/^\d+$/.test(raw)) return Number(raw)
  const m = raw.match(/^(?:(\d+):)?(\d{1,2}):(\d{2})$/)
  if (!m) return null
  const h = m[1] ? Number(m[1]) : 0
  const min = Number(m[2])
  const sec = Number(m[3])
  if (sec >= 60 || (m[1] && min >= 60)) return null
  return h * 3600 + min * 60 + sec
}

export interface LectureInput {
  title: string
  videoId: string
  durationSec: number | null
  notesUrl: string | null
}

export type LectureInputResult = { ok: true; value: LectureInput } | { ok: false; error: string }

function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value)
    return u.protocol === 'https:' || u.protocol === 'http:'
  } catch {
    return false
  }
}

/** 강의 저장 입력 검증 (서버 액션에서 다시 확인) */
export function validateLectureInput(input: unknown): LectureInputResult {
  if (!input || typeof input !== 'object') return { ok: false, error: '입력값이 올바르지 않습니다.' }
  const o = input as Record<string, unknown>

  const url = typeof o.url === 'string' ? o.url : ''
  const videoId = parseYoutubeUrl(url)
  if (!videoId) return { ok: false, error: 'YouTube 영상 링크를 확인해 주세요.' }

  const title = typeof o.title === 'string' ? o.title.trim() : ''
  if (!title) return { ok: false, error: '강의 제목을 입력해 주세요.' }
  if (title.length > LECTURE_TITLE_MAX) return { ok: false, error: `강의 제목은 ${LECTURE_TITLE_MAX}자까지 쓸 수 있어요.` }

  let durationSec: number | null = null
  if (o.durationSec !== null && o.durationSec !== undefined && o.durationSec !== '') {
    const n = typeof o.durationSec === 'number' ? o.durationSec : Number(o.durationSec)
    if (!Number.isFinite(n) || n <= 0 || n > LECTURE_DURATION_MAX) {
      return { ok: false, error: '강의 길이를 확인해 주세요. (최대 3시간)' }
    }
    durationSec = Math.round(n)
  }

  const notesRaw = typeof o.notesUrl === 'string' ? o.notesUrl.trim() : ''
  if (notesRaw && !isHttpUrl(notesRaw)) return { ok: false, error: '강의 노트 링크는 http(s)://로 시작해야 해요.' }

  return { ok: true, value: { title, videoId, durationSec, notesUrl: notesRaw || null } }
}

/** 학생에게 보여 줄 강의 1편 — 학원 강의 우선, 없으면 본사 기본(academyId null) */
export function pickLectureForAcademy<T extends { academyId: string | null }>(lectures: T[], academyId: string): T | null {
  return lectures.find((l) => l.academyId === academyId) ?? lectures.find((l) => l.academyId === null) ?? null
}

/** YouTube 영상 보기 링크 */
export function youtubeWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`
}
