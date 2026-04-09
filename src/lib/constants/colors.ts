// ── IVY LMS 색상 상수 ─────────────────────────────────────────────────
// Recharts, Chart.js 등 차트 라이브러리에서 재사용

// Primary (네이비 블루)
export const PRIMARY = {
  900: '#0C2340',
  800: '#1B3A5C',
  700: '#1865F2',
  600: '#4B8AF5',
  100: '#EEF4FF',
  50: '#F7F9FC',
} as const

// Accent
export const ACCENT = {
  green: '#1FAF54',
  greenLight: '#E6F7ED',
  gold: '#FFB100',
  goldLight: '#FFF8E6',
  red: '#D92916',
  redLight: '#FFF0EE',
  purple: '#7854F7',
  purpleLight: '#F3EFFF',
  teal: '#0FBFAD',
  tealLight: '#E6FAF8',
} as const

// Neutral
export const GRAY = {
  900: '#21242C',
  700: '#3B3E48',
  500: '#6B6F7A',
  300: '#BABEC7',
  200: '#E3E5EA',
  100: '#F0F1F3',
  50: '#F7F8F9',
} as const

// ── 영어 학습 5영역 색상 ──────────────────────────────────────────────
export const DOMAIN_COLORS = {
  grammar: '#1865F2',     // 문법 - 블루
  vocabulary: '#7854F7',  // 어휘 - 퍼플
  reading: '#0FBFAD',     // 읽기 - 틸
  listening: '#E91E8A',   // 듣기 - 핑크
  writing: '#E35C20',     // 쓰기 - 오렌지
} as const

export const DOMAIN_BG_COLORS = {
  grammar: '#EEF4FF',
  vocabulary: '#F3EFFF',
  reading: '#E6FAF8',
  listening: '#FDE7F3',
  writing: '#FFF3EE',
} as const

export const DOMAIN_LABELS_KO = {
  grammar: '문법',
  vocabulary: '어휘',
  reading: '읽기',
  listening: '듣기',
  writing: '쓰기',
} as const

// ── 레이더 차트용 설정 ────────────────────────────────────────────────
export const RADAR_CHART_CONFIG = {
  gridColor: GRAY[200],
  labelColor: GRAY[500],
  domains: [
    { key: 'grammar', label: '문법', color: DOMAIN_COLORS.grammar },
    { key: 'vocabulary', label: '어휘', color: DOMAIN_COLORS.vocabulary },
    { key: 'reading', label: '읽기', color: DOMAIN_COLORS.reading },
    { key: 'listening', label: '듣기', color: DOMAIN_COLORS.listening },
    { key: 'writing', label: '쓰기', color: DOMAIN_COLORS.writing },
  ],
} as const

// ── 상태별 색상 (배지 등) ─────────────────────────────────────────────
export const STATUS_COLORS = {
  active: { bg: ACCENT.greenLight, text: ACCENT.green },
  pending: { bg: ACCENT.goldLight, text: ACCENT.gold },
  expired: { bg: ACCENT.redLight, text: ACCENT.red },
  info: { bg: PRIMARY[100], text: PRIMARY[700] },
} as const
