// ── 10단계 레벨 시스템 ──────────────────────────────────────────────────────────

export const LEVELS = [
  { level: 1,  cefr: 'Pre-A1', name: 'Beginner',                nameKo: '입문',      scoreMin: 0,  scoreMax: 10 },
  { level: 2,  cefr: 'A1 하',  name: 'Elementary Low',          nameKo: '기초 하',   scoreMin: 11, scoreMax: 20 },
  { level: 3,  cefr: 'A1 상',  name: 'Elementary High',         nameKo: '기초 상',   scoreMin: 21, scoreMax: 30 },
  { level: 4,  cefr: 'A2 하',  name: 'Pre-Intermediate Low',    nameKo: '초급 하',   scoreMin: 31, scoreMax: 40 },
  { level: 5,  cefr: 'A2 상',  name: 'Pre-Intermediate High',   nameKo: '초급 상',   scoreMin: 41, scoreMax: 50 },
  { level: 6,  cefr: 'B1 하',  name: 'Intermediate Low',        nameKo: '중급 하',   scoreMin: 51, scoreMax: 60 },
  { level: 7,  cefr: 'B1 상',  name: 'Intermediate High',       nameKo: '중급 상',   scoreMin: 61, scoreMax: 70 },
  { level: 8,  cefr: 'B2 하',  name: 'Upper-Intermediate Low',  nameKo: '중상급 하', scoreMin: 71, scoreMax: 80 },
  { level: 9,  cefr: 'B2 상',  name: 'Upper-Intermediate High', nameKo: '중상급 상', scoreMin: 81, scoreMax: 90 },
  { level: 10, cefr: 'C1+',    name: 'Advanced',                nameKo: '고급',      scoreMin: 91, scoreMax: 100 },
] as const

export type LevelEntry = (typeof LEVELS)[number]

export const LEVEL_UP_THRESHOLDS = [
  { from: 1,  to: 2,  requiredAvg: 15 },
  { from: 2,  to: 3,  requiredAvg: 25 },
  { from: 3,  to: 4,  requiredAvg: 35 },
  { from: 4,  to: 5,  requiredAvg: 45 },
  { from: 5,  to: 6,  requiredAvg: 55 },
  { from: 6,  to: 7,  requiredAvg: 65 },
  { from: 7,  to: 8,  requiredAvg: 75 },
  { from: 8,  to: 9,  requiredAvg: 85 },
  { from: 9,  to: 10, requiredAvg: 93 },
] as const

// 레벨별 배지 색상
export const LEVEL_COLORS = {
  1:  { bg: 'bg-gray-100',   text: 'text-gray-600',   border: 'border-gray-300' },
  2:  { bg: 'bg-gray-200',   text: 'text-gray-700',   border: 'border-gray-400' },
  3:  { bg: 'bg-green-100',  text: 'text-green-700',  border: 'border-green-300' },
  4:  { bg: 'bg-green-200',  text: 'text-green-800',  border: 'border-green-400' },
  5:  { bg: 'bg-blue-100',   text: 'text-blue-700',   border: 'border-blue-300' },
  6:  { bg: 'bg-blue-200',   text: 'text-blue-800',   border: 'border-blue-400' },
  7:  { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-300' },
  8:  { bg: 'bg-purple-200', text: 'text-purple-800', border: 'border-purple-400' },
  9:  { bg: 'bg-amber-100',  text: 'text-amber-800',  border: 'border-amber-400' },
  10: { bg: 'bg-amber-400',  text: 'text-white',      border: 'border-amber-500' },
} as const

// ── 유틸 함수 ──────────────────────────────────────────────────────────────────

export function getLevelInfo(level: number): LevelEntry {
  return LEVELS.find((l) => l.level === level) ?? LEVELS[0]
}

export function scoreToLevel(score: number): number {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (score >= LEVELS[i].scoreMin) return LEVELS[i].level
  }
  return 1
}

export function getLevelFromScore(score: number): LevelEntry {
  return getLevelInfo(scoreToLevel(score))
}

// CEFR 레벨 목록 (문제 뱅크·테스트 폼에서 사용)
export const CEFR_LEVEL_LIST = [
  'Pre-A1',
  'A1 하',
  'A1 상',
  'A2 하',
  'A2 상',
  'B1 하',
  'B1 상',
  'B2 하',
  'B2 상',
  'C1+',
] as const

// level number → CEFR string 매핑
export const LEVEL_TO_CEFR: Record<number, string> = Object.fromEntries(
  LEVELS.map((l) => [l.level, l.cefr]),
)
