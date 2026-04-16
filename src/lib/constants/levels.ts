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

// ── 난이도 가중 점수 계산 ─────────────────────────────────────────────────────

/**
 * 문제 난이도를 고려하여 정답률을 레벨 추정 점수로 변환.
 *
 * 원리: 쉬운 문제(difficulty 1~3)를 100% 맞춰도 높은 레벨이 될 수 없음.
 * - 각 문제의 난이도를 가중치로 사용하여, 어려운 문제를 맞힐수록 높은 점수를 받음.
 * - 오답은 페널티 없이 단순히 가중치에 포함되지 않음.
 * - 최종 점수는 0~100 범위로 정규화됨.
 *
 * @param questions - 각 문제의 난이도(1~10)와 정답 여부
 * @returns 0~100 범위의 난이도 가중 점수
 */
export function difficultyWeightedScore(
  questions: { difficulty: number; isCorrect: boolean }[],
): number {
  if (questions.length === 0) return 0

  // 맞힌 문제의 난이도 합산 (난이도가 높을수록 가중치 큼)
  let weightedCorrect = 0
  let maxPossible = 0

  for (const q of questions) {
    // 난이도 가중치: difficulty 그대로 사용 (1~10)
    maxPossible += q.difficulty
    if (q.isCorrect) {
      weightedCorrect += q.difficulty
    }
  }

  if (maxPossible === 0) return 0

  // 가중 정답률 (0~1)
  const weightedRate = weightedCorrect / maxPossible

  // 평균 난이도에 따른 천장 점수 계산
  // 평균 난이도가 3이면 최대 30점(=Level 3), 7이면 최대 70점(=Level 7)
  const avgDifficulty = questions.reduce((s, q) => s + q.difficulty, 0) / questions.length
  const ceiling = avgDifficulty * 10 // difficulty 1~10 → ceiling 10~100

  // 최종 점수 = 가중 정답률 × 천장 점수
  const score = Math.round(weightedRate * ceiling)

  return Math.max(0, Math.min(100, score))
}

/**
 * 난이도 가중 점수를 기반으로 레벨을 추정.
 * scoreToLevel()의 난이도 인식 버전.
 */
export function difficultyWeightedLevel(
  questions: { difficulty: number; isCorrect: boolean }[],
): number {
  return scoreToLevel(difficultyWeightedScore(questions))
}

// ── 학년 기반 레벨 상한선 ─────────────────────────────────────────────────────

/**
 * 학년(grade)에 따른 기대 최대 레벨.
 * 해당 학년에서 도달할 수 있는 현실적 상한선.
 * 이 상한선은 "일반 테스트"에서의 레벨 추정에만 적용됨.
 * 적응형 레벨 테스트에서는 적용하지 않음 (실력이 뛰어난 학생 허용).
 */
export const GRADE_LEVEL_CAPS: Record<string, number> = {
  // 초등학교
  '초1': 3, '초2': 3, '초3': 4, '초4': 5, '초5': 6, '초6': 6,
  // 중학교
  '중1': 7, '중2': 8, '중3': 8,
  // 고등학교
  '고1': 9, '고2': 10, '고3': 10,
  // 성인/기타
  '성인': 10,
}

/**
 * 학년 문자열로부터 레벨 상한선을 반환.
 * 매칭되지 않으면 10(제한 없음)을 반환.
 */
export function getGradeLevelCap(grade: string | null | undefined): number {
  if (!grade) return 10
  return GRADE_LEVEL_CAPS[grade] ?? 10
}
