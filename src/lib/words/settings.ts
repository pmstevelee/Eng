// 학원 단어학습 설정 (Academy.settingsJson.wordLearning) 파서 — 서버·클라이언트 공용

export const DEFAULT_DAILY_NEW_WORDS = 10
export const DEFAULT_DAILY_GRAMMAR_QUESTIONS = 5
export const GRAMMAR_QUESTIONS_RANGE = { min: 3, max: 20 } as const

export interface WordLearningSettings {
  /** 하루 신규 단어 수 (오늘의 단어학습 자동 생성량) */
  dailyNewWords: number
  /** 오늘의 학습 문법 문제 수 */
  dailyGrammarQuestions: number
  /** 전체(타 학원 포함) 랭킹 참여·공개 여부 */
  globalRanking: boolean
}

function readObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

export function parseWordLearningSettings(settingsJson: unknown): WordLearningSettings {
  const wl = readObject(readObject(settingsJson).wordLearning)
  const dailyNewWords =
    typeof wl.dailyNewWords === 'number' && wl.dailyNewWords > 0 ? wl.dailyNewWords : DEFAULT_DAILY_NEW_WORDS
  const grammar =
    typeof wl.dailyGrammarQuestions === 'number' &&
    wl.dailyGrammarQuestions >= GRAMMAR_QUESTIONS_RANGE.min &&
    wl.dailyGrammarQuestions <= GRAMMAR_QUESTIONS_RANGE.max
      ? wl.dailyGrammarQuestions
      : DEFAULT_DAILY_GRAMMAR_QUESTIONS
  return {
    dailyNewWords,
    dailyGrammarQuestions: grammar,
    globalRanking: wl.globalRanking !== false,
  }
}

export const DAILY_NEW_WORDS_RANGE = { min: 1, max: 100 } as const

/** 학생이 직접 정한 값이 있으면 우선하고, 없으면 학원 설정값을 쓴다 (무료 플랜 상한은 호출부에서 적용) */
export function resolveDailyNewWords(academyValue: number, studentOverride: number | null | undefined): number {
  if (typeof studentOverride === 'number' && studentOverride >= DAILY_NEW_WORDS_RANGE.min) {
    return Math.min(studentOverride, DAILY_NEW_WORDS_RANGE.max)
  }
  return academyValue
}
