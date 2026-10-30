// 위고업잉글리시 강의 영상 디자인 토큰 (영상 전용 — LMS 화면 색상 규칙과 별개)
// Remotion 번들러가 '@/' 별칭을 모르므로 이 폴더는 상대 경로만 쓴다.

import type { Role } from '../../lib/lecture-pipeline/types'

export const VIDEO = { width: 1920, height: 1080, fps: 30 } as const
export const THUMB = { width: 1280, height: 720 } as const

export const COLOR = {
  indigo: '#4458F6',
  indigoSoft: '#E6E9FE',
  indigoDeep: '#2F3FD0',
  navy: '#1B2559',
  navyDeep: '#0E1638',
  bg: '#F5F6FA',
  card: '#FFFFFF',
  line: '#E1E4EE',
  text: '#1B2233',
  muted: '#5B6478',
  teal: '#0E9F9A',
  tealSoft: '#DDF4F3',
  red: '#E5484D',
  redSoft: '#FDE8E8',
  green: '#18A957',
  greenSoft: '#DFF5E8',
  gold: '#FFB100',
  goldSoft: '#FFF3D6',
} as const

/** 문장 성분 색 — 동사=인디고, 주어=틸, 오류=레드, 정답=그린 */
export const ROLE_COLOR: Record<Role, { fg: string; bg: string }> = {
  subject: { fg: COLOR.teal, bg: COLOR.tealSoft },
  verb: { fg: COLOR.indigo, bg: COLOR.indigoSoft },
  object: { fg: COLOR.navy, bg: '#E8EAF2' },
  error: { fg: COLOR.red, bg: COLOR.redSoft },
  correct: { fg: COLOR.green, bg: COLOR.greenSoft },
}

export const FONT = {
  family: "'Pretendard', 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif",
  /** 영어 예문 — Pretendard의 라틴 글꼴(Inter 계열)이 가독성이 좋아 같은 글꼴을 쓴다 */
  english: "'Pretendard', 'Inter', 'Helvetica Neue', Arial, sans-serif",
} as const

/** 최소 글자 크기 48px (모바일 시청) — 화면 안내 워터마크만 예외 */
export const MIN_FONT = 48

/** 글자가 길면 줄이되 48px 아래로는 줄이지 않는다 */
export function fitSize(text: string, base: number, fitChars: number): number {
  const len = Array.from(text.replace(/\*\*/g, '')).length
  if (len <= fitChars) return base
  return Math.max(MIN_FONT, Math.round((base * fitChars) / len))
}

/** 화면 영역 */
export const LAYOUT = {
  padX: 150,
  top: 120,
  /** 자막·진행바를 위해 비워 두는 아래쪽 */
  bottomReserve: 210,
} as const
