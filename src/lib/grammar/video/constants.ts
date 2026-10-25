// AI 강의 영상 화면·타이밍 기준 (참고 샘플: 영문법 영상 샘플 — 수동태)
// 이 색·모눈은 영상 화면 전용이며 앱 화면 디자인 규칙(CLAUDE.md)과는 별개다.

import type { TokenRole } from '@/types/grammar-video'

/** 영상 크기 (px) */
export const VIDEO_WIDTH = 1920
export const VIDEO_HEIGHT = 1080
export const VIDEO_FPS = 30

/** 여백 — 아래 200은 자막 자리 */
export const VIDEO_PADDING = { top: 96, side: 140, bottom: 200 } as const

/** 모눈 칸 크기와 선 두께 */
export const GRID_SIZE = 60
export const GRID_LINE = 2

export const VIDEO_COLORS = {
  paper: '#FFFFFF',
  grid: '#E6ECFA',
  ink: '#18224B',
  soft: '#5D6584',
  /** 오프닝·정리 남색 배경 */
  night: '#18224B',
  nightText: '#FFFFFF',
  subj: '#2E5BFF',
  subjBg: '#E3EAFF',
  obj: '#E8650A',
  objBg: '#FFEADB',
  verb: '#0F8A5B',
  verbBg: '#D9F3E7',
  warn: '#E0364A',
  warnBg: '#FDE3E6',
  /** 자막 상자 (반투명 남색) */
  subtitleBg: 'rgba(16,22,52,0.86)',
  subtitleText: '#FFFFFF',
  /** 영어 자막·오프닝 영어 제목·구독 안내 */
  subtitleEn: '#FFD27A',
} as const

/** 색 역할 → 글자색/배경색 (strike는 배경 없이 회색 글자 + 빨간 취소선) */
export const TOKEN_ROLE_COLORS: Record<TokenRole, { fg: string; bg: string | null }> = {
  subj: { fg: VIDEO_COLORS.subj, bg: VIDEO_COLORS.subjBg },
  obj: { fg: VIDEO_COLORS.obj, bg: VIDEO_COLORS.objBg },
  verb: { fg: VIDEO_COLORS.verb, bg: VIDEO_COLORS.verbBg },
  warn: { fg: VIDEO_COLORS.warn, bg: VIDEO_COLORS.warnBg },
  strike: { fg: VIDEO_COLORS.soft, bg: null },
  hl: { fg: VIDEO_COLORS.verb, bg: VIDEO_COLORS.verbBg },
}

export const VIDEO_FONTS = {
  ko: '"Noto Sans KR", sans-serif',
  en: '"Lexend", "Noto Sans KR", sans-serif',
} as const

/** 글꼴 크기 (px) */
export const VIDEO_FONT_SIZES = {
  heading: 72,
  headingSmall: 40,
  openingSeries: 38,
  openingTitle: 230,
  openingTitleEn: 96,
  openingHook: 52,
  brand: 34,
  compareLabel: 50,
  compareSub: 30,
  compareSentence: 86,
  translation: 38,
  note: 42,
  stepNumber: 64,
  stepTitle: 44,
  stepExample: 44,
  formula: 58,
  variationLabel: 44,
  variationSentence: 62,
  caseTitle: 50,
  caseSentence: 76,
  warningRule: 54,
  warningSentence: 84,
  warningWords: 44,
  quizSentence: 68,
  quizHint: 44,
  summaryLine: 56,
  cta: 52,
  subtitle: 42,
} as const

/** 타이밍 (ms) */
export const VIDEO_TIMING = {
  /** 장면 시작 후 첫 문장까지 */
  sceneStartMs: 350,
  /** 문장 사이 */
  segmentGapMs: 260,
  /** 장면 끝 여유 */
  sceneEndMs: 600,
  /** 퀴즈 생각 시간 기본값 */
  quizWaitMs: 5000,
  /** 항목 등장 연출(페이드 + 위로 올라오기)·장면 전환 */
  revealMs: 450,
  /** 등장 연출 시작 위치 (아래로 18px) */
  revealOffsetPx: 18,
  /** 퀴즈 정답 페이드 */
  answerFadeMs: 350,
  /** 자막 페이드 */
  subtitleFadeMs: 200,
} as const

/** 음성이 없을 때 세그먼트 길이 예상치 */
export const SPEECH_ESTIMATE = {
  koMsPerChar: 120,
  enMsPerChar: 80,
  minMs: 1200,
} as const

/** 영어 원어민 음성 속도 (샘플 기준) */
export const EN_SPEECH_RATE = 0.88

export const VIDEO_BRAND = 'WeGoUp English'
