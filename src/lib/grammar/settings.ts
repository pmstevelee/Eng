// 학원 문법학습 설정 (Academy.settingsJson.grammarLearning) 파서 — 서버·클라이언트 공용
//
// 범위를 벗어나거나 형식이 틀린 값은 기본값(constants.ts)으로 대체한다.
// vitest로 테스트하므로 @/ 경로를 쓰지 않는다.

import { MASTERY_REVIEW_STREAK, MASTERY_REVIEW_STREAK_RANGE, PASS_SCORE, PASS_SCORE_RANGE } from './constants'

export interface GrammarLearningSettings {
  /** 확인 테스트·복습 통과 점수(%) — 60~100 */
  passScore: number
  /** 숙달에 필요한 포인트 복습 연속 통과 횟수 — 1~3 */
  masteryReviewStreak: number
}

export const DEFAULT_GRAMMAR_LEARNING_SETTINGS: GrammarLearningSettings = {
  passScore: PASS_SCORE,
  masteryReviewStreak: MASTERY_REVIEW_STREAK,
}

function readObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function intInRange(value: unknown, range: { min: number; max: number }, fallback: number): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= range.min && value <= range.max
    ? value
    : fallback
}

export function parseGrammarLearningSettings(settingsJson: unknown): GrammarLearningSettings {
  const gl = readObject(readObject(settingsJson).grammarLearning)
  return {
    passScore: intInRange(gl.passScore, PASS_SCORE_RANGE, PASS_SCORE),
    masteryReviewStreak: intInRange(gl.masteryReviewStreak, MASTERY_REVIEW_STREAK_RANGE, MASTERY_REVIEW_STREAK),
  }
}
